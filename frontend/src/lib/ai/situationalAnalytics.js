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
