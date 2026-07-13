// Seed Supabase auth users + profiles for SurvAIve PH demo accounts.
// Usage:  node seed_auth_users.mjs <service-role-key>
// Get service-role key: Supabase Dashboard → Settings → API → service_role secret

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nlcntuxyndzmrhjhspgj.supabase.co'
const SERVICE_KEY  = process.argv[2] ?? ''

if (!SERVICE_KEY) {
  console.error('Error: service-role key is required.')
  console.error('Usage: node seed_auth_users.mjs <service-role-key>')
  console.error('Find it: Supabase Dashboard → Settings → API → service_role secret')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const USERS = [
  {
    contact: '09170000001', role: 'superadmin',
    name: 'DOST Provincial Director - Caraga',
    province: 'Surigao del Norte', municipality: null, barangay: null,
  },
  {
    contact: '09170000002', role: 'admin',
    name: 'DRRM Officer - Del Carmen',
    province: 'Surigao del Norte', municipality: 'Del Carmen', barangay: null,
  },
  {
    contact: '09170000003', role: 'admin',
    name: 'DRRM Officer - Dapa',
    province: 'Surigao del Norte', municipality: 'Dapa', barangay: null,
  },
]

console.log(`Seeding ${USERS.length} auth users into ${SUPABASE_URL} ...\n`)

for (const u of USERS) {
  const email = `${u.contact}@survAIve.ph`

  const userMeta = {
    role:         u.role,
    name:         u.name,
    contact_number: u.contact,
    province:     u.province,
    municipality: u.municipality,
    barangay:     u.barangay,
  }

  let uid

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: 'password',
    email_confirm: true,
    user_metadata: userMeta,
  })

  if (error) {
    if (error.message.includes('already been registered') || error.message.includes('already exists')) {
      // Auth user exists — look up their UUID (Supabase stores emails lowercase)
      const { data: list } = await supabase.auth.admin.listUsers({ perPage: 50 })
      const existing = list?.users?.find((x) => x.email === email.toLowerCase())
      if (!existing) {
        console.error(`  ERROR  ${email}: exists but UUID not found`)
        continue
      }
      uid = existing.id
      // Patch metadata on the existing user so login works even without profiles row
      await supabase.auth.admin.updateUserById(uid, { user_metadata: userMeta })
      console.log(`  EXISTS  ${email} — metadata patched, upserting profile`)
    } else {
      console.error(`  ERROR  ${email}: ${error.message}`)
      continue
    }
  } else {
    uid = data.user.id
    console.log(`  OK     ${email}  (${u.role})`)
  }

  // Upsert profiles row (safe for both new and pre-existing auth users)
  const { error: pe } = await supabase.from('profiles').upsert({
    id:             uid,
    role:           u.role,
    name:           u.name,
    contact_number: u.contact,
    province:       u.province,
    municipality:   u.municipality,
    barangay:       u.barangay,
  })

  if (pe) console.error(`  PROFILE ERROR  ${email}: ${pe.message}`)
}

console.log('\nDone! Check Supabase Dashboard → Authentication → Users to verify.')
