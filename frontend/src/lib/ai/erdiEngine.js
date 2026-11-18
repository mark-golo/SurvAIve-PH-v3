// Emergency Response Delay Intelligence (ERDI) — rule-based, offline, explainable.
// Follows the same pattern as responderIntelligence.js: pure deterministic JS,
// no network calls, works offline. All timing is in milliseconds internally.

const MIN = 60_000

// ── Priority baselines (ms per stage) ────────────────────────────────────────
// Based on Philippine MDRRMO target response standards.
// Calibrate these from historical sos_status_events data as usage grows.
const BASELINES = {
  CRITICAL: { ackMs: 5 * MIN, enRouteMs: 10 * MIN, onSceneMs: 25 * MIN },
  HIGH:     { ackMs: 10 * MIN, enRouteMs: 20 * MIN, onSceneMs: 40 * MIN },
  MODERATE: { ackMs: 15 * MIN, enRouteMs: 30 * MIN, onSceneMs: 60 * MIN },
  LOW:      { ackMs: 20 * MIN, enRouteMs: 45 * MIN, onSceneMs: 90 * MIN },
}

export function getBaselineFor(aiPriorityScore) {
  const score = Number(aiPriorityScore) || 0
  if (score >= 80) return BASELINES.CRITICAL
  if (score >= 60) return BASELINES.HIGH
  if (score >= 40) return BASELINES.MODERATE
  return BASELINES.LOW
}

export function getPriorityLabel(aiPriorityScore) {
  const score = Number(aiPriorityScore) || 0
  if (score >= 80) return 'CRITICAL'
  if (score >= 60) return 'HIGH'
  if (score >= 40) return 'MODERATE'
  return 'LOW'
}

// ── Weather multiplier ────────────────────────────────────────────────────────
// Extends baseline by a factor when severe weather is active.
export function getWeatherFactor(riskLevel) {
  switch (riskLevel) {
    case 'EXTREME':  return 1.60
    case 'HIGH':     return 1.35
    case 'MODERATE': return 1.15
    default:         return 1.00
  }
}

// ── Geographic risk tier ─────────────────────────────────────────────────────
// Simple heuristics until GIS data is integrated. Barangay name patterns and
// Philippine coordinate bounds are used as proxies.
const COASTAL_KEYWORDS = /port|puerto|pier|bay|baybay|dagat|isla|island|cove|shore|beach|coastal/i
const REMOTE_KEYWORDS  = /sitio|far|mountain|bundok|bukid|lalim|valley|canyon/i

export function getGeoTier(barangay = '', lat, lng) {
  if (REMOTE_KEYWORDS.test(barangay))  return 'remote'
  if (COASTAL_KEYWORDS.test(barangay)) return 'coastal'
  // Very approximate: rural if far from typical PH urban clusters
  if (lat && lng) {
    // Outside Metro Manila / Cebu / Davao clusters → lean rural
    const inUrbanCluster =
      (lat > 14.4 && lat < 14.8 && lng > 120.9 && lng < 121.2) || // Metro Manila
      (lat > 10.2 && lat < 10.5 && lng > 123.8 && lng < 124.1) || // Metro Cebu
      (lat > 7.0  && lat < 7.2  && lng > 125.5 && lng < 125.7)    // Metro Davao
    if (!inUrbanCluster) return 'rural'
  }
  return 'urban'
}

// ── Stage timing from sos_status_events ──────────────────────────────────────
// events: array of { old_status, new_status, created_at } sorted ascending.
// report: { timestamp | created_at, rescue_status }
export function computeDelayStages(events = [], report = {}) {
  const now = Date.now()
  const created = new Date(report.timestamp ?? report.created_at ?? now).getTime()

  // Find the timestamp when a specific status was first entered
  function enteredAt(status) {
    const ev = events.find(e => e.new_status === status)
    return ev ? new Date(ev.created_at).getTime() : null
  }

  const ackedAt    = enteredAt('acknowledged')
    ?? (report.confirmed_at ? new Date(report.confirmed_at).getTime() : null)
  const enRouteAt  = enteredAt('en_route')
  const onSceneAt  = enteredAt('on_scene')
  const rescuedAt  = enteredAt('rescued')

  const rescueStatus = report.rescue_status ?? 'pending'
  const isActive     = !['rescued', 'cannot_reach'].includes(rescueStatus)

  // pending → acknowledged
  const pendingEnd = ackedAt ?? (isActive && rescueStatus === 'pending' ? now : null)
  const pendingMs  = pendingEnd ? pendingEnd - created : null

  // acknowledged → en_route
  const ackEnd  = enRouteAt ?? (isActive && rescueStatus === 'acknowledged' ? now : null)
  const ackMs   = (ackedAt && ackEnd) ? ackEnd - ackedAt : null

  // en_route → on_scene
  const enRouteEnd = onSceneAt ?? (isActive && rescueStatus === 'en_route' ? now : null)
  const enRouteMs  = (enRouteAt && enRouteEnd) ? enRouteEnd - enRouteAt : null

  // total active time (created → now if still active, else created → rescued/on_scene)
  const activeEnd  = rescuedAt ?? (isActive ? now : onSceneAt ?? now)
  const totalActiveMs = activeEnd - created

  return { pendingMs, ackMs, enRouteMs, totalActiveMs, isActive }
}

