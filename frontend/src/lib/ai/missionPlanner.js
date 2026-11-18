// Mission sequencing — §3.4 AI-Assisted Rescue Mission Planning.
// Pure JS, no network calls, fully offline.
// Uses Haversine distance + greedy nearest-neighbor ordering.

const ROAD_FACTOR  = 1.3   // straight-line → road distance multiplier
const SPEED_KMH    = 30    // conservative urban rescue speed

function haversine(lat1, lon1, lat2, lon2) {
  const R   = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a   = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) *
              Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function urgencyLabel(score) {
  const s = Number(score) || 50
  if (s >= 80) return 'CRITICAL'
  if (s >= 60) return 'HIGH'
  if (s >= 40) return 'MODERATE'
  return 'LOW'
}

/**
 * Plan a mission sequence for a list of active SOS reports.
 *
 * @param {object[]} reports       — SOS report objects; must have lat/lng or latitude/longitude
 * @param {object|null} responderCoords — { lat, lng } of responder; null = start from highest-urgency report
 * @returns {{ sequence, totalDistanceKm, canSequence }}
 *   sequence[i] = { report, order, distanceFromPrevKm, estMinutes, urgencyLabel }
 */
export function planMission(reports = [], responderCoords = null) {
  // Normalise coordinates
  const withCoords = reports
    .filter(r => r.rescue_status !== 'rescued')
    .map(r => ({
      ...r,
      _lat: parseFloat(r.lat ?? r.latitude  ?? ''),
      _lng: parseFloat(r.lng ?? r.longitude ?? ''),
    }))
    .filter(r => !isNaN(r._lat) && !isNaN(r._lng))

  if (withCoords.length < 2) {
    return { sequence: [], totalDistanceKm: 0, canSequence: false }
  }

  // Sort by urgency desc to pick the highest-priority start if no responder coords
  const byUrgency = [...withCoords].sort(
    (a, b) => (Number(b.ai_priority_score) || 50) - (Number(a.ai_priority_score) || 50)
  )

  let curLat, curLng
  if (responderCoords) {
    curLat = responderCoords.lat
    curLng = responderCoords.lng
  } else {
    curLat = byUrgency[0]._lat
    curLng = byUrgency[0]._lng
  }

  // Greedy nearest-neighbor
  const remaining = [...byUrgency]
  const sequence  = []
  let totalKm = 0

  while (remaining.length > 0) {
    let bestIdx = 0
    let bestDist = Infinity
    remaining.forEach((r, i) => {
      const d = haversine(curLat, curLng, r._lat, r._lng)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    })
    const chosen   = remaining.splice(bestIdx, 1)[0]
    const roadKm   = +(bestDist * ROAD_FACTOR).toFixed(2)
    const estMin   = Math.round((roadKm / SPEED_KMH) * 60)
    totalKm += roadKm
    curLat = chosen._lat
    curLng = chosen._lng
    sequence.push({
      report:              chosen,
      order:               sequence.length + 1,
      distanceFromPrevKm:  roadKm,
      estMinutes:          estMin,
      urgencyLabel:        urgencyLabel(chosen.ai_priority_score),
    })
  }

  return { sequence, totalDistanceKm: +totalKm.toFixed(2), canSequence: true }
}
