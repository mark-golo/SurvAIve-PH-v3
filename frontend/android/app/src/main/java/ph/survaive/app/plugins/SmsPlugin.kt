package ph.survaive.app.plugins

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Native Android SMS plugin for the SurvAIve PH emergency fallback channel.
 *
 * Opens the device's default SMS app pre-filled with the emergency recipient
 * and report payload, then resolves immediately with status "launched".
 * No SEND_SMS permission is required — the user's own SMS app handles sending.
 * This avoids the Android 10+ restricted-permission block that prevents
 * third-party apps from holding SEND_SMS.
 */
@CapacitorPlugin(name = "Sms")
class SmsPlugin : Plugin() {

    @PluginMethod
    fun sendSMS(call: PluginCall) {
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
