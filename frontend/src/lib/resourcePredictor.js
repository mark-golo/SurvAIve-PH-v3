const ACTIVE_STATUSES = new Set(['pending', 'en_route', 'on_scene'])
const RESPONDER_CAPACITY = 2  // max simultaneous active cases per on-duty responder

function computeRates(reports) {
  const now  = Date.now()
  const m60  = now - 60  * 60 * 1000
  const m360 = now - 360 * 60 * 1000
  let recent = 0, older = 0
  for (const r of reports) {
    const ts = new Date(r.created_at).getTime()
    if (ts >= m60)        recent++
    else if (ts >= m360)  older++
  }
  return { recentRate: recent, olderAvgRate: older / 5 }
}

export function predictDepletion(reports, responders) {
  const activeLoad  = reports.filter(r => ACTIVE_STATUSES.has(r.rescue_status)).length
  const onDutyCount = responders.filter(r => r.duty_status === 'on_duty').length
  const capacity    = onDutyCount * RESPONDER_CAPACITY

  const { recentRate, olderAvgRate } = computeRates(reports)
  const surging        = recentRate > 0 && recentRate > olderAvgRate * 1.5
  const projectedLoad  = activeLoad + Math.round(recentRate * 0.5)
  const cap            = Math.max(capacity, 1)
  const loadRatio      = activeLoad  / cap
  const projectedRatio = projectedLoad / cap

  let minutesToOverwhelm = null
  if (recentRate > 0 && projectedRatio < 1) {
    minutesToOverwhelm = Math.max(0, Math.round((capacity - activeLoad) / recentRate * 60))
  }

  let alertLevel = 'NORMAL'
  if      (projectedRatio >= 1.0)                                    alertLevel = 'OVERWHELMED'
  else if (projectedRatio >= 0.75 || (surging && loadRatio >= 0.5)) alertLevel = 'AT_RISK'
  else if (loadRatio >= 0.5)                                         alertLevel = 'ELEVATED'

  return {
    alertLevel, activeLoad, onDutyCount, capacity,
    loadRatio, projectedLoad, projectedRatio,
    surging, recentRate, minutesToOverwhelm,
  }
}

export function groupPredictionByMunicipality(allReports, allResponders) {
  const munis = [...new Set(allReports.map(r => r.municipality).filter(Boolean))]
  return munis.map(muni => {
    const mReports    = allReports.filter(r => r.municipality === muni)
    const mResponders = allResponders.filter(r => r.municipality === muni)
    return { municipality: muni, ...predictDepletion(mReports, mResponders) }
  }).sort((a, b) => b.projectedRatio - a.projectedRatio)
}
