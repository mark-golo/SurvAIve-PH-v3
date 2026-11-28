import { supabase } from './supabase'
import { PHILSMS_RECEIVING_NUMBER } from './smsConfig'

/**
 * Returns the list of active SMS recipient numbers for a victim's location.
 *
 * Priority order:
 *   1. Active Response Agencies in the victim's municipality
 *   2. Active Admins in the victim's municipality
 *   3. Active Response Agencies in the victim's province (if no municipality match)
 *   4. PHILSMS_RECEIVING_NUMBER (hardcoded fallback)
 *
 * Always returns a non-empty array — the last-resort fallback ensures SMS is
 * never silently dropped even when Supabase queries fail or return no rows.
 *
 * @param {string|null} municipality
 * @param {string|null} province
 * @returns {Promise<string[]>}
 */
export async function getSMSRecipients(municipality, province) {
  const numbers = new Set()
  const muni = municipality?.trim() || null
  const prov = province?.trim() || null

  if (muni) {
    try {
      const { data: agencies } = await supabase
        .from('response_agencies')
        .select('contact_number')
        .eq('municipality', muni)
        .eq('status', 'active')
      agencies?.forEach(a => a.contact_number && numbers.add(a.contact_number))
    } catch {}

    try {
      const { data: admins } = await supabase
        .from('admins')
        .select('contact_number')
        .eq('municipality', muni)
        .eq('status', 'active')
      admins?.forEach(a => a.contact_number && numbers.add(a.contact_number))
    } catch {}
  }

  // If no municipality-level match, try province-level agencies as a wider net
  if (numbers.size === 0 && prov) {
    try {
      const { data: agencies } = await supabase
        .from('response_agencies')
        .select('contact_number')
        .eq('province', prov)
        .eq('status', 'active')
      agencies?.forEach(a => a.contact_number && numbers.add(a.contact_number))
    } catch {}
  }

  const result = [...numbers].filter(Boolean)
  return result.length > 0 ? result : [PHILSMS_RECEIVING_NUMBER]
}
