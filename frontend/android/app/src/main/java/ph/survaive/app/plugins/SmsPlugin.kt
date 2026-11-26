package ph.survaive.app.plugins

import android.Manifest
import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.telephony.SmsManager
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.PermissionState
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Native Android SMS plugin for the SurvAIve PH emergency fallback channel.
 *
 * Sends a plain-text SMS through Android's SmsManager when the device has
 * no internet but cellular signal is available.  The JS layer calls this via
 * Capacitor's plugin bridge; web builds never reach this code.
 *
 * Required Android permission: SEND_SMS (declared in AndroidManifest.xml).
 */
@CapacitorPlugin(
    name = "Sms",
    permissions = [Permission(strings = [Manifest.permission.SEND_SMS], alias = "sms")]
)
class SmsPlugin : Plugin() {

    @PluginMethod
    fun sendSMS(call: PluginCall) {
        val reportId  = call.getString("reportId")  ?: run { call.reject("reportId required"); return }
        val recipient = call.getString("recipient") ?: run { call.reject("recipient required"); return }
        val message   = call.getString("message")   ?: run { call.reject("message required"); return }

        if (recipient.isBlank()) { call.reject("recipient must not be blank"); return }
        if (message.isBlank())   { call.reject("message must not be blank");   return }

        // Request SEND_SMS permission if not yet granted.
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            requestPermissionForAlias("sms", call, "smsPermissionCallback")
            return
        }

        dispatchSMS(call, reportId, recipient, message)
    }

    @PermissionCallback
    fun smsPermissionCallback(call: PluginCall) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            call.reject("SMS_PERMISSION_DENIED", "SEND_SMS permission was denied by the user")
            return
        }
        val reportId  = call.getString("reportId")  ?: run { call.reject("reportId required"); return }
        val recipient = call.getString("recipient") ?: run { call.reject("recipient required"); return }
        val message   = call.getString("message")   ?: run { call.reject("message required"); return }
        dispatchSMS(call, reportId, recipient, message)
    }

    private fun dispatchSMS(call: PluginCall, reportId: String, recipient: String, message: String) {
        try {
            // Use a per-invocation UUID so concurrent sends (retry + original) never share
            // the same action string / PendingIntent and resolve the wrong JS promise.
            val callId     = java.util.UUID.randomUUID().toString().replace("-", "").take(16)
            val sentAction = "ph.survaive.app.SMS_SENT.$callId"

            val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_ONE_SHOT
            }

            val sentPI = PendingIntent.getBroadcast(
                context, 0, Intent(sentAction), piFlags
            )

            val sentReceiver = object : BroadcastReceiver() {
                override fun onReceive(ctx: Context, intent: Intent) {
                    try { context.applicationContext.unregisterReceiver(this) } catch (_: Exception) {}
                    val result = JSObject()
                    result.put("reportId", reportId)
                    when (resultCode) {
                        Activity.RESULT_OK -> {
                            result.put("status", "submitted")
                            call.resolve(result)
                        }
                        SmsManager.RESULT_ERROR_RADIO_OFF -> call.reject("SMS_RADIO_OFF",   "Cellular radio is off")
                        SmsManager.RESULT_ERROR_NO_SERVICE -> call.reject("SMS_NO_SERVICE", "No cellular service")
                        SmsManager.RESULT_ERROR_NULL_PDU   -> call.reject("SMS_NULL_PDU",   "Null PDU error")
                        else -> call.reject("SMS_SEND_FAILED", "SMS failed with result code: $resultCode")
                    }
                }
            }

            if (Build.VERSION.SDK_INT >= 33) {
                context.applicationContext.registerReceiver(sentReceiver, IntentFilter(sentAction), Context.RECEIVER_NOT_EXPORTED)
            } else {
                @Suppress("UnspecifiedRegisterReceiverFlag")
                context.applicationContext.registerReceiver(sentReceiver, IntentFilter(sentAction))
            }

            val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                context.getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            } ?: run {
                // SmsManager.getDefault() can return null on pre-API-31 dual-SIM devices
                // when no default SMS SIM is configured.
                try { context.applicationContext.unregisterReceiver(sentReceiver) } catch (_: Exception) {}
                call.reject("SMS_NO_SIM", "No SIM card or default SMS app is available")
                return
            }

            // divideMessage() correctly handles both GSM-7 (160 chars/seg) and
            // Unicode (70 chars/seg), fixing the bug where `message.length > 160`
            // would mis-route non-ASCII messages to the single-segment path.
            val parts         = smsManager.divideMessage(message)
            val remaining     = AtomicInteger(parts.size)
            val resolved      = AtomicBoolean(false)
            // Keep a reference to every per-segment receiver so they can all be
            // unregistered in the outer catch block, preventing context leaks.
            val partReceivers = ArrayList<BroadcastReceiver>()
            try {
                if (parts.size > 1) {
                    // Multi-part: single-segment sentReceiver is not used — unregister it now
                    try { context.applicationContext.unregisterReceiver(sentReceiver) } catch (_: Exception) {}

                    val sentIntents = ArrayList<PendingIntent?>()

                    parts.forEachIndexed { i, _ ->
                        val partAction = "$sentAction.part$i"
                        val partPI = PendingIntent.getBroadcast(context, i, Intent(partAction), piFlags)
                        val partReceiver = object : BroadcastReceiver() {
                            override fun onReceive(ctx: Context, intent: Intent) {
                                try { context.applicationContext.unregisterReceiver(this) } catch (_: Exception) {}
                                if (resultCode != Activity.RESULT_OK) {
                                    if (resolved.compareAndSet(false, true)) {
                                        val errCode = when (resultCode) {
                                            SmsManager.RESULT_ERROR_RADIO_OFF  -> "SMS_RADIO_OFF"
                                            SmsManager.RESULT_ERROR_NO_SERVICE -> "SMS_NO_SERVICE"
                                            SmsManager.RESULT_ERROR_NULL_PDU   -> "SMS_NULL_PDU"
                                            else                               -> "SMS_SEND_FAILED"
                                        }
                                        call.reject(errCode, "Part $i failed with code: $resultCode")
                                    }
                                    return
                                }
                                if (remaining.decrementAndGet() == 0 && resolved.compareAndSet(false, true)) {
                                    val result = JSObject()
                                    result.put("reportId", reportId)
                                    result.put("status", "submitted")
                                    call.resolve(result)
                                }
                            }
                        }
                        if (Build.VERSION.SDK_INT >= 33) {
                            context.applicationContext.registerReceiver(partReceiver, IntentFilter(partAction), Context.RECEIVER_NOT_EXPORTED)
                        } else {
                            @Suppress("UnspecifiedRegisterReceiverFlag")
                            context.applicationContext.registerReceiver(partReceiver, IntentFilter(partAction))
                        }
                        partReceivers.add(partReceiver)
                        sentIntents.add(partPI)
                    }
                    smsManager.sendMultipartTextMessage(recipient, null, parts, sentIntents, null)
                } else {
                    smsManager.sendTextMessage(recipient, null, parts[0], sentPI, null)
                }
            } catch (e: Exception) {
                // Unregister all BroadcastReceivers to prevent context leaks.
                try { context.applicationContext.unregisterReceiver(sentReceiver) } catch (_: Exception) {}
                partReceivers.forEach { r ->
                    try { context.applicationContext.unregisterReceiver(r) } catch (_: Exception) {}
                }
                call.reject("SMS_EXCEPTION", e.message ?: "Unexpected error sending SMS")
            }

        } catch (e: Exception) {
            call.reject("SMS_EXCEPTION", e.message ?: "Unexpected error sending SMS")
        }
    }
}
