/**
 * Device-Bound Authentication utilities for SurvAIve PH victim accounts.
 *
 * Uses Web Crypto API (SubtleCrypto) — zero external libraries.
 * Works in browser, Capacitor Android WebView, and iOS WKWebView.
 *
 * Security model:
 *  - Device key: 32 random bytes, stored in localStorage + Capacitor Preferences.
 *    Raw key NEVER leaves the device — only its SHA-256 hash is sent to the server.
 *  - PIN: user-chosen 6-digit number.
 *    For offline verification: PBKDF2-SHA256 (100k iterations) stored locally.
 *    For server verification: raw PIN sent to PHP which bcrypt-hashes it server-side.
 *  - Victim ID: client-generated readable ID (VCT-XXXXXXXX).
 */

const DEVICE_KEY_STORE  = 'survAIve-device-key'
const VICTIM_CREDS_STORE = 'survAIve-victim-creds'

// ── Device Key ────────────────────────────────────────────────────────────────

/**
 * Return existing device key from any available store, or generate and
 * persist a new one.  The raw key is 32 random bytes expressed as hex.
 */
export async function getOrCreateDeviceKey() {
  // 1. Try localStorage (synchronous, fastest)
  try {
    const existing = localStorage.getItem(DEVICE_KEY_STORE)
    if (existing) return existing
  } catch { /* private browsing may throw */ }

  // 2. Try Capacitor Preferences (Android SecureStorage)
  try {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key: DEVICE_KEY_STORE })
    if (value) {
      try { localStorage.setItem(DEVICE_KEY_STORE, value) } catch {}
      return value
    }
  } catch { /* not a Capacitor build */ }

  // 3. Generate fresh key
  const raw = new Uint8Array(32)
  crypto.getRandomValues(raw)
  const key = toHex(raw)

  try { localStorage.setItem(DEVICE_KEY_STORE, key) } catch {}
  try {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.set({ key: DEVICE_KEY_STORE, value: key })
  } catch {}

  return key
}

// ── Victim ID ─────────────────────────────────────────────────────────────────

/**
 * Generate a unique Victim ID: VCT-XXXXXXXX
 * Uses an unambiguous character set (no 0/O, 1/I/L confusion).
 */
export function generateVictimId() {
  const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const raw = new Uint8Array(8)
  crypto.getRandomValues(raw)
  const suffix = Array.from(raw).map(b => CHARS[b % CHARS.length]).join('')
  return `VCT-${suffix}`
}

// ── Cryptographic helpers ─────────────────────────────────────────────────────

/** Generate a 16-byte random hex salt */
export function generateSalt() {
  const raw = new Uint8Array(16)
  crypto.getRandomValues(raw)
  return toHex(raw)
}

/**
 * Hash a PIN using PBKDF2-SHA256 (100 000 iterations, 256-bit output).
 * Fully offline — uses only the built-in Web Crypto API.
 *
 * @param {string} pin   6-digit PIN string
 * @param {string} salt  Hex salt from generateSalt()
 * @returns {Promise<string>} Hex digest
 */
export async function hashPIN(pin, salt) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return toHex(new Uint8Array(bits))
}

/**
 * SHA-256 hash of the device key.
 * Only this hash is sent to the server — the raw key stays on the device.
 *
 * @param {string} deviceKey  Hex device key
 * @returns {Promise<string>} Hex digest
 */
export async function hashDeviceKey(deviceKey) {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(deviceKey))
  return toHex(new Uint8Array(buf))
}

// ── Local credential store ────────────────────────────────────────────────────

/**
 * Persist all data required for offline login.
 * Called after both online and offline registration/login.
 *
 * @param {string} victimId
 * @param {string} pinHash    PBKDF2 hash for local verification
 * @param {string} salt       Salt used for the PBKDF2 hash
 * @param {string} deviceKey  Raw device key (stored only on device)
 * @param {object} user       User profile object from server
 */
export function storeLocalCredentials(victimId, pinHash, salt, deviceKey, user = {}) {
  const payload = JSON.stringify({ victimId, pinHash, salt, deviceKey, user, storedAt: Date.now() })
  try { localStorage.setItem(VICTIM_CREDS_STORE, payload) } catch {}
  // Also mirror to Capacitor Preferences (fire-and-forget)
  ;(async () => {
    try {
      const { Preferences } = await import('@capacitor/preferences')
      await Preferences.set({ key: VICTIM_CREDS_STORE, value: payload })
    } catch {}
  })()
}

/** Load stored credentials; returns null if absent or parse fails */
export function loadLocalCredentials() {
  try {
    const raw = localStorage.getItem(VICTIM_CREDS_STORE)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

/**
 * Verify Victim ID + PIN + device key against locally stored credentials.
 * Used for fully-offline login — zero network required.
 *
 * @returns {Promise<boolean>}
 */
export async function verifyLocally(victimId, pin, deviceKey) {
  const creds = loadLocalCredentials()
  if (!creds) return false
  if (creds.victimId !== victimId) return false
  if (creds.deviceKey !== deviceKey) return false
  const computed = await hashPIN(pin, creds.salt)
  return computed === creds.pinHash
}

// ── Offline session token ─────────────────────────────────────────────────────

/**
 * Create a local-only session token after successful offline verification.
 * This token is NOT cryptographically signed — it is accepted only by the
 * victim app itself for UI purposes.  The PHP backend will reject it gracefully
 * (SOS posts fall back to guest/unverified mode when the JWT is invalid).
 *
 * @param {object} user  User profile fields
 * @returns {string}  'local.<base64-json>'
 */
export function createOfflineToken(user) {
  const payload = {
    id:           user.id ?? null,
    role:         'victim',
    name:         user.name ?? '',
    victim_id:    user.victim_id ?? null,
    barangay:     user.barangay ?? null,
    municipality: user.municipality ?? null,
    province:     user.province ?? null,
    offline:      true,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600, // 30 days
  }
  try {
    return 'local.' + btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
  } catch {
    return 'local.' + btoa(JSON.stringify(payload))
  }
}

// ── Internal helper ───────────────────────────────────────────────────────────

function toHex(uint8Array) {
  return Array.from(uint8Array).map(b => b.toString(16).padStart(2, '0')).join('')
}
