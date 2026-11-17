import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Send, ChevronDown, ChevronUp, AlertTriangle,
  BookOpen, Check, WifiOff,
  Home, Map, Settings, MessageSquare, FileText,
} from 'lucide-react'
import { TopBar, MobileNavBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { GlassSelect, GlassInput, GlassTextarea } from '../../components/ui/GlassInput'
import { NeonButton } from '../../components/ui/NeonButton'
import { useAuthStore } from '../../store/auth'
import { getVictimTheme } from '../../lib/victimTheme'
import { getNetworkOnline } from '../../lib/capacitor'
import { buildStructuredSOS } from '../../lib/ai/emergencyIntelligence'
import { getInstructions } from '../../lib/ai/instructionKnowledgeBase'

const NAV = [
  { icon: Home,          label: 'Home',     path: '/home' },
  { icon: MessageSquare, label: 'SOS',      path: '/sos' },
  { icon: Map,           label: 'Map',      path: '/map' },
  { icon: Sparkles,      label: 'AI',       path: '/assistant' },
  { icon: Settings,      label: 'Settings', path: '/settings' },
]

const SERVICES = [
  { value: 'mdrrmo',   label: 'Disaster' },
  { value: 'hospital', label: 'Medical' },
  { value: 'bfp',      label: 'Fire' },
  { value: 'pnp',      label: 'Crime / Security' },
  { value: 'pcg',      label: 'Maritime' },
]

const PRIORITY_COLORS = {
  CRITICAL: '#ef4444', HIGH: '#f59e0b', MODERATE: '#00d4ff', LOW: '#22c55e',
}

// AI Personal Emergency Assistant — guest-accessible (guests have role 'victim').
// Rule-based engine, fully offline. The AI only PREFILLS an SOS draft; the user
// reviews, corrects, and submits through the normal SOS Report flow.
export function VictimAssistant() {
  const navigate = useNavigate()
  const { isGuest } = useAuthStore()
  const [isLight] = useState(() => getVictimTheme() === 'light')
  const offline = !getNetworkOnline()

  const [input,    setInput]    = useState('')
  const [analysis, setAnalysis] = useState(null)  // buildStructuredSOS result
  const [draft,    setDraft]    = useState(null)  // user-editable copy of form fields
  const [showWhy,  setShowWhy]  = useState(false)
  const [lang,     setLang]     = useState('en')

  const analyze = () => {
    const text = input.trim()
    if (!text) return
    const result = buildStructuredSOS(text, { isVerified: !isGuest })
    setAnalysis(result)
    setDraft({
      status:       result.form.status,
      people_count: result.form.people_count,
      service_type: result.form.service_type,
      notes:        result.form.notes,
      ageGroup:     result.ageGroup,
      conditions:   result.conditions,
    })
    setShowWhy(false)
  }

  const toggleService = (v) =>
    setDraft(d => ({
      ...d,
      service_type: d.service_type.includes(v)
        ? d.service_type.filter(x => x !== v)
        : [...d.service_type, v],
    }))

  const useInSOS = () => {
    navigate('/sos/new', {
      state: {
        aiPrefill: {
          form: {
            status:       draft.status,
            people_count: draft.people_count,
            service_type: draft.service_type,
            notes:        draft.notes,
          },
          ageGroup:   draft.ageGroup,
          conditions: draft.conditions,
        },
      },
    })
  }

  const instructions = analysis
    ? getInstructions({
        serviceType: analysis.classification.primary,
        subtype:     analysis.classification.subtype,
        conditions:  analysis.entities.conditions,
      }, lang)
    : null

  const confPct = analysis ? Math.round(analysis.classification.confidence * 100) : 0

  return (
    <div className={`h-screen bg-mesh flex flex-col overflow-hidden${isLight ? ' light-theme' : ''}`}>
      <TopBar title="AI Assistant" subtitle="Personal Emergency Assistant" onBack />

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-nav">

        {/* Intro */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-[#00d4ff]" />
            <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider">
              Describe your emergency
            </p>
            {offline && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-[#f59e0b]">
                <WifiOff size={11} /> Offline — AI works on-device
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-3">
            Tell me what's happening in English, Filipino, or Bisaya. I'll identify the
            emergency type, who needs help, and prepare an SOS draft for you to review.
          </p>
          <GlassTextarea
            placeholder={'e.g. "Nakulong kami sa baha, 4 kami, may lola…"'}
            icon={FileText}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
          />
          <NeonButton variant="primary" size="md" onClick={analyze} className="w-full mt-3">
            <Send size={14} className="mr-1.5" /> Analyze Situation
          </NeonButton>
          <p className="text-[10px] text-slate-500 mt-2 text-center">
            In immediate danger? Skip this —{' '}
            <button onClick={() => navigate('/sos/new')} className="text-[#ef4444] font-semibold underline">
              send SOS now
            </button>
          </p>
        </GlassCard>

        <AnimatePresence>
          {analysis && draft && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* ── AI Incident Card (editable) ───────────────────────────── */}
              <GlassCard glow>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider">
                    AI Interpretation — review &amp; correct
                  </p>
                  <span
                    className="text-[10px] font-black px-2 py-0.5 rounded-full"
                    style={{
                      color: PRIORITY_COLORS[analysis.priority.label],
                      background: `${PRIORITY_COLORS[analysis.priority.label]}1a`,
                      border: `1px solid ${PRIORITY_COLORS[analysis.priority.label]}55`,
                    }}
                  >
                    {analysis.priority.label} · {analysis.priority.score}
                  </span>
                </div>

                {/* Classification result */}
                {analysis.classification.primary ? (
                  <p className="text-xs text-slate-400 mb-2">
                    Detected: <span className="text-white font-semibold">{analysis.classification.primaryLabel}</span>
                    {analysis.classification.subtype && (
                      <> · {analysis.classification.subtype.replace(/_/g, ' ')}</>
                    )}
                    <span className="text-slate-500"> · confidence {confPct}%</span>
                  </p>
                ) : (
                  <p className="text-xs text-[#f59e0b] mb-2">
                    I couldn't classify this confidently — please pick the emergency type below.
                  </p>
                )}

                {/* Service chips (editable) */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {SERVICES.map(s => {
                    const active = draft.service_type.includes(s.value)
                    return (
                      <button key={s.value} type="button" onClick={() => toggleService(s.value)}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-all font-medium ${
                          active
                            ? 'bg-[rgba(0,212,255,0.15)] text-[#00d4ff] border-[rgba(0,212,255,0.4)]'
                            : 'glass text-slate-400 border-[rgba(255,255,255,0.1)]'
                        }`}>
                        {active && <Check size={10} className="inline mr-1" />}{s.label}
                      </button>
                    )
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <GlassSelect label="Situation" value={draft.status}
                    onChange={(e) => setDraft(d => ({ ...d, status: e.target.value }))}>
                    <option value="trapped">Trapped</option>
                    <option value="injured">Injured</option>
                    <option value="missing">Missing</option>
                    <option value="safe">Safe / Need Supplies</option>
                  </GlassSelect>
                  <GlassInput type="number" label="People" min={1} max={99}
                    value={draft.people_count}
                    onChange={(e) => setDraft(d => ({ ...d, people_count: +e.target.value }))} />
                </div>
                <GlassSelect label="Age Group" value={draft.ageGroup}
                  onChange={(e) => setDraft(d => ({ ...d, ageGroup: e.target.value }))}>
                  <option value="child">Child (under 18)</option>
                  <option value="adult">Adult (18–59)</option>
                  <option value="senior">Senior (60+)</option>
                </GlassSelect>

                {draft.conditions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {draft.conditions.map(c => (
                      <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(239,68,68,0.1)] text-[#ef4444] border border-[rgba(239,68,68,0.25)]">
                        {c.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}

                {/* Explainability */}
                <button onClick={() => setShowWhy(w => !w)}
                  className="mt-3 flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors">
                  {showWhy ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  Why this assessment?
                </button>
                {showWhy && (
                  <div className="mt-2 space-y-1.5 border-t border-[rgba(255,255,255,0.06)] pt-2">
                    {analysis.priority.factors.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">
                          {f.label}
                          {f.evidence && <span className="text-slate-600"> — matched "{f.evidence}"</span>}
                        </span>
                        <span className={f.points >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                          {f.points >= 0 ? '+' : ''}{f.points}
                        </span>
                      </div>
                    ))}
                    {analysis.classification.matchedTerms.length > 0 && (
                      <p className="text-[10px] text-slate-500 pt-1">
                        Terms detected: {[...new Set(analysis.classification.matchedTerms.map(t => t.term))].join(', ')}
                      </p>
                    )}
                  </div>
                )}

                <NeonButton variant="red" size="lg" onClick={useInSOS} className="w-full mt-4">
                  Use in SOS Report
                </NeonButton>
                <p className="text-[10px] text-slate-500 mt-1.5 text-center">
                  You review everything before sending — the AI never submits for you.
                </p>
              </GlassCard>

              {/* ── Follow-up prompts ─────────────────────────────────────── */}
              {analysis.missingFields.length > 0 && (
                <GlassCard>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={13} className="text-[#f59e0b]" />
                    <p className="text-xs font-semibold text-[#f59e0b] uppercase tracking-wider">
                      Helpful details to add
                    </p>
                  </div>
                  <ul className="space-y-1.5">
                    {analysis.missingFields.map(mf => (
                      <li key={mf.field} className="text-xs text-slate-400 flex gap-2">
                        <span className="text-slate-600">•</span>{mf.prompt}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-slate-500 mt-2">
                    Optional — you can send your SOS without answering these.
                  </p>
                </GlassCard>
              )}

              {/* ── Safety instructions ───────────────────────────────────── */}
              {instructions && (
                <GlassCard>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BookOpen size={13} className="text-[#22c55e]" />
                      <p className="text-xs font-semibold text-[#22c55e] uppercase tracking-wider">
                        {instructions.title}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {['en', 'fil'].map(l => (
                        <button key={l} onClick={() => setLang(l)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                            lang === l
                              ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e] border-[rgba(34,197,94,0.4)]'
                              : 'glass text-slate-500 border-[rgba(255,255,255,0.1)]'
                          }`}>
                          {l === 'en' ? 'EN' : 'FIL'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <ol className="space-y-1.5 mb-2">
                    {instructions.steps.map((s, i) => (
                      <li key={i} className="text-xs text-slate-300 flex gap-2">
                        <span className="text-[#22c55e] font-bold shrink-0">{i + 1}.</span>{s}
                      </li>
                    ))}
                  </ol>
                  {instructions.warnings.length > 0 && (
                    <div className="space-y-1 border-t border-[rgba(255,255,255,0.06)] pt-2">
                      {instructions.warnings.map((w, i) => (
                        <p key={i} className="text-[11px] text-[#f59e0b] flex gap-1.5">
                          <AlertTriangle size={11} className="shrink-0 mt-0.5" />{w}
                        </p>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 mt-2 italic">{instructions.disclaimer}</p>
                </GlassCard>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      <MobileNavBar items={NAV} />
    </div>
  )
}
