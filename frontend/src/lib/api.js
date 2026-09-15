// Supabase compatibility wrapper — maps old PHP URL patterns to Supabase calls
import { supabase, signupClient } from './supabase'
import { hashPIN, createOfflineToken } from './deviceAuth'
import { getNetworkOnline } from './capacitor'

// ── Local PHP backend (XAMPP) ── used in offline / Wi-Fi hotspot mode ─────────
//
// Problem in Capacitor WebView:
//   window.location.hostname returns 'localhost' because assets are served from
//   capacitor://localhost — not the actual machine running XAMPP.  So the old
//   `${hostname}/SurvAIve PH v3/...` URL resolves to the device itself, not the
//   admin's XAMPP server on the local Wi-Fi hotspot.
//
// Fix:
//   Cache the XAMPP host from Capacitor Preferences (set by the user in Settings).
//   Default: 192.168.43.1 — the standard Android hotspot gateway IP, which is
//   typically the address of the admin device running XAMPP.
//
// The user can override this default in VictimSettings / ResponderSettings.

let _cachedXamppHost = null  // null = not yet initialised

/** Detect a safe default: use window hostname except when inside a Capacitor WebView */
function getDefaultXamppHost() {
  const { hostname } = window.location
  // In a Capacitor WebView hostname is 'localhost' — fall back to hotspot default
  if (hostname === 'localhost' && window.Capacitor?.isNativePlatform?.()) {
    return '192.168.43.1'
  }
  return hostname
}

/**
 * Load the persisted XAMPP host from Capacitor Preferences (async, called once
 * at module load time). Capacitor Preferences is backed by Android SharedPreferences
 * so it survives app restarts.
 */
async function initXamppHost() {
  try {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key: 'survAIve-xampp-host' })
    _cachedXamppHost = value || getDefaultXamppHost()
  } catch {
    // Capacitor Preferences not available (web build) — use window hostname
    _cachedXamppHost = getDefaultXamppHost()
  }
}

/**
 * Override the XAMPP host at runtime. Called from VictimSettings and
 * ResponderSettings after the user saves a new IP address.
 *
 * @param {string} host e.g. '192.168.43.1' or '192.168.1.10'
 */
export function setXamppHost(host) {
  _cachedXamppHost = host
}

// Kick off initialisation immediately — subsequent calls to localPhpUrl() will
// use the cached value (synchronous) after the first async resolution.
initXamppHost()

function localPhpUrl(path) {
  const host = _cachedXamppHost || getDefaultXamppHost()
  // Always use HTTP for the local XAMPP server (no TLS on LAN)
  return `http://${host}/SurvAIve%20PH%20v3/backend/api/router.php?path=${path}`
}