// ── Main assessment ──────────────────────────────────────────────────────────
// report:      { ai_priority_score, rescue_status, timestamp|created_at, barangay, lat, lng, vulnerabilities, people_count }
// events:      sos_status_events array sorted by created_at ascending
// responder:   { lat, lng, last_seen_at } or null
// weatherRisk: { riskLevel: 'LOW'|'MODERATE'|'HIGH'|'EXTREME', rainfall, windSpeed } or null
export function assessDelay(report = {}, events = [], responder = null, weatherRisk = null, agencyContext = null) {
  const now = Date.now()
  const priorityLabel = getPriorityLabel(report.ai_priority_score)
  const baseline      = getBaselineFor(report.ai_priority_score)
  const weatherFactor = getWeatherFactor(weatherRisk?.riskLevel ?? 'LOW')
  const geoTier       = getGeoTier(report.barangay, report.lat, report.lng)
  const stages        = computeDelayStages(events, report)

  // Adjust baselines for weather + geography
  const geoMultiplier = geoTier === 'remote' ? 1.5 : geoTier === 'coastal' ? 1.2 : geoTier === 'rural' ? 1.2 : 1.0
  const totalMultiplier = weatherFactor * geoMultiplier
  const adj = {
    ackMs:     baseline.ackMs     * totalMultiplier,
    enRouteMs: baseline.enRouteMs * totalMultiplier,
    onSceneMs: baseline.onSceneMs * totalMultiplier,
  }

  // Per-stage results
  function stageResult(elapsedMs, adjBaselineMs, stageLabel) {
    if (elapsedMs === null) return { elapsed: null, baseline: adjBaselineMs, overMs: null, label: stageLabel, ratio: null }
    const overMs = Math.max(0, elapsedMs - adjBaselineMs)
    const ratio  = elapsedMs / adjBaselineMs
    return { elapsed: elapsedMs, baseline: adjBaselineMs, overMs, label: stageLabel, ratio }
  }

  const stageResults = {
    pending:      stageResult(stages.pendingMs,  adj.ackMs,     'Dispatch'),
    acknowledged: stageResult(stages.ackMs,      adj.enRouteMs, 'Mobilisation'),
    en_route:     stageResult(stages.enRouteMs,  adj.onSceneMs, 'Travel'),
  }

  // Delay tier — worst ratio across active stages
  const ratios = Object.values(stageResults).map(s => s.ratio).filter(r => r !== null)
  const maxRatio = ratios.length > 0 ? Math.max(...ratios) : 0

  // Also check total active time vs on_scene baseline
  const totalRatio = stages.totalActiveMs / adj.onSceneMs

  let tier
  if (maxRatio > 2.5 || totalRatio > 3.0) tier = 'CRITICAL_DELAY'
  else if (maxRatio > 1.5)                tier = 'DELAYED'
  else if (maxRatio > 1.0)                tier = 'MINOR_DELAY'
  else                                    tier = 'ON_TRACK'

  // Contributing factors — each is { label: string, type: 'observed'|'reported'|'inferred' }
  // type meanings: observed = live system data, reported = user/API-sourced input, inferred = derived heuristic
  const factors = []

  if (weatherRisk && weatherRisk.riskLevel !== 'LOW') {
    const pct = Math.round((weatherFactor - 1) * 100)
    const label = weatherRisk.riskLevel === 'EXTREME' ? 'Extreme weather' : weatherRisk.riskLevel === 'HIGH' ? 'Heavy rain / strong winds' : 'Moderate rainfall'
    factors.push({ label: `${label} (+${pct}% travel time estimate)`, type: 'reported' })
  }

  if (geoTier === 'remote')  factors.push({ label: 'Remote location — limited road access', type: 'inferred' })
  if (geoTier === 'coastal') factors.push({ label: 'Coastal barangay — may require water access', type: 'inferred' })
  if (geoTier === 'rural')   factors.push({ label: 'Rural barangay — longer travel distances typical', type: 'inferred' })

  // Disaster-type-specific context factors (§4.1)
  const svcType = report.service_type
  if (svcType === 'bfp') {
    factors.push({ label: 'Active fire incident — smoke or fire spread may affect route safety', type: 'reported' })
  } else if (svcType === 'pcg') {
    factors.push({ label: 'Maritime incident — may require water transport or coast guard coordination', type: 'reported' })
  } else if (svcType === 'pnp') {
    factors.push({ label: 'Security incident — responders may require additional precautions on approach', type: 'reported' })
  } else if (svcType === 'mdrrmo' && report.ai_primary_category) {
    const cat = String(report.ai_primary_category).toLowerCase()
    if (cat.includes('earthquake') || cat.includes('collapse')) {
      factors.push({ label: 'Earthquake/structural collapse — unstable terrain or debris may obstruct access', type: 'reported' })
    } else if (cat.includes('landslide')) {
      factors.push({ label: 'Landslide conditions — road sections may be blocked or unstable', type: 'reported' })
    }
  }

  const vulnList = Array.isArray(report.vulnerabilities)
    ? report.vulnerabilities
    : typeof report.vulnerabilities === 'string'
      ? report.vulnerabilities.split(',').filter(Boolean)
      : []
  if (vulnList.length > 0) {
    factors.push({ label: `Vulnerable individuals reported (${vulnList.slice(0,2).map(v => v.replace(/_/g,' ')).join(', ')}${vulnList.length > 2 ? ` +${vulnList.length-2} more` : ''})`, type: 'reported' })
  }
  if (Number(report.people_count) >= 10) {
    factors.push({ label: `Large-scale incident (${report.people_count} people) — may require additional resources`, type: 'reported' })
  }

  Object.values(stageResults).forEach(s => {
    if (s.overMs !== null && s.overMs > 0) {
      const over = formatMsShort(s.overMs)
      factors.push({ label: `${s.label} stage is ${over} beyond the adjusted baseline`, type: 'observed' })
    }
  })

  if (!responder?.lat || !responder?.lng) {
    factors.push({ label: 'Responder location not yet available — ETA cannot be confirmed', type: 'observed' })
  } else {
    const { trackingFreshness } = _freshnessFns
    const freshness = trackingFreshness(responder.last_seen_at)
    if (freshness === 'stale')             factors.push({ label: 'Responder GPS last updated more than 5 minutes ago — position may be outdated', type: 'observed' })
    else if (freshness === 'reconnecting') factors.push({ label: 'Responder GPS signal is intermittent', type: 'observed' })
  }

  if (agencyContext?.onDutyCount > 0) {
    const loadRatio = (agencyContext.activeLoad ?? 0) / (agencyContext.onDutyCount * 2)
    if (loadRatio > 0.8) {
      factors.push({ label: `High agency workload — ${agencyContext.activeLoad} active incident${agencyContext.activeLoad !== 1 ? 's' : ''} across ${agencyContext.onDutyCount} on-duty responder${agencyContext.onDutyCount !== 1 ? 's' : ''}`, type: 'observed' })
    }
  }

  if (factors.length === 0 && tier === 'ON_TRACK') {
    factors.push({ label: `Response is proceeding within the ${priorityLabel.toLowerCase()}-priority baseline`, type: 'inferred' })
  }

  // Confidence
  let confidence = 'high'
  if (!responder?.lat) confidence = 'medium'
  if (events.length === 0) confidence = 'low'
  const staleGPS = responder?.last_seen_at && _freshnessFns.trackingFreshness(responder.last_seen_at) === 'stale'
  if (staleGPS) confidence = 'low'

  // Role-appropriate recommendations
  const recs = buildRecommendations(tier, stageResults, report, geoTier, weatherRisk)

  // Potential impact summary (§7 output structure)
  const potentialImpact = (() => {
    if (tier === 'ON_TRACK') return null
    if (tier === 'MINOR_DELAY') return 'Minor delays may prolong victim wait time beyond priority targets.'
    if (tier === 'DELAYED')     return 'Continued delay increases risk of deteriorating conditions; responder reassignment may be needed.'
    return 'Significant delay — victim may require immediate alternative response resources or inter-agency escalation.'
  })()

  return {
    tier,
    priorityLabel,
    geoTier,
    weatherFactor,
    stages: stageResults,
    factors,
    recommendations: recs,
    potentialImpact,
    confidence,
    staleDataWarning: staleGPS || events.length === 0,
    assessedAt: new Date(now),
  }
}

