// scripts/fetch-municipality-boundaries.mjs
// Run from project root: node scripts/fetch-municipality-boundaries.mjs
// Re-running is safe: already-fetched municipalities are skipped.
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'

const OSM_MUNICIPALITIES = [
  { name: 'Del Carmen',   osmId: 4664507,  psgc10: '1606708000', code: '166708000' },
  { name: 'Dapa',         osmId: 4664450,  psgc10: '1606707000', code: '166707000' },
  { name: 'General Luna', osmId: 4664474,  psgc10: '1606710000', code: '166710000' },
  { name: 'Santa Monica', osmId: 4664553,  psgc10: '1606721000', code: '166721000' },
  { name: 'Pilar',        osmId: 4664481,  psgc10: '1606716000', code: '166716000' },
  { name: 'San Isidro',   osmId: 4664529,  psgc10: '1606720000', code: '166720000' },
  { name: 'Socorro',      osmId: 4664581,  psgc10: '1606723000', code: '166723000' },
  { name: 'Alegria',      osmId: 12618159, psgc10: '1606701000', code: '166701000' },
  { name: 'Burgos',       osmId: 4664539,  psgc10: '1606704000', code: '166704000' },
  { name: 'San Benito',   osmId: 4664542,  psgc10: '1606718000', code: '166718000' },
]

const APPROX_MUNICIPALITIES = [
  { name: 'City of Surigao', psgc10: '1606724000', code: '166724000',
    coords: [[125.46,9.76],[125.52,9.76],[125.52,9.82],[125.46,9.82],[125.46,9.76]] },
  { name: 'Tagana-An',       psgc10: '1606725000', code: '166725000',
    coords: [[125.44,9.78],[125.52,9.78],[125.52,9.86],[125.44,9.86],[125.44,9.78]] },
  { name: 'Tubod',           psgc10: '1606727000', code: '166727000',
    coords: [[125.44,9.72],[125.53,9.72],[125.53,9.78],[125.44,9.78],[125.44,9.72]] },
  { name: 'Placer',          psgc10: '1606717000', code: '166717000',
    coords: [[125.55,9.59],[125.65,9.59],[125.65,9.68],[125.55,9.68],[125.55,9.59]] },
  { name: 'Bacuag',          psgc10: '1606702000', code: '166702000',
    coords: [[125.59,9.61],[125.68,9.61],[125.68,9.68],[125.59,9.68],[125.59,9.61]] },
  { name: 'Gigaquit',        psgc10: '1606711000', code: '166711000',
    coords: [[125.63,9.52],[125.72,9.52],[125.72,9.60],[125.63,9.60],[125.63,9.52]] },
  { name: 'Claver',          psgc10: '1606706000', code: '166706000',
    coords: [[125.67,9.52],[125.78,9.52],[125.78,9.61],[125.67,9.61],[125.67,9.52]] },
  { name: 'Sison',           psgc10: '1606722000', code: '166722000',
    coords: [[125.56,9.46],[125.66,9.46],[125.66,9.55],[125.56,9.55],[125.56,9.46]] },
  { name: 'Mainit',          psgc10: '1606714000', code: '166714000',
    coords: [[125.47,9.48],[125.59,9.48],[125.59,9.57],[125.47,9.57],[125.47,9.48]] },
  { name: 'Malimono',        psgc10: '1606715000', code: '166715000',
    coords: [[125.40,9.38],[125.52,9.38],[125.52,9.47],[125.40,9.47],[125.40,9.38]] },
  { name: 'San Francisco',   psgc10: '1606719000', code: '166719000',
    coords: [[125.92,9.39],[126.04,9.39],[126.04,9.48],[125.92,9.48],[125.92,9.39]] },
]

const OUT_FILE = 'frontend/src/data/municipality-boundaries.json'

// Load existing successful fetches to skip re-fetching
const existing = new Map()
if (existsSync(OUT_FILE)) {
  try {
    const saved = JSON.parse(readFileSync(OUT_FILE, 'utf8'))
    for (const f of saved.features ?? []) {
      if (f.properties?.source === 'osm') existing.set(f.properties.name, f)
    }
    console.log(`Loaded ${existing.size} already-fetched OSM boundaries from existing file.`)
  } catch { /* fresh start */ }
}

async function fetchWithRetry(osmId, name, retries = 3) {
  const query = `[out:json][timeout:60];relation(${osmId});out geom;`
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 45000)
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'SurvAIve-PH/3.0 (capstone; boundary-fetch)' },
      })
      clearTimeout(timer)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      const rel = data.elements?.[0]
      if (!rel) throw new Error('No element returned')

      const outerWays = rel.members.filter(m => m.role === 'outer' && m.geometry)
      let allCoords = []
      for (const way of outerWays) {
        allCoords = allCoords.concat(way.geometry.map(n => [n.lon, n.lat]))
      }
      const step = Math.max(1, Math.floor(allCoords.length / 150))
      const simplified = allCoords.filter((_, i) => i % step === 0)
      if (simplified.length > 0) {
        const first = simplified[0], last = simplified[simplified.length - 1]
        if (first[0] !== last[0] || first[1] !== last[1]) simplified.push(first)
      }
      return simplified
    } catch (e) {
      const msg = e.name === 'AbortError' ? 'timeout' : e.message
      console.log(`  attempt ${attempt}/${retries} failed: ${msg}`)
      if (attempt < retries) await new Promise(r => setTimeout(r, 8000 * attempt))
    }
  }
  return null
}

const features = []

// OSM boundaries (skip already-fetched)
for (const m of OSM_MUNICIPALITIES) {
  if (existing.has(m.name)) {
    console.log(`Skipping ${m.name} (already fetched)`)
    features.push(existing.get(m.name))
    continue
  }
  console.log(`Fetching ${m.name} (relation ${m.osmId})...`)
  const coords = await fetchWithRetry(m.osmId, m.name)
  if (coords) {
    const feat = {
      type: 'Feature',
      properties: { name: m.name, psgc10: m.psgc10, code: m.code, source: 'osm' },
      geometry: { type: 'Polygon', coordinates: [coords] },
    }
    features.push(feat)
    console.log(`  OK ${coords.length} points`)
    // Save after each success so progress is not lost on interrupt
    mkdirSync('frontend/src/data', { recursive: true })
    const partial = { type: 'FeatureCollection', features: [...features] }
    writeFileSync(OUT_FILE, JSON.stringify(partial))
  } else {
    console.log(`  SKIPPED — will keep approximate bounds for ${m.name}`)
  }
  await new Promise(r => setTimeout(r, 6000))
}

// Approx boundaries for the remaining 11
for (const m of APPROX_MUNICIPALITIES) {
  features.push({
    type: 'Feature',
    properties: { name: m.name, psgc10: m.psgc10, code: m.code, source: 'approx' },
    geometry: { type: 'Polygon', coordinates: [m.coords] },
  })
}

mkdirSync('frontend/src/data', { recursive: true })
writeFileSync(OUT_FILE, JSON.stringify({ type: 'FeatureCollection', features }))
const osmCount = features.filter(f => f.properties.source === 'osm').length
console.log(`\nDone: ${features.length} total (${osmCount} OSM real boundaries, ${features.length - osmCount} approximate)`)
