import { useState, useEffect } from 'react'
import { VictimTable } from '../admin/VictimTable'
import { CheckCircle, XCircle, Users, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getNetworkOnline } from '../../lib/capacitor'
import { useAuthStore } from '../../store/auth'

// ── Acknowledgment Panel ──────────────────────────────────────────────────────
// Shows agency-level acknowledgment actions for each pending SOS.
// Displayed as a collapsible card above the main VictimTable.

function AcknowledgmentPanel({ agencyType, agencyId }) {
  const [pendingSOS, setPendingSOS] = useState([])
  const [loading,    setLoading]    = useState(false)
  const [actioning,  setActioning]  = useState(null)
  const [expanded,   setExpanded]   = useState(true)
  const isOnline = getNetworkOnline()
  const { scope }  = useAuthStore()
  const muni = scope?.municipality

  async function load() {
    if (!isOnline || !agencyType) return
    setLoading(true)
    try {
      let q = supabase
        .from('sos_reports')
        .select('id,barangay,municipality,status,rescue_status,service_type,created_at,name')
        .contains('service_type', [agencyType])
        .eq('rescue_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20)
      if (muni) q = q.eq('municipality', muni)
      const { data } = await q
      setPendingSOS(data ?? [])
    } catch (err) {
      console.error('[AcknowledgmentPanel] load failed:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [agencyType, muni])

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
          {pendingSOS.map(sos => (
            <div key={sos.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  SOS #{sos.id} · {sos.name ?? 'Guest'}
                </p>
                <p className="text-xs text-slate-500">
                  {sos.barangay ?? '—'} · {new Date(sos.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
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
              </div>
            </div>
          ))}
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
    <div className="flex flex-col h-full">
      <AcknowledgmentPanel agencyType={agencyType} agencyId={agencyId} />
      <VictimTable />
    </div>
  )
}
