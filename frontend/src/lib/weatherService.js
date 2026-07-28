const CACHE_TTL = 5 * 60 * 1000  // 5 minutes
let _cache = { data: null, ts: 0, lat: null, lng: null }

export async function fetchWeather(lat, lng) {
  const now = Date.now()
  if (_cache.data && now - _cache.ts < CACHE_TTL &&
      _cache.lat === lat && _cache.lng === lng) {
    return _cache.data
  }
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lng}` +
    `&current=rain,wind_speed_10m,precipitation,weather_code&forecast_days=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Weather unavailable')
  const json = await res.json()
  const c    = json.current ?? {}

  const rainfall  = c.precipitation ?? c.rain ?? 0
  const windSpeed = c.wind_speed_10m ?? 0
  const code      = c.weather_code  ?? 0

  let riskLevel, scoreBonus
  if      (rainfall > 15  || windSpeed > 75) { riskLevel = 'EXTREME';  scoreBonus = 30 }
  else if (rainfall > 7.5 || windSpeed > 50) { riskLevel = 'HIGH';     scoreBonus = 20 }
  else if (rainfall > 2.5 || windSpeed > 25) { riskLevel = 'MODERATE'; scoreBonus = 10 }
  else                                        { riskLevel = 'LOW';      scoreBonus = 0  }

  const data = { rainfall, windSpeed, weatherCode: code, riskLevel, scoreBonus }
  _cache = { data, ts: now, lat, lng }
  return data
}

export function getWeatherLabel(code) {
  if (code >= 95) return 'Thunderstorm'
  if (code >= 80) return 'Rain Showers'
  if (code >= 61) return 'Rain'
  if (code >= 51) return 'Drizzle'
  if (code >= 45) return 'Fog'
  if (code >= 1)  return 'Partly Cloudy'
  return 'Clear'
}
