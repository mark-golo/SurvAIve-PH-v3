import { useState, useEffect, useRef } from 'react'
import { getResponderTheme } from '../../lib/victimTheme'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Users, Phone, Navigation, CheckCircle, XCircle, AlertTriangle, UserCheck, Home, List, Map, Sparkles, Settings, Radio } from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { NeonButton } from '../../components/ui/NeonButton'
import { GlassTextarea } from '../../components/ui/GlassInput'
import api from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { getNetworkOnline } from '../../lib/capacitor'
import { Geolocation } from '@capacitor/geolocation'
import { fmtSosId } from '../../lib/format'
import { fetchWeather } from '../../lib/weatherService'
import { assessDelay } from '../../lib/ai/erdiEngine'
import { ERDIPanel } from '../../components/ui/ERDIPanel'
import { AIReviewPanel } from '../../components/ui/AIReviewPanel'


const ACTIONS = [
  { label: 'En Route',     value: 'en_route',    variant: 'blue',   icon: Navigation  },
  { label: 'On Scene',     value: 'on_scene',    variant: 'orange', icon: MapPin      },
  { label: 'Rescued',      value: 'rescued',     variant: 'green',  icon: CheckCircle },
  { label: 'Cannot Reach', value: 'cannot_reach',variant: 'red',    icon: XCircle     },
]

const STATUS_MESSAGE = {
  en_route:     'Responder is en route to your location',
  on_scene:     'Responder has arrived on scene',
  rescued:      'Rescue / assistance completed',
  cannot_reach: 'Responder was unable to reach the location',
}

const NAV = [
  { icon: Home,     label: 'Home',     path: '/responder'          },
  { icon: List,     label: 'Queue',    path: '/responder/queue'    },
  { icon: Map,      label: 'Map',      path: '/responder/map'      },
  { icon: Sparkles, label: 'AI',       path: '/responder/assistant' },
  { icon: Settings, label: 'Settings', path: '/responder/settings' },
]

