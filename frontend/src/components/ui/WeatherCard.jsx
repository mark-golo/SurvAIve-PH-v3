import { useState, useEffect, useRef, useCallback } from 'react'
import { getPosition, onNetworkChange } from '../../lib/capacitor'

// ── Constants ──────────────────────────────────────────────────────────────────
const CACHE_KEY        = 'survAIve-weather-v1'
const REFRESH_MS       = 15 * 60 * 1000   // auto-refresh every 15 min
const COORD_REUSE_MS   = 5  * 60 * 1000   // reuse cached GPS coords if < 5 min old
const FETCH_TIMEOUT_MS = 10 * 1000        // abort any single fetch after 10 s

// ── Cache helpers (private-window safe) ───────────────────────────────────────
function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') } catch { return null }
}
function writeCache(payload) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(payload)) } catch {}
}

// ── Timeout wrapper ────────────────────────────────────────────────────────────
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ])
}

// ── Sky condition helpers ──────────────────────────────────────────────────────
function getSkyCondition(cloudCover, weatherCode) {
  if (weatherCode >= 95) return 'Thunderstorm'
  if (weatherCode >= 80) return 'Rain Showers'
  if (weatherCode >= 61) return 'Rainy'
  if (weatherCode >= 51) return 'Drizzle'
  if (weatherCode >= 45) return 'Foggy'
  if (cloudCover <= 12)  return 'Clear'
  if (cloudCover <= 37)  return 'Mostly Clear'
  if (cloudCover <= 62)  return 'Partly Cloudy'
  if (cloudCover <= 87)  return 'Mostly Cloudy'
  if (cloudCover < 100)  return 'Cloudy'
  return 'Overcast'
}
function getConditionKey(condition) {
  const c = condition.toLowerCase()
  if (c.includes('thunder'))                        return 'storm'
  if (c.includes('rain') || c.includes('drizzle')) return 'rain'
  if (c.includes('fog'))                            return 'cloudy'
  if (c.includes('overcast'))                       return 'overcast'
  if (c.includes('mostly cloudy') || c.includes('cloudy')) return 'cloudy'
  if (c.includes('partly'))                         return 'partly'
  if (c.includes('mostly clear'))                   return 'mostly-clear'
  return 'clear'
}