function buildRecommendations(tier, stages, report, geoTier, weatherRisk) {
  const isDelayed = tier === 'DELAYED' || tier === 'CRITICAL_DELAY'

  const victim = (() => {
    if (!isDelayed) return 'Your responder is on the way. Stay in a safe, accessible location and keep your phone available.'
    if (tier === 'CRITICAL_DELAY') return 'Response is taking longer than expected. Please remain in a safe location, conserve your phone battery, and contact a neighbour or local authority if your situation becomes more urgent.'
    return 'Response may be delayed. Stay in a safe, accessible location, keep your phone available, and avoid hazardous areas.'
  })()

  const responder = (() => {
    if (!isDelayed) return 'Response is within expected timeframe. Maintain current route and status updates.'
    const travel = stages.en_route?.overMs > 0 ? 'Assess your current route for obstructions. ' : ''
    const geo = geoTier !== 'urban' ? 'Confirm accessibility of the last-mile route. ' : ''
    const weather = weatherRisk && weatherRisk.riskLevel !== 'LOW' ? 'Take precautions for current weather conditions. ' : ''
    return `${travel}${geo}${weather}Update your status and estimated arrival. Contact your dispatch if you need a route reassessment.`.trim()
  })()

  const admin = (() => {
    if (!isDelayed) return 'No action required. Monitor for status changes.'
    if (tier === 'CRITICAL_DELAY') return 'Consider reviewing the assigned responder. Assess whether a closer unit, alternative route, or additional resources are available. Escalate if needed.'
    return 'Review response progress. Verify the assigned responder can reach the location. Consider contacting the responder for a status update.'
  })()

  // Agency role — dispatch and coordination focus (§5.3)
  const agency = (() => {
    if (!isDelayed) return 'No action required. Monitor for status updates.'
    if (tier === 'CRITICAL_DELAY') return 'Reassess the assigned responder immediately. Evaluate whether a closer unit, alternative route, or inter-agency coordination is available. Escalate to LGU administrator if the incident cannot be resolved with available resources.'
    return 'Review the assigned responder\'s availability and route. Consider contacting the responder for status confirmation. Coordinate with the nearest available unit if travel is obstructed.'
  })()

  return { victim, responder, admin, agency }
}

