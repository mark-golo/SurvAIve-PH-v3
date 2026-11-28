package ph.survaive.app.plugins

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.telephony.SmsManager
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * Native Android SMS plugin for the SurvAIve PH emergency fallback channel.
 *
 * sendSMS()      — Sends the message silently via SmsManager (no SMS app opened).
 *                  Requests SEND_SMS permission at runtime if not yet granted.
 *                  Resolves { status: "submitted" } on success.
 *                  Rejects with PERMISSION_DENIED if the user denies the permission.
 *
 * openSMSIntent() — Intent fallback: opens the device's default SMS app pre-filled.
 *                   No permission required. Resolves { status: "launched" }.
 *                   Used when sendSMS() permission is permanently denied.
 */
@CapacitorPlugin(
    name = "Sms",
    permissions = [
        Permission(strings = [Manifest.permission.SEND_SMS], alias = "sms")
    ]
)
class SmsPlugin : Plugin() {

    // ── sendSMS — SmsManager direct send ────────────────────────────────────────

    @PluginMethod
    fun sendSMS(call: PluginCall) {
        val reportId  = call.getString("reportId")  ?: run { call.reject("reportId required"); return }
        val recipient = call.getString("recipient") ?: run { call.reject("recipient required"); return }
        val message   = call.getString("message")   ?: run { call.reject("message required"); return }
        if (recipient.isBlank()) { call.reject("recipient must not be blank"); return }
        if (message.isBlank())   { call.reject("message must not be blank");   return }

        if (getPermissionState("sms") != PermissionState.GRANTED) {
            requestPermissionForAlias("sms", call, "smsPermissionCallback")
            return
        }
        doSendSMS(call)
    }

    @PermissionCallback
    private fun smsPermissionCallback(call: PluginCall) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            call.reject("PERMISSION_DENIED", "SMS permission was not granted. Enable it in Settings → Apps → SurvAIve PH → Permissions → SMS.")
            return
        }
        doSendSMS(call)
    }

    private fun doSendSMS(call: PluginCall) {
        val reportId  = call.getString("reportId")!!
        val recipient = call.getString("recipient")!!
        val message   = call.getString("message")!!

        try {
            @Suppress("DEPRECATION")
            val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                context.getSystemService(SmsManager::class.java)
            } else {
                SmsManager.getDefault()
            }

            val parts = smsManager.divideMessage(message)
            if (parts.size > 1) {
                smsManager.sendMultipartTextMessage(recipient, null, parts, null, null)
            } else {
                smsManager.sendTextMessage(recipient, null, message, null, null)
            }

            val result = JSObject()
            result.put("reportId", reportId)
            result.put("status", "submitted")
            call.resolve(result)
        } catch (e: SecurityException) {
            call.reject("PERMISSION_DENIED", "SMS permission denied by the system.")
        } catch (e: Exception) {
            call.reject("SMS_EXCEPTION", e.message ?: "Failed to send SMS")
        }
    }

    // ── openSMSIntent — Intent fallback (no permission required) ────────────────

    @PluginMethod
    fun openSMSIntent(call: PluginCall) {
        val reportId  = call.getString("reportId")  ?: run { call.reject("reportId required"); return }
        val recipient = call.getString("recipient") ?: run { call.reject("recipient required"); return }
        val message   = call.getString("message")   ?: run { call.reject("message required"); return }
        if (recipient.isBlank()) { call.reject("recipient must not be blank"); return }
        if (message.isBlank())   { call.reject("message must not be blank");   return }

        val intent = Intent(Intent.ACTION_SENDTO).apply {
            data = Uri.parse("smsto:$recipient")
            putExtra("sms_body", message)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        try {
            activity.startActivity(intent)
            val result = JSObject()
            result.put("reportId", reportId)
            result.put("status", "launched")
            call.resolve(result)
        } catch (e: ActivityNotFoundException) {
            call.reject("SMS_NO_APP", "No SMS app installed on this device")
        } catch (e: Exception) {
            call.reject("SMS_EXCEPTION", e.message ?: "Failed to open SMS app")
        }
    }
}
