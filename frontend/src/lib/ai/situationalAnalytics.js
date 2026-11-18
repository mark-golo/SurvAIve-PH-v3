// Shared AI Situational Analytics logic used by both AdminAnalytics and SituationalAwareness.
// Pure JS, fully offline — no network calls or external dependencies.

const getPriority = (score) =>
  score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 40 ? 'MODERATE' : 'LOW'

export function analyzeZones(reports) {
  if (!reports.length) return []

  // Normalise each report (handle both Supabase and PHP API shapes)
  const normalised = reports.map(r => ({
    ...r,
    priority: r.priority ?? getPriority(r.ai_priority_score ?? 50),
    minutes_ago: Number(r.minutes_ago) || 9999,
  }))

  // Group by barangay
  const groups = {}
  normalised.forEach(r => {
    const key = r.barangay?.trim() || 'Unknown'
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
  })

  const maxCount = Math.max(...Object.values(groups).map(g => g.length), 1)

  return Object.entries(groups).map(([barangay, zr]) => {
    const total         = zr.length
    const unrescued     = zr.filter(r => r.rescue_status !== 'rescued').length
    const rescued       = total - unrescued
    const criticalCount = zr.filter(r => r.priority === 'CRITICAL').length
    const highCount     = zr.filter(r => r.priority === 'HIGH').length
    const avgScore      = Math.round(zr.reduce((s, r) => s + (r.ai_priority_score ?? 50), 0) / total)
    const criticalPct   = criticalCount / total
    // Surge: 3+ new reports in the last 30 minutes
    const recentCount    = zr.filter(r => r.minutes_ago < 30).length
    const isSurging      = recentCount >= 3 || (recentCount >= 2 && total >= 4)

    // Rapidly escalating: new CRITICAL/HIGH in last 60 min
    const recentCritical = zr.filter(r => r.minutes_ago < 60 &&
      (r.priority === 'CRITICAL' || r.priority === 'HIGH')).length

    // Zone classification — deterministic, no randomness
    let tag, tagColor, recommendation, sortPriority
    if (criticalCount >= 3 || total >= 8 || (criticalPct >= 0.5 && total >= 4)) {
      tag           = 'CRITICAL CLUSTER'
      tagColor      = '#ef4444'
      recommendation = 'Deploy maximum available rescue resources immediately. Establish incident command post on-site.'
      sortPriority  = 1
    } else if (isSurging || (total >= 5 && unrescued >= 4)) {
      tag           = 'SURGE ZONE'
      tagColor      = '#f97316'
      recommendation = 'Incident rate rising rapidly. Pre-position additional rescue teams and evacuation transport.'
      sortPriority  = 2
    } else if (total >= 3 || avgScore >= 65 || recentCritical >= 1) {
      tag           = 'HIGH RISK'
      tagColor      = '#f59e0b'
      recommendation = 'Assign a dedicated rescue unit. Maintain direct communication and prepare evacuation route.'
      sortPriority  = 3
    } else {
      tag           = 'ACTIVE'
      tagColor      = '#22c55e'
      recommendation = 'Assign nearest available unit. Standard response protocol applies.'
      sortPriority  = 4
    }

    // Evacuation urgency: used to rank evacuation priority list
    const evacScore = unrescued * 10 + criticalCount * 25 + (isSurging ? 20 : 0)

    // AI review status counts
    const reviewCounts = {
      confirmed:  zr.filter(r => r.ai_review_status === 'confirmed').length,
      corrected:  zr.filter(r => r.ai_review_status === 'corrected').length,
      rejected:   zr.filter(r => r.ai_review_status === 'rejected').length,
      unreviewed: zr.filter(r => !r.ai_review_status || r.ai_review_status === 'unreviewed').length,
    }

    return {
      barangay, total, unrescued, rescued,
      criticalCount, highCount, avgScore, criticalPct,
      isSurging, recentCount, recentCritical,
      tag, tagColor, recommendation, sortPriority, evacScore,
      widthPct: Math.round((total / maxCount) * 100),
      reports: zr, reviewCounts,
    }
  }).sort((a, b) =>
    a.sortPriority !== b.sortPriority
      ? a.sortPriority - b.sortPriority
      : b.total - a.total
  )
}

