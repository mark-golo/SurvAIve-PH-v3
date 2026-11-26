import { registerPlugin, Capacitor } from '@capacitor/core'

// Register the native Android SMS plugin.
// On web/browser this stub is never called — isSMSCapable() guards every use.
const SmsNative = registerPlugin('Sms')

/**
 * Returns true when running inside the Android native container where the
 * SmsPlugin Kotlin class is registered.
 */
export function isSMSCapable() {
  return Capacitor.getPlatform() === 'android'
}

/**
 * Send an emergency SMS via the native Android SmsManager.
 *
 * @param {object} opts
 * @param {string} opts.reportId  Client UUID (mesh_packet_id) used for correlation
 * @param {string} opts.recipient Destination number (the PhilSMS inbound number)
 * @param {string} opts.message   Plain-text SMS body
 * @returns {Promise<{reportId: string, status: 'submitted'}>}
 * @throws  When running in the browser, SMS permission is denied, or the
 *          Android SMS subsystem rejects the message.
 */
export async function sendEmergencySMS({ reportId, recipient, message }) {
  if (Capacitor.getPlatform() !== 'android') {
    throw new Error('Native SMS is only available on Android')
  }
  let timeoutId
  const send = SmsNative.sendSMS({ reportId, recipient, message })
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('SMS send timed out after 60s')), 60_000)
  })
  try {
    return await Promise.race([send, timeout])
  } finally {
    clearTimeout(timeoutId)
  }
}