// ── Inline SVG weather icons ───────────────────────────────────────────────────
function IconClear() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" fill="none">
      <circle cx="40" cy="40" r="16" fill="#fbbf24" />
      <g stroke="#fbbf24" strokeWidth="3" strokeLinecap="round">
        <line x1="40" y1="6"  x2="40" y2="14" /><line x1="40" y1="66" x2="40" y2="74" />
        <line x1="6"  y1="40" x2="14" y2="40" /><line x1="66" y1="40" x2="74" y2="40" />
        <line x1="17" y1="17" x2="23" y2="23" /><line x1="57" y1="57" x2="63" y2="63" />
        <line x1="63" y1="17" x2="57" y2="23" /><line x1="23" y1="57" x2="17" y2="63" />
      </g>
    </svg>
  )
}
function IconMostlyClear() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" fill="none">
      <circle cx="32" cy="34" r="13" fill="#fbbf24" />
      <g stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round">
        <line x1="32" y1="8"  x2="32" y2="15" /><line x1="32" y1="53" x2="32" y2="60" />
        <line x1="6"  y1="34" x2="13" y2="34" /><line x1="51" y1="34" x2="58" y2="34" />
        <line x1="14" y1="16" x2="19" y2="21" /><line x1="45" y1="47" x2="50" y2="52" />
        <line x1="50" y1="16" x2="45" y2="21" /><line x1="19" y1="47" x2="14" y2="52" />
      </g>
      <path d="M48 56 Q44 48 52 46 Q54 40 62 42 Q68 42 68 50 Q74 50 74 56 Z" fill="rgba(200,220,240,0.9)" />
    </svg>
  )
}
function IconPartlyCloudy() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" fill="none">
      <circle cx="28" cy="30" r="14" fill="#fbbf24" opacity="0.9" />
      <g stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" opacity="0.8">
        <line x1="28" y1="6"  x2="28" y2="12" /><line x1="28" y1="48" x2="28" y2="54" />
        <line x1="4"  y1="30" x2="10" y2="30" /><line x1="46" y1="30" x2="52" y2="30" />
        <line x1="11" y1="13" x2="15" y2="17" /><line x1="41" y1="43" x2="45" y2="47" />
        <line x1="45" y1="13" x2="41" y2="17" /><line x1="15" y1="43" x2="11" y2="47" />
      </g>
      <path d="M20 62 Q16 52 26 48 Q29 38 42 40 Q52 38 54 48 Q62 48 62 56 Q62 62 54 62 Z" fill="white" opacity="0.92" />
      <path d="M20 62 Q16 52 26 48 Q29 38 42 40 Q52 38 54 48 Q62 48 62 56 Q62 62 54 62 Z" fill="url(#cg)" opacity="0.15" />
      <defs>
        <linearGradient id="cg" x1="20" y1="38" x2="62" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#93c5fd" /><stop offset="1" stopColor="#bfdbfe" />
        </linearGradient>
      </defs>
    </svg>
  )
}
function IconCloudy() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" fill="none">
      <path d="M18 62 Q12 50 24 44 Q28 30 46 32 Q60 30 62 44 Q72 44 72 54 Q72 62 62 62 Z" fill="white" opacity="0.9" />
      <path d="M18 62 Q12 50 24 44 Q28 30 46 32 Q60 30 62 44 Q72 44 72 54 Q72 62 62 62 Z" fill="#bfdbfe" opacity="0.4" />
    </svg>
  )
}
function IconRain() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" fill="none">
      <path d="M16 54 Q10 42 22 36 Q26 22 44 24 Q58 22 60 36 Q70 36 70 46 Q70 54 60 54 Z" fill="white" opacity="0.85" />
      <path d="M16 54 Q10 42 22 36 Q26 22 44 24 Q58 22 60 36 Q70 36 70 46 Q70 54 60 54 Z" fill="#bfdbfe" opacity="0.4" />
      <g stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round">
        <line x1="28" y1="60" x2="24" y2="72" />
        <line x1="40" y1="60" x2="36" y2="72" />
        <line x1="52" y1="60" x2="48" y2="72" />
      </g>
    </svg>
  )
}
function IconStorm() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" fill="none">
      <path d="M16 50 Q10 38 22 32 Q26 18 44 20 Q58 18 60 32 Q70 32 70 42 Q70 50 60 50 Z" fill="#94a3b8" opacity="0.9" />
      <path d="M46 52 L38 64 L44 64 L36 78 L52 60 L46 60 Z" fill="#fbbf24" />
    </svg>
  )
}
const ICONS = {
  'clear': IconClear, 'mostly-clear': IconMostlyClear, 'partly': IconPartlyCloudy,
  'cloudy': IconCloudy, 'overcast': IconCloudy, 'rain': IconRain, 'storm': IconStorm,
}

// ── Reverse geocode ────────────────────────────────────────────────────────────
async function reverseGeocode(lat, lon) {
  const res  = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
    { headers: { 'Accept-Language': 'en', 'User-Agent': 'SurvAIve-PH/1.0' } }
  )
  const data = await res.json()
  const addr = data.address ?? {}
  return {
    barangay: addr.village ?? addr.suburb ?? addr.neighbourhood ?? addr.quarter ?? '',
    city:     addr.city ?? addr.town ?? addr.municipality ?? addr.county ?? '',
  }
}