export function RescueDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [isLight] = useState(() => getResponderTheme() === 'light')

  const [victim, setVictim] = useState(null)
  const [rescueStatus, setRescueStatus] = useState('pending')
  const [notes, setNotes] = useState('')
  const [dataLoading, setDataLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [timer, setTimer] = useState(null)
  const [responderProfile, setResponderProfile] = useState(null)
  const [gpsStatus, setGpsStatus] = useState('inactive') // 'inactive'|'active'|'error'
  const watchIdRef  = useRef(null)
  const lastPushRef = useRef(0)
  const [sosEvents,     setSosEvents]     = useState([])
  const [weatherRisk,   setWeatherRisk]   = useState(null)
  const [erdiAssessment,setErdiAssessment]= useState(null)

  useEffect(() => {
    api.get(`/sos/${id}`)
      .then(row => {
        setVictim({
          id: row.id,
          name: row.name ?? 'Unknown',
          status: row.status,
          priority: row.priority ?? 'HIGH',
          people_count: row.people_count,
          barangay: row.barangay,
          lat: row.lat, lng: row.lng,
          notes: row.notes,
          contact: row.contact_number,
          vulnerabilities: Array.isArray(row.vulnerabilities) ? row.vulnerabilities : [],
          is_verified: !!row.is_verified,
          rescue_status: row.rescue_status,
          assigned_responder_id: row.assigned_responder_id ?? null,
          ai_priority_score:  row.ai_priority_score  ?? null,
          ai_classification:  row.ai_classification  ?? null,
          ai_confidence:      row.ai_confidence      ?? null,
          ai_rules_version:   row.ai_rules_version   ?? null,
          ai_review_status:   row.ai_review_status   ?? 'unreviewed',
          ai_review_note:     row.ai_review_note     ?? null,
          ai_reviewed_by:     row.ai_reviewed_by     ?? null,
          ai_reviewed_at:     row.ai_reviewed_at     ?? null,
        })
        setRescueStatus(row.rescue_status ?? 'pending')
        setNotes(row.notes || '')
      })
      .catch(() => setNotFound(true))
      .finally(() => setDataLoading(false))
  }, [id])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      const contact = authUser?.user_metadata?.contact_number
      if (!contact) return
      supabase.from('responders')
        .select('id,name,unit_name')
        .eq('contact_number', contact)
        .single()
        .then(({ data }) => { if (data) setResponderProfile(data) })
    })
  }, [])

  // Fetch sos_status_events for ERDI stage timing
  useEffect(() => {
    if (!id) return
    supabase
      .from('sos_status_events')
      .select('id,event_type,old_status,new_status,created_at,actor_role')
      .eq('sos_id', id)
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (data) setSosEvents(data) })
      .catch(() => {})
  }, [id, rescueStatus])

  // Fetch weather risk for ERDI (non-blocking)
  useEffect(() => {
    if (!victim?.lat || !victim?.lng) return
    fetchWeather(victim.lat, victim.lng)
      .then(w => setWeatherRisk(w))
      .catch(() => {})
  }, [victim?.lat, victim?.lng])

  // Recompute ERDI assessment
  useEffect(() => {
    if (!victim) return
    const report = { ...victim, ai_priority_score: victim.ai_priority_score ?? 60 }
    setErdiAssessment(assessDelay(report, sosEvents, responderProfile, weatherRisk))
  }, [victim?.rescue_status, sosEvents.length, weatherRisk])

  // GPS location sharing — active only when en_route or on_scene
  useEffect(() => {
    const isActive = rescueStatus === 'en_route' || rescueStatus === 'on_scene'

    if (!isActive) {
      if (watchIdRef.current != null) {
        Geolocation.clearWatch({ id: watchIdRef.current }).catch(() => {})
        watchIdRef.current = null
        setGpsStatus('inactive')
      }
      return
    }

    let cancelled = false
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (cancelled) return
      const contact = authUser?.user_metadata?.contact_number
      if (!contact) { setGpsStatus('error'); return }

      Geolocation.watchPosition({ enableHighAccuracy: true }, (pos, err) => {
        if (err || !pos) { setGpsStatus('error'); return }
        setGpsStatus('active')
        const now = Date.now()
        if (now - lastPushRef.current < 10_000) return // throttle: max once per 10 s
        lastPushRef.current = now
        supabase.from('responders')
          .update({
            lat:          pos.coords.latitude,
            lng:          pos.coords.longitude,
            last_seen_at: new Date().toISOString(),
          })
          .eq('contact_number', contact)
          .then(({ error }) => { if (error) console.warn('[RescueDetail] GPS push:', error.message) })
      }).then(wid => { if (!cancelled) watchIdRef.current = wid })
        .catch(() => setGpsStatus('error'))
    })

    return () => {
      cancelled = true
      if (watchIdRef.current != null) {
        Geolocation.clearWatch({ id: watchIdRef.current }).catch(() => {})
        watchIdRef.current = null
      }
    }
  }, [rescueStatus])

  const updateStatus = async (newStatus) => {
    const prevStatus = rescueStatus
    if (newStatus === 'on_scene') setTimer(Date.now())
    setRescueStatus(newStatus)
    if (victim?.id) {
      const payload = {
        rescue_status: newStatus,
        ...(responderProfile?.id && { assigned_responder_id: responderProfile.id }),
      }
      if (newStatus === 'rescued') {
        payload.confirmed_by_name = responderProfile?.name ?? null
        payload.confirmed_at = new Date().toISOString()
      }
      if (newStatus === 'acknowledged') {
        payload.confirmed_by_name = responderProfile?.name ?? 'responder'
      }
      try {
        await api.put(`/sos/${victim.id}`, payload)
        // Write status event to Supabase (online only — best-effort)
        if (getNetworkOnline()) {
          supabase.from('sos_status_events').insert({
            sos_id:             Number(victim.id),
            event_type:         `status_${newStatus}`,
            old_status:         prevStatus,
            new_status:         newStatus,
            actor_role:         'responder',
            actor_name_snapshot: responderProfile?.name ?? null,
            source:             'online',
            message:            STATUS_MESSAGE[newStatus] ?? newStatus,
            idempotency_key:    crypto.randomUUID(),
          }).then(({ error }) => { if (error) console.warn('[RescueDetail] event insert:', error.message) })
        }
      } catch {
        // local state already reflects the change; failure is surfaced by submitReport if needed
      }
    }
  }

  const acceptAssignment = async () => {
    if (!responderProfile?.id) return
    setSubmitting(true)
    try {
      await api.put(`/sos/${victim.id}`, { assigned_responder_id: responderProfile.id })
      setVictim(prev => ({ ...prev, assigned_responder_id: responderProfile.id }))
    } catch {
      alert('Could not accept assignment. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitReport = async () => {
    setSubmitting(true)
    try {
      await api.put(`/sos/${victim.id}`, {
        rescue_status: rescueStatus,
        notes,
        ...(responderProfile?.id && { assigned_responder_id: responderProfile.id }),
      })
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 3000)
    } catch {
      alert('Submit failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const elapsed = timer ? Math.floor((Date.now() - timer) / 1000) : null

  if (dataLoading) return (
    <div className={`min-h-screen bg-mesh flex flex-col pb-6${isLight ? ' light-theme' : ''}`}>
      <TopBar title="Rescue Detail" subtitle="Loading…" onBack />
      <div className="flex items-center justify-center flex-1 text-slate-400 text-sm">Loading…</div>
      <MobileNavBar items={NAV} />
    </div>
  )

  if (notFound || !victim) return (
    <div className={`min-h-screen bg-mesh flex flex-col pb-6${isLight ? ' light-theme' : ''}`}>
      <TopBar title="Rescue Detail" subtitle="Not found" onBack />
      <div className="flex items-center justify-center flex-1 text-slate-400 text-sm">Victim not found</div>
      <MobileNavBar items={NAV} />
    </div>
  )

  return (
    <div className={`min-h-screen bg-mesh flex flex-col${isLight ? ' light-theme' : ''}`}>
      <TopBar title="Rescue Detail" subtitle={`SOS ${fmtSosId(victim.id)}`} onBack />

      <main className="flex-1 p-4 pb-nav space-y-4">
        {/* Priority banner */}
        <div className={`glass rounded-xl p-3 border ${
          victim.priority === 'CRITICAL' ? 'border-[rgba(239,68,68,0.5)]' :
          victim.priority === 'HIGH'     ? 'border-[rgba(249,115,22,0.5)]' :
          'border-[rgba(245,158,11,0.5)]'
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-[#ef4444] shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <StatusBadge status={victim.priority} pulse />
                {victim.is_verified
                  ? <span className="text-[10px] text-[#00d4ff] font-medium">✓ Verified</span>
                  : <span className="text-[10px] text-[#f59e0b] font-medium">⚠ Guest</span>
                }
              </div>
              <p className="font-bold text-white mt-1">{victim.name}</p>
            </div>
          </div>
        </div>

        {/* Victim details */}
        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Victim Information</p>
          <div className="space-y-2.5">
            <Detail icon={MapPin}  label="Location"   value={`${victim.barangay} · ${victim.lat?.toFixed(4)}, ${victim.lng?.toFixed(4)}`} />
            <Detail icon={Users}   label="People"     value={`${victim.people_count} person(s)`} />
            <Detail icon={AlertTriangle} label="Status" value={victim.status} />
            {victim.contact && <Detail icon={Phone} label="Contact" value={victim.contact} />}
          </div>
          {victim.vulnerabilities?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {victim.vulnerabilities.map(v => (
                <span key={v} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[#ef4444]">
                  {v}
                </span>
              ))}
            </div>
          )}
          {victim.notes && (
            <p className="mt-3 text-xs text-slate-400 italic border-t border-[rgba(255,255,255,0.06)] pt-3">
              "{victim.notes}"
            </p>
          )}
        </GlassCard>

        {/* Rescue status */}
        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Rescue Actions</p>

          {/* GPS location-sharing status badge */}
          {(rescueStatus === 'en_route' || rescueStatus === 'on_scene') && (
            <div className={`mb-3 flex items-center gap-2 text-xs px-3 py-2 rounded-xl border ${
              gpsStatus === 'active'
                ? 'border-green-500/30 bg-green-900/10 text-green-400'
                : gpsStatus === 'error'
                  ? 'border-amber-500/30 bg-amber-900/10 text-amber-400'
                  : 'border-slate-700/40 bg-slate-800/20 text-slate-500'
            }`}>
              <Radio size={12} className={gpsStatus === 'active' ? 'animate-pulse' : ''} />
              {gpsStatus === 'active'
                ? 'Location Sharing Active'
                : gpsStatus === 'error'
                  ? 'GPS Unavailable'
                  : 'Starting location sharing…'}
            </div>
          )}

          {/* Accept Assignment — links this responder to the report */}
          <button
            onClick={acceptAssignment}
            disabled={submitting || !responderProfile}
            className={`w-full mb-3 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all border ${
              victim?.assigned_responder_id === responderProfile?.id
                ? 'bg-[#00d4ff] border-[#00d4ff] text-black'
                : 'bg-[rgba(0,212,255,0.08)] border-[rgba(0,212,255,0.3)] text-[#00d4ff] hover:bg-[rgba(0,212,255,0.16)] active:scale-[0.98]'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <UserCheck size={14} />
            {submitting ? 'Accepting…' : victim?.assigned_responder_id === responderProfile?.id ? 'Assignment Accepted' : 'Accept Assignment'}
          </button>

          {/* Acknowledge SOS — full-width prominence button above the action grid */}
          <button
            onClick={() => updateStatus('acknowledged')}
            className={`w-full mb-2 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all border ${
              rescueStatus === 'acknowledged'
                ? 'bg-amber-400 border-amber-400 text-black'
                : 'bg-[rgba(245,158,11,0.08)] border-[rgba(245,158,11,0.3)] text-amber-400 hover:bg-[rgba(245,158,11,0.16)] active:scale-[0.98]'
            }`}
          >
            <CheckCircle size={14} />
            Acknowledge SOS
          </button>
          <div className="grid grid-cols-2 gap-2">
            {ACTIONS.map(({ label, value, variant, icon: Icon }) => (
              <NeonButton
                key={value}
                variant={rescueStatus === value ? variant : 'ghost'}
                onClick={() => updateStatus(value)}
                className="flex items-center justify-center gap-2"
                size="sm"
              >
                <Icon size={13} />
                {label}
              </NeonButton>
            ))}
          </div>
          {rescueStatus && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <p className="text-xs text-slate-500">Current:</p>
              {victim?.assigned_responder_id === responderProfile?.id && (
                <StatusBadge status="ACCEPTED" />
              )}
              <StatusBadge status={rescueStatus.toUpperCase().replace('_', ' ')} pulse={rescueStatus === 'en_route'} />
              {elapsed && <p className="text-xs text-slate-500">On scene {elapsed}s</p>}
            </div>
          )}
        </GlassCard>

        {/* Field notes */}
        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Field Notes</p>
          <GlassTextarea
            placeholder="Describe the scene, actions taken, equipment used…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </GlassCard>

        {/* ERDI — delay intelligence (hidden after rescue/cannot_reach) */}
        {erdiAssessment && !['rescued','cannot_reach'].includes(rescueStatus) && (
          <ERDIPanel assessment={erdiAssessment} role="responder" />
        )}

        {/* AI Review — human validation of AI assessment (hidden after rescue/cannot_reach) */}
        {victim && !['rescued','cannot_reach'].includes(rescueStatus) && (
          <AIReviewPanel
            report={victim}
            reviewerName={responderProfile?.name ?? 'Responder'}
            onReviewed={fields => setVictim(v => ({ ...v, ...fields }))}
          />
        )}

        {/* Submit report — hidden for already-completed rescues */}
        {victim?.rescue_status !== 'rescued' && (
          <NeonButton
            variant={submitted ? 'green' : 'violet'}
            onClick={submitReport}
            disabled={submitting}
            className="w-full"
          >
            {submitted ? 'Submitted' : submitting ? 'Submitting…' : 'Submit Report'}
          </NeonButton>
        )}
      </main>
      <MobileNavBar items={NAV} />
    </div>
  )
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} className="text-slate-500 mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-white">{value}</p>
      </div>
    </div>
  )
}
