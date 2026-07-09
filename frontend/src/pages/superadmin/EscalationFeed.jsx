import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertOctagon, Check, Filter, Clock, MessageSquare } from 'lucide-react'
import { SuperAdminLayout } from './SuperAdminLayout'
import { NeonButton } from '../../components/ui/NeonButton'
import { GlassCard } from '../../components/ui/GlassCard'
import { GlassTextarea } from '../../components/ui/GlassInput'

const SEED = [
  { id: 1, municipality: 'Del Carmen', summary: '12 critical SOS reports unaddressed in Zones 1-3. Responder capacity exceeded.', reason: 'Insufficient rescue teams', acknowledged: false, time: '14:35', notes: '' },
  { id: 2, municipality: 'Dapa',       summary: 'Flooding in 5 barangays. 40+ victims, only 2 active responders.',                reason: 'Request for additional resources', acknowledged: true,  time: '13:20', notes: 'Noted. Coordinating with NDRRMC for additional deployment.' },
]

export function EscalationFeed() {
  const [items, setItems] = useState(SEED)
  const [filter, setFilter] = useState('all')
  const [noteFor, setNoteFor] = useState(null)
  const [noteText, setNoteText] = useState('')

  const acknowledge = (id) => {
    setItems(d => d.map(e => e.id === id ? { ...e, acknowledged: true } : e))
  }

  const saveNote = (id) => {
    setItems(d => d.map(e => e.id === id ? { ...e, notes: noteText } : e))
    setNoteFor(null); setNoteText('')
  }

  const displayed = filter === 'all' ? items : items.filter(e => !e.acknowledged)

  return (
    <SuperAdminLayout title="Escalation Feed">
      <div className="p-4 space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">{items.filter(e => !e.acknowledged).length} unacknowledged</p>
          <div className="flex gap-2">
            {['all', 'unacknowledged'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all capitalize ${
                  filter === f
                    ? 'bg-[rgba(139,92,246,0.15)] border-[rgba(139,92,246,0.5)] text-[#8b5cf6]'
                    : 'glass border-[rgba(255,255,255,0.08)] text-slate-400'
                }`}>{f}</button>
            ))}
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-3">
          {displayed.map((e, i) => (
            <motion.div key={e.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <GlassCard className={`border ${e.acknowledged ? 'border-[rgba(34,197,94,0.2)] opacity-80' : 'border-[rgba(239,68,68,0.4)]'}`}>
                <div className="flex items-start gap-3">
                  <AlertOctagon size={18} className={e.acknowledged ? 'text-[#22c55e] shrink-0 mt-0.5' : 'text-[#ef4444] shrink-0 mt-0.5'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-bold text-white text-sm">{e.municipality}</p>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 shrink-0">
                        <Clock size={10} />
                        {e.time}
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 mb-1">{e.summary}</p>
                    <p className="text-[11px] text-slate-500 italic">Reason: {e.reason}</p>

                    {e.notes && (
                      <div className="mt-2 p-2 glass rounded-lg border border-[rgba(139,92,246,0.2)]">
                        <p className="text-[10px] text-[#8b5cf6] font-medium mb-0.5">Response Note:</p>
                        <p className="text-[11px] text-slate-400">{e.notes}</p>
                      </div>
                    )}

                    {noteFor === e.id && (
                      <div className="mt-3 space-y-2">
                        <GlassTextarea
                          placeholder="Add response note…"
                          value={noteText}
                          onChange={el => setNoteText(el.target.value)}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <NeonButton size="sm" variant="violet" onClick={() => saveNote(e.id)}>Save Note</NeonButton>
                          <NeonButton size="sm" variant="ghost" onClick={() => setNoteFor(null)}>Cancel</NeonButton>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 mt-3">
                      {!e.acknowledged && (
                        <NeonButton size="sm" variant="green" onClick={() => acknowledge(e.id)}>
                          <Check size={12} className="mr-1" />
                          Acknowledge
                        </NeonButton>
                      )}
                      <NeonButton size="sm" variant="ghost" onClick={() => setNoteFor(noteFor === e.id ? null : e.id)}>
                        <MessageSquare size={12} className="mr-1" />
                        {e.notes ? 'Edit Note' : 'Add Note'}
                      </NeonButton>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {displayed.length === 0 && (
          <div className="text-center py-16">
            <Check size={32} className="text-[#22c55e] mx-auto mb-3" />
            <p className="text-slate-400 text-sm">All escalations acknowledged</p>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  )
}
