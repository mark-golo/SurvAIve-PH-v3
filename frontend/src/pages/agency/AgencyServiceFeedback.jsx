import { useState, useEffect, useMemo } from 'react'
import { Star, WifiOff, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getNetworkOnline } from '../../lib/capacitor'
import { useAuthStore } from '../../store/auth'

function StarDisplay({ rating }) {
  if (!rating) return <span className="text-slate-500">—</span>
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(n => (
        <Star key={n} size={11} className={n <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'} />
      ))}
      <span className="ml-1 text-[10px] text-slate-400">{rating}/5</span>
    </span>
  )
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function AgencyServiceFeedback() {
  const { scope } = useAuthStore()
  const [isOnline] = useState(getNetworkOnline)
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)

  const agencyType = scope?.agency_type

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('response_feedback')
        .select(`
          id, rating, comments, display_anonymously, created_at,
          sos:sos_reports ( id, barangay, created_at )
        `)
        .eq('target_type', 'agency')
        .eq('target_id', agencyType ?? '')
        .eq('moderation_status', 'visible')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      setRows(data ?? [])
    } catch (err) {
      console.error('[AgencyServiceFeedback] load failed:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (isOnline && agencyType) { load() } else { setLoading(false) } }, [isOnline, agencyType])

  const stats = useMemo(() => {
    if (rows.length === 0) return null
    const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length
    const dist = [1,2,3,4,5].map(n => ({ star: n, count: rows.filter(r => r.rating === n).length }))
    return { avg: avg.toFixed(1), total: rows.length, dist }
  }, [rows])

  if (!isOnline) {
    return (
      <div className="p-4 flex flex-col items-center gap-3 mt-16 text-slate-500">
        <WifiOff size={28} />
        <p className="text-sm">Service Feedback is only available when online.</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">

      {/* Stats */}
      {stats && (
        <div className="glass rounded-2xl p-4 space-y-3 border border-[rgba(245,158,11,0.2)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-black text-amber-400">{stats.avg} ★</p>
              <p className="text-xs text-slate-500">{stats.total} review{stats.total !== 1 ? 's' : ''} total</p>
            </div>
            <button onClick={load} className="text-slate-500 hover:text-[#00d4ff] transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="space-y-1">
            {stats.dist.slice().reverse().map(({ star, count }) => (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="text-amber-400 w-3 text-right">{star}★</span>
                <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                  <div className="bg-amber-400 h-1.5 rounded-full transition-all"
                    style={{ width: stats.total > 0 ? `${count / stats.total * 100}%` : '0%' }} />
                </div>
                <span className="text-slate-500 w-4 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="glass rounded-2xl h-16 animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 mt-12 text-slate-500">
          <Star size={28} />
          <p className="text-sm">No feedback received yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="glass rounded-2xl p-4 space-y-1 border border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between">
                <StarDisplay rating={r.rating} />
                <span className="text-[10px] text-slate-600">{fmtDate(r.created_at)}</span>
              </div>
              {r.comments && (
                <p className="text-xs text-slate-400 italic">
                  "{r.display_anonymously ? r.comments : r.comments}"
                </p>
              )}
              {r.sos?.id && (
                <p className="text-[10px] text-slate-600">SOS #{r.sos.id} · {r.sos?.barangay ?? '—'}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
