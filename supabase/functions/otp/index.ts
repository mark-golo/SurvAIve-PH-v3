import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SEMAPHORE_KEY = Deno.env.get('SEMAPHORE_API_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function secureOtp(): string {
  const arr = new Uint8Array(4)
  crypto.getRandomValues(arr)
  return ((arr[0] * 16777216 + arr[1] * 65536 + arr[2] * 256 + arr[3]) % 1000000)
    .toString().padStart(6, '0')
}

function normalisePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, '')
  if (d.startsWith('63') && d.length === 12) return '+' + d
  if (d.startsWith('0')  && d.length === 11)  return '+63' + d.slice(1)
  if (d.length === 10) return '+63' + d
  return null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  let body: { action?: string; phone?: string; otp?: string }
  try { body = await req.json() } catch { return json({ error: 'Invalid request body' }, 400) }

  const phone = normalisePhone(body.phone ?? '')
  if (!phone) return json({ error: 'Invalid Philippine mobile number' }, 400)

  // ── SEND ──────────────────────────────────────────────────────────────────
  if (body.action === 'send') {
    // Rate limit: 1 OTP per 60 seconds per phone
    const { data: recent } = await admin.from('otp_requests')
      .select('id').eq('phone', phone).eq('used', false)
      .gte('created_at', new Date(Date.now() - 60_000).toISOString()).limit(1)

    if (recent?.length) return json({ error: 'Please wait 60 seconds before requesting another code.' }, 429)

    const code  = secureOtp()
    const salt  = crypto.randomUUID()
    const hash  = await sha256(code + salt + phone)
    const expAt = new Date(Date.now() + 5 * 60_000).toISOString()

    await admin.from('otp_requests').insert({ phone, otp_hash: `${salt}:${hash}`, expires_at: expAt })

    const smsRes = await fetch('https://api.semaphore.co/api/v4/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        apikey:     SEMAPHORE_KEY,
        number:     phone,
        message:    `Your SurvAIve PH code is: ${code}. Valid for 5 minutes. Do not share this code.`,
        sendername: 'SurvAIve',
      }),
    })

    if (!smsRes.ok) {
      console.error('Semaphore error:', await smsRes.text())
      return json({ error: 'Failed to send SMS. Please try again.' }, 502)
    }

    return json({ message: 'OTP sent via SMS' })
  }

  // ── VERIFY ────────────────────────────────────────────────────────────────
  if (body.action === 'verify') {
    const otp = body.otp ?? ''
    if (otp.length !== 6) return json({ error: 'Enter the 6-digit code.' }, 400)

    const { data: rows } = await admin.from('otp_requests')
      .select('id, otp_hash, attempts')
      .eq('phone', phone).eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }).limit(1)

    if (!rows?.length) return json({ error: 'No valid OTP found. Please request a new code.' }, 400)

    const row = rows[0]
    if (row.attempts >= 5) return json({ error: 'Too many incorrect attempts. Please request a new code.' }, 429)

    const [salt, storedHash] = (row.otp_hash as string).split(':')
    const inputHash = await sha256(otp + salt + phone)

    if (inputHash !== storedHash) {
      await admin.from('otp_requests').update({ attempts: row.attempts + 1 }).eq('id', row.id)
      return json({ error: `Incorrect code. ${4 - row.attempts} attempt(s) remaining.` }, 400)
    }

    await admin.from('otp_requests').update({ used: true }).eq('id', row.id)

    // ── Find or create Supabase auth user ────────────────────────────────
    // Internal email used as the auth identity (never actually emailed)
    const internalEmail = `${phone.replace('+', '')}@internal.survaive.ph`
    let authUser: { id: string; email?: string | null } | null = null

    try {
      const { data } = await admin.auth.admin.getUserByPhone(phone)
      if (data?.user) authUser = data.user
    } catch { /* no phone-auth user */ }

    if (!authUser) {
      try {
        const { data } = await admin.auth.admin.getUserByEmail(internalEmail)
        if (data?.user) authUser = data.user
      } catch { /* not found yet */ }
    }

    if (!authUser) {
      const { data, error } = await admin.auth.admin.createUser({
        email: internalEmail, email_confirm: true, user_metadata: { role: 'victim' },
      })
      if (error || !data?.user) return json({ error: 'Failed to create user account.' }, 500)
      authUser = data.user
    } else if (!authUser.email) {
      // Existing phone-auth user — add internal email so generateLink works
      await admin.auth.admin.updateUserById(authUser.id, { email: internalEmail })
      authUser = { ...authUser, email: internalEmail }
    }

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink', email: authUser.email!,
    })
    if (linkErr || !linkData?.properties?.hashed_token)
      return json({ error: 'Authentication failed. Please try again.' }, 500)

    return json({ hashed_token: linkData.properties.hashed_token })
  }

  return json({ error: 'Unknown action' }, 400)
})
