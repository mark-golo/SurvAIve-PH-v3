// AI Emergency Intelligence Engine — rule-based NLP, runs fully offline.
// Every output carries matched evidence terms: nothing is asserted without a term match,
// and the priority score reuses calcPriorityScore so score and explanation never diverge.
import { calcPriorityScore } from '../api'
import {
  SERVICE_LEXICON, STATUS_LEXICON, CONDITION_LEXICON,
  VULNERABILITY_LEXICON, NUMBER_WORDS, LANDMARK_MARKERS,
} from './lexicon'

// ── Text utilities ────────────────────────────────────────────────────────────
export function normalizeText(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const _rxCache = new Map()
function termRegex(term) {
  let rx = _rxCache.get(term)
  if (!rx) {
    rx = new RegExp(`(?:^|[^a-z0-9])${escapeRx(term)}(?:$|[^a-z0-9])`)
    _rxCache.set(term, rx)
  }
  return rx
}

// Match a {en:[],fil:[],bis:[]} term map against normalized text → [{term, lang}]
function matchLangMap(norm, langMap) {
  const hits = []
  for (const [lang, terms] of Object.entries(langMap)) {
    for (const term of terms) {
      if (termRegex(term).test(norm)) hits.push({ term, lang })
    }
  }
  return hits
}

// ── Incident classification ──────────────────────────────────────────────────
// → { serviceTypes: ['mdrrmo', ...], primary, subtype, confidence, matchedTerms }
export function classifyIncident(text) {
  const norm = normalizeText(text)
  const matchedTerms = []
  const services = []

  for (const [service, def] of Object.entries(SERVICE_LEXICON)) {
    let totalHits = 0
    let bestSubtype = null
    let bestSubtypeHits = 0
    for (const [subtype, langMap] of Object.entries(def.subtypes)) {
      const hits = matchLangMap(norm, langMap)
      if (hits.length > 0) {
        totalHits += hits.length
        hits.forEach(h => matchedTerms.push({ ...h, category: 'incident', key: `${service}/${subtype}` }))
        if (hits.length > bestSubtypeHits) { bestSubtype = subtype; bestSubtypeHits = hits.length }
      }
    }
    if (totalHits > 0) services.push({ service, label: def.label, hits: totalHits, subtype: bestSubtype })
  }

  services.sort((a, b) => b.hits - a.hits)
  const top = services[0] ?? null
  const confidence = top ? Math.min(1, top.hits / 2) : 0

  return {
    serviceTypes: services.map(s => s.service),
    primary:      confidence >= 0.25 ? top.service : null,
    primaryLabel: confidence >= 0.25 ? top.label   : null,
    subtype:      confidence >= 0.25 ? top.subtype : null,
    confidence,
    matchedTerms,
  }
}

// ── Entity extraction ─────────────────────────────────────────────────────────
// → { status, victimCount, ageGroup, vulnerabilities, conditions, landmarks, matchedTerms }
export function extractEntities(text) {
  const norm = normalizeText(text)
  const matchedTerms = []

  // Victim status — priority order mirrors calcPriorityScore weights
  let status = null
  for (const key of ['trapped', 'injured', 'missing', 'stranded']) {
    const hits = matchLangMap(norm, STATUS_LEXICON[key])
    if (hits.length > 0) {
      hits.forEach(h => matchedTerms.push({ ...h, category: 'status', key }))
      if (!status) status = key
    }
  }

  // Victim count — digits near people-words first, then number words, then bare digits
  let victimCount = null
  const peopleCtx = '(?:people|persons?|victims?|pax|kami|tao|ka|mi kabuok)'
  let m = norm.match(new RegExp(`\\b(\\d{1,2})\\s*${peopleCtx}\\b`))
  if (m) victimCount = Number(m[1])
  if (victimCount == null) {
    outer:
    for (const [lang, words] of Object.entries(NUMBER_WORDS)) {
      for (const [word, n] of Object.entries(words)) {
        if (new RegExp(`\\b${word}\\s*${peopleCtx}\\b`).test(norm) ||
            new RegExp(`\\b${peopleCtx}\\s*(?:ay|nga|na)?\\s*${word}\\b`).test(norm)) {
          victimCount = n
          matchedTerms.push({ term: word, lang, category: 'count', key: String(n) })
          break outer
        }
      }
    }
  }
  if (victimCount == null) {
    m = norm.match(/(?:^|[^a-z0-9.])(\d{1,2})(?:$|[^a-z0-9.])/)
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 99) victimCount = Number(m[1])
  }

  // Vulnerabilities + age group (child checked before senior, matching prior behavior)
  const vulnerabilities = []
  for (const [key, langMap] of Object.entries(VULNERABILITY_LEXICON)) {
    const hits = matchLangMap(norm, langMap)
    if (hits.length > 0) {
      vulnerabilities.push(key)
      hits.forEach(h => matchedTerms.push({ ...h, category: 'vulnerability', key }))
    }
  }
  const ageGroup = vulnerabilities.includes('child') ? 'child'
                 : vulnerabilities.includes('senior') ? 'senior'
                 : null

  // Special conditions — keys match the existing special_conditions values
  const conditions = []
  for (const [key, langMap] of Object.entries(CONDITION_LEXICON)) {
    const hits = matchLangMap(norm, langMap)
    if (hits.length > 0) {
      conditions.push(key)
      hits.forEach(h => matchedTerms.push({ ...h, category: 'condition', key }))
    }
  }

  // Landmarks — text following a landmark marker phrase
  const landmarks = []
  for (const markers of Object.values(LANDMARK_MARKERS)) {
    for (const marker of markers) {
      const mm = norm.match(new RegExp(`\\b${escapeRx(marker)}\\s+([a-z0-9' ]{3,40}?)(?:[.,;!?]|$)`))
      if (mm) {
        const lm = mm[1].trim()
        if (lm && !landmarks.includes(lm)) landmarks.push(lm)
      }
    }
  }

  return { status, victimCount, ageGroup, vulnerabilities, conditions, landmarks, matchedTerms }
}