// ── Weather fetch ──────────────────────────────────────────────────────────────
async function fetchWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m,cloud_cover,weather_code` +
    `&wind_speed_unit=kmh&timezone=auto`
  const res  = await fetch(url)
  const json = await res.json()
  const c    = json.current
  return {
    temperature:   Math.round(c.temperature_2m),
    humidity:      Math.round(c.relative_humidity_2m),
    precipitation: Math.round(c.precipitation_probability),
    windSpeed:     Math.round(c.wind_speed_10m),
    cloudCover:    Math.round(c.cloud_cover),
    weatherCode:   c.weather_code,
  }
}

// ── Time formatter ─────────────────────────────────────────────────────────────
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
}
function fmtDateTime(ts) {
  return new Date(ts).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="glass rounded-2xl p-4 border border-[rgba(0,180,255,0.15)] animate-pulse">
      <div className="h-3 w-32 bg-slate-700 rounded mb-1.5" />
      <div className="h-2.5 w-24 bg-slate-700 rounded mb-4 opacity-60" />
      <div className="flex justify-center mb-4"><div className="w-20 h-20 bg-slate-700 rounded-full" /></div>
      <div className="h-4 w-28 bg-slate-700 rounded mx-auto mb-4" />
      <div className="h-px bg-slate-700 mb-3" />
      <div className="grid grid-cols-3 gap-2">
        {[0,1,2].map(i => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="h-3 w-12 bg-slate-700 rounded" />
            <div className="h-2 w-8 bg-slate-700 rounded opacity-60" />
          </div>
        ))}
      </div>
      <p className="text-[10px] text-slate-600 text-center mt-3">Fetching weather…</p>
    </div>
  )
}

// ── RefreshIcon ────────────────────────────────────────────────────────────────
function RefreshIcon({ spinning, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={spinning ? { animation: 'spin 1s linear infinite' } : {}}>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function WeatherCard({ user, isGuest }) {
  const initCache = readCache()

  const [displayState, setDisplayState] = useState(initCache ? 'cache' : 'loading')
  const [weather,      setWeather]      = useState(initCache?.weather  ?? null)
  const [location,     setLocation]     = useState(initCache?.location ?? null)
  const [fetchedAt,    setFetchedAt]    = useState(initCache?.fetchedAt ?? null)
  const [refreshing,   setRefreshing]   = useState(false)
  const [errorMsg,     setErrorMsg]     = useState('')

  const cancelledRef = useRef(false)
  const timerRef     = useRef(null)

  const refresh = useCallback(async () => {
    if (cancelledRef.current) return
    setRefreshing(true)

    try {
      const cache = readCache()

      // ── GPS: reuse cached coords if fresh enough ───────────────────────────
      let lat, lon
      const coordsFresh = cache && (Date.now() - cache.fetchedAt) < COORD_REUSE_MS
      if (coordsFresh) {
        lat = cache.lat
        lon = cache.lon
      } else {
        const coords = await withTimeout(getPosition(), FETCH_TIMEOUT_MS)
        lat = coords.latitude
        lon = coords.longitude
      }

      // ── Skip reverseGeocode if registered user or coords barely moved ──────
      const coordsMoved = !cache || Math.abs(lat - cache.lat) > 0.01 || Math.abs(lon - cache.lon) > 0.01
      const needGeo     = isGuest && coordsMoved

      const [wx, geo] = await Promise.all([
        withTimeout(fetchWeather(lat, lon), FETCH_TIMEOUT_MS),
        needGeo ? withTimeout(reverseGeocode(lat, lon), FETCH_TIMEOUT_MS) : Promise.resolve(null),
      ])

      if (cancelledRef.current) return

      const locName = geo
        ? { barangay: geo.barangay, city: geo.city }
        : (cache?.location ?? { barangay: user?.barangay ?? '', city: user?.municipality ?? '' })

      const now = Date.now()
      writeCache({ weather: wx, location: locName, fetchedAt: now, lat, lon })

      setWeather(wx)
      setLocation(locName)
      setFetchedAt(now)
      setDisplayState('live')
      setErrorMsg('')
    } catch (e) {
      if (cancelledRef.current) return
      const msg = String(e?.message ?? e)
      const errText = /permission|denied|blocked/i.test(msg)
        ? 'GPS permission denied — weather unavailable.'
        : 'No connection — weather service unreachable.'
      setErrorMsg(errText)

      const stillHasCache = readCache()
      if (stillHasCache) {
        setDisplayState('stale')
      } else {
        setDisplayState('error')
      }
    } finally {
      if (!cancelledRef.current) setRefreshing(false)
    }

    // Schedule next auto-refresh
    if (!cancelledRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(refresh, REFRESH_MS)
    }
  }, [user, isGuest]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cancelledRef.current = false
    refresh()

    // Network recovery: re-fetch as soon as connectivity returns
    const netP = onNetworkChange(connected => { if (connected) refresh() })

    return () => {
      cancelledRef.current = true
      clearTimeout(timerRef.current)
      netP.then(h => h.remove()).catch(() => {})
    }
  }, [refresh])

  // ── Render: loading (no cache ever) ────────────────────────────────────────
  if (displayState === 'loading') return <Skeleton />

  // ── Render: error with no cache ────────────────────────────────────────────
  if (displayState === 'error') {
    return (
      <div className="glass rounded-2xl px-4 py-4 border border-[rgba(255,255,255,0.06)]">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🌫</span>
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-300">Weather Unavailable</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{errorMsg}</p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg
            text-[11px] font-semibold text-[#00d4ff] border border-[rgba(0,212,255,0.25)]
            hover:bg-[rgba(0,212,255,0.08)] transition-colors disabled:opacity-40"
        >
          <RefreshIcon spinning={refreshing} />
          {refreshing ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    )
  }

  // ── Render: data card (live | cache | stale) ────────────────────────────────
  const condition    = getSkyCondition(weather.cloudCover, weather.weatherCode)
  const conditionKey = getConditionKey(condition)
  const WeatherIcon  = ICONS[conditionKey] ?? IconPartlyCloudy
  const dateStr      = new Date().toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const locationStr  = [location?.barangay, location?.city].filter(Boolean).join(', ') || 'Current Location'

  return (
    <div className="glass rounded-2xl overflow-hidden border border-[rgba(0,180,255,0.2)]"
      style={{ background: 'linear-gradient(160deg, rgba(0,160,255,0.08) 0%, rgba(0,180,255,0.03) 100%)' }}>

      {/* Header — centered above location */}
      <div className="px-4 pt-4 pb-0 text-center">
        {/* Badge + refresh — single centered row */}
        <div className="flex justify-center items-center gap-1.5 mb-1">
          {displayState === 'live' && !refreshing && (
            <span className="text-[9px] font-semibold text-[#22c55e] flex items-center gap-0.5">
              <span className="inline-block w-1 h-1 rounded-full bg-[#22c55e]" />Live
            </span>
          )}
          {refreshing && (
            <span className="text-[9px] font-semibold text-[#00d4ff]">Updating…</span>
          )}
          {displayState === 'stale' && !refreshing && (
            <span className="text-[9px] font-semibold text-[#f59e0b]">
              Cached · {fmtTime(fetchedAt)}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={refreshing}
            title="Refresh weather"
            className="p-0.5 rounded text-slate-400 hover:text-[#00d4ff] transition-colors disabled:opacity-30"
          >
            <RefreshIcon spinning={refreshing} size={11} />
          </button>
        </div>
        <p className="text-sm font-bold text-white leading-tight">{locationStr}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{dateStr}</p>
      </div>

      {/* Weather icon */}
      <div className="flex justify-center py-3">
        <WeatherIcon />
      </div>

      {/* Condition label */}
      <p className="text-base font-semibold text-white text-center pb-3">{condition}</p>

      {/* Stats row */}
      <div className="border-t border-[rgba(255,255,255,0.07)] grid grid-cols-3 divide-x divide-[rgba(255,255,255,0.07)]">
        <StatCell icon="💨" value={`${weather.windSpeed} km/h`} label="Wind" />
        <StatCell icon="💧" value={`${weather.humidity}%`}      label="Humidity" />
        <StatCell icon="🌧" value={`${weather.precipitation}%`} label="Precipitation" />
      </div>

      {/* Stale footer — last successful update */}
      {displayState === 'stale' && fetchedAt && (
        <div className="px-4 py-2 border-t border-[rgba(245,158,11,0.15)] text-center">
          <p className="text-[10px] text-[#f59e0b]">
            Last updated: {fmtDateTime(fetchedAt)} · {errorMsg}
          </p>
        </div>
      )}
    </div>
  )
}

function StatCell({ icon, value, label }) {
  return (
    <div className="flex flex-col items-center py-3 gap-0.5">
      <span className="text-base leading-none">{icon}</span>
      <p className="text-sm font-bold text-white mt-1">{value}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
    </div>
  )
}
