// Supabase compatibility wrapper — maps old PHP URL patterns to Supabase calls
import { supabase } from './supabase'

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

// Heuristic priority score matching the PHP backend logic
function calcPriorityScore(body) {
  let score = 50
  const s = (body.status ?? '').toLowerCase()
  if (s === 'trapped') score += 30
  else if (s === 'injured') score += 20
  else if (s === 'missing') score += 15
  const n = Number(body.people_count) || 1
  if (n >= 10) score += 25
  else if (n >= 5) score += 15
  else if (n >= 2) score += 5
  return Math.min(score, 99)
}

// Normalize SOS row: add priority label and human-readable time_ago
function normalizeSos(r) {
  if (!r) return r
  const score = r.ai_priority_score ?? 50
  const priority = score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 40 ? 'MODERATE' : 'LOW'
  let time_ago = ''
  if (r.created_at) {
    const mins = Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000)
    time_ago = mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`
  }
  // victims join comes back as r.victims.name when using select('*, victims(name,...)')
  const joinedName    = r.victims?.name ?? null
  const joinedContact = r.victims?.contact_number ?? null
  return {
    ...r,
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

  // ── Auth endpoints ──
  if (resource === 'auth') {
    const action = path.replace(/\?.*/, '').split('/')[2]

    if (action === 'login') {
      const email = `${body.contact_number}@survAIve.ph`
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: body.password })
      if (error) throwErr('Invalid credentials. Check your contact number and password.', 401)
      const { data: profile, error: pe } = await supabase
        .from('profiles').select('*').eq('id', data.user.id).single()
      if (pe || !profile) throwErr('Account not fully set up. Contact your administrator.', 403)
      return { token: data.session.access_token, user: profile }
    }

    if (action === 'otp') {
      const email = `${body.contact}@survAIve.ph`

      if (body.action === 'send') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true },
        })
        if (error) throwErr(error.message)
        return { message: 'OTP sent to email', demo_otp: 'Check email: ' + email }
      }

      if (body.action === 'verify') {
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: body.otp,
          type: 'email',
        })
        if (error) throwErr('Invalid or expired OTP')
        const { data: profile } = await supabase
          .from('profiles').select('*').eq('id', data.user.id).maybeSingle()
        if (profile) {
          const { data: victim } = await supabase
            .from('victims').select('*').eq('contact_number', body.contact).maybeSingle()
          return {
            existing_user: true,
            token: data.session.access_token,
            user: { ...profile, ...(victim ?? {}) },
          }
        }
        return { existing_user: false, token: data.session.access_token }
      }
    }

    if (action === 'register') {
      const { data: { user }, error: ue } = await supabase.auth.getUser()
      if (ue || !user) throwErr('Session expired. Please restart registration.', 401)

      const victimData = {
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
      }
      const { data: victim, error: ve } = await supabase
        .from('victims').insert(victimData).select().single()
      if (ve) sbThrow(ve)

      const { error: pe } = await supabase.from('profiles').upsert({
        id:             user.id,
        role:           'victim',
        name:           body.name,
        contact_number: body.contact_number,
        province:       body.province ?? null,
        municipality:   body.municipality ?? null,
        barangay:       body.barangay ?? null,
      })
      if (pe) sbThrow(pe)

      const { data: sess } = await supabase.auth.getSession()
      return {
        token: sess.session?.access_token ?? null,
        user: {
          id:           user.id,
          role:         'victim',
          name:         body.name,
          municipality: body.municipality,
          province:     body.province,
          barangay:     body.barangay,
          contact_number: body.contact_number,
        },
      }
    }

    throwErr('Unknown auth action', 404)
  }

  // ── SOS submit ──
  if (resource === 'sos') {
    const score = calcPriorityScore(body)
    const { data, error } = await supabase
      .from('sos_reports')
      .insert({
        barangay:         body.barangay     ?? null,
        municipality:     body.municipality ?? null,
        province:         body.province     ?? null,
        lat:              body.lat          ?? null,
        lng:              body.lng          ?? null,
        status:           body.status       ?? 'unknown',
        people_count:     Number(body.people_count) || 1,
        notes:            body.notes        ?? null,
        ai_priority_score: score,
        rescue_status:    'pending',
      })
      .select()
      .single()
    if (error) sbThrow(error)
    return { ...data, ai_priority_score: score }
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

  if (!id) throwErr('ID required for update')
  const { password: _pw, ...updateData } = body
  const { data, error } = await supabase.from(table).update(updateData).eq('id', id).select().single()
  if (error) sbThrow(error)
  return data
}

// ── DELETE ─────────────────────────────────────────────────────────────────────
async function del(path) {
  const { id, table } = parsePath(path)
  if (!id) throwErr('ID required for delete')
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) sbThrow(error)
  return {}
}

const api = { get, post, put, delete: del }
export default api
