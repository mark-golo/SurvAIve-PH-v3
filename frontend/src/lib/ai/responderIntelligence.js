// AI Field Response Assistant engine — rule-based, offline, explainable.
// Reuses the system's existing scoring (normalizeSos / calcPriorityScore bands),
// clustering (kmeans) and capacity prediction (resourcePredictor) so AI output
// can never contradict what the rest of the system displays.
import { normalizeSos } from '../api'
import { clusterSOS } from '../kmeans'
import { predictDepletion } from '../resourcePredictor'
import { extractEntities, explainScoreFactors, normalizeText } from './emergencyIntelligence'
import { NUMBER_WORDS } from './lexicon'

const SERVICE_LABELS = {
  mdrrmo: 'Disaster', hospital: 'Medical', bfp: 'Fire', pnp: 'Crime/Security', pcg: 'Maritime',
}
const STATUS_LABELS = { trapped: 'Trapped', injured: 'Injured', missing: 'Missing', safe: 'Safe / needs supplies' }
const ACTIVE_STATUSES = new Set(['pending', 'en_route', 'on_scene'])

function timeBonusFactor(minutesAgo) {
  const pts = minutesAgo >= 240 ? 20 : minutesAgo >= 120 ? 15 : minutesAgo >= 60 ? 10 : minutesAgo >= 30 ? 5 : 0
  if (pts === 0) return null
  const h = Math.round(minutesAgo / 60)
  return { label: `Waiting ${h >= 1 ? `${h}h` : `${minutesAgo}m`}`, points: pts }
}

function scoreFactorsFor(r, minutesAgo) {
  const factors = explainScoreFactors({
    status:             r.status,
    people_count:       r.people_count,
    victim_age_group:   r.victim_age_group,
    special_conditions: r.special_conditions ?? '',
    is_verified:        !!r.is_verified || !!r.victim_id,
  })
  const tb = timeBonusFactor(minutesAgo)
  if (tb) factors.push(tb)
  return factors
}

// ── Incident briefing ─────────────────────────────────────────────────────────
// → { headline, narrative, fields, missingInfo[], priority:{label, score, factors[]} }
export function summarizeSOS(report) {
  const r = normalizeSos({ ...report })
  const minutesAgo = r.created_at
    ? Math.max(0, Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000))
    : 0

  const n = Number(r.people_count) || 1
  const services = (Array.isArray(r.service_type) ? r.service_type : [r.service_type])
    .filter(Boolean).map(s => SERVICE_LABELS[s] ?? s)
  const conds = (typeof r.special_conditions === 'string' ? r.special_conditions.split(',') : [])
    .filter(Boolean).map(c => c.replace(/_/g, ' '))
  const entities = extractEntities(r.notes ?? '')
  const place = [r.barangay, r.municipality].filter(Boolean).join(', ') || 'location not specified'

  const headline = [
    r.priority,
    `${STATUS_LABELS[r.status] ?? r.status ?? 'Unknown status'}`,
    `${n} ${n === 1 ? 'person' : 'people'}`,
    place,
  ].join(' — ')

  const bits = []
  bits.push(`${n === 1 ? 'A person' : `A group of ${n}`} reported "${STATUS_LABELS[r.status]?.toLowerCase() ?? r.status}" in ${place}${r.time_ago ? ` (${r.time_ago})` : ''}.`)
  if (services.length) bits.push(`Requested service${services.length > 1 ? 's' : ''}: ${services.join(', ')}.`)
  if (conds.length)    bits.push(`Reported conditions: ${conds.join(', ')}.`)
  if (r.victim_age_group && r.victim_age_group !== 'adult') bits.push(`Victim age group: ${r.victim_age_group}.`)
  if (entities.vulnerabilities.length) bits.push(`Notes mention vulnerable individuals: ${entities.vulnerabilities.join(', ')}.`)
  if (entities.landmarks.length) bits.push(`Landmark mentioned: "${entities.landmarks[0]}".`)
  bits.push('Verify accessibility and victim status before deployment.')

  const missingInfo = []
  if (!r.contact_number)            missingInfo.push('No contact number')
  if (r.lat == null || r.lng == null) missingInfo.push('No GPS coordinates')
  if (!r.notes)                     missingInfo.push('No description provided')
  if (!r.barangay)                  missingInfo.push('No barangay specified')

  return {
    headline,
    narrative: bits.join(' '),
    fields: {
      status: r.status, people_count: n, age_group: r.victim_age_group ?? 'adult',
      conditions: conds, services, location: place, time_ago: r.time_ago,
      contact: r.contact_number ?? null, name: r.name ?? null,
    },
    entities,
    missingInfo,
    priority: { label: r.priority, score: r.displayScore, factors: scoreFactorsFor(r, minutesAgo) },
  }
}

