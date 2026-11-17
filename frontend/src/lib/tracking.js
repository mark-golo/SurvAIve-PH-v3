/**
 * tracking.js — Live Responder Tracking utilities
 *
 * Shared by ResponseTracking.jsx (victim side: distance display + voice announcements)
 * and RescueDetail.jsx (responder side: GPS status badge).
 */

const R = 6_371_000 // Earth radius in meters

/** Geodesic (Haversine) distance between two coordinates, in metres. */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** "1.2 km" or "300 m" */
export function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

/** Proximity milestones in metres, largest → smallest. 0 = arrival (triggered by status). */
export const MILESTONES = [2000, 1000, 500, 300, 100]

const TEXTS = {
  en: {
    2000: 'Your responder is 2 kilometers away.',
    1000: 'Your responder is 1 kilometer away.',
    500:  'Your responder is 500 meters away.',
    300:  'Your responder is 300 meters away.',
    100:  'Your responder is 100 meters away. Please prepare for assistance.',
    0:    'Your responder has arrived at your location.',
  },
  fil: {
    2000: 'Ang iyong responder ay 2 kilometro na lang.',
    1000: 'Ang iyong responder ay 1 kilometro na lang.',
    500:  'Ang iyong responder ay 500 metro na lang.',
    300:  'Ang iyong responder ay 300 metro na lang.',
    100:  'Ang iyong responder ay 100 metro na lang. Maghanda na para sa tulong.',
    0:    'Nakarating na ang iyong responder sa iyong lokasyon.',
  },
  bis: {
    2000: 'Ang imong responder duha ka kilometro na lang.',
    1000: 'Ang imong responder usa ka kilometro na lang.',
    500:  'Ang imong responder 500 metro na lang.',
    300:  'Ang imong responder 300 metro na lang.',
    100:  'Ang imong responder 100 metro na lang. Andam na alang sa tabang.',
    0:    'Naabot na ang imong responder sa imong lugar.',
  },
}

export function getMilestoneAnnouncement(milestoneMeters, lang = 'en') {
  return (TEXTS[lang] ?? TEXTS.en)[milestoneMeters] ?? (TEXTS.en)[milestoneMeters] ?? ''
}

/**
 * Returns every milestone newly crossed in this GPS update (may be multiple
 * if the responder jumps a large distance). Excludes 0 — arrival is triggered
 * by rescue_status change, not proximity alone.
 *
 * @param {number|null} prevMeters
 * @param {number}      currMeters
 * @param {Set<number>} announcedSet  milestones already announced this assignment
 * @returns {number[]}  newly crossed milestones, largest first
 */
export function checkMilestones(prevMeters, currMeters, announcedSet) {
  if (prevMeters == null || currMeters == null) return []
  return MILESTONES.filter(
    m => prevMeters > m && currMeters <= m && !announcedSet.has(m),
  )
}

/**
 * Speak text with the device's built-in TTS.
 * No-op if the Web Speech API is unavailable.
 */
export function speak(text, lang = 'en') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang   = lang === 'fil' || lang === 'bis' ? 'fil-PH' : 'en-PH'
  u.rate   = 0.95
  u.volume = 1
  window.speechSynthesis.speak(u)
}

/**
 * Road-distance + ETA from OSRM (same endpoint used by LocalMap.jsx).
 * Returns { minutes, roadKm } or null on network/parse failure.
 */
export async function fetchETA(rLat, rLng, iLat, iLng) {
  if (!rLat || !rLng || !iLat || !iLng) return null
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${rLng},${rLat};${iLng},${iLat}?overview=false`,
      { signal: ctrl.signal },
    )
    if (!res.ok) return null
    const json  = await res.json()
    const route = json.routes?.[0]
    if (!route) return null
    return { minutes: Math.ceil(route.duration / 60), roadKm: (route.distance / 1000).toFixed(1) }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * How fresh is a responder's last GPS ping?
 * @param {string|null} lastSeenAt — ISO timestamp
 * @returns {'live'|'reconnecting'|'stale'|'unknown'}
 */
export function trackingFreshness(lastSeenAt) {
  if (!lastSeenAt) return 'unknown'
  const age = (Date.now() - new Date(lastSeenAt).getTime()) / 1000
  if (age < 60)  return 'live'
  if (age < 300) return 'reconnecting'
  return 'stale'
}

/** "just now" / "2 min ago" / "10 min ago" */
export function formatLastSeen(lastSeenAt) {
  if (!lastSeenAt) return 'unknown'
  const age = (Date.now() - new Date(lastSeenAt).getTime()) / 1000
  if (age < 30)  return 'just now'
  if (age < 90)  return '1 min ago'
  if (age < 3600) return `${Math.round(age / 60)} min ago`
  return `${Math.round(age / 3600)} hr ago`
}
