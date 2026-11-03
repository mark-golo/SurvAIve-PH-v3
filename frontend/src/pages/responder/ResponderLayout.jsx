import { useState, useEffect, useRef, useCallback } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useAlertStore } from '../../store/alertStore'
import { supabase } from '../../lib/supabase'
import api, { localFetch } from '../../lib/api'

function playAlarmTone(vol, audioCtxRef) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    audioCtxRef.current = ctx
    let t = ctx.currentTime
    for (let i = 0; i < 3; i++) {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'square'
      osc.frequency.setValueAtTime(880, t)
      osc.frequency.setValueAtTime(660, t + 0.15)
      gain.gain.setValueAtTime(vol * 0.55, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42)
      osc.start(t)
      osc.stop(t + 0.42)
      t += 0.62
    }
  } catch { /* blocked by browser autoplay policy */ }
}

export function ResponderLayout() {
  const navigate = useNavigate()
  const { scope } = useAuthStore()
  const muni = scope?.municipality

  const { soundEnabled, visualEnabled, notificationEnabled, volume } = useAlertStore()

  const [alertQueue,  setAlertQueue]  = useState([])
  const [alertActive, setAlertActive] = useState(false)
  const [muteActive,  setMuteActive]  = useState(false)

  const audioCtxRef      = useRef(null)
  const soundIntervalRef = useRef(null)
  const seenIdsRef       = useRef(new Set())
  const muteActiveRef    = useRef(false)

  // Keep muteActiveRef in sync so triggerAlert can read it synchronously
  useEffect(() => { muteActiveRef.current = muteActive }, [muteActive])

  // Clean up sound/visual when the last alert is dismissed or muted
  useEffect(() => {
    if (alertQueue.length > 0) return
    setAlertActive(false)
    muteActiveRef.current = false
    setMuteActive(false)
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current)
      soundIntervalRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
  }, [alertQueue.length])

  const triggerAlert = useCallback((entry) => {
    setAlertQueue(q => [...q, entry])
    // Read muteActive via ref — pure, no side effects inside a state updater
    if (!muteActiveRef.current) {
      if (visualEnabled) setAlertActive(true)
      if (soundEnabled) {
        playAlarmTone(volume, audioCtxRef)
        if (!soundIntervalRef.current) {
          soundIntervalRef.current = setInterval(() => {
            playAlarmTone(volume, audioCtxRef)
          }, 2800)
        }
      }
    }
  }, [visualEnabled, soundEnabled, volume])

  const acknowledgeAlert = useCallback((id) => {
    api.put('/sos/' + id, { rescue_status: 'acknowledged' }).catch(() => {})
    navigate(`/responder/rescue/${id}`)
    // Cleanup is handled by the alertQueue.length effect when the queue empties
    setAlertQueue(prev => prev.filter(a => a.id !== id))
  }, [navigate])

  const muteCurrentAlert = useCallback(() => {
    muteActiveRef.current = true
    setMuteActive(true)
    setAlertActive(false)
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current)
      soundIntervalRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
  }, [])

  // Expose to ResponderSettings via window refs
  useEffect(() => {
    window.__triggerTestAlert = () => triggerAlert({
      id:           'test-' + Date.now(),
      name:         'Test Alert',
      barangay:     'Test Barangay',
      municipality: '',
      ts:           new Date().toLocaleTimeString(),
    })
    window.__muteCurrentAlert = muteCurrentAlert
    return () => {
      delete window.__triggerTestAlert
      delete window.__muteCurrentAlert
    }
  }, [triggerAlert, muteCurrentAlert])

  // Supabase Realtime — immediate notification for new SOS
  useEffect(() => {
    const ch = supabase.channel('responder-sos-alert')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sos_reports' },
        payload => {
          const r = payload.new
          const norm = s => s?.toLowerCase().trim() ?? ''
          if (muni && r.municipality && norm(r.municipality) !== norm(muni)) return
          if (seenIdsRef.current.has(r.id)) return
          seenIdsRef.current.add(r.id)
          triggerAlert({
            id:           r.id,
            name:         r.name ?? 'Unknown',
            barangay:     r.barangay ?? '—',
            municipality: r.municipality ?? '',
            ts:           new Date().toLocaleTimeString(),
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [muni, triggerAlert])

  // Polling fallback — catches SOS that bypass Realtime (< 2 min old).
  // Queries Supabase and XAMPP PHP independently so either source failing
  // (e.g. no internet on local hotspot, or XAMPP not running) doesn't block
  // the other. api.get() is NOT used here because it throws before reaching
  // its own MySQL fallback when Supabase is unreachable.
  useEffect(() => {
    const norm = s => s?.toLowerCase().trim() ?? ''

    async function fetchAndProcess() {
      const rows = []
      const fetched = new Set()

      // Source 1: Supabase (works when internet is available)
      try {
        const { data } = await supabase
          .from('sos_reports')
          .select('id, name, barangay, municipality, created_at, timestamp')
          .order('created_at', { ascending: false })
          .limit(100)
        ;(data ?? []).forEach(r => { fetched.add(r.id); rows.push(r) })
      } catch {}

      // Source 2: XAMPP PHP (works on local hotspot when internet is unavailable)
      try {
        const raw = await localFetch('sos')
        ;(Array.isArray(raw) ? raw : [])
          .filter(r => !fetched.has(r.id))
          .forEach(r => rows.push(r))
      } catch {}

      rows.forEach(r => {
        if (seenIdsRef.current.has(r.id)) return
        // Case-insensitive municipality filter — avoids silent drop on casing/spacing mismatch
        if (muni && r.municipality && norm(r.municipality) !== norm(muni)) return
        seenIdsRef.current.add(r.id)
        const ts  = r.created_at ?? r.timestamp ?? null
        const age = ts ? Date.now() - new Date(ts).getTime() : Infinity
        if (age < 120_000) {
          triggerAlert({
            id:           r.id,
            name:         r.name ?? 'Unknown',
            barangay:     r.barangay ?? '—',
            municipality: r.municipality ?? '',
            ts:           new Date().toLocaleTimeString(),
          })
        }
      })
    }

    fetchAndProcess()
    const poll = setInterval(fetchAndProcess, 10_000)
    return () => clearInterval(poll)
  }, [muni, triggerAlert])

  return (
    <>
      <Outlet />

      {/* Red screen pulse overlay */}
      <AnimatePresence>
        {alertActive && visualEnabled && (
          <motion.div
            key="resp-sos-pulse"
            className="fixed inset-0 z-[9998] pointer-events-none"
            style={{ background: 'rgba(239,68,68,0.18)' }}
            animate={{ opacity: [0, 0.85, 0] }}
            transition={{ duration: 1.1, ease: 'easeInOut', repeat: Infinity }}
          />
        )}
      </AnimatePresence>

      {/* Notification toast cards */}
      {notificationEnabled && alertQueue.length > 0 && (
        <div className="fixed top-4 right-4 z-[9999] space-y-2 w-80 pointer-events-none">
          <AnimatePresence>
            {alertQueue.slice(0, 3).map((alert, i) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: -16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: -8 }}
                transition={{ duration: 0.2 }}
                className="pointer-events-auto rounded-2xl border border-[rgba(239,68,68,0.45)] bg-[rgba(12,3,3,0.93)] backdrop-blur-xl shadow-2xl p-4"
                style={{ boxShadow: '0 0 36px rgba(239,68,68,0.22), 0 8px 32px rgba(0,0,0,0.6)' }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Bell size={13} className="text-[#ef4444] animate-bounce shrink-0" />
                  <p className="text-[11px] font-black text-[#ef4444] uppercase tracking-widest">New SOS Alert</p>
                  {i === 0 && alertQueue.length > 1 && (
                    <span className="ml-auto text-[10px] font-bold text-[#f97316] shrink-0">
                      +{alertQueue.length - 1} queued
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 mb-0.5">Critical emergency request received.</p>
                <p className="text-[11px] text-slate-400">
                  <span className="text-white font-semibold">{alert.name}</span>
                  {' · '}{alert.barangay}
                  {alert.municipality ? ` · ${alert.municipality}` : ''}
                </p>
                <p className="text-[10px] text-slate-600 mt-0.5">{alert.ts}</p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="flex-1 py-1.5 rounded-xl text-[11px] font-bold bg-gradient-to-r from-[#ef4444] to-[#f97316] text-white hover:opacity-90 transition-all"
                  >
                    Acknowledge SOS
                  </button>
                  <button
                    onClick={muteCurrentAlert}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-slate-400 border border-[rgba(255,255,255,0.1)] hover:text-white hover:border-[rgba(255,255,255,0.2)] transition-all"
                  >
                    Mute
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </>
  )
}
