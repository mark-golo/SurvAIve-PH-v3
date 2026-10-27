import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnon) {
  console.error('[SurvAIve] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. ' +
    'Set these in the Vercel project dashboard (Settings → Environment Variables) or in .env.local for local dev.')
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnon ?? '')

// Non-persistent client used to create new auth accounts from the Admin UI
// without overwriting the currently logged-in admin's session.
export const signupClient = createClient(
  supabaseUrl  ?? '',
  supabaseAnon ?? '',
  { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'sb-signup-tmp' } }
)