// ── Explainable queue ranking ─────────────────────────────────────────────────
// → sorted [{ report, tier: 'URGENT'|'HIGH'|'ROUTINE', score, factors[] }]
// Tiers map onto the system's existing bands: CRITICAL→URGENT, HIGH→HIGH, else ROUTINE.
export function rankQueue(reports) {
  return (reports ?? [])
    .map(raw => {
      const r = normalizeSos({ ...raw })
      const minutesAgo = r.created_at
        ? Math.max(0, Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000))
        : 0
      const tier = r.priority === 'CRITICAL' ? 'URGENT' : r.priority === 'HIGH' ? 'HIGH' : 'ROUTINE'
      return { report: r, tier, score: r.displayScore, factors: scoreFactorsFor(r, minutesAgo) }
    })
    .sort((a, b) => b.score - a.score)
}

// ── Situation assessment ──────────────────────────────────────────────────────
// → { clusters[], depletion, anomalies[], recommendations[] }
// All claims carry evidence; data limitations are stated, never hidden.
export function assessSituation(reports = [], centers = [], responders = []) {
  const normalized = reports.map(r => normalizeSos({ ...r }))
  const active = normalized.filter(r => ACTIVE_STATUSES.has(r.rescue_status))

  const clusters  = clusterSOS(active)
  const depletion = predictDepletion(normalized, responders)

  // Surge anomaly: last hour vs. trailing 6h hourly average
  const now = Date.now()
  const lastHour = normalized.filter(r => r.created_at && now - new Date(r.created_at).getTime() <= 60 * 60e3).length
  const trailing = normalized.filter(r => {
    if (!r.created_at) return false
    const age = now - new Date(r.created_at).getTime()
    return age > 60 * 60e3 && age <= 360 * 60e3
  }).length
  const trailingAvg = trailing / 5

  const anomalies = []
  if (lastHour >= 3 && lastHour > trailingAvg * 2) {
    anomalies.push({
      text: `Unusual surge: ${lastHour} report${lastHour !== 1 ? 's' : ''} in the last hour vs. ~${trailingAvg.toFixed(1)}/hr baseline.`,
      evidence: `last 60 min = ${lastHour}, prior 5h avg = ${trailingAvg.toFixed(1)}/hr`,
    })
  }
  const unresolvedOld = active.filter(r => r.created_at && now - new Date(r.created_at).getTime() > 120 * 60e3).length
  if (unresolvedOld > 0) {
    anomalies.push({
      text: `${unresolvedOld} active SOS older than 2 hours — review for escalation.`,
      evidence: `${unresolvedOld} of ${active.length} active reports exceed 120 min`,
    })
  }

  const recommendations = []
  const topCluster = clusters[0]
  if (topCluster && topCluster.count >= 2) {
    recommendations.push({
      text: `Concentrate assessment on ${topCluster.barangays.join(', ') || 'the top cluster area'} — ${topCluster.count} active reports, avg priority ${topCluster.avgScore}.`,
      evidence: `cluster of ${topCluster.count} reports${topCluster.criticalCount ? `, ${topCluster.criticalCount} CRITICAL` : ''}`,
    })
  }
  if (depletion.alertLevel === 'OVERWHELMED' || depletion.alertLevel === 'AT_RISK') {
    recommendations.push({
      text: `Responder capacity is ${depletion.alertLevel.replace('_', ' ')}: ${depletion.activeLoad} active cases vs. capacity ${depletion.capacity}. Request reinforcement or agency escalation.`,
      evidence: `${depletion.onDutyCount} on-duty responders × 2 cases = ${depletion.capacity}`,
    })
  }
  if (centers.length === 0) {
    recommendations.push({
      text: 'No evacuation-center data available in this view — verify center capacity through the admin dashboard before directing evacuees.',
      evidence: 'centers list empty at assessment time',
    })
  }
  if (recommendations.length === 0) {
    recommendations.push({
      text: 'No abnormal patterns detected in current reports. Maintain normal monitoring.',
      evidence: `${active.length} active reports, capacity ratio ${(depletion.loadRatio * 100).toFixed(0)}%`,
    })
  }

  return { clusters, depletion, anomalies, recommendations, activeCount: active.length }
}

