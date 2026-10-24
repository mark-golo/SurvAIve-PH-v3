package ph.survaive.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/**
 * Restarts MeshNetworkService automatically after a device reboot.
 * Without this the mesh is offline until the user manually opens the app —
 * unacceptable in a disaster scenario where devices may power-cycle mid-event.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            ContextCompat.startForegroundService(
                context,
                Intent(context, MeshNetworkService::class.java).apply {
                    action = MeshNetworkService.ACTION_START
                }
            )
        }
    }
}
