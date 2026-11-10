import { useState, useEffect } from 'react'
import { getResponderTheme } from '../../lib/victimTheme'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Users, Phone, Navigation, CheckCircle, XCircle, AlertTriangle, UserCheck, Home, List, Map, Radio, Settings } from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { NeonButton } from '../../components/ui/NeonButton'
import { GlassTextarea } from '../../components/ui/GlassInput'
import api from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { getNetworkOnline } from '../../lib/capacitor'
import { fmtSosId } from '../../lib/format'


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
  { icon: Radio,    label: 'Mesh',     path: '/responder/relay'    },
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
