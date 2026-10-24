package ph.survaive.app

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.util.Log
import android.bluetooth.BluetoothManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.getcapacitor.PermissionState
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
        // API 33+ (Android 13): POST_NOTIFICATIONS is a runtime-dangerous permission.
        // Without it the foreground service notification is suppressed, and on Samsung/
        // Xiaomi OEM the service is killed as if it were a background-restricted process.
        Permission(
            strings  = ["android.permission.POST_NOTIFICATIONS"],
            alias    = "postNotifications",
        ),
    ],
)
class MeshNetworkPlugin : Plugin() {

    companion object { private const val TAG = "MeshPlugin" }

    private var meshService: MeshNetworkService? = null
    private var pendingStartCall: PluginCall? = null

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            val service = (binder as MeshNetworkService.LocalBinder).getService()
            meshService = service
            service.onPacketReceived = { packet ->
                // Stage 2 of receive chain: plugin forwarding packet to JS via Capacitor event.
                Log.d(TAG, "notifyListeners meshPacketReceived id=${packet.id.take(8)} type=${packet.type}")
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
            // Wire BLE broadcast-status callback so JS receives advertising_started /
            // advertising_failed / awaiting_peers events via addListener("meshBroadcastStatus").
            service.getBLEStrategy()?.onBroadcastStatus = { status, errorCode ->
                val data = JSObject().apply {
                    put("status", status)
                    if (errorCode != 0) put("errorCode", errorCode)
                }
                notifyListeners("meshBroadcastStatus", data)
            }
            // Wire generic low-level event callback → JS "meshEvent" listener.
            service.getBLEStrategy()?.onMeshEvent = { type, data ->
                val jsData = JSObject().apply {
                    put("eventType", type)
                    data.forEach { (k, v) ->
                        when (v) {
                            null    -> {}
                            is Int  -> put(k, v)
                            is Long -> put(k, v)
                            is Boolean -> put(k, v)
                            else    -> put(k, v.toString())
                        }
                    }
                }
                notifyListeners("meshEvent", jsData)
            }
            // Wire relay event → JS "meshEvent" listener.
            service.onRelayedPacket = { packet ->
                notifyListeners("meshEvent", JSObject().apply {
                    put("eventType", "sos_relayed")
                    put("packetId", packet.id)
                    put("hopCount", packet.hopCount)
                    put("originDeviceId", packet.originDeviceId)
                })
            }
            pendingStartCall?.resolve(JSObject().put("success", true))
            pendingStartCall = null
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            meshService = null
            pendingStartCall?.reject("Mesh service disconnected unexpectedly")
            pendingStartCall = null
            // Android killed the service — it will be START_STICKY restarted. Rebind
            // immediately so meshService is restored as soon as the service re-creates.
            // Without this, JS _isStarted stays true but all broadcast() calls return
            // {success:false, transport:"not started"} silently.
            val rebindIntent = Intent(context, MeshNetworkService::class.java).apply {
                action = MeshNetworkService.ACTION_START
            }
            try { context.bindService(rebindIntent, this, Context.BIND_AUTO_CREATE) } catch (_: Exception) {}
        }
    }

    // ── @PluginMethod: startMesh ──────────────────────────────────────────────────

    @PluginMethod
    fun startMesh(call: PluginCall) {
        requestAllPermissions(call, "startMeshAfterPermissions")
    }

    @PermissionCallback
    private fun startMeshAfterPermissions(call: PluginCall) {
        // Verify that all critical permissions were actually granted
        val requiredAliases = mutableListOf("bluetoothScan", "bluetoothAdvertise", "bluetoothConnect",
            "location")  // ACCESS_FINE_LOCATION required on all API levels to receive manufacturer-data beacons
        val deniedAliases = requiredAliases.filter { getPermissionState(it) != PermissionState.GRANTED }
        if (deniedAliases.isNotEmpty()) {
            call.reject("Mesh requires Bluetooth permissions. Denied: $deniedAliases")
            return
        }

        pendingStartCall = call
        val intent = Intent(context, MeshNetworkService::class.java).apply {
            action = MeshNetworkService.ACTION_START
        }
        ContextCompat.startForegroundService(context, intent)
        context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)

        // Request battery optimization exemption so OEM battery managers (Samsung, Xiaomi,
        // Huawei) cannot restrict or kill BLE scanning while the app is in the background.
        // The foreground service + connectedDevice type provide Doze exemption, but OEM
        // custom battery managers can still kill a service that lacks this exemption.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
            if (pm != null && !pm.isIgnoringBatteryOptimizations(context.packageName)) {
                try {
                    activity?.startActivity(
                        Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                            data = Uri.parse("package:${context.packageName}")
                        }
                    )
                } catch (_: Exception) {}
            }
        }
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
            id             = call.getString("id") ?: UUID.randomUUID().toString(),
            type           = type,
            payload        = payload,
            originDeviceId = deviceId(),
            hopCount       = MeshPacket.MAX_HOPS,
        )

        val (success, transport) = service.broadcast(packet)
        call.resolve(
            JSObject()
                .put("success",   success)
                .put("transport", transport)
                .put("packetId",  packet.id),
        )
    }

    // ── @PluginMethod: getPeers ───────────────────────────────────────────────────

    @PluginMethod
    fun getPeers(call: PluginCall) {
        val service = meshService
        if (service == null) {
            call.resolve(JSObject().put("peers", com.getcapacitor.JSArray()))
            return
        }
        val arr = com.getcapacitor.JSArray()
        service.getPeers().forEach { peer ->
            arr.put(JSObject().apply {
                put("id",           peer["id"])
                put("transport",    peer["transport"])
                put("lastSeen",     peer["lastSeen"])
                put("isRelaying",   peer["isRelaying"]   as? Boolean ?: false)
                put("relayEnabled", peer["relayEnabled"] as? Boolean ?: true)
                put("signal",       peer["signal"]       ?: 2)
            })
        }
        call.resolve(JSObject().put("peers", arr))
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
    @SuppressLint("MissingPermission")
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

    // ── @PluginMethod: setUserRole ────────────────────────────────────────────────

    @PluginMethod
    fun setUserRole(call: PluginCall) {
        val role = call.getString("role", "device") ?: "device"
        activity.getSharedPreferences("survaive_prefs", Context.MODE_PRIVATE)
            .edit()
            .putString("user_role", role)
            .apply()
        call.resolve()
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    private fun deviceId(): String =
        Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID,
        ) ?: "unknown"
}
