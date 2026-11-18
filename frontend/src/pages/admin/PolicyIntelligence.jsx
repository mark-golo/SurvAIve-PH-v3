import { useState, useEffect, useCallback } from 'react'
import { Scale, RefreshCw, WifiOff, AlertTriangle, CheckCircle2, Clock, FileText, Printer, ChevronDown, ChevronUp, Info, Search, BookOpen, X } from 'lucide-react'
import api, { logActivity } from '../../lib/api'
import { searchPolicyKB } from '../../lib/ai/policyKnowledgeBase'
import { getNetworkOnline, onNetworkChange } from '../../lib/capacitor'
import { useAuthStore } from '../../store/auth'

// ── localStorage helpers ───────────────────────────────────────────────────────
const STATUS_KEY = 'survAIve-policy-statuses'

function loadStatuses() {
  try { return JSON.parse(localStorage.getItem(STATUS_KEY) ?? '{}') } catch { return {} }
}
function saveStatuses(s) {
  try { localStorage.setItem(STATUS_KEY, JSON.stringify(s)) } catch {}
}

// ── Rule-based analysis engine ─────────────────────────────────────────────────
function analyzeData(reports, centers, responders, muni) {
  const recs = []
  const now  = new Date()
  const period = `as of ${now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`

  // Apply 30-day lookback window per blueprint §5.6 supporting indicators
  const LOOKBACK_DAYS = 30
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS)
  const recentReports = reports.filter(r => !r.created_at || new Date(r.created_at) >= cutoff)

  // 1. SOS hotspot barangays
  const bCounts = {}
  recentReports.forEach(r => { if (r.barangay) bCounts[r.barangay] = (bCounts[r.barangay] ?? 0) + 1 })
  const hotspots = Object.entries(bCounts).sort((a, b) => b[1] - a[1]).filter(([, c]) => c >= 2).slice(0, 3)
  if (hotspots.length > 0) {
    recs.push({
      id: 'hotspot-response',
      category: 'Emergency Response',
      title: 'Concentrated Emergency Hotspots Detected',
      priority: 'high',
      issue: `${hotspots.length} barangay(s) account for a disproportionate share of SOS incidents in the last 30 days (${period}).`,
      evidence: hotspots.map(([b, c]) => `${b}: ${c} incident${c > 1 ? 's' : ''} (last 30 days)`).join(' · '),
      dataSource: 'SOS incident records',
      finding: `System records show repeated emergency incidents concentrated in a limited number of barangays. This may indicate elevated vulnerability, insufficient local preparedness, or uneven resource distribution.`,
      recommendation: 'Strengthen barangay-level disaster preparedness programs, training, and equipment in high-frequency incident areas. Consider deploying additional early warning systems and community response teams.',
      office: 'MDRRMO, Barangay Disaster Risk Reduction and Management Committees (BDRRMCs)',
      instrument: 'Executive Order or Municipal Ordinance',
      outcome: 'Reduced emergency incident frequency and improved community-level preparedness in identified barangays.',
    })
  }

  // 2. Unresolved SOS cases
  const total    = recentReports.length
  const unresolved = recentReports.filter(r => r.rescue_status !== 'rescued' && !r.dismissed).length
  if (total > 3 && unresolved / total > 0.2) {
    const pct = Math.round(unresolved / total * 100)
    recs.push({
      id: 'rescue-coverage',
      category: 'Rescue & Response',
      title: 'Unresolved SOS Rescue Cases',
      priority: 'high',
      issue: `${unresolved} of ${total} SOS reports (${pct}%) remain unresolved or unrescued in the last 30 days (${period}).`,
      evidence: `Rescue completion rate: ${100 - pct}% · Unresolved: ${unresolved} reports (last 30 days)`,
      dataSource: 'SOS and rescue status records',
      finding: `A significant portion of logged SOS cases have not reached a confirmed "Rescued" status. This may reflect insufficient rescue resources, coordination gaps, or prioritization challenges.`,
      recommendation: 'Review and improve evacuation and rescue resource allocation. Establish clear inter-agency response protocols and accountability mechanisms for case resolution.',
      office: 'MDRRMO, Response Agencies, Local Chief Executive',
      instrument: 'Administrative Order or Emergency Response Protocol',
      outcome: 'Higher rescue completion rate and reduced number of unresolved emergency cases.',
    })
  }

  // 3. Evacuation center capacity
  const overloaded = centers.filter(c => c.capacity > 0 && (c.current_population ?? 0) >= c.capacity * 0.8)
  if (overloaded.length > 0) {
    const atFull = overloaded.filter(c => (c.current_population ?? 0) >= c.capacity)
    recs.push({
      id: 'evacuation-capacity',
      category: 'Evacuation Preparedness',
      title: `Evacuation Center Capacity ${atFull.length > 0 ? 'Critical' : 'Concern'}`,
      priority: atFull.length > 0 ? 'high' : 'medium',
      issue: `${overloaded.length} evacuation center(s) at or near full capacity (${period}).`,
      evidence: overloaded.map(c => `${c.name}: ${c.current_population ?? 0}/${c.capacity}`).join(' · '),
      dataSource: 'Evacuation center occupancy records',
      finding: `One or more designated evacuation centers are operating at or above 80% capacity. Overcrowding may compromise safety, sanitation, and service delivery for displaced residents.`,
      recommendation: 'Expand existing evacuation center capacity, identify and designate additional facilities, and develop contingency plans for overflow scenarios. Review accessibility for persons with disabilities and vulnerable populations.',
      office: 'Municipal Planning and Development Office (MPDO), MDRRMO, Barangay Officials',
      instrument: 'Municipal Ordinance or Executive Order',
      outcome: 'Adequate and accessible evacuation capacity for all displaced residents during emergencies.',
    })
  }

  // 4. Responder capacity and on-duty rate
  const activeR  = responders.filter(r => r.status === 'active')
  const onDutyR  = responders.filter(r => r.duty_status === 'on_duty')
  const dutyRate = activeR.length > 0 ? onDutyR.length / activeR.length : 0
  if (activeR.length < 5 || dutyRate < 0.3) {
    recs.push({
      id: 'responder-capacity',
      category: 'Emergency Response Capacity',
      title: 'Limited Emergency Responder Deployment',
      priority: 'medium',
      issue: `${activeR.length} active responder(s) on record; ${onDutyR.length} currently on duty (${Math.round(dutyRate * 100)}% duty rate).`,
      evidence: `Active: ${activeR.length} · On Duty: ${onDutyR.length} · Duty Rate: ${Math.round(dutyRate * 100)}%`,
      dataSource: 'Responder status records',
      finding: `System data indicates a low number of active responders or a low on-duty rate. This may limit the municipality's capacity to respond simultaneously to multiple emergency incidents.`,
      recommendation: 'Expand the active responder pool through recruitment and inter-agency coordination. Establish duty scheduling protocols to maintain adequate on-duty coverage at all times.',
      office: 'MDRRMO, Response Agencies, Human Resources',
      instrument: 'Administrative Order or Personnel Policy',
      outcome: 'Improved emergency response capacity and faster incident response times.',
    })
  }

  // 5. Communication & AI readiness (always present — connectivity data not directly queryable)
  recs.push({
    id: 'communication-infrastructure',
    category: 'Communication Infrastructure',
    title: 'Emergency Communication Redundancy and AI-Assisted Triage Readiness',
    priority: 'medium',
    issue: 'Connectivity redundancy and AI-assisted triage procedures should be assessed for full barangay coverage.',
    evidence: 'Based on the connectivity-dependent reporting architecture of the SurvAIve PH system',
    dataSource: 'System architecture and barangay connectivity records',
    finding: `SurvAIve PH depends on internet connectivity for real-time SOS delivery, with on-device AI assistance and local queuing when offline. Connectivity dead zones in geographically isolated barangays delay report synchronization, and AI-generated triage recommendations require trained personnel to review them during surge periods.`,
    recommendation: 'Maintain redundant communication channels (SMS hotlines, satellite or radio fallback) for connectivity-challenged barangays, and train MDRRMO personnel to review AI-assisted triage recommendations before acting on them.',
    office: 'MDRRMO, Municipal ICT Office (if applicable), BDRRMCs',
    instrument: 'Municipal Ordinance, Executive Order, or Administrative Program',
    outcome: 'Reliable emergency reporting across all barangays and accountable, human-verified use of AI triage support.',
  })

  recs.forEach(rec => {
    rec.policyRefs = searchPolicyKB(`${rec.category} ${rec.title}`, 2)
  })

  return recs
}

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'draft',          label: 'Draft',          color: 'text-slate-400',  bg: 'bg-slate-700' },
  { value: 'under_review',   label: 'Under Review',   color: 'text-blue-400',   bg: 'bg-blue-900/40' },
  { value: 'approved',       label: 'Approved',       color: 'text-green-400',  bg: 'bg-green-900/40' },
  { value: 'rejected',       label: 'Rejected',       color: 'text-red-400',    bg: 'bg-red-900/40' },
  { value: 'for_monitoring', label: 'For Monitoring', color: 'text-amber-400',  bg: 'bg-amber-900/40' },
]