export async function localFetch(path, opts = {}) {
  // Pass the local PHP JWT if available (stored after offline login)
  let token = null
  try {
    const stored = JSON.parse(localStorage.getItem('survAIve-auth') ?? '{}')
    token = stored?.state?.token ?? null
  } catch { /* ignore */ }

  const res = await fetch(localPhpUrl(path), {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json.error ?? `Local request failed (${res.status})`
    throw Object.assign(new Error(msg), { error: msg, status: res.status })
  }
  return json
}

const TABLE = {
  evacuation_centers: 'evacuation_centers',
  sos:                'sos_reports',
  victims:            'victims',
  constituents:       'victims',   // alias used by ConstituentRegistry
  responders:         'responders',
  admins:             'admins',
  superadmins:        'superadmins',
  escalations:        'escalations',
}

// Query params that map directly to column equality filters
const FILTER_COLS = new Set([
  'municipality', 'province', 'barangay', 'status',
  'rescue_status', 'is_verified', 'duty_status',
])

function parsePath(rawPath) {
  const [p, qs] = rawPath.split('?')
  const parts = p.replace(/^\//, '').split('/')
  const resource = parts[0]
  const id = parts[1] ? decodeURIComponent(parts[1]) : null
  const table = TABLE[resource] ?? resource
  const params = new URLSearchParams(qs ?? '')
  return { resource, id, table, params }
}

// Unified heuristic priority score — matches PHP backend exactly
function calcPriorityScore(body) {
  let score = 50
  const s = (body.status ?? '').toLowerCase()
  if      (s === 'trapped') score += 30
  else if (s === 'injured') score += 20
  else if (s === 'missing') score += 15

  const n = Number(body.people_count) || 1
  if      (n >= 10) score += 25
  else if (n >= 5)  score += 15
  else if (n >= 2)  score += 5

  const age = body.victim_age_group ?? 'adult'
  if      (age === 'senior') score += 20
  else if (age === 'child')  score += 15

  const conds = typeof body.special_conditions === 'string'
    ? body.special_conditions.split(',').filter(Boolean)
    : []
  if (conds.includes('medical_emergency'))   score += 20
  if (conds.includes('fire'))                score += 15
  if (conds.includes('structural_collapse')) score += 10
  if (conds.includes('flooding'))            score += 10

  if (!body.is_verified) score -= 10

  return Math.min(score, 99)
}

// Normalize SOS row: add priority label (time-escalated) and human-readable time_ago
function normalizeSos(r) {
  if (!r) return r
  const rawScore   = r.ai_priority_score ?? 50
  const minutesAgo = r.minutes_ago != null
    ? Number(r.minutes_ago)
    : r.created_at
      ? Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000)
      : 0
  const timeBonus = minutesAgo >= 240 ? 20
                  : minutesAgo >= 120 ? 15
                  : minutesAgo >= 60  ? 10
                  : minutesAgo >= 30  ? 5
                  : 0
  const displayScore = Math.min(rawScore + timeBonus, 99)
  const priority = displayScore >= 80 ? 'CRITICAL'
                 : displayScore >= 60 ? 'HIGH'
                 : displayScore >= 40 ? 'MODERATE'
                 : 'LOW'
  let time_ago = ''
  if (r.created_at) {
    const mins = minutesAgo
    time_ago = mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`
  }
  // victims join comes back as r.victims.name when using select('*, victims(name,...)')
  const joinedName    = r.victims?.name ?? null
  const joinedContact = r.victims?.contact_number ?? null
  return {
    ...r,
    // Supabase RPC returns `created_at`; MySQL offline path returns `timestamp`.
    // isToday() in CommandCenter filters on `r.timestamp` — unify both sources here.
    timestamp:      r.timestamp ?? r.created_at,
    name:           r.name ?? joinedName,
    contact_number: r.contact_number ?? joinedContact,
    priority,
    time_ago,
    victims: undefined,
  }
}

function throwErr(msg, status = 400) {
  const e = Object.assign(new Error(msg), { error: msg, status })
  throw e
}

function sbThrow(error) {
  throwErr(error?.message ?? 'Database error')
}

// ── GET ────────────────────────────────────────────────────────────────────────
async function get(path) {
  const { resource, id, table, params } = parsePath(path)

  // ── Province reports — always served from local XAMPP MySQL ─────────────────
  if (resource === 'province_reports') {
    const qs = params.toString()
    const rows = await localFetch(`province_reports${qs ? '?' + qs : ''}`)
    return Array.isArray(rows) ? rows : (rows ? [rows] : [])
  }

  // ── Offline: route all reads to local XAMPP PHP backend ─────────────────────
  if (!getNetworkOnline() && resource === 'sos') {
    const qs = params.toString()
    const rows = await localFetch(`sos${qs ? '?' + qs : ''}`)
    return (Array.isArray(rows) ? rows : [rows]).map(normalizeSos)
  }

  if (!getNetworkOnline() && resource === 'evacuation_centers') {
    const qs = params.toString()
    const rows = await localFetch(`evacuation_centers${qs ? '?' + qs : ''}`)
    return Array.isArray(rows) ? rows : (rows ? [rows] : [])
  }

  if (!getNetworkOnline() && resource === 'constituents') {
    const qs = params.toString()
    const rows = await localFetch(`constituents${qs ? '?' + qs : ''}`)
    return (Array.isArray(rows) ? rows : (rows ? [rows] : [])).map(r => ({
      ...r,
      account_status: null, // profiles join not available offline
    }))
  }

  if (!getNetworkOnline() && (resource === 'responders' || resource === 'admins' || resource === 'superadmins')) {
    const qs = params.toString()
    const rows = await localFetch(`${resource}${qs ? '?' + qs : ''}`)
    return Array.isArray(rows) ? rows : (rows ? [rows] : [])
  }

  // ── SOS ──
  if (resource === 'sos') {
    const muni = params.get('municipality') || null
    const prov = params.get('province')     || null

    if (id) {
      const { data, error } = await supabase
        .from('sos_reports')
        .select('*, victims(name, contact_number, vulnerabilities, household_count)')
        .eq('id', id)
        .single()
      if (error) sbThrow(error)
      return normalizeSos(data)
    }

    // List via RPC — computes priority label + time_ago server-side
    const { data, error } = await supabase.rpc('get_sos_with_priority', {
      p_municipality: muni,
      p_province:     prov,
    })
    if (error) sbThrow(error)
    return (data ?? []).map(normalizeSos)
  }

  // ── Constituents (victims enriched with account status from profiles) ──
  if (resource === 'constituents' && !id) {
    const qs = params.toString()

    // Primary source: Supabase (authoritative online store)
    let q = supabase.from('victims').select('*')
    for (const [key, val] of params.entries()) {
      if (FILTER_COLS.has(key)) q = q.eq(key, val)
    }
    const { data: sbVictims, error: ve } = await q
    if (ve) sbThrow(ve)

    const contacts = (sbVictims ?? []).map(v => v.contact_number).filter(Boolean)
    let profileMap = {}
    if (contacts.length) {
      const { data: profs } = await supabase
        .from('profiles').select('contact_number, status').eq('role', 'victim')
        .in('contact_number', contacts)
      for (const p of profs ?? []) profileMap[p.contact_number] = p.status
    }
    const supabaseRows = (sbVictims ?? []).map(v => ({ ...v, account_status: profileMap[v.contact_number] ?? null }))

    // Secondary source: local MySQL via PHP — catches victims registered via the PHP
    // backend (XAMPP / admin hotspot) who have not yet been mirrored to Supabase.
    let mysqlRows = []
    try {
      const raw = await localFetch(`constituents${qs ? '?' + qs : ''}`)
      mysqlRows = (Array.isArray(raw) ? raw : (raw ? [raw] : [])).map(r => ({ ...r, account_status: null }))
    } catch { /* XAMPP not running — use Supabase-only results */ }

    // Merge: Supabase rows first (authoritative), then MySQL-only rows (dedup by contact_number)
    const seen = new Set(supabaseRows.map(v => v.contact_number).filter(Boolean))
    const mysqlOnly = mysqlRows.filter(v => !seen.has(v.contact_number))

    return [...supabaseRows, ...mysqlOnly]
  }

  // ── Single item (non-SOS) ──
  if (id) {
    const { data, error } = await supabase.from(table).select('*').eq('id', id).single()
    if (error) sbThrow(error)
    return data
  }

  // ── List with optional filters ──
  let q = supabase.from(table).select('*')
  for (const [key, val] of params.entries()) {
    if (FILTER_COLS.has(key)) q = q.eq(key, val)
  }
  const { data, error } = await q
  if (error) sbThrow(error)
  return data ?? []
}

// ── POST ───────────────────────────────────────────────────────────────────────
async function post(path, body = {}) {
  const { resource, table, params } = parsePath(path)

  // ── Province reports — always written to local XAMPP MySQL ──────────────────
  if (resource === 'province_reports') {
    return localFetch('province_reports', { method: 'POST', body: JSON.stringify(body) })
  }

  // ── Auth endpoints ──
  if (resource === 'auth') {
    const action = path.replace(/\?.*/, '').split('/')[2]

    if (action === 'login') {
      // ── Offline login: authenticate against local XAMPP MySQL ──
      if (!getNetworkOnline()) {
        const data = await localFetch('auth/login', {
          method: 'POST',
          body: JSON.stringify({
            contact_number: body.contact_number,
            password:       body.password,
            role:           body.role,
          }),
        })
        return { token: data.token, user: { ...data.user, role: data.user.role } }
      }

      const email = body.role === 'victim'
        ? `${body.contact_number}@internal.survaive.ph`
        : `${body.contact_number}@survAIve.ph`
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: body.password })
      if (error) throwErr('Invalid credentials. Check your contact number and password.', 401)

      // Try profiles table first
      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', data.user.id).maybeSingle()

      // Fall back to user_metadata in JWT (set by seed script or Fix A SQL)
      const meta = data.user.user_metadata ?? {}
      const userInfo = profile ?? (meta.role ? { id: data.user.id, ...meta } : null)

      if (!userInfo) throwErr('Account not fully set up. Contact your administrator.', 403)

      // Block inactive responders from logging in
      if (userInfo.role === 'responder') {
        const { data: respRow } = await supabase
          .from('responders').select('status').eq('contact_number', userInfo.contact_number).maybeSingle()
        if (respRow?.status === 'inactive') {
          throwErr('Your account has been disabled. Contact your administrator.', 403)
        }
      }

      if (body.role && body.role !== 'victim' && userInfo.role !== body.role) {
        await supabase.auth.signOut().catch(() => {})
        throwErr('Invalid credentials. Please try again.', 401)
      }

      // Silently mirror credentials into local MySQL so offline login works
      // after the admin has logged in at least once while online.
      localFetch('sync?action=staff', {
        method: 'POST',
        body: JSON.stringify({
          role:           body.role,
          name:           userInfo.name ?? '',
          contact_number: body.contact_number,
          province:       userInfo.province       ?? null,
          municipality:   userInfo.municipality   ?? null,
          password:       body.password,
        }),
      }).catch(() => {}) // fire-and-forget — XAMPP may not be running

      return { token: data.session.access_token, user: userInfo }
    }

    if (action === 'otp') {
      if (body.action === 'send') {
        if (body.method === 'phone') {
          const digits = body.contact.replace(/\D/g, '')
          const phone = '+63' + (digits.startsWith('0') ? digits.slice(1) : digits)
          const { data: fnData, error: fnErr } = await supabase.functions.invoke('otp', {
            body: { action: 'send', phone },
          })
          if (fnErr) {
            let msg = 'Failed to send OTP via SMS'
            try { const b = await fnErr.context.json(); if (b?.error) msg = b.error } catch {}
            throwErr(msg)
          }
          if (fnData?.error) throwErr(fnData.error)
          return { message: 'OTP sent via SMS' }
        }
        // email method
        const { error } = await supabase.auth.signInWithOtp({
          email: body.email,
          options: { shouldCreateUser: true },
        })
        if (error) {
          const msg = error.message
            || (error.status === 429 ? 'Too many OTP requests. Please wait a few minutes and try again.' : null)
            || `Failed to send OTP (${error.status ?? 500}). Check your Supabase email settings.`
          throwErr(msg)
        }
        return { message: 'OTP sent to email' }
      }

      if (body.action === 'verify') {
        if (body.method === 'phone') {
          const digits = body.contact.replace(/\D/g, '')
          const phone  = '+63' + (digits.startsWith('0') ? digits.slice(1) : digits)
          const { data: fnData, error: fnErr } = await supabase.functions.invoke('otp', {
            body: { action: 'verify', phone, otp: body.otp },
          })
          if (fnErr) {
            let msg = 'Invalid or expired OTP'
            try { const b = await fnErr.context.json(); if (b?.error) msg = b.error } catch {}
            throwErr(msg)
          }
          if (fnData?.error) throwErr(fnData.error)
          const { data, error } = await supabase.auth.verifyOtp({ token_hash: fnData.hashed_token, type: 'email' })
          if (error || !data?.session) throwErr('Authentication failed. Please try again.')
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle()
          if (profile) {
            if (profile.status === 'inactive') throwErr('Your account has been disabled. Contact your administrator.', 403)
            const { data: victim } = await supabase.from('victims').select('*')
              .eq('contact_number', body.contact.replace(/\D/g, '')).maybeSingle()
            return { existing_user: true, token: data.session.access_token, user: { ...profile, ...(victim ?? {}) } }
          }
          return { existing_user: false, token: data.session.access_token }
        }
        // email path
        const { data, error } = await supabase.auth.verifyOtp({ email: body.email, token: body.otp, type: 'email' })
        if (error) throwErr('Invalid or expired OTP')
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle()
        if (profile) {
          if (profile.status === 'inactive') throwErr('Your account has been disabled. Contact your administrator.', 403)
          return { existing_user: true, token: data.session.access_token, user: { ...profile } }
        }
        return { existing_user: false, token: data.session.access_token }
      }
    }

    // ── Device-bound victim registration (no OTP / Supabase Auth) ──────────────
    if (action === 'register') {
      // Shared victim data object used by both paths below
      const victimData = {
        victim_id:                      body.victim_id ?? null,
        name:                           body.name,
        contact_number:                 body.contact_number,
        province:                       body.province ?? null,
        municipality:                   body.municipality ?? null,
        barangay:                       body.barangay ?? null,
        sitio:                          body.sitio ?? null,
        household_count:                body.household_count ?? 1,
        vulnerabilities:                body.vulnerabilities ?? null,
        medical_conditions:             body.medical_conditions ?? null,
        emergency_contact_name:         body.emergency_contact_name ?? null,
        emergency_contact_number:       body.emergency_contact_number ?? null,
        emergency_contact_relationship: body.emergency_contact_relationship ?? null,
        pin_hash:                       body.pin_hash ?? null,
        device_key_hash:                body.device_key_hash ?? null,
        pin_salt:                       body.pin_salt ?? null,
        is_verified:                    true,
        trust_score:                    'HIGH',
      }

      // Try local XAMPP PHP first — works in dev (XAMPP running) and on the admin
      // Wi-Fi hotspot (offline Mode 2). Falls back to Supabase when XAMPP is not
      // reachable (e.g. production PWA without a hotspot).
      try {
        const phpRes = await localFetch('auth/register', { method: 'POST', body: JSON.stringify(body) })

        // Mirror to Supabase so the admin Constituent Registry (which reads Supabase
        // when online) can see the new victim. Requires victims_device_register RLS
        // policy — see database/migration_device_auth.sql Part 2.
        // Fire-and-forget: PHP insert already succeeded, Supabase is best-effort.
        supabase.from('victims').insert(victimData).then(() => {}).catch(() => {})

        return phpRes
      } catch {
        // XAMPP not reachable — fall through to Supabase-only insert below.
        // Requires the victims_device_register RLS policy to be in place.
      }

      // Supabase fallback: insert victim row directly with the anon key.
      // Allowed by the victims_device_register RLS policy (victim_id IS NOT NULL).
      const { data: victimRow, error: ve } = await supabase
        .from('victims').insert(victimData).select().single()
      if (ve) sbThrow(ve)

      const user = {
        id:             victimRow.id,
        role:           'victim',
        name:           body.name,
        victim_id:      body.victim_id ?? null,
        contact_number: body.contact_number,
        municipality:   body.municipality,
        province:       body.province,
        barangay:       body.barangay,
      }
      return { token: createOfflineToken(user), user }
    }

    // ── Device-bound victim login (Victim ID + PIN + device key) ─────────────
    if (action === 'victim-login') {
      // Offline: forward to local XAMPP only (cannot reach Supabase)
      if (!getNetworkOnline()) {
        return localFetch('auth/victim-login', { method: 'POST', body: JSON.stringify(body) })
      }

      // Online: try PHP first — covers victims who are in MySQL only
      try {
        const phpRes = await localFetch('auth/victim-login', { method: 'POST', body: JSON.stringify(body) })
        if (phpRes?.user) {
          // Mirror victim to Supabase so the SOS user_id link works on next submit
          const m = phpRes.user
          supabase.from('victims').upsert({
            victim_id:      m.victim_id      ?? body.victim_id,
            name:           m.name           ?? null,
            contact_number: m.contact_number ?? null,
            province:       m.province       ?? null,
            municipality:   m.municipality   ?? null,
            barangay:       m.barangay       ?? null,
          }, { onConflict: 'victim_id' }).then(() => {}).catch(() => {})
        }
        return phpRes
      } catch {
        // XAMPP not running → fall through to Supabase path
      }

      // Supabase path: victim is already in Supabase — verify client-side
      const { data: victim, error: qe } = await supabase
        .from('victims')
        .select('id, name, contact_number, province, municipality, barangay, pin_hash, device_key_hash, pin_salt, status')
        .eq('victim_id', body.victim_id)
        .maybeSingle()
      if (qe) sbThrow(qe)
      if (!victim) throwErr('Invalid Victim ID or PIN', 401)
      if (victim.status !== 'active') throwErr('Account is not active. Contact your local DRRM office.', 403)

      // Verify PIN via PBKDF2 (same hash stored in pin_hash)
      const computed = victim.pin_salt
        ? await hashPIN(body.pin, victim.pin_salt)
        : null
      const pinOk = computed && computed === victim.pin_hash
      if (!pinOk) throwErr('Invalid Victim ID or PIN', 401)

      // Verify device key
      if (victim.device_key_hash && victim.device_key_hash !== body.device_key_hash) {
        throwErr('Device not recognised. Please log in from your registered device.', 401)
      }

      const user = {
        id:             victim.id,
        role:           'victim',
        name:           victim.name,
        victim_id:      body.victim_id,
        contact_number: victim.contact_number,
        province:       victim.province,
        municipality:   victim.municipality,
        barangay:       victim.barangay,
      }
      return { token: createOfflineToken(user), user }
    }

    throwErr('Unknown auth action', 404)
  }

  // ── SOS submit ──
  if (resource === 'sos') {
    // Offline: POST directly to local XAMPP (victim on admin's Wi-Fi hotspot)
    if (!getNetworkOnline()) {
      return localFetch('sos', { method: 'POST', body: JSON.stringify(body) })
    }

    const score = calcPriorityScore(body)

    // Resolve device-auth victim_id → verified status + best-effort Supabase user_id
    // victim_id is only included in the payload for authenticated users (PIN-verified),
    // so its presence is sufficient proof of identity — don't gatekeep on Supabase row.
    let supabaseUserId = null
    let isVerified     = false
    let trustScore     = 'LOW'
    if (body.victim_id) {
      isVerified = true
      trustScore = 'HIGH'
      // Still try to resolve Supabase user_id so the JOIN in get_sos_with_priority works
      const { data: vRow } = await supabase
        .from('victims')
        .select('id')
        .eq('victim_id', body.victim_id)
        .maybeSingle()
      if (vRow?.id) supabaseUserId = vRow.id
    }

    const { error } = await supabase
      .from('sos_reports')
      .insert({
        user_id:             supabaseUserId,
        name:                body.name                ?? null,
        barangay:            body.barangay            || null,
        municipality:        body.municipality        || null,
        province:            body.province            || null,
        lat:                 body.lat                 ?? null,
        lng:                 body.lng                 ?? null,
        status:              body.status              ?? 'unknown',
        people_count:        Number(body.people_count) || 1,
        victim_age_group:    body.victim_age_group    ?? 'adult',
        special_conditions:  body.special_conditions  ?? '',
        notes:               body.notes               ?? null,
        ai_priority_score:   score,
        rescue_status:       'pending',
        is_verified:         isVerified,
        trust_score:         trustScore,
        // dual-mode SOS: YOLO11 AI analysis fields
        sos_mode:            body.sos_mode            ?? 'status',
        ai_scene_label:      body.ai_scene_label      ?? null,
        ai_scene_confidence: body.ai_scene_confidence ?? null,
        ai_detected_count:   body.ai_detected_count   ?? null,
      })
    if (error) sbThrow(error)
    return { ai_priority_score: score }
  }

  // ── Responder creation: create Supabase Auth account + profiles row ──
  if (table === 'responders') {
    const { password, ...respData } = body
    if (!password) throwErr('Password is required to create a responder account.', 400)

    const email = `${respData.contact_number}@survaive.ph`
    const userMeta = {
      role: 'responder',
      name: respData.name,
      contact_number: respData.contact_number,
      province: respData.province,
      municipality: respData.municipality,
      barangay: respData.barangay,
    }

    const { data: authData, error: authError } = await signupClient.auth.signUp({
      email,
      password,
      options: { data: userMeta },
    })

    if (authError) {
      if (authError.message?.toLowerCase().includes('already')) {
        throwErr(`Contact number ${respData.contact_number} already has an account.`, 409)
      }
      throwErr(authError.message || 'Failed to create responder auth account.', 500)
    }

    const uid = authData.user?.id
    if (!uid) throwErr('Auth account created but no user ID returned.', 500)

    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: uid, role: 'responder', name: respData.name,
      contact_number: respData.contact_number,
      province: respData.province, municipality: respData.municipality, barangay: respData.barangay,
    })
    if (profileErr) throwErr(profileErr.message, 500)

    const { data: respRow, error: respErr } = await supabase
      .from('responders').insert(respData).select().single()
    if (respErr) sbThrow(respErr)
    return respRow
  }

  // ── Admin creation: create Supabase Auth account + profiles row ──
  if (table === 'admins') {
    const { password, ...adminData } = body
    if (!password) throwErr('Password is required to create an admin account.', 400)

    const email = `${adminData.contact_number}@survaive.ph`
    const userMeta = {
      role: 'admin',
      name: adminData.name,
      contact_number: adminData.contact_number,
      province: adminData.province,
      municipality: adminData.municipality,
    }

    const { data: authData, error: authError } = await signupClient.auth.signUp({
      email,
      password,
      options: { data: userMeta },
    })

    if (authError) {
      if (authError.message?.toLowerCase().includes('already')) {
        throwErr(`Contact number ${adminData.contact_number} already has an account.`, 409)
      }
      throwErr(authError.message || 'Failed to create admin auth account.', 500)
    }

    const uid = authData.user?.id
    if (!uid) throwErr('Auth account created but no user ID returned.', 500)

    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: uid, role: 'admin', name: adminData.name,
      contact_number: adminData.contact_number,
      province: adminData.province, municipality: adminData.municipality,
    })
    if (profileErr) throwErr(profileErr.message, 500)

    const { data: adminRow, error: adminErr } = await supabase
      .from('admins').insert(adminData).select().single()
    if (adminErr) sbThrow(adminErr)
    return adminRow
  }

  // ── Generic table insert (password field removed — Supabase Auth owns it) ──
  const { password: _pw, ...insertData } = body
  const { data, error } = await supabase.from(table).insert(insertData).select().single()
  if (error) sbThrow(error)
  return data
}

// ── PUT ────────────────────────────────────────────────────────────────────────
async function put(path, body = {}) {
  const { resource, id, table } = parsePath(path)

  // PUT /responders (no ID) = update the currently-logged-in responder's own row
  if (resource === 'responders' && !id) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return {}
    const { data: profile } = await supabase
      .from('profiles').select('contact_number').eq('id', user.id).maybeSingle()
    if (!profile?.contact_number) return {}
    const { data, error } = await supabase
      .from('responders')
      .update(body)
      .eq('contact_number', profile.contact_number)
      .select()
      .maybeSingle()
    if (error) sbThrow(error)
    return data ?? {}
  }

  // ── Constituent update: strip account_active and sync it to profiles.status ──
  if (resource === 'constituents' && id) {
    const { account_active, password: _pw, ...updateData } = body
    const { data, error } = await supabase.from('victims').update(updateData).eq('id', id).select().single()
    if (error) sbThrow(error)
    if (typeof account_active === 'boolean' && data?.contact_number) {
      await supabase.from('profiles')
        .update({ status: account_active ? 'active' : 'inactive' })
        .eq('contact_number', data.contact_number).eq('role', 'victim')
    }
    return data
  }

  if (!id) throwErr('ID required for update')
  const { password: _pw, ...updateData } = body
  const { data, error } = await supabase.from(table).update(updateData).eq('id', id).select().single()
  if (error) sbThrow(error)
  return data
}

// ── DELETE ─────────────────────────────────────────────────────────────────────
async function del(path) {
  const { resource, id, table } = parsePath(path)
  if (!id) throwErr('ID required for delete')

  // Constituent delete: remove victims row + profiles row (blocks login; auth user remains)
  if (resource === 'constituents') {
    const { data: victim } = await supabase
      .from('victims').select('contact_number').eq('id', id).maybeSingle()
    const { error } = await supabase.from('victims').delete().eq('id', id)
    if (error) sbThrow(error)
    if (victim?.contact_number) {
      await supabase.from('profiles').delete()
        .eq('contact_number', victim.contact_number).eq('role', 'victim')
    }
    return {}
  }

  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) sbThrow(error)
  return {}
}

const api = { get, post, put, delete: del }
export default api