// ── Field-note parsing → draft documentation ─────────────────────────────────
// → { rescued_count, destination, medical_needs[], missingFields[], evidence[] }
// Output is a DRAFT — the responder reviews and confirms through the existing flow.
export function parseFieldNotes(text, { centerNames = [] } = {}) {
  const norm = normalizeText(text)
  const evidence = []

  // Rescued count
  let rescued_count = null
  let m = norm.match(/(\d{1,2})\s*(?:victims?|people|persons?|survivors?|individuals?|pax|ka tao|tao)\b/)
    ?? norm.match(/(?:rescued|evacuated|transferred|extracted|nailigtas|nasagip)\s*(?:all\s*)?(\d{1,2})\b/)
  if (m) {
    rescued_count = Number(m[1])
    evidence.push({ field: 'rescued_count', term: m[0].trim() })
  }
  if (rescued_count == null) {
    outer:
    for (const words of Object.values(NUMBER_WORDS)) {
      for (const [word, n] of Object.entries(words)) {
        if (new RegExp(`\\b${word}\\s*(?:victims?|people|persons?|tao|ka tao)\\b`).test(norm)) {
          rescued_count = n
          evidence.push({ field: 'rescued_count', term: word })
          break outer
        }
      }
    }
  }

  // Destination — explicit transfer phrases, then known center names
  let destination = null
  m = norm.match(/(?:transferred to|brought to|evacuated to|transported to|moved to|dinala sa|gidala sa)\s+([a-z0-9' .-]{3,50}?)(?:[.,;!?]|$)/)
  if (m) {
    destination = m[1].trim()
    evidence.push({ field: 'destination', term: m[0].trim() })
  }
  if (!destination) {
    for (const name of centerNames) {
      if (name && norm.includes(normalizeText(name))) {
        destination = name
        evidence.push({ field: 'destination', term: name })
        break
      }
    }
  }

  // Medical needs — reuse entity extraction on the note text
  const entities = extractEntities(text)
  const medical_needs = []
  if (entities.conditions.includes('medical_emergency')) medical_needs.push('medical attention required')
  if (entities.status === 'injured') medical_needs.push('injury treatment')
  for (const v of entities.vulnerabilities) {
    if (v === 'senior')   medical_needs.push('elderly care / assessment')
    if (v === 'child')    medical_needs.push('pediatric assessment')
    if (v === 'pregnant') medical_needs.push('obstetric assessment')
    if (v === 'pwd')      medical_needs.push('mobility assistance')
  }
  entities.matchedTerms
    .filter(t => t.category === 'condition' || t.category === 'vulnerability' || t.category === 'status')
    .forEach(t => evidence.push({ field: 'medical_needs', term: t.term }))

  const missingFields = []
  if (rescued_count == null) missingFields.push('rescued_count')
  if (!destination)          missingFields.push('destination')
  if (medical_needs.length === 0 && /(?:injur|medical|sugat|samad)/.test(norm)) missingFields.push('medical_details')

  return {
    rescued_count,
    destination,
    medical_needs: [...new Set(medical_needs)],
    notesClean: String(text ?? '').trim(),
    missingFields,
    evidence,
  }
}