// ── Plain-language explanation ────────────────────────────────────────────────
export function explainDelay(assessment, role = 'victim') {
  if (!assessment) return ''
  const { tier, factors } = assessment
  const rec = assessment.recommendations?.[role] ?? ''

  const intro = {
    ON_TRACK:       'Response is proceeding as expected.',
    MINOR_DELAY:    'A minor delay has been detected.',
    DELAYED:        'The response appears to be delayed.',
    CRITICAL_DELAY: 'A significant response delay has been detected.',
  }[tier] ?? ''

  const topFactor = factors[0]?.label ?? null
  const causeStr  = topFactor ? ` Possible cause: ${topFactor.charAt(0).toLowerCase() + topFactor.slice(1)}.` : ''

  return `${intro}${causeStr}${rec ? ` ${rec}` : ''}`
}

// ── Formatting helpers ────────────────────────────────────────────────────────
export function formatMsShort(ms) {
  if (!ms || ms < 0) return '0 min'
  const totalMin = Math.round(ms / MIN)
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function tierColor(tier) {
  switch (tier) {
    case 'CRITICAL_DELAY': return '#ef4444'
    case 'DELAYED':        return '#f97316'
    case 'MINOR_DELAY':    return '#f59e0b'
    default:               return '#22c55e'
  }
}

export function tierLabel(tier) {
  switch (tier) {
    case 'CRITICAL_DELAY': return 'Critical Delay'
    case 'DELAYED':        return 'Delayed'
    case 'MINOR_DELAY':    return 'Minor Delay'
    default:               return 'On Track'
  }
}

// Lazy import shim — avoids circular deps with tracking.js
// tracking.js uses no AI lib so the actual import is safe;
// we wrap it so erdiEngine.js can be loaded before tracking.js.
const _freshnessFns = {
  trackingFreshness(lastSeenAt) {
    if (!lastSeenAt) return 'unknown'
    const age = (Date.now() - new Date(lastSeenAt).getTime()) / 1000
    if (age < 60)  return 'live'
    if (age < 300) return 'reconnecting'
    return 'stale'
  },
}