function getStatusCfg(v) {
  return STATUS_OPTIONS.find(s => s.value === v) ?? STATUS_OPTIONS[0]
}

const PRIORITY_CFG = {
  high:   { label: 'High Priority',   dot: 'bg-red-500',   text: 'text-red-400',   border: 'border-red-500/20' },
  medium: { label: 'Medium Priority', dot: 'bg-amber-400', text: 'text-amber-400', border: 'border-amber-400/20' },
  low:    { label: 'Low Priority',    dot: 'bg-slate-500', text: 'text-slate-400', border: 'border-slate-500/20' },
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'text-[#00d4ff]' }) {
  return (
    <div className="glass rounded-2xl p-4 border border-[rgba(255,255,255,0.06)]">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs font-semibold text-white mt-1">{label}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Recommendation card ────────────────────────────────────────────────────────
function RecommendationCard({ rec, status, onStatusChange }) {
  const [expanded, setExpanded] = useState(false)
  const pri = PRIORITY_CFG[rec.priority] ?? PRIORITY_CFG.medium
  const sta = getStatusCfg(status)

  return (
    <div className={`glass rounded-2xl border ${pri.border} overflow-hidden`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${pri.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${pri.dot}`} />{pri.label}
              </span>
              <span className="text-[10px] text-slate-500 px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)]">
                {rec.category}
              </span>
            </div>
            <p className="text-sm font-bold text-white leading-snug">{rec.title}</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{rec.issue}</p>
          </div>
          {/* Status select */}
          <div className="shrink-0">
            <select
              value={status}
              onChange={e => onStatusChange(rec.id, e.target.value)}
              className={`text-[10px] font-semibold px-2 py-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] outline-none cursor-pointer ${sta.color} ${sta.bg}`}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value} className="bg-[#1e293b] text-white">{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Evidence row */}
        <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)]">
          <Info size={11} className="text-slate-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Evidence · {rec.dataSource}</p>
            <p className="text-[11px] text-slate-300 mt-0.5">{rec.evidence}</p>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-3 flex items-center gap-1 text-[11px] text-slate-500 hover:text-[#00d4ff] transition-colors"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Hide' : 'Show'} full recommendation
        </button>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[rgba(255,255,255,0.06)] pt-4">
          <Detail label="AI Interpretation" value={rec.finding} />
          <Detail label="Recommended Policy Intervention" value={rec.recommendation} highlight />
          <Detail label="Suggested Responsible Office" value={rec.office} />
          <Detail label="Suggested Policy Instrument" value={rec.instrument} />
          <Detail label="Expected Outcome" value={rec.outcome} />
          {rec.policyRefs?.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Policy Basis</p>
              <div className="space-y-2">
                {rec.policyRefs.map(p => (
                  <div key={p.id} className="rounded-lg p-2.5 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)]">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] text-white font-medium leading-tight">{p.title}</p>
                      {p.source_url && (
                        <a href={p.source_url} target="_blank" rel="noopener noreferrer"
                           className="text-[9px] text-[#00d4ff] hover:underline shrink-0">↗ Source</a>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed line-clamp-3">{p.body}</p>
                    <p className="text-[9px] text-slate-600 mt-0.5">{p.source} · {p.section}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-[10px] text-slate-600 italic pt-1">
            ⚠ AI-generated recommendation. Requires data validation, stakeholder consultation, and appropriate LGU legal review before adoption.
          </p>
        </div>
      )}
    </div>
  )
}

function Detail({ label, value, highlight }) {
  return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5">{label}</p>
      <p className={`text-xs leading-relaxed ${highlight ? 'text-white font-medium' : 'text-slate-300'}`}>{value}</p>
    </div>
  )
}

// ── Policy brief panel ─────────────────────────────────────────────────────────
function PolicyBriefPanel({ recommendations, statuses, muni, generatedAt }) {
  const dateStr = generatedAt.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = generatedAt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })

  return (
    <div className="glass rounded-2xl border border-[rgba(0,212,255,0.15)] overflow-hidden">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #policy-brief-root, #policy-brief-root * { visibility: visible; }
          #policy-brief-root {
            position: fixed;
            top: 0; left: 0; right: 0;
            padding: 32px;
            background: #ffffff !important;
          }
          #policy-brief-root, #policy-brief-root * {
            color: #111 !important;
            background-color: transparent !important;
            border-color: #d1d5db !important;
            box-shadow: none !important;
          }
          #policy-brief-root h2 { color: #1d4ed8 !important; }
          .no-print { display: none !important; visibility: hidden; }
        }
      `}</style>

      {/* Brief header */}
      <div className="px-6 py-5 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Municipal Disaster Governance and Policy Recommendation Report</p>
          <p className="text-sm font-bold text-white mt-0.5">Generated: {dateStr} at {timeStr}</p>
          {muni && <p className="text-xs text-slate-400">Scope: {muni}</p>}
        </div>
        <button
          onClick={() => window.print()}
          className="no-print flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[#00d4ff] border border-[rgba(0,212,255,0.3)] hover:bg-[rgba(0,212,255,0.08)] transition-colors"
        >
          <Printer size={13} /> Print / Save PDF
        </button>
      </div>

      <div id="policy-brief-root" className="px-6 py-5 space-y-6 text-sm">
        {/* Executive summary */}
        <section>
          <h2 className="text-xs font-bold text-[#00d4ff] uppercase tracking-widest mb-2">Executive Summary</h2>
          <p className="text-slate-300 leading-relaxed text-xs">
            This report presents findings and policy recommendations generated by the SurvAIve PH AI Policy Intelligence module
            based on analysis of system records {muni ? `for ${muni}` : 'across the municipality'} as of {dateStr}.
            A total of <strong className="text-white">{recommendations.length}</strong> potential policy issues were identified,
            with <strong className="text-white">{recommendations.filter(r => r.priority === 'high').length}</strong> classified as high priority.
            All recommendations are AI-assisted advisory drafts and must undergo data validation, stakeholder consultation, and
            appropriate legal and administrative review before any policy action is considered.
          </p>
        </section>

        {/* Findings */}
        <section>
          <h2 className="text-xs font-bold text-[#00d4ff] uppercase tracking-widest mb-3">Identified Issues and Policy Recommendations</h2>
          <div className="space-y-5">
            {recommendations.map((rec, i) => {
              const pri = PRIORITY_CFG[rec.priority] ?? PRIORITY_CFG.medium
              const sta = getStatusCfg(statuses[rec.id] ?? 'draft')
              return (
                <div key={rec.id} className="border border-[rgba(255,255,255,0.08)] rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{i + 1}. {rec.category}</p>
                      <p className="text-sm font-bold text-white">{rec.title}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${pri.text}`}>{pri.label}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full ${sta.color}`}>{sta.label}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400"><span className="font-semibold text-slate-300">Issue:</span> {rec.issue}</p>
                  <p className="text-[11px] text-slate-400"><span className="font-semibold text-slate-300">Evidence:</span> {rec.evidence} <span className="text-slate-600">({rec.dataSource})</span></p>
                  <p className="text-[11px] text-slate-400"><span className="font-semibold text-slate-300">AI Interpretation:</span> {rec.finding}</p>
                  <p className="text-[11px] text-white font-medium"><span className="font-semibold text-[#00d4ff]">Recommendation:</span> {rec.recommendation}</p>
                  <p className="text-[11px] text-slate-400"><span className="font-semibold text-slate-300">Responsible Office:</span> {rec.office}</p>
                  <p className="text-[11px] text-slate-400"><span className="font-semibold text-slate-300">Instrument:</span> {rec.instrument}</p>
                  <p className="text-[11px] text-slate-400"><span className="font-semibold text-slate-300">Expected Outcome:</span> {rec.outcome}</p>
                  {rec.policyRefs?.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-[rgba(255,255,255,0.06)]">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Policy Basis</p>
                      {rec.policyRefs.map((ref, ri) => (
                        <p key={ri} className="text-[10px] text-slate-300 mb-0.5">
                          {ri + 1}. {ref.title} ({ref.year}) — {ref.section} · <span className="text-slate-500">{ref.source}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Disclaimer */}
        <section className="border-t border-[rgba(255,255,255,0.08)] pt-4">
          <h2 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">Data Limitations and Validation Status</h2>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            All figures in this report are derived from actual SurvAIve PH system records. AI-generated interpretations
            and policy recommendations are advisory in nature. They do not constitute official LGU policy and must not be
            implemented without appropriate data validation, stakeholder consultation, and legal and administrative review
            by authorized municipal officials and the Sangguniang Bayan where required.
            Personal and sensitive victim information has not been included in this report; only aggregated indicators are presented.
          </p>
          <p className="text-[10px] text-slate-600 mt-2">Generated by SurvAIve PH AI Policy Intelligence · {dateStr} {timeStr}</p>
        </section>
      </div>
    </div>
  )
}

// ── Suggested policy queries ──────────────────────────────────────────────────
const SUGGESTED_QUERIES = [
  'LGU duties during disaster',
  'state of calamity declaration',
  'LDRRM Office mandate',
  'Quick Response Fund',
  'evacuation center standards',
  'BDRRMC composition',
  'early warning system',
]

// ── Policy search panel ───────────────────────────────────────────────────────
function PolicySearchPanel({ query, onQueryChange, results, onSearch, onClear }) {
  const [open, setOpen] = useState(true)

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSearch() }
  }

  return (
    <div className="glass rounded-2xl border border-[rgba(0,212,255,0.15)] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-xs font-semibold text-[#00d4ff] uppercase tracking-wider"
      >
        <span className="flex items-center gap-2">
          <BookOpen size={13} />
          Policy Knowledge Base — Ask a Question
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-[rgba(255,255,255,0.06)]">
          {/* Suggested queries */}
          <div className="pt-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Suggested queries</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_QUERIES.map(q => (
                <button
                  key={q}
                  onClick={() => { onQueryChange(q); onSearch.call(null, q) }}
                  className="text-[10px] px-2.5 py-1 rounded-full bg-[rgba(0,212,255,0.08)] border border-[rgba(0,212,255,0.2)] text-[#00d4ff] hover:bg-[rgba(0,212,255,0.16)] transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Search input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={e => onQueryChange(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask a policy question or type keywords…"
                className="w-full text-xs rounded-xl bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] pl-8 pr-3 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[rgba(0,212,255,0.4)]"
              />
            </div>
            <button
              onClick={() => onSearch()}
              disabled={!query.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[rgba(0,212,255,0.15)] border border-[rgba(0,212,255,0.3)] text-[#00d4ff] text-xs font-semibold hover:bg-[rgba(0,212,255,0.25)] transition-colors disabled:opacity-40"
            >
              <Search size={11} /> Search
            </button>
            {results !== null && (
              <button
                onClick={onClear}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-200 border border-[rgba(255,255,255,0.08)] transition-colors"
                title="Clear results"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Results */}
          {results === null && (
            <p className="text-[11px] text-slate-600 text-center py-3">
              Search the Philippines DRRM policy knowledge base for official provisions, definitions, and LGU duties.
            </p>
          )}
          {results !== null && results.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-5 text-center">
              <Info size={16} className="text-slate-500" />
              <p className="text-xs text-slate-400">No relevant policy passages found in the knowledge base.</p>
              <p className="text-[10px] text-slate-600 leading-relaxed max-w-sm">
                The knowledge base does not contain sufficient evidence to address this query.
                Try rephrasing with keywords such as "LDRRMF", "evacuation", "BDRRMC", or "state of calamity",
                or consult the full source documents directly.
              </p>
            </div>
          )}
          {results !== null && results.length > 0 && (
            <div className="space-y-3 pt-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                {results.length} result{results.length !== 1 ? 's' : ''} — keyword-indexed retrieval
              </p>
              {results.map(entry => (
                <div key={entry.id} className="glass-bright rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-white">{entry.title}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.3)] text-[#00d4ff] font-semibold">
                      {entry.source}
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-[rgba(139,92,246,0.1)] border border-[rgba(139,92,246,0.3)] text-violet-400">
                      {entry.section}
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-slate-400">
                      {entry.instrument}
                    </span>
                    {entry.issuing_org && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.3)] text-amber-400">
                        {entry.issuing_org}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{entry.body}</p>
                  {entry.source_url && (
                    <a
                      href={entry.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[9px] text-[#00d4ff] hover:underline mt-0.5"
                    >
                      ↗ View source document
                    </a>
                  )}
                </div>
              ))}
              <p className="text-[10px] text-slate-600 text-center pt-1">
                This retrieval is keyword-based. Verify provisions against the full source document before official use.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export function PolicyIntelligence() {
  const { scope } = useAuthStore()
  const muni = scope?.municipality

  const [loading,         setLoading]         = useState(true)
  const [refreshing,      setRefreshing]       = useState(false)
  const [offlineMode,     setOfflineMode]      = useState(!getNetworkOnline())
  const [recommendations, setRecommendations]  = useState([])
  const [statuses,        setStatuses]         = useState(loadStatuses)
  const [showBrief,       setShowBrief]        = useState(false)
  const [briefTime,       setBriefTime]        = useState(null)
  const [dataRange,       setDataRange]        = useState(null)
  const [policyQuery,     setPolicyQuery]      = useState('')
  const [policyResults,   setPolicyResults]    = useState(null)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    setOfflineMode(false)

    try {
      const url = (p) => muni ? `${p}?municipality=${encodeURIComponent(muni)}` : p
      const [reports, centers, responders] = await Promise.all([
        api.get(url('/sos')).catch(() => []),
        api.get(url('/evacuation_centers')).catch(() => []),
        api.get(url('/responders')).catch(() => []),
      ])
      const recs = analyzeData(
        Array.isArray(reports) ? reports : [],
        Array.isArray(centers) ? centers : [],
        Array.isArray(responders) ? responders : [],
        muni,
      )
      setRecommendations(recs)
      setDataRange(new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }))
      logActivity('POST', 'ai_policy', 'policy_intelligence', null, {
        action: 'ai_policy_analysis',
        recommendationCount: recs.length,
        highPriorityCount: recs.filter(r => r.priority === 'high').length,
        municipality: muni ?? null,
      })
    } catch {
      setOfflineMode(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [muni])

  useEffect(() => {
    load()
    const handle = onNetworkChange(online => { if (online) load(true) })
    return () => { handle.then(h => h.remove()).catch(() => {}) }
  }, [load])

  function handleStatusChange(id, value) {
    const next = { ...statuses, [id]: value }
    setStatuses(next)
    saveStatuses(next)
    logActivity('PUT', 'policy_intelligence', 'policy_intelligence', id, { status: value })
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const highPriority  = recommendations.filter(r => r.priority === 'high').length
  const underReview   = recommendations.filter(r => (statuses[r.id] ?? 'draft') === 'under_review').length

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm gap-2">
        <Scale size={16} className="animate-pulse text-[#00d4ff]" />
        Analyzing system data…
      </div>
    )
  }

  return (
    <>
      {offlineMode && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-400">
          <WifiOff size={13} className="shrink-0" />
          <span>
            {recommendations.length > 0
              ? 'Network unavailable. Showing last generated results.'
              : 'You are offline. Connect to generate a policy analysis. KB search remains available.'}
          </span>
          <button onClick={() => load(true)} disabled={refreshing}
            className="ml-auto flex items-center gap-1 hover:text-white transition-colors disabled:opacity-40">
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} /> Retry
          </button>
        </div>
      )}

      <div className="p-4 space-y-4">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Scale size={16} className="text-[#00d4ff]" />
              <h1 className="text-base font-bold text-white">AI Policy Intelligence Center</h1>
            </div>
            <p className="text-xs text-slate-400">Evidence-based disaster governance and strategic decision support.</p>
            {dataRange && <p className="text-[10px] text-slate-600 mt-0.5">Data analyzed as of {dataRange}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setBriefTime(new Date()); setShowBrief(v => !v) }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[rgba(0,212,255,0.15)] border border-[rgba(0,212,255,0.3)] hover:bg-[rgba(0,212,255,0.25)] transition-colors"
            >
              <FileText size={13} />
              {showBrief ? 'Hide' : 'Generate'} Policy Brief
            </button>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-400 border border-[rgba(255,255,255,0.1)] hover:text-white transition-colors disabled:opacity-40"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Identified Issues"       value={recommendations.length} sub="Patterns detected"       color="text-[#00d4ff]" />
          <StatCard label="AI Recommendations"      value={recommendations.length} sub="Generated for LGU review" color="text-[#a78bfa]" />
          <StatCard label="Priority Interventions"  value={highPriority}           sub="Classified high priority" color="text-[#ef4444]" />
          <StatCard label="Under Review"            value={underReview}            sub="Awaiting LGU evaluation"  color="text-amber-400" />
        </div>

        {/* Notice */}
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[rgba(139,92,246,0.08)] border border-[rgba(139,92,246,0.2)] text-xs text-slate-400 leading-relaxed">
          <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
          <span>
            AI-generated recommendations are advisory drafts derived from validated SurvAIve PH records.
            They do not constitute official LGU policy and require data validation, stakeholder consultation,
            and legal review before adoption.
          </span>
        </div>

        {/* Recommendation cards */}
        {recommendations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-slate-500">
            <CheckCircle2 size={32} className="opacity-40 text-green-400" />
            <p className="text-sm">No policy issues detected from current system records.</p>
            <p className="text-xs text-slate-600">Record more emergency incidents, responder activity, or evacuation data for analysis.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Recommended Policy Interventions ({recommendations.length})
            </p>
            {recommendations.map(rec => (
              <RecommendationCard
                key={rec.id}
                rec={rec}
                status={statuses[rec.id] ?? 'draft'}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}

        {/* Policy brief panel */}
        {showBrief && (
          <PolicyBriefPanel
            recommendations={recommendations}
            statuses={statuses}
            muni={muni}
            generatedAt={briefTime ?? new Date()}
          />
        )}

        {/* Policy knowledge base search */}
        <PolicySearchPanel
          query={policyQuery}
          onQueryChange={setPolicyQuery}
          results={policyResults}
          onSearch={(q) => {
            const effectiveQuery = typeof q === 'string' ? q : policyQuery
            const hits = searchPolicyKB(effectiveQuery)
            setPolicyResults(hits)
            logActivity('GET', 'ai_policy', 'policy_kb_search', null, { query: effectiveQuery, resultCount: hits.length })
          }}
          onClear={() => { setPolicyQuery(''); setPolicyResults(null) }}
        />

        {/* Footer note */}
        <p className="text-[10px] text-slate-600 text-right pb-2">
          SurvAIve PH · AI Policy Intelligence Module · Recommendations require LGU validation
        </p>
      </div>
    </>
  )
}
