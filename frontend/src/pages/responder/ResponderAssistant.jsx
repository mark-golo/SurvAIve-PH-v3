import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles, RefreshCw, AlertTriangle, ChevronRight, ChevronDown, ChevronUp,
  FileText, Activity, ListOrdered, ClipboardList, Copy, Check,
  Home, List, Map, Settings, Route, BookOpen, Mic, MicOff,
} from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { GlassTextarea } from '../../components/ui/GlassInput'
import { NeonButton } from '../../components/ui/NeonButton'
import { useAuthStore } from '../../store/auth'
import { getResponderTheme } from '../../lib/victimTheme'
import api from '../../lib/api'
import { summarizeSOS, rankQueue, assessSituation, parseFieldNotes } from '../../lib/ai/responderIntelligence'
import { planMission } from '../../lib/ai/missionPlanner'
import { searchKB, KB_CATEGORIES } from '../../lib/ai/responderKnowledgeBase'

const NAV = [
  { icon: Home,     label: 'Home',     path: '/responder'           },
  { icon: List,     label: 'Queue',    path: '/responder/queue'     },
  { icon: Map,      label: 'Map',      path: '/responder/map'       },
  { icon: Sparkles, label: 'AI',       path: '/responder/assistant' },
  { icon: Settings, label: 'Settings', path: '/responder/settings'  },
]

const TABS = [
  { key: 'briefings', label: 'Briefings', Icon: FileText      },
  { key: 'priority',  label: 'Priority',  Icon: ListOrdered   },
  { key: 'situation', label: 'Situation', Icon: Activity      },
  { key: 'notes',     label: 'Notes',     Icon: ClipboardList },
  { key: 'mission',   label: 'Mission',   Icon: Route         },
  { key: 'knowledge', label: 'Knowledge', Icon: BookOpen      },
]

const HAS_SPEECH = typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

const TIER_COLORS = { URGENT: '#ef4444', HIGH: '#f59e0b', ROUTINE: '#00d4ff' }
const PRIORITY_COLORS = { CRITICAL: '#ef4444', HIGH: '#f59e0b', MODERATE: '#00d4ff', LOW: '#22c55e' }

