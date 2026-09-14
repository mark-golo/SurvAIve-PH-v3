package ph.survaive.app.strategies

import android.content.Context
import ph.survaive.app.MeshPacket

/**
 * MeshStrategy — pluggable transport interface for the offline mesh network.
 *
 * SurvAIve uses a strategy pattern so that multiple physical transports can coexist
 * and be tried in priority order:
 *
 *   1. [BLEMeshStrategy]     — Bluetooth Low Energy GATT (always-on discovery layer)
 *   2. [WiFiDirectStrategy]  — Wi-Fi Direct P2P (higher bandwidth, group formation needed)
 *
 * New transports (Nearby Connections API, LoRa HAL, etc.) can be added by implementing
 * this interface and registering an instance in [ph.survaive.app.MeshNetworkService].
 */
interface MeshStrategy {

    /** Human-readable transport name, returned in broadcast results and stats */
    val name: String

    /**
     * Returns true if the transport hardware is present and enabled on this device.
     * [MeshNetworkService] skips strategies that report false here.
     */
    val isAvailable: Boolean

    /**
     * Start the transport:
     *   - BLE: begin advertising + GATT server + background scanning
     *   - Wi-Fi Direct: register channel + start peer discovery + open HTTP relay port
     *
     * [onPacketReceived] is invoked on the strategy's worker thread each time a
     * new (non-deduplicated) packet is received from a peer.  The callback must be
     * thread-safe — [MeshNetworkService] handles deduplication before forwarding.
     *
     * @param context     Application context for system service access
     * @param onPacketReceived Callback fired with each inbound packet
     */
    fun start(context: Context, onPacketReceived: (MeshPacket) -> Unit)

    /** Stop the transport and release all system resources (sockets, BLE handles, etc.). */
    fun stop()

    /**
     * Broadcast [packet] to all reachable peers via this transport.
     *
     * @return true if at least one peer received the packet (or the send was
     *         dispatched without immediate failure); false on total failure.
     */
    fun broadcast(packet: MeshPacket): Boolean
}
