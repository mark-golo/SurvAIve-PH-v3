import { useState, useEffect, useMemo } from 'react'
import { VictimTable } from '../admin/VictimTable'
import { CheckCircle, XCircle, Users, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getNetworkOnline } from '../../lib/capacitor'
import { useAuthStore } from '../../store/auth'
import { fmtSosId } from '../../lib/format'
import api from '../../lib/api'
import { assessDelay, tierColor, tierLabel } from '../../lib/ai/erdiEngine'
import { ERDIPanel } from '../../components/ui/ERDIPanel'
import { fetchWeather } from '../../lib/weatherService'

// ── Acknowledgment Panel ──────────────────────────────────────────────────────
// Shows agency-level acknowledgment actions for each pending SOS.
// Displayed as a collapsible card above the main VictimTable.

function AcknowledgmentPanel({ agencyType, agencyId }) {
  const [pendingSOS,  setPendingSOS]  = useState([])
  const [loading,     setLoading]     = useState(false)
  const [actioning,   setActioning]   = useState(null)
  const [expanded,    setExpanded]    = useState(true)
  const [expandedId,  setExpandedId]  = useState(null)
  const [erdiWeather, setErdiWeather] = useState(null)
  const [onDutyCount, setOnDutyCount] = useState(0)
  const [eventsCache, setEventsCache] = useState({})
  const isOnline = getNetworkOnline()
  const { scope }  = useAuthStore()
  const muni = scope?.municipality

  async function load() {
    if (!isOnline || !agencyType) return
    setLoading(true)
    try {
      // Exclude SOS already actioned by this agency type (any status).
      // This ensures acknowledged/unable_to_respond SOS don't reappear after navigation.
      const { data: actioned } = await supabase
        .from('sos_response_assignments')
        .select('sos_id')
        .eq('agency_type', agencyType)
      const actionedIds = (actioned ?? []).map(r => r.sos_id)

      let q = supabase
        .from('sos_reports')
        .select('id,barangay,municipality,status,rescue_status,service_type,created_at,name')
        .contains('service_type', [agencyType])
        .eq('rescue_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20)
      if (muni) q = q.eq('municipality', muni)
      if (actionedIds.length > 0) q = q.not('id', 'in', `(${actionedIds.join(',')})`)
      const { data } = await q
      setPendingSOS(data ?? [])
    } catch (err) {
      console.error('[AcknowledgmentPanel] load failed:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [agencyType, muni])

  // Fetch weather once (using first SOS with coords) for ERDI assessments
  useEffect(() => {
    if (!pendingSOS.length) return
    const ref = pendingSOS.find(s => s.lat && s.lng)
    if (!ref) return
    fetchWeather(ref.lat, ref.lng).then(setErdiWeather).catch(() => {})
  }, [pendingSOS])

  // Fetch on-duty responder count for agencyContext
  useEffect(() => {
    if (!agencyId || !muni) return
    supabase.from('responders')
      .select('id', { count: 'exact', head: true })
      .eq('duty_status', 'on_duty')
      .eq('municipality', muni)
      .then(({ count }) => setOnDutyCount(count ?? 0))
      .catch(() => {})
  }, [agencyId, muni])

  const agencyCtx = useMemo(() => ({
    onDutyCount,
    activeLoad: pendingSOS.length,
  }), [onDutyCount, pendingSOS.length])

  function expandRow(sosId) {
    setExpandedId(id => id === sosId ? null : sosId)
    if (eventsCache[sosId] !== undefined) return
    supabase.from('sos_status_events')
      .select('status,created_at')
      .eq('sos_id', sosId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setEventsCache(prev => ({ ...prev, [sosId]: data ?? [] })))
      .catch(() => {})
  }

  async function acknowledge(sosId, status, declineReason) {
    setActioning(sosId)
    try {
      const insertRow = {
        sos_id:           sosId,
        agency_type:      agencyType,
        status,
        acknowledged_at:  new Date().toISOString(),
        acknowledged_by:  'Agency',
        ...(declineReason ? { decline_reason: declineReason } : {}),
      }
      const { error } = await supabase
        .from('sos_response_assignments')
        .upsert(insertRow, { onConflict: 'sos_id,agency_type' })
      if (error) throw error
      // For 'acknowledged': also update sos_reports.rescue_status so the VictimTable
      // reflects it and other agencies' panels won't show it as pending.
      // 'unable_to_respond' intentionally leaves rescue_status='pending' for other agencies.
      if (status === 'acknowledged') {
        api.put(`/sos/${sosId}`, { rescue_status: 'acknowledged' }).catch(() => {})
      }
      setPendingSOS(prev => prev.filter(r => r.id !== sosId))
    } catch (err) {
      console.error('[AcknowledgmentPanel] acknowledge failed:', err)
      alert('Action failed. Please try again.')
    } finally {
      setActioning(null)
    }
  }

  if (!isOnline || pendingSOS.length === 0) return null

  return (
    <div className="mx-4 mt-4 glass rounded-2xl border border-[rgba(0,212,255,0.2)] overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-[#00d4ff] uppercase tracking-wider">
        <span className="flex items-center gap-2">
          <Users size={13} />
          {pendingSOS.length} Pending Incident{pendingSOS.length !== 1 ? 's' : ''} — Awaiting Agency Action
        </span>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); load() }}
            className="text-slate-500 hover:text-[#00d4ff] transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          <span className="text-slate-500">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="divide-y divide-[rgba(255,255,255,0.05)]">
          {pendingSOS.map(sos => {
            const isExpanded = expandedId === sos.id
            const erdi = assessDelay(sos, eventsCache[sos.id] ?? [], null, erdiWeather, agencyCtx)
            return (
              <div key={sos.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => expandRow(sos.id)}
                  >
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-white truncate">
                        {fmtSosId(sos.id)} · {sos.name ?? 'Guest'}
                      </p>
                      {erdi.tier !== 'ON_TRACK' && (
                        <span className="text-[9px] font-bold shrink-0" style={{ color: tierColor(erdi.tier) }}>
                          {tierLabel(erdi.tier)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {sos.barangay ?? '—'} · {new Date(sos.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      disabled={actioning === sos.id}
                      onClick={() => acknowledge(sos.id, 'acknowledged')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-900/40 border border-green-700/40 text-green-400 text-xs font-semibold hover:bg-green-900/60 transition-all disabled:opacity-50">
                      <CheckCircle size={12} />
                      Acknowledge
                    </button>
                    <button
                      disabled={actioning === sos.id}
                      onClick={() => {
                        const reason = window.prompt('Reason for inability to respond (optional):') ?? ''
                        acknowledge(sos.id, 'unable_to_respond', reason || null)
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-700/30 text-red-400 text-xs font-semibold hover:bg-red-900/50 transition-all disabled:opacity-50">
                      <XCircle size={12} />
                      Unable
                    </button>
                    <button
                      onClick={() => expandRow(sos.id)}
                      className="text-slate-500 hover:text-[#00d4ff] transition-colors text-xs px-1"
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <ERDIPanel assessment={erdi} role="agency" className="mt-3" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export function AgencyVictimTable() {
  const { scope } = useAuthStore()
  const agencyType = scope?.agency_type
  const agencyId   = scope?.id ?? null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 max-h-64 overflow-y-auto">
        <AcknowledgmentPanel agencyType={agencyType} agencyId={agencyId} />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <VictimTable />
      </div>
    </div>
  )
}