// AI Field Response Assistant — rule-based, explainable, human-confirmed.
// Recommendations never auto-dispatch, auto-deprioritize, or complete a rescue.
export function ResponderAssistant() {
  const navigate = useNavigate()
  const { scope } = useAuthStore()
  const [isLight] = useState(() => getResponderTheme() === 'light')
  const muni = scope?.municipality

  const [tab,        setTab]        = useState('briefings')
  const [reports,    setReports]    = useState([])
  const [responders, setResponders] = useState([])
  const [centers,    setCenters]    = useState([])
  const [loading,    setLoading]    = useState(false)
  const [expanded,   setExpanded]   = useState(null)
  const [noteText,   setNoteText]   = useState('')
  const [noteDraft,  setNoteDraft]  = useState(null)
  const [copied,     setCopied]     = useState(false)
  const [kbQuery,    setKbQuery]    = useState('')
  const [kbCat,      setKbCat]      = useState('all')
  const [kbEntry,    setKbEntry]    = useState(null)
  const [listening,  setListening]  = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const url = muni
        ? `/sos?assigned_to=me&municipality=${encodeURIComponent(muni)}`
        : '/sos?assigned_to=me'
      const res = await api.get(url)
      setReports(Array.isArray(res) ? res : [])
    } catch { setReports([]) }
    // Secondary datasets are best-effort — the engine degrades gracefully without them
    try { setResponders(await api.get('/responders') ?? []) } catch { setResponders([]) }
    try { setCenters(await api.get('/evacuation_centers') ?? []) } catch { setCenters([]) }
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  const active = reports.filter(r => r.rescue_status !== 'rescued')
  const briefings = active.map(r => ({ id: r.id, s: summarizeSOS(r) }))
  const ranked    = rankQueue(active)
  const situation = assessSituation(reports, centers, responders)
  const mission   = planMission(active, null)
  const kbResults = searchKB(kbQuery, kbCat, 6)

  const analyzeNotes = () => {
    if (!noteText.trim()) return
    setNoteDraft(parseFieldNotes(noteText, { centerNames: centers.map(c => c.name).filter(Boolean) }))
  }

  const copyDraft = async () => {
    if (!noteDraft) return
    const lines = [
      noteDraft.rescued_count != null ? `Victims rescued: ${noteDraft.rescued_count}` : null,
      noteDraft.destination ? `Transferred to: ${noteDraft.destination}` : null,
      noteDraft.medical_needs.length ? `Medical needs: ${noteDraft.medical_needs.join('; ')}` : null,
      `Notes: ${noteDraft.notesClean}`,
    ].filter(Boolean).join('\n')
    try {
      await navigator.clipboard.writeText(lines)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable */ }
  }

  return (
    <div className={`h-screen bg-mesh flex flex-col overflow-hidden${isLight ? ' light-theme' : ''}`}>
      <TopBar
        title="AI Assistant"
        subtitle="Field Response Assistant"
        onBack
        rightSlot={
          <NeonButton size="sm" variant="ghost" onClick={refresh} loading={loading}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </NeonButton>
        }
      />

      {/* Tabs — scrollable so all 6 fit on small screens */}
      <div className="flex gap-1 px-4 pt-3 shrink-0 overflow-x-auto scrollbar-hide">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`shrink-0 flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-semibold transition-all border ${
              tab === key
                ? 'bg-[rgba(0,212,255,0.15)] text-[#00d4ff] border-[rgba(0,212,255,0.3)]'
                : 'glass text-slate-400 border-transparent'
            }`}>
            <Icon size={12} />{label}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto p-4 space-y-3 pb-nav">

        {/* ── Briefings ─────────────────────────────────────────────────────── */}
        {tab === 'briefings' && (
          briefings.length === 0 ? (
            <GlassCard><p className="text-xs text-slate-400 text-center py-4">No active SOS reports to brief.</p></GlassCard>
          ) : briefings.map(({ id, s }) => (
            <motion.div key={id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <GlassCard>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-xs font-bold leading-snug" style={{ color: PRIORITY_COLORS[s.priority.label] ?? '#fff' }}>
                    {s.headline}
                  </p>
                  <button onClick={() => navigate(`/responder/rescue/${id}`)}
                    className="shrink-0 text-slate-500 hover:text-[#00d4ff]"><ChevronRight size={16} /></button>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-2">{s.narrative}</p>
                {s.missingInfo.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {s.missingInfo.map(mi => (
                      <span key={mi} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(245,158,11,0.1)] text-[#f59e0b] border border-[rgba(245,158,11,0.25)]">
                        ⚠ {mi}
                      </span>
                    ))}
                  </div>
                )}
                <button onClick={() => setExpanded(expanded === id ? null : id)}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white">
                  {expanded === id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  Priority factors ({s.priority.score})
                </button>
                {expanded === id && (
                  <div className="mt-2 space-y-1 border-t border-[rgba(255,255,255,0.06)] pt-2">
                    {s.priority.factors.map((f, i) => (
                      <div key={i} className="flex justify-between text-[11px]">
                        <span className="text-slate-400">{f.label}</span>
                        <span className={f.points >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                          {f.points >= 0 ? '+' : ''}{f.points}
                        </span>
                      </div>
                    ))}
                    <p className="text-[10px] text-slate-500 pt-1">
                      AI summary of the victim's report — open the full report before deployment.
                    </p>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          ))
        )}

        {/* ── Priority ──────────────────────────────────────────────────────── */}
        {tab === 'priority' && (
          <>
            {['URGENT', 'HIGH', 'ROUTINE'].map(tier => {
              const rows = ranked.filter(x => x.tier === tier)
              if (rows.length === 0) return null
              return (
                <div key={tier}>
                  <p className="text-[11px] font-black tracking-wider mb-1.5" style={{ color: TIER_COLORS[tier] }}>
                    {tier} ({rows.length})
                  </p>
                  <div className="space-y-2 mb-3">
                    {rows.map(({ report, score, factors }) => (
                      <GlassCard key={report.id} onClick={() => navigate(`/responder/rescue/${report.id}`)}
                        className="cursor-pointer">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-white">
                            {report.name ?? 'Unknown'} · {report.barangay ?? report.municipality ?? '—'}
                          </p>
                          <span className="text-sm font-black" style={{ color: TIER_COLORS[tier] }}>{score}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {factors.filter(f => f.label !== 'Base score').map((f, i) => (
                            <span key={i}
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                f.points >= 0 ? 'bg-[rgba(255,255,255,0.05)] text-slate-400' : 'bg-[rgba(239,68,68,0.08)] text-[#ef4444]'
                              }`}>
                              {f.points >= 0 ? '+' : ''}{f.points} {f.label}
                            </span>
                          ))}
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                </div>
              )
            })}
            {ranked.length === 0 && (
              <GlassCard><p className="text-xs text-slate-400 text-center py-4">No active reports to rank.</p></GlassCard>
            )}
            <p className="text-[10px] text-slate-500 text-center">
              Suggested order only — operational prioritization remains your decision.
              No report is ever hidden or discarded by the AI.
            </p>
          </>
        )}

        {/* ── Situation ─────────────────────────────────────────────────────── */}
        {tab === 'situation' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <GlassCard>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Active SOS</p>
                <p className="text-2xl font-black text-white">{situation.activeCount}</p>
              </GlassCard>
              <GlassCard>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Capacity</p>
                <p className="text-2xl font-black" style={{
                  color: situation.depletion.alertLevel === 'OVERWHELMED' ? '#ef4444'
                       : situation.depletion.alertLevel === 'AT_RISK'     ? '#f59e0b'
                       : situation.depletion.alertLevel === 'ELEVATED'    ? '#f59e0b' : '#22c55e',
                }}>
                  {situation.depletion.alertLevel.replace('_', ' ')}
                </p>
                <p className="text-[10px] text-slate-500">
                  {situation.depletion.activeLoad}/{situation.depletion.capacity} load · {situation.depletion.onDutyCount} on duty
                </p>
              </GlassCard>
            </div>

            {situation.clusters.length > 0 && (
              <GlassCard>
                <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-2">Report Clusters</p>
                <div className="space-y-2">
                  {situation.clusters.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">
                        {c.barangays.join(', ') || `Cluster ${i + 1}`}
                        <span className="text-slate-500"> · {c.count} report{c.count !== 1 ? 's' : ''}</span>
                      </span>
                      <span className="font-bold" style={{ color: PRIORITY_COLORS[c.priority] }}>
                        {c.priority} {c.avgScore}
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {situation.anomalies.length > 0 && (
              <GlassCard>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={13} className="text-[#f59e0b]" />
                  <p className="text-xs font-semibold text-[#f59e0b] uppercase tracking-wider">Unusual Activity</p>
                </div>
                {situation.anomalies.map((a, i) => (
                  <div key={i} className="mb-2 last:mb-0">
                    <p className="text-xs text-slate-300">{a.text}</p>
                    <p className="text-[10px] text-slate-500">Evidence: {a.evidence}</p>
                  </div>
                ))}
              </GlassCard>
            )}

            <GlassCard>
              <p className="text-xs font-semibold text-[#22c55e] uppercase tracking-wider mb-2">Recommendations</p>
              {situation.recommendations.map((rec, i) => (
                <div key={i} className="mb-2 last:mb-0">
                  <p className="text-xs text-slate-300">{rec.text}</p>
                  <p className="text-[10px] text-slate-500">Basis: {rec.evidence}</p>
                </div>
              ))}
              <p className="text-[10px] text-slate-500 mt-2 italic">
                Assessment from currently loaded reports — data may be incomplete offline.
                Verify conditions before acting.
              </p>
            </GlassCard>
          </>
        )}

        {/* ── Notes → Report ────────────────────────────────────────────────── */}
        {tab === 'notes' && (
          <>
            <GlassCard>
              <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-2">
                Field Notes → Draft Report
              </p>
              <p className="text-[11px] text-slate-400 mb-2">
                Type or dictate your observations; I'll structure them into a draft rescue report.
              </p>
              <GlassTextarea
                placeholder={'e.g. "4 victims rescued, transferred to Del Carmen gym, one elderly needs medical check"'}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={4}
              />
              <div className="flex gap-2 mt-3">
                <NeonButton variant="primary" size="md" onClick={analyzeNotes} className="flex-1">
                  Structure Notes
                </NeonButton>
                {HAS_SPEECH && (
                  <button
                    type="button"
                    title={listening ? 'Stop listening' : 'Dictate notes'}
                    onClick={() => {
                      if (listening) return
                      const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
                      const rec = new SR()
                      rec.lang = 'en-PH'
                      rec.interimResults = false
                      rec.onresult = (e) => {
                        const t = Array.from(e.results).map(r => r[0].transcript).join(' ')
                        setNoteText(prev => prev ? `${prev} ${t}` : t)
                      }
                      rec.onend = () => setListening(false)
                      rec.onerror = () => setListening(false)
                      setListening(true)
                      rec.start()
                    }}
                    className={`shrink-0 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      listening
                        ? 'bg-[rgba(239,68,68,0.2)] border-[rgba(239,68,68,0.4)] text-red-400 animate-pulse'
                        : 'glass border-[rgba(255,255,255,0.12)] text-slate-400 hover:text-[#00d4ff]'
                    }`}
                  >
                    {listening ? <MicOff size={14} /> : <Mic size={14} />}
                  </button>
                )}
              </div>
            </GlassCard>

            {noteDraft && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <GlassCard glow>
                  <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-2">
                    Draft Documentation — review required
                  </p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Victims rescued</span>
                      <span className={noteDraft.rescued_count != null ? 'text-white font-semibold' : 'text-[#f59e0b]'}>
                        {noteDraft.rescued_count ?? 'not stated'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Destination</span>
                      <span className={noteDraft.destination ? 'text-white font-semibold' : 'text-[#f59e0b]'}>
                        {noteDraft.destination ?? 'not stated'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500 shrink-0">Medical needs</span>
                      <span className="text-white text-right">
                        {noteDraft.medical_needs.length ? noteDraft.medical_needs.join('; ') : '—'}
                      </span>
                    </div>
                  </div>

                  {noteDraft.missingFields.length > 0 && (
                    <p className="text-[11px] text-[#f59e0b] mt-2">
                      ⚠ Missing: {noteDraft.missingFields.map(f => f.replace(/_/g, ' ')).join(', ')} — add these before confirming.
                    </p>
                  )}
                  {noteDraft.evidence.length > 0 && (
                    <p className="text-[10px] text-slate-500 mt-1.5">
                      Extracted from: {[...new Set(noteDraft.evidence.map(e => `"${e.term}"`))].join(', ')}
                    </p>
                  )}

                  <NeonButton variant="secondary" size="md" onClick={copyDraft} className="w-full mt-3">
                    {copied ? <Check size={13} className="mr-1.5" /> : <Copy size={13} className="mr-1.5" />}
                    {copied ? 'Copied' : 'Copy Draft to Clipboard'}
                  </NeonButton>
                  <p className="text-[10px] text-slate-500 mt-1.5 text-center">
                    Paste into the rescue confirmation form — this draft never completes a rescue by itself.
                  </p>
                </GlassCard>
              </motion.div>
            )}
          </>
        )}

        {/* ── Mission Planning — §3.4 ───────────────────────────────────── */}
        {tab === 'mission' && (
          <>
            {!mission.canSequence ? (
              <GlassCard>
                <div className="flex items-start gap-2.5 py-2">
                  <Route size={14} className="text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-slate-300 mb-1">Need 2+ Active Reports with GPS</p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Mission sequencing requires at least two active SOS reports with GPS coordinates.
                      Refresh to load the latest reports.
                    </p>
                  </div>
                </div>
              </GlassCard>
            ) : (
              <>
                <GlassCard>
                  <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-1">
                    Suggested Response Sequence
                  </p>
                  <p className="text-[10px] text-slate-500 mb-3">
                    Greedy nearest-neighbor from highest-urgency report. Verify conditions before deployment.
                  </p>
                  <div className="space-y-2">
                    {mission.sequence.map((step, i) => (
                      <div key={step.report.id}
                        className="flex items-start gap-3 p-2.5 rounded-xl glass border border-[rgba(255,255,255,0.06)]">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                          style={{
                            background: i === 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
                            border: `1px solid ${i === 0 ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
                          }}>
                          <span className="text-[11px] font-black"
                            style={{ color: i === 0 ? '#ef4444' : '#94a3b8' }}>
                            {step.order}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-white truncate">
                              {step.report.name ?? 'Unknown'} — {step.report.barangay ?? step.report.municipality ?? '—'}
                            </p>
                            <span className="text-[10px] font-black shrink-0 px-1.5 py-0.5 rounded"
                              style={{
                                color: PRIORITY_COLORS[step.urgencyLabel] ?? '#fff',
                                background: `${PRIORITY_COLORS[step.urgencyLabel] ?? '#fff'}20`,
                              }}>
                              {step.urgencyLabel}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {step.distanceFromPrevKm} km · est. {step.estMinutes} min travel
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-[rgba(255,255,255,0.06)]">
                    Total estimated distance: <span className="text-slate-300">{mission.totalDistanceKm} km</span>
                    {' '}(road-adjusted) · {mission.sequence.length} stop{mission.sequence.length !== 1 ? 's' : ''}
                  </p>
                </GlassCard>
                <p className="text-[10px] text-slate-500 text-center px-2">
                  Distance estimates use Haversine ×1.3 road factor at 30 km/h.
                  Verify actual route and road conditions independently.
                  AI never dispatches or deprioritizes reports automatically.
                </p>
              </>
            )}
          </>
        )}

        {/* ── Knowledge Base — §4.2 ─────────────────────────────────────── */}
        {tab === 'knowledge' && (
          <>
            {kbEntry ? (
              <GlassCard>
                <button type="button" onClick={() => setKbEntry(null)}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white mb-3">
                  <ChevronDown size={12} style={{ transform: 'rotate(90deg)' }} /> Back to results
                </button>
                <p className="text-xs font-bold text-slate-200 mb-1">{kbEntry.title}</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.2)] text-[#00d4ff] mb-3 inline-block capitalize">
                  {kbEntry.category.replace(/_/g, ' ')}
                </span>
                <div className="mt-2 text-xs text-slate-300 leading-relaxed space-y-1.5 whitespace-pre-line">
                  {kbEntry.content}
                </div>
                <p className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-[rgba(255,255,255,0.06)] italic">
                  Source: {kbEntry.source}
                </p>
              </GlassCard>
            ) : (
              <>
                <GlassCard>
                  <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-2">
                    Responder Knowledge Base
                  </p>
                  <input
                    type="text"
                    value={kbQuery}
                    onChange={e => setKbQuery(e.target.value)}
                    placeholder={'Search procedures, e.g. "rescue completion" …'}
                    className="w-full text-xs rounded-xl bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[rgba(0,212,255,0.4)] mb-2"
                  />
                  <div className="flex gap-1.5 flex-wrap">
                    {KB_CATEGORIES.map(c => (
                      <button key={c.key} type="button" onClick={() => setKbCat(c.key)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-all ${
                          kbCat === c.key
                            ? 'bg-[rgba(0,212,255,0.15)] text-[#00d4ff] border-[rgba(0,212,255,0.3)]'
                            : 'glass text-slate-500 border-[rgba(255,255,255,0.1)]'
                        }`}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </GlassCard>

                {kbResults.length === 0 ? (
                  <GlassCard>
                    <p className="text-xs text-slate-400 text-center py-3">No procedures match your search.</p>
                  </GlassCard>
                ) : kbResults.map(entry => (
                  <button key={entry.id} type="button" onClick={() => setKbEntry(entry)}
                    className="w-full text-left">
                    <GlassCard className="hover:border-[rgba(0,212,255,0.25)] transition-all cursor-pointer">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-200 leading-snug mb-0.5">
                            {entry.title}
                          </p>
                          <p className="text-[11px] text-slate-400 leading-relaxed">{entry.summary}</p>
                        </div>
                        <ChevronRight size={14} className="text-slate-500 shrink-0 mt-0.5" />
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.05)] text-slate-500 mt-1.5 inline-block capitalize">
                        {entry.category.replace(/_/g, ' ')}
                      </span>
                    </GlassCard>
                  </button>
                ))}

                <p className="text-[10px] text-slate-500 text-center">
                  Procedures are for reference only. Follow your agency's authorized guidelines.
                </p>
              </>
            )}
          </>
        )}

      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}