// ── Explainable priority ─────────────────────────────────────────────────────
// Mirrors calcPriorityScore's branches so factors always sum to the real score.
export function explainScoreFactors(body) {
  const factors = [{ label: 'Base score', points: 50 }]
  const s = (body.status ?? '').toLowerCase()
  if      (s === 'trapped')  factors.push({ label: 'Status: trapped', points: 30 })
  else if (s === 'injured')  factors.push({ label: 'Status: injured', points: 20 })
  else if (s === 'missing')  factors.push({ label: 'Status: missing', points: 15 })
  else if (s === 'stranded') factors.push({ label: 'Status: stranded / isolated', points: 10 })

  const n = Number(body.people_count) || 1
  if      (n >= 10) factors.push({ label: `${n} people affected`, points: 25 })
  else if (n >= 5)  factors.push({ label: `${n} people affected`, points: 15 })
  else if (n >= 2)  factors.push({ label: `${n} people affected`, points: 5 })

  const age = body.victim_age_group ?? 'adult'
  if      (age === 'senior') factors.push({ label: 'Senior victim', points: 20 })
  else if (age === 'child')  factors.push({ label: 'Child victim', points: 15 })

  const conds = typeof body.special_conditions === 'string'
    ? body.special_conditions.split(',').filter(Boolean)
    : []
  if (conds.includes('medical_emergency'))   factors.push({ label: 'Medical emergency', points: 20 })
  if (conds.includes('fire'))                factors.push({ label: 'Fire reported', points: 15 })
  if (conds.includes('structural_collapse')) factors.push({ label: 'Structural collapse', points: 10 })
  if (conds.includes('flooding'))            factors.push({ label: 'Flooding reported', points: 10 })
  if (conds.includes('needs_evacuation'))    factors.push({ label: 'Evacuation required', points: 15 })

  if (!body.is_verified) factors.push({ label: 'Unverified report', points: -10 })
  return factors
}

const scoreLabel = (score) =>
  score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 40 ? 'MODERATE' : 'LOW'

// → { score, label, factors:[{label, points, evidence?}] }
export function suggestPriority(entities, { isVerified = false } = {}) {
  const body = {
    status:             entities.status ?? '',
    people_count:       entities.victimCount ?? 1,
    victim_age_group:   entities.ageGroup ?? 'adult',
    special_conditions: entities.conditions.join(','),
    is_verified:        isVerified,
  }
  const score = calcPriorityScore(body)
  const factors = explainScoreFactors(body).map(f => {
    const ev = entities.matchedTerms.find(t =>
      (f.label.startsWith('Status') && t.category === 'status') ||
      (f.label.includes('victim') && t.category === 'vulnerability') ||
      (f.label === 'Medical emergency'    && t.key === 'medical_emergency') ||
      (f.label === 'Fire reported'        && t.key === 'fire') ||
      (f.label === 'Structural collapse'  && t.key === 'structural_collapse') ||
      (f.label === 'Flooding reported'    && t.key === 'flooding') ||
      (f.label === 'Evacuation required'  && t.key === 'needs_evacuation')
    )
    return ev ? { ...f, evidence: ev.term } : f
  })
  return { score, label: scoreLabel(score), factors }
}

// ── Structured SOS builder ────────────────────────────────────────────────────
// Output `form` matches SOSReport's form state shape; ageGroup/conditions match its
// separate state hooks. The AI only PREFILLS — the user reviews and submits.
export function buildStructuredSOS(text, { isVerified = false } = {}) {
  const classification = classifyIncident(text)
  const entities       = extractEntities(text)
  const priority       = suggestPriority(entities, { isVerified })

  const missingFields = []
  if (classification.serviceTypes.length === 0) {
    missingFields.push({ field: 'service_type', prompt: 'What type of emergency is this — Disaster, Medical, Fire, Crime, or Maritime?' })
  }
  if (entities.victimCount == null) {
    missingFields.push({ field: 'people_count', prompt: 'How many people need help, including yourself?' })
  }
  if (entities.landmarks.length === 0) {
    missingFields.push({ field: 'landmark', prompt: 'Can you describe a nearby landmark (school, church, store)?' })
  }

  return {
    form: {
      status:       entities.status ?? 'trapped',
      people_count: entities.victimCount ?? 1,
      service_type: classification.serviceTypes,
      notes:        String(text ?? '').trim(),
    },
    ageGroup:   entities.ageGroup ?? 'adult',
    conditions: entities.conditions,
    priority,
    classification,
    entities,
    missingFields,
  }
}