// §4.6 — Statistical anomaly detection (surge and old-unresolved)
export function detectAnomalies(reports = []) {
  const now = Date.now()
  const active = reports.filter(r => !['rescued', 'cannot_reach'].includes(r.rescue_status ?? ''))
  const lastHour = active.filter(r => r.created_at &&
    now - new Date(r.created_at).getTime() < 60 * 60e3).length
  const trailing = active.filter(r => {
    if (!r.created_at) return false
    const age = now - new Date(r.created_at).getTime()
    return age > 60 * 60e3 && age <= 360 * 60e3
  }).length
  const trailingAvg = trailing / 5

  const withTs = active.filter(r => r.created_at)
  const coverageNote = `based on ${withTs.length} of ${active.length} records with timestamps`

  // Hour bucket gives IDs stable within a clock-hour so localStorage acknowledgements
  // survive count changes in the same event window (e.g., 5 → 6 reports in the same hour).
  const hourBucket = new Date(now).toISOString().slice(0, 13) // "YYYY-MM-DDTHH"

  const anomalies = []
  if (lastHour >= 3 && lastHour > trailingAvg * 2) {
    const magnitude = trailingAvg > 0 ? (lastHour / trailingAvg).toFixed(1) : null
    const surgeEvidence = magnitude
      ? `last 60 min = ${lastHour}, prior 5h avg = ${trailingAvg.toFixed(1)}/hr (${magnitude}× baseline); ${coverageNote}`
      : `last 60 min = ${lastHour}, prior 5h avg = ${trailingAvg.toFixed(1)}/hr; ${coverageNote}`
    anomalies.push({
      id: `surge-${hourBucket}`,
      text: `Unusual surge: ${lastHour} SOS report${lastHour !== 1 ? 's' : ''} in the last hour vs. ~${trailingAvg.toFixed(1)}/hr baseline.`,
      evidence: surgeEvidence,
      severity: 'high',
    })
  }
  const unresolvedOld = active.filter(r => r.created_at &&
    now - new Date(r.created_at).getTime() > 120 * 60e3).length
  if (unresolvedOld > 0) {
    const stalePct = active.length > 0 ? ` (${((unresolvedOld / active.length) * 100).toFixed(0)}%)` : ''
    const staleEvidence = `${unresolvedOld} of ${active.length} active reports exceed 120 min without resolution${stalePct}; ${coverageNote}`
    anomalies.push({
      id: `stale-${hourBucket}`,
      text: `${unresolvedOld} active SOS report${unresolvedOld !== 1 ? 's' : ''} older than 2 hours — review for escalation.`,
      evidence: staleEvidence,
      severity: unresolvedOld >= 3 ? 'high' : 'medium',
    })
  }
  return anomalies
}

// §4.4 — SAFE/UNSAFE/UNKNOWN aggregation by barangay using victims table
export function computeSafetyAggregation(victims = []) {
  const groups = {}
  victims.forEach(v => {
    const key = v.barangay?.trim() || 'Unknown'
    if (!groups[key]) groups[key] = { safe: 0, unsafe: 0, unknown: 0 }
    const s = v.status ?? 'unknown'
    if (s === 'rescued') groups[key].safe++
    else if (s === 'sos_sent') groups[key].unsafe++
    else groups[key].unknown++
  })
  return Object.entries(groups).map(([barangay, counts]) => ({
    barangay,
    ...counts,
    total: counts.safe + counts.unsafe + counts.unknown,
    coveragePct: Math.round(
      ((counts.safe + counts.unsafe) / (counts.safe + counts.unsafe + counts.unknown)) * 100,
    ),
  })).sort((a, b) => b.unsafe - a.unsafe || b.total - a.total)
}

export function generateInsights(zones) {
  const insights = []
  if (!zones.length) return insights

  // 1 — Highest-risk zone
  const top = zones[0]
  insights.push({
    type: 'priority', icon: '', color: '#ef4444',
    title: 'Immediate Priority Zone',
    body: `${top.barangay} requires immediate action — ${top.total} SOS report${top.total > 1 ? 's' : ''}, ${top.criticalCount} CRITICAL, average AI score ${top.avgScore}.`,
  })

  // 2 — Surge zones
  const surging = zones.filter(z => z.isSurging)
  if (surging.length) {
    insights.push({
      type: 'surge', icon: '⚡', color: '#f97316',
      title: `Surge Detected — ${surging.length} Zone${surging.length > 1 ? 's' : ''}`,
      body: `${surging.map(z => z.barangay).join(', ')} ${surging.length === 1 ? 'is' : 'are'} showing rapidly increasing incident rates. Pre-position rescue resources immediately.`,
    })
  }

  // 3 — Evacuation priorities (most unrescued)
  const evacTop = [...zones]
    .sort((a, b) => b.evacScore - a.evacScore)
    .filter(z => z.unrescued > 0)
    .slice(0, 3)
  if (evacTop.length) {
    insights.push({
      type: 'evacuation', icon: '🏃', color: '#8b5cf6',
      title: 'Evacuation Priorities',
      body: evacTop.map(z => `${z.barangay} (${z.unrescued} unrescued)`).join(' › ') +
        '. These zones have the most people awaiting rescue.',
    })
  }

  return insights
}
