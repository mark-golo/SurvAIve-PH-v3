// Reverse geocoding via Nominatim (OpenStreetMap) — online only.
// Returns { barangay, city } from lat/lon coordinates.
// Use only when getNetworkOnline() is true; throws on network failure or timeout.

function withTimeout(promise, ms) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  return promise.finally(() => clearTimeout(timer))
}

export async function reverseGeocode(lat, lon, timeoutMs = 5000) {
  const promise = fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
    { headers: { 'Accept-Language': 'en', 'User-Agent': 'SurvAIve-PH/1.0' } }
  ).then(res => res.json())

  const data = await withTimeout(promise, timeoutMs)
  const addr = data.address ?? {}
  return {
    barangay: addr.village ?? addr.suburb ?? addr.neighbourhood ?? addr.quarter ?? '',
    city:     addr.city ?? addr.town ?? addr.municipality ?? addr.county ?? '',
  }
}
