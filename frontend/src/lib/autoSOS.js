const STORAGE_KEY = 'survAIve-autosos'

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {} } catch { return {} }
}
function save(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

// Shake detection
let shakeCount = 0, lastShakeTime = 0
const SHAKE_THRESHOLD = 15   // m/s² magnitude
const SHAKE_WINDOW    = 5000 // ms — reset count if gap exceeds this
const SHAKE_REQUIRED  = 3    // shakes needed within window

function handleMotion(e) {
  const a = e.accelerationIncludingGravity
  if (!a) return
  const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2)
  if (mag > SHAKE_THRESHOLD) {
    const now = Date.now()
    if (now - lastShakeTime > SHAKE_WINDOW) shakeCount = 0
    shakeCount++
    lastShakeTime = now
    if (shakeCount >= SHAKE_REQUIRED) {
      shakeCount = 0
      window.location.href = '/sos'
    }
  }
}

// Volume button hold (5 s)
let volumeTimer = null
function handleKeyDown(e) {
  if ((e.code === 'AudioVolumeDown' || e.keyCode === 174) && !volumeTimer) {
    e.preventDefault()
    volumeTimer = setTimeout(() => { window.location.href = '/sos' }, 5000)
  }
}
function handleKeyUp(e) {
  if (e.code === 'AudioVolumeDown' || e.keyCode === 174) {
    clearTimeout(volumeTimer)
    volumeTimer = null
  }
}

let initialized = false

export const autoSOS = {
  init() {
    if (initialized) return
    initialized = true
    const s = load()
    if (s.shake) window.addEventListener('devicemotion', handleMotion)
    if (s.volume) {
      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)
    }
  },
  getSettings() {
    const s = load()
    return { shake: s.shake ?? false, volume: s.volume ?? false }
  },
  setShake(enabled) {
    save({ ...load(), shake: enabled })
    if (enabled) window.addEventListener('devicemotion', handleMotion)
    else window.removeEventListener('devicemotion', handleMotion)
  },
  setVolume(enabled) {
    save({ ...load(), volume: enabled })
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)
    } else {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  },
}
