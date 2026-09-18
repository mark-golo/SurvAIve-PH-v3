package ph.survaive.app

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.util.UUID

/**
 * MeshNetworkPlugin — Capacitor bridge between the React WebView and the
 * Kotlin native BLE + Wi-Fi Direct mesh foreground service.
 *
 * ── JavaScript API (TypeScript contract in MeshNetworkPlugin.ts) ───────────────
 *   MeshNetwork.startMesh()           → starts foreground service, requests permissions
 *   MeshNetwork.stopMesh()            → stops foreground service
 *   MeshNetwork.broadcast({ type, payload }) → broadcasts a packet
 *   MeshNetwork.getStats()            → returns { peersNearby, transport, relayEnabled }
 *   MeshNetwork.setRelay({ enabled }) → toggles relay mode
 *   MeshNetwork.addListener('meshPacketReceived', fn) → subscribes to inbound packets
 */
@CapacitorPlugin(
    name = "MeshNetwork",
    permissions = [
        Permission(
            strings  = [Manifest.permission.BLUETOOTH_ADVERTISE],
            alias    = "bluetoothAdvertise",
        ),
        Permission(
            strings  = [Manifest.permission.BLUETOOTH_CONNECT],
            alias    = "bluetoothConnect",
        ),
        Permission(
            strings  = [Manifest.permission.BLUETOOTH_SCAN],
            alias    = "bluetoothScan",
        ),
        Permission(
            strings  = [Manifest.permission.ACCESS_FINE_LOCATION],
            alias    = "location",
        ),
        Permission(
            strings  = [Manifest.permission.CHANGE_WIFI_STATE],
            alias    = "wifiState",
        ),
        Permission(
            strings  = [Manifest.permission.ACCESS_WIFI_STATE],
            alias    = "wifiAccess",
        ),
        Permission(
            strings  = ["android.permission.NEARBY_WIFI_DEVICES"],
            alias    = "nearbyWifi",
        ),
    ],
)
class MeshNetworkPlugin : Plugin() {

    private var meshService: MeshNetworkService? = null
    private var pendingStartCall: PluginCall? = null

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            val service = (binder as MeshNetworkService.LocalBinder).getService()
            meshService = service
            service.onPacketReceived = { packet ->
                val data = JSObject().apply {
                    put("id",             packet.id)
                    put("type",           packet.type)
                    put("payload",        packet.payload)
                    put("originDeviceId", packet.originDeviceId)
                    put("hopCount",       packet.hopCount)
                    put("timestamp",      packet.timestamp)
                }
                notifyListeners("meshPacketReceived", data)
            }
            pendingStartCall?.resolve(JSObject().put("success", true))
            pendingStartCall = null
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            meshService = null
        }
    }

    // ── @PluginMethod: startMesh ──────────────────────────────────────────────────

    @PluginMethod
    fun startMesh(call: PluginCall) {
        requestAllPermissions(call, "startMeshAfterPermissions")
    }

    @PermissionCallback
    private fun startMeshAfterPermissions(call: PluginCall) {
        pendingStartCall = call
        val intent = Intent(context, MeshNetworkService::class.java).apply {
            action = MeshNetworkService.ACTION_START
        }
        ContextCompat.startForegroundService(context, intent)
        context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
    }

    // ── @PluginMethod: stopMesh ───────────────────────────────────────────────────

    @PluginMethod
    fun stopMesh(call: PluginCall) {
        val intent = Intent(context, MeshNetworkService::class.java).apply {
            action = MeshNetworkService.ACTION_STOP
        }
        context.startService(intent)
        try { context.unbindService(serviceConnection) } catch (_: Exception) {}
        meshService = null
        call.resolve()
    }

    // ── @PluginMethod: broadcast ──────────────────────────────────────────────────

    @PluginMethod
    fun broadcast(call: PluginCall) {
        val service = meshService
        if (service == null) {
            call.resolve(JSObject().put("success", false).put("transport", "not started"))
            return
        }
        val type    = call.getString("type")    ?: "sos"
        val payload = call.getString("payload") ?: "{}"

        val packet = MeshPacket(
            id             = UUID.randomUUID().toString(),
            type           = type,
            payload        = payload,
            originDeviceId = deviceId(),
            hopCount       = MeshPacket.MAX_HOPS,
        )

        val (success, transport) = service.broadcast(packet)
        call.resolve(
            JSObject()
                .put("success",   success)
                .put("transport", transport),
        )
    }

    // ── @PluginMethod: getStats ───────────────────────────────────────────────────

    @PluginMethod
    fun getStats(call: PluginCall) {
        val service = meshService
        if (service == null) {
            call.resolve(
                JSObject()
                    .put("peersNearby", 0)
                    .put("transport", "not started")
                    .put("relayEnabled", false)
            )
            return
        }
        val stats  = service.getStats()
        val result = JSObject()
        stats.forEach { (k, v) -> result.put(k, v) }
        call.resolve(result)
    }

    // ── @PluginMethod: setRelay ───────────────────────────────────────────────────

    @PluginMethod
    fun setRelay(call: PluginCall) {
        meshService?.relayEnabled = call.getBoolean("enabled") ?: true
        call.resolve()
    }

    // ── @PluginMethod: enableRadios ───────────────────────────────────────────────

    @PluginMethod
    fun enableRadios(call: PluginCall) {
        // Bluetooth — prompt or silently enable based on API level
        val bm = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        val adapter = bm?.adapter
        if (adapter != null && !adapter.isEnabled) {
            if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
                try {
                    @Suppress("DEPRECATION")
                    adapter.enable()
                } catch (_: Exception) {
                    activity?.startActivity(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE))
                }
            } else {
                activity?.startActivity(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE))
            }
        }

        // WiFi — prompt or silently enable based on API level
        val wm = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        if (wm != null && !wm.isWifiEnabled) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                activity?.startActivity(Intent(Settings.Panel.ACTION_WIFI))
            } else {
                @Suppress("DEPRECATION")
                wm.setWifiEnabled(true)
            }
        }

        call.resolve()
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    private fun deviceId(): String =
        Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID,
        ) ?: "unknown"
}
