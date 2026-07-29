import { useState, useEffect } from 'react'
import { Radio, MapPin } from 'lucide-react'
import { AdminLayout } from './AdminLayout'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'

const RESCUE_STATUS = {
  on_scene:     { label: 'On Scene',     color: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
  en_route:     { label: 'En Route',     color: '#00d4ff', bg: 'rgba(0,212,255,0.15)'   },
  cannot_reach: { label: 'Cannot Reach', color: '#ef4444', bg: 'rgba(239,68,68,0.15)'   },
  rescued:      { label: 'Rescued',      color: '#22c55e', bg: 'rgba(34,197,94,0.15)'   },
  pending:      { label: 'Pending',      color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
}

const SORT_ORDER = { on_scene: 0, en_route: 1, cannot_reach: 2, rescued: 3, pending: 4 }

export function RespondersView() {
  const { scope } = useAuthStore()
  const muni = scope?.municipality

  const [responders, setResponders] = useState([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState(null)

  const [sosReports, setSosReports] = useState([])
  const [sosLoading, setSosLoading] = useState(true)

  // Fetch responders
  useEffect(() => {
    const q = muni ? `/responders?municipality=${encodeURIComponent(muni)}` : '/responders'
    api.get(q).then(setResponders).catch(() => setResponders([])).finally(() => setLoading(false))
  }, [])

  // Fetch SOS reports (rescue status feed)
  useEffect(() => {
    const q = muni ? `/sos?municipality=${encodeURIComponent(muni)}` : '/sos'
    api.get(q).then(setSosReports).catch(() => setSosReports([])).finally(() => setSosLoading(false))
  }, [])

  // Realtime: update rescue status when responder submits a report
  useEffect(() => {
    const ch = supabase.channel('rv-sos-status')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sos_reports' },
        payload => {
          const r = payload.new
          if (muni && r.municipality !== muni) return
          setSosReports(prev => prev.map(x =>
            x.id === r.id
              ? { ...x, rescue_status: r.rescue_status, notes: r.notes, assigned_responder_id: r.assigned_responder_id }
              : x
          ))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const sortedReports = sosReports
    .slice()
    .sort((a, b) =>
      (SORT_ORDER[a.rescue_status ?? 'pending'] ?? 4) -
      (SORT_ORDER[b.rescue_status ?? 'pending'] ?? 4)
    )

  return (
    <AdminLayout title="Rescue Updates">
      <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)]">

        {/* LEFT — Rescue Status Feed */}
        <div className="flex-1 overflow-y-auto p-4 border-b lg:border-b-0 lg:border-r border-[rgba(255,255,255,0.08)]">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Rescue Status Feed</p>

          {sosLoading && <p className="text-sm text-slate-500 text-center py-8">Loading…</p>}

          {!sosLoading && sortedReports.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">No SOS reports found</p>
          )}

          {sortedReports.map(r => {
            const rs = RESCUE_STATUS[r.rescue_status ?? 'pending']
            const teamName = r.assigned_responder_id
              ? (responders.find(t => t.id === r.assigned_responder_id)?.name ?? null)
              : null
            return (
              <div key={r.id} className="glass rounded-xl p-3 mb-2 border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-white truncate pr-2">{r.name ?? 'Anonymous'}</p>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{ color: rs.color, background: rs.bg }}
                  >
                    {rs.label}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">{r.barangay}{r.municipality ? ` · ${r.municipality}` : ''}</p>
                {teamName && (
                  <p className="text-[10px] text-[#00d4ff] mt-0.5 font-medium">Submitted by: {teamName}</p>
                )}
                {r.notes && (
                  <p className="text-[10px] text-slate-400 mt-1.5 italic border-t border-[rgba(255,255,255,0.05)] pt-1.5">
                    "{r.notes}"
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* RIGHT — Rescue Teams */}
        <aside className="w-full lg:w-72 glass border-t lg:border-t-0 lg:border-l border-[rgba(255,255,255,0.08)] p-4 space-y-3 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rescue Teams</p>

          {loading && <p className="text-sm text-slate-500 text-center py-8">Loading…</p>}

          {!loading && responders.length === 0 && (
            <div className="text-center py-8">
              <Radio size={24} className="text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No responders found</p>
            </div>
          )}

          {responders.map(r => (
            <div key={r.id} onClick={() => setSelected(selected === r.id ? null : r.id)}
              className={`glass rounded-xl p-3 cursor-pointer transition-all border ${
                selected === r.id ? 'border-[rgba(0,212,255,0.4)]' : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)]'
              }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2.5 h-2.5 rounded-full ${r.duty_status === 'on_duty' ? 'bg-[#22c55e] animate-pulse' : 'bg-slate-500'}`} />
                <p className="text-sm font-semibold text-white">{r.name}</p>
                <StatusBadge status={r.duty_status === 'on_duty' ? 'ACTIVE' : 'STANDBY'} className="ml-auto" />
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <p className="flex items-center gap-1"><MapPin size={10} /> {r.assigned_zone ?? '—'}</p>
                <p className="flex items-center gap-1">
                  <Radio size={10} className={r.active_mesh_relay ? 'text-[#22c55e]' : ''} />
                  {r.active_mesh_relay ? 'Relay Active' : 'Relay Off'}
                </p>
              </div>
              {selected === r.id && (
                <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                  <p className="text-[10px] text-slate-500 mb-2">Assign to zone:</p>
                  <div className="flex gap-2 flex-wrap">
                    {['Zone 1', 'Zone 2', 'Zone 3'].map(z => (
                      <button key={z} onClick={e => {
                        e.stopPropagation()
                        setResponders(d => d.map(rr => rr.id === r.id ? { ...rr, assigned_zone: z } : rr))
                        api.put('/responders/' + r.id, { assigned_zone: z }).catch(() => {})
                      }}
                        className={`text-[10px] px-2 py-1 rounded-full border transition-all ${
                          r.assigned_zone === z
                            ? 'bg-[rgba(0,212,255,0.15)] border-[rgba(0,212,255,0.4)] text-[#00d4ff]'
                            : 'border-[rgba(255,255,255,0.1)] text-slate-500'
                        }`}>{z}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {!loading && responders.length > 0 && (
            <div className="glass rounded-xl p-3 border border-[rgba(0,212,255,0.15)]">
              <p className="text-[11px] text-[#00d4ff] font-semibold mb-1">Mesh Coverage</p>
              <p className="text-xs text-slate-400">
                {responders.filter(r => r.active_mesh_relay).length} responder(s) active as relay nodes
              </p>
            </div>
          )}
        </aside>
      </div>
    </AdminLayout>
  )
}
