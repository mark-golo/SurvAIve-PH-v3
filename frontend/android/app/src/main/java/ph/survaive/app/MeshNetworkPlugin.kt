package ph.survaive.app

import android.Manifest
import android.os.Build
import android.provider.Settings
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
 * Kotlin native BLE + Wi-Fi Direct mesh implementation.
 *
 * ── JavaScript API (TypeScript contract in MeshNetworkPlugin.ts) ───────────────
 *   MeshNetwork.startMesh()           → starts all transports, requests permissions
 *   MeshNetwork.stopMesh()            → stops all transports
 *   MeshNetwork.broadcast({ type, payload }) → broadcasts a packet
 *   MeshNetwork.getStats()            → returns { peersNearby, transport, relayEnabled }
 *   MeshNetwork.setRelay({ enabled }) → toggles relay mode
 *   MeshNetwork.addListener('meshPacketReceived', fn) → subscribes to inbound packets
 *
 * ── Permissions ────────────────────────────────────────────────────────────────
 *   Android 12+ (API 31+): BLUETOOTH_ADVERTISE, BLUETOOTH_CONNECT, BLUETOOTH_SCAN
 *   All versions:          ACCESS_FINE_LOCATION (required for BLE scan + Wi-Fi Direct)
 *   Wi-Fi Direct:          ACCESS_WIFI_STATE, CHANGE_WIFI_STATE
 *
 *   Permissions are requested lazily when [startMesh] is first called.
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
    ],
)
class MeshNetworkPlugin : Plugin() {

    private lateinit var meshService: MeshNetworkService

    // ── Plugin load ───────────────────────────────────────────────────────────────

    override fun load() {
        meshService = MeshNetworkService(context)

        // Wire incoming packets from the Kotlin service to the JavaScript layer
        meshService.onPacketReceived = { packet ->
            val data = JSObject().apply {
                put("id",             packet.id)
                put("type",           packet.type)
                put("payload",        packet.payload)
                put("originDeviceId", packet.originDeviceId)
                put("hopCount",       packet.hopCount)
                put("timestamp",      packet.timestamp)
            }
            // Fires 'meshPacketReceived' event → React's addListener callback
            notifyListeners("meshPacketReceived", data)
        }
    }

    // ── @PluginMethod: startMesh ──────────────────────────────────────────────────

    /**
     * Requests all required runtime permissions then starts the mesh transports.
     * Capacitor's permission system calls [startMeshAfterPermissions] once the
     * user responds to the permission dialog.
     */
    @PluginMethod
    fun startMesh(call: PluginCall) {
        requestAllPermissions(call, "startMeshAfterPermissions")
    }

    @PermissionCallback
    private fun startMeshAfterPermissions(call: PluginCall) {
        meshService.start()
        call.resolve(JSObject().put("success", true))
    }

    // ── @PluginMethod: stopMesh ───────────────────────────────────────────────────

    @PluginMethod
    fun stopMesh(call: PluginCall) {
        meshService.stop()
        call.resolve()
    }

    // ── @PluginMethod: broadcast ──────────────────────────────────────────────────

    /**
     * Creates a [MeshPacket] from the call arguments and passes it to [MeshNetworkService].
     *
     * JS call: MeshNetwork.broadcast({ type: 'sos', payload: '{"lat":...}' })
     */
    @PluginMethod
    fun broadcast(call: PluginCall) {
        val type    = call.getString("type")    ?: "sos"
        val payload = call.getString("payload") ?: "{}"

        val packet = MeshPacket(
            id             = UUID.randomUUID().toString(),
            type           = type,
            payload        = payload,
            originDeviceId = deviceId(),
            hopCount       = MeshPacket.MAX_HOPS,
        )

        val (success, transport) = meshService.broadcast(packet)
        call.resolve(
            JSObject()
                .put("success",   success)
                .put("transport", transport),
        )
    }

    // ── @PluginMethod: getStats ───────────────────────────────────────────────────

    @PluginMethod
    fun getStats(call: PluginCall) {
        val stats  = meshService.getStats()
        val result = JSObject()
        stats.forEach { (k, v) -> result.put(k, v) }
        call.resolve(result)
    }

    // ── @PluginMethod: setRelay ───────────────────────────────────────────────────

    @PluginMethod
    fun setRelay(call: PluginCall) {
        meshService.relayEnabled = call.getBoolean("enabled") ?: true
        call.resolve()
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    private fun deviceId(): String =
        Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID,
        ) ?: "unknown"
}
