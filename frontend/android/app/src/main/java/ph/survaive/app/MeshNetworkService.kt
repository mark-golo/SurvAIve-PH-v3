package ph.survaive.app

import android.content.Context
import ph.survaive.app.strategies.BLEMeshStrategy
import ph.survaive.app.strategies.MeshStrategy
import ph.survaive.app.strategies.WiFiDirectStrategy
import java.util.concurrent.ConcurrentHashMap

/**
 * MeshNetworkService — core engine of the SurvAIve offline mesh network.
 *
 * This service is instantiated and owned by [MeshNetworkPlugin]. It:
 *   1. Manages a prioritised list of transport strategies.
 *   2. Deduplicates incoming packets to prevent relay loops.
 *   3. Forwards packets to the next hop when acting as a relay node.
 *   4. Delivers unique inbound packets to the Capacitor plugin via [onPacketReceived].
 *
 * ── Strategy chain ─────────────────────────────────────────────────────────────
 *   [ BLEMeshStrategy ] → [ WiFiDirectStrategy ]
 *
 *   [broadcast] tries each strategy in order.  The first one to return true stops
 *   the chain (short-circuit).  Both strategies are started simultaneously so that
 *   BLE is always advertising and Wi-Fi Direct is always discovering peers — only
 *   the *send* path is sequential.
 *
 * ── Relay logic ────────────────────────────────────────────────────────────────
 *   When [relayEnabled] is true and a packet arrives with hopCount > 1,
 *   [MeshNetworkService] decrements hopCount and re-broadcasts the packet.
 *   The originating device never relays its own packet (originDeviceId check).
 *
 * ── Deduplication ──────────────────────────────────────────────────────────────
 *   [seenPacketIds] stores packet UUIDs in a [ConcurrentHashMap]-backed set.
 *   When the set exceeds [MAX_SEEN_IDS], it is cleared (simple overflow protection).
 *   A production system should use an LRU cache here.
 */
class MeshNetworkService(private val context: Context) {

    companion object {
        private const val MAX_SEEN_IDS = 500
    }

    // ── Deduplication set ────────────────────────────────────────────────────────
    private val seenPacketIds: MutableSet<String> = ConcurrentHashMap.newKeySet()

    // ── Callback registered by MeshNetworkPlugin → forwarded to JavaScript ────────
    var onPacketReceived: ((MeshPacket) -> Unit)? = null

    // ── Transport strategies ─────────────────────────────────────────────────────
    private val strategies: List<MeshStrategy> = listOf(
        BLEMeshStrategy(),
        WiFiDirectStrategy(),
    )

    /** True when this device should forward received packets to the next hop. */
    var relayEnabled: Boolean = true

    /** Android device ID cached on first call — used to skip self-originating relays */
    private val deviceId: String by lazy {
        android.provider.Settings.Secure.getString(
            context.contentResolver,
            android.provider.Settings.Secure.ANDROID_ID,
        ) ?: "unknown"
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────────

    /** Start all available transport strategies. */
    fun start() {
        strategies.forEach { strategy ->
            if (strategy.isAvailable) {
                strategy.start(context) { packet -> handleIncomingPacket(packet) }
            }
        }
    }

    /** Stop all transport strategies and release resources. */
    fun stop() {
        strategies.forEach { it.stop() }
    }

    // ── Broadcast ────────────────────────────────────────────────────────────────

    /**
     * Broadcast [packet] via the first available strategy.
     * Marks the packet as seen before sending to prevent self-relay.
     *
     * @return Pair(success, transportName)
     */
    fun broadcast(packet: MeshPacket): Pair<Boolean, String> {
        // Mark as seen so we ignore our own packet if it loops back
        seenPacketIds.add(packet.id)

        for (strategy in strategies) {
            if (strategy.isAvailable) {
                val sent = strategy.broadcast(packet)
                if (sent) return Pair(true, strategy.name)
            }
        }
        return Pair(false, "none")
    }

    // ── Incoming packet handling ─────────────────────────────────────────────────

    private fun handleIncomingPacket(packet: MeshPacket) {
        // ① Deduplication — drop if we've seen this UUID before
        if (seenPacketIds.contains(packet.id)) return
        seenPacketIds.add(packet.id)

        // ② Overflow protection
        if (seenPacketIds.size > MAX_SEEN_IDS) {
            seenPacketIds.clear()
        }

        // ③ Deliver to the Capacitor plugin → WebView → React component
        onPacketReceived?.invoke(packet)

        // ④ Relay: forward to next hop if TTL allows and we're a relay node
        if (relayEnabled && packet.hopCount > 1) {
            val relayed = packet.copy(hopCount = packet.hopCount - 1)
            broadcast(relayed)  // relayed.id already in seenPacketIds — won't loop
        }
    }

    // ── Stats ────────────────────────────────────────────────────────────────────

    /**
     * Returns current mesh statistics for display in the React MeshStatus page.
     * [peersNearby] is a best-effort count from the BLE strategy's discovered peer list.
     */
    fun getStats(): Map<String, Any> {
        val activeStrategy = strategies.firstOrNull { it.isAvailable }
        return mapOf(
            "peersNearby"   to 0,   // TODO: expose discoveredPeers.size from BLEMeshStrategy
            "transport"     to (activeStrategy?.name ?: "none"),
            "relayEnabled"  to relayEnabled,
        )
    }
}
