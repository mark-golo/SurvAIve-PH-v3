package ph.survaive.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Binder
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import ph.survaive.app.strategies.BLEMeshStrategy
import ph.survaive.app.strategies.MeshStrategy
import ph.survaive.app.strategies.WiFiDirectStrategy
import java.util.concurrent.ConcurrentHashMap

/**
 * MeshNetworkService — Android Foreground Service wrapping the BLE + Wi-Fi Direct mesh.
 *
 * Running as a foreground service keeps BLE advertising, the GATT server,
 * and the Wi-Fi Direct relay server alive even when the user locks the screen
 * or switches to another app (Android 8+ background restriction bypass).
 *
 * ── Binding ────────────────────────────────────────────────────────────────────
 *   MeshNetworkPlugin binds to this service via [LocalBinder] to call
 *   [broadcast], [getStats], and to set [relayEnabled] and [onPacketReceived].
 *
 * ── Strategy chain ─────────────────────────────────────────────────────────────
 *   [ BLEMeshStrategy ] → [ WiFiDirectStrategy ]
 */
class MeshNetworkService : Service() {

    companion object {
        const val ACTION_START = "ph.survaive.app.MESH_START"
        const val ACTION_STOP  = "ph.survaive.app.MESH_STOP"
        const val NOTIF_ID     = 1001
        const val CHANNEL_ID   = "mesh_channel"
        private const val MAX_SEEN_IDS      = 500
        private const val MAX_PENDING       = 20
        private const val PREFS_PENDING     = "mesh_pending"
        private const val PREFS_KEY_PACKETS = "pending_packets"
    }

    inner class LocalBinder : Binder() {
        fun getService(): MeshNetworkService = this@MeshNetworkService
    }

    private val binder = LocalBinder()

    // ── Deduplication set ────────────────────────────────────────────────────────
    // FIFO-bounded: evicts the insertion-oldest entry when capacity exceeds MAX_SEEN_IDS.
    // ConcurrentHashMap.newKeySet() evicts in hash-bucket order (arbitrary), allowing old
    // entries to survive while new ones are removed — creating relay-storm windows.
    private val seenPacketIds: MutableSet<String> = java.util.Collections.synchronizedSet(
        java.util.Collections.newSetFromMap(
            object : java.util.LinkedHashMap<String, Boolean>(MAX_SEEN_IDS + 1, 0.75f, false) {
                override fun removeEldestEntry(e: Map.Entry<String, Boolean>) = size > MAX_SEEN_IDS
            }
        )
    )

    // ── Store-and-forward buffer ─────────────────────────────────────────────────
    // Packets are ALWAYS queued here on broadcast() — even when BLE returns true (optimistic).
    // BLEMeshStrategy removes a packet via onWriteConfirmed only when the GATT write is
    // actually confirmed (onCharacteristicWrite GATT_SUCCESS). This ensures the retry loop
    // always has the packet available if the async write fails silently.
    private val pendingPackets: ArrayDeque<MeshPacket> = ArrayDeque()

    // ── Per-peer relay counter ───────────────────────────────────────────────────
    // Tracks how many packets from each originDeviceId have been relayed by this node.
    // Exposed via getPeers() so the UI can show a real relay count instead of a timestamp.
    private val forwardedCount: ConcurrentHashMap<String, Int> = ConcurrentHashMap()

    // ── Relay rate-limiting ───────────────────────────────────────────────────────
    // Caps SOS relay at 1 per 8s per unique originDeviceId to prevent relay storms from
    // a single injected packet with hopCount=5 producing 3^5=243 transmissions.
    private val _relayRateMs = ConcurrentHashMap<String, Long>()
    private fun isRelayRateLimited(originId: String): Boolean {
        val now = System.currentTimeMillis()
        val last = _relayRateMs.getOrDefault(originId, 0L)
        if (now - last < 8_000L) return true
        _relayRateMs[originId] = now
        return false
    }

    // Gap 5 fix: relay packets queued for BLE await GATT confirmation before the
    // onRelayedPacket event fires. Non-BLE transports deliver synchronously and fire immediately.
    private val pendingRelayNotify: ConcurrentHashMap<String, MeshPacket> = ConcurrentHashMap()

    // ── Callback registered by MeshNetworkPlugin → forwarded to JavaScript ────────
    // Packets that arrive before the plugin binds are buffered and drained on assignment.
    private val startupBuffer: ArrayDeque<MeshPacket> = ArrayDeque()

    var onPacketReceived: ((MeshPacket) -> Unit)? = null
        set(value) {
            field = value
            if (value != null) {
                val buffered = synchronized(startupBuffer) { startupBuffer.toList().also { startupBuffer.clear() } }
                buffered.forEach { value.invoke(it) }
            }
        }

    // Fired when this device relays a received packet to other peers.
    var onRelayedPacket: ((packet: MeshPacket) -> Unit)? = null

    // ── Transport strategies ─────────────────────────────────────────────────────
    private val strategies: List<MeshStrategy> = listOf(
        BLEMeshStrategy(),
        WiFiDirectStrategy(),
    )

    var relayEnabled: Boolean = true

    private var started = false

    // Retries pendingPackets every 3s on a dedicated background thread to avoid
    // GATT operations accumulating on the main thread under sustained mesh load.
    private val retryThread = HandlerThread("MeshRetry").also { it.start() }
    private val retryHandler = Handler(retryThread.looper)
    // M1 fix: BLE connectGatt must run on main thread on Samsung/Xiaomi OEM stacks.
    private val mainHandler = Handler(Looper.getMainLooper())

    private fun scheduleRetry() {
        retryHandler.postDelayed({
            // Run flushPending on retryThread (not mainHandler) to prevent ANR when
            // WiFiDirect.broadcast() blocks for up to 10s on a TCP write.
            // BLEMeshStrategy.broadcast() still posts connectAndWrite to mainHandler
            // internally, so the M1 fix (connectGatt on main thread) is preserved.
            if (pendingPackets.isNotEmpty()) flushPending()
            scheduleRetry()
        }, 3000L)
    }

    private val deviceId: String by lazy {
        android.provider.Settings.Secure.getString(
            contentResolver,
            android.provider.Settings.Secure.ANDROID_ID,
        ) ?: "unknown"
    }

    // Gap 2 fix: SharedPreferences-backed durability for the store-and-forward buffer.
    private val prefs by lazy { getSharedPreferences(PREFS_PENDING, android.content.Context.MODE_PRIVATE) }

    private fun persistPending() {
        val json = synchronized(pendingPackets) {
            "[${pendingPackets.joinToString(",") { it.toJson() }}]"
        }
        prefs.edit().putString(PREFS_KEY_PACKETS, json).commit()
    }

    private fun restorePending() {
        val stored = prefs.getString(PREFS_KEY_PACKETS, null) ?: return
        try {
            val arr = org.json.JSONArray(stored)
            synchronized(pendingPackets) {
                for (i in 0 until arr.length()) {
                    val p = MeshPacket.fromJson(arr.getJSONObject(i).toString()) ?: continue
                    if (pendingPackets.none { it.id == p.id }) pendingPackets.addLast(p)
                }
            }
            android.util.Log.d("MeshService", "Restored ${arr.length()} pending packet(s) from prefs")
        } catch (e: Exception) {
            android.util.Log.w("MeshService", "Failed to restore pending packets: ${e.message}")
        }
    }

    // ── Service lifecycle ────────────────────────────────────────────────────────

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (!started) {
            // Android 14 (API 34) requires the three-argument form when the manifest
            // declares android:foregroundServiceType="connectedDevice". Without it,
            // onStartCommand() throws MissingForegroundServiceTypeException and the
            // service is killed before BLE advertising or scanning can start.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIF_ID, buildNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
            } else {
                startForeground(NOTIF_ID, buildNotification())
            }

            // Wire callbacks BEFORE starting strategies so there is no race window
            // where a packet is confirmed before the callback is registered.
            strategies.filterIsInstance<BLEMeshStrategy>().firstOrNull()?.onWriteConfirmed = { packetId ->
                synchronized(pendingPackets) { pendingPackets.removeIf { it.id == packetId } }
                persistPending()
                // Increment relay counter and fire event on confirmed GATT delivery.
                pendingRelayNotify.remove(packetId)?.let { relayed ->
                    forwardedCount[relayed.originDeviceId] =
                        (forwardedCount[relayed.originDeviceId] ?: 0) + 1
                    onRelayedPacket?.invoke(relayed)
                }
            }
            strategies.filterIsInstance<BLEMeshStrategy>().firstOrNull()?.onNewPeerDiscovered = { _ ->
                // New BLE peer just appeared — flush pending packets immediately instead of waiting 3s retry.
                retryHandler.post { flushPending() }
            }

            strategies.forEach { strategy ->
                strategy.start(applicationContext) { packet -> handleIncomingPacket(packet) }
            }
            started = true
            restorePending()
            scheduleRetry()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        retryHandler.removeCallbacksAndMessages(null)
        retryThread.quitSafely()
        strategies.forEach { it.stop() }
        started = false
        super.onDestroy()
    }

    // ── Broadcast ────────────────────────────────────────────────────────────────

    fun broadcast(packet: MeshPacket): Pair<Boolean, String> {
        // Emergency SOS overrides battery-saver relay-off: re-enable relay so the sender
        // participates in mesh forwarding even if the user previously disabled it.
        if (packet.type == "sos" && !relayEnabled) {
            relayEnabled = true
            android.util.Log.d("MeshService", "relay auto-enabled: SOS broadcast overrides battery-saver mode")
        }
        seenPacketIds.add(packet.id)
        // Cross-format dedup: suppress the beacon-format version of any full-UUID packet
        // so that if the same packet arrives via both passive beacon and GATT write,
        // the second delivery is dropped by handleIncomingPacket.
        if (!packet.id.startsWith("beacon-") && !packet.id.startsWith("ack-")) {
            seenPacketIds.add("beacon-" + packet.id.replace("-", "").take(6))
        }

        // Always queue first — BLE is optimistic (returns true before the write completes).
        // onWriteConfirmed removes the packet when the write is actually confirmed.
        // This guarantees the retry loop always has the packet if the async GATT write fails.
        synchronized(pendingPackets) {
            if (pendingPackets.none { it.id == packet.id }) {
                if (pendingPackets.size >= MAX_PENDING) pendingPackets.removeFirst()
                pendingPackets.addLast(packet)
            }
        }
        persistPending()

        for (strategy in strategies) {
            if (strategy.isAvailable && strategy.broadcast(packet)) {
                if (strategy.name != "BLE") {
                    // Non-BLE strategies deliver synchronously — remove from pending immediately
                    synchronized(pendingPackets) { pendingPackets.removeIf { it.id == packet.id } }
                    flushPending()
                }
                // For BLE: stays in pending until onWriteConfirmed fires
                return Pair(true, strategy.name)
            }
        }
        // No strategy could even attempt delivery — stays in pending for next retry cycle
        return Pair(false, "none")
    }

    private fun flushPending() {
        val toFlush = synchronized(pendingPackets) { pendingPackets.toList().also { pendingPackets.clear() } }
        for (p in toFlush) {
            var sent = false
            for (strategy in strategies) {
                if (strategy.isAvailable && strategy.broadcast(p)) {
                    sent = true
                    if (strategy.name != "BLE") {
                        // Non-BLE delivered synchronously — packet stays cleared from pending
                    } else {
                        // BLE: re-add to pending; onWriteConfirmed will remove it on success
                        synchronized(pendingPackets) {
                            if (pendingPackets.none { it.id == p.id }) pendingPackets.addLast(p)
                        }
                    }
                    break
                }
            }
            if (!sent) {
                // No strategy could attempt delivery — re-queue for next retry cycle
                synchronized(pendingPackets) {
                    if (pendingPackets.none { it.id == p.id }) pendingPackets.addLast(p)
                }
            }
        }
    }

    // ── Incoming packet handling ─────────────────────────────────────────────────

    private fun handleIncomingPacket(packet: MeshPacket) {
        // Drop packets we originated ourselves (important for beacon self-receive)
        // Fix 4: lowercase both sides — beacon-decoded originDeviceId is always lowercase hex,
        // but raw ANDROID_ID may contain uppercase characters on some OEM devices.
        if (packet.originDeviceId.length >= 12 && deviceId.take(12).lowercase() == packet.originDeviceId.take(12).lowercase()) return
        // Drop stale packets (>30 min) and future-dated packets (>5 min ahead of our clock).
        // Use receiver-side clock so the window cannot be bypassed by setting ts=now() in the packet.
        val receiveMs = System.currentTimeMillis()
        val age = receiveMs - packet.timestamp
        if (age > 30 * 60 * 1000L || age < -(5 * 60 * 1000L)) {
            android.util.Log.d("MeshService", "Stale/future-dated packet dropped id=${packet.id} age=${age}ms")
            return
        }
        // Exact-ID dedup only. GATT is allowed through even if beacon arrived first:
        // beacon carries partial data (no barangay/municipality), GATT carries full SOS.
        // JS-side addReceivedSOS merges the two into one entry.
        val shortId = "beacon-" + packet.id.replace("-", "").take(6)
        if (seenPacketIds.contains(packet.id)) {
            android.util.Log.d("MeshService", "Duplicate suppressed id=${packet.id}")
            return
        }
        seenPacketIds.add(packet.id)
        // Register shortId so a later beacon is blocked when GATT arrived first.
        if (!packet.id.startsWith("beacon-") && !packet.id.startsWith("ack-")) seenPacketIds.add(shortId)
        android.util.Log.d("MeshService", "Packet received id=${packet.id} type=${packet.type} hops=${packet.hopCount}")
        if (packet.type == "sos") android.util.Log.d("SOSMessage", "SOS queued id=${packet.id}")

        // A peer sent us a packet — they're reachable; post flush to retryThread to avoid
        // blocking the BLE callback thread (and prevent ANR if WiFiDirect is available).
        retryHandler.post { flushPending() }

        // Deliver to JS via plugin callback, or buffer if plugin hasn't bound yet.
        // RC-9: cap startupBuffer at 20 to prevent OOM if the plugin never binds.
        val cb = onPacketReceived
        if (cb != null) {
            android.util.Log.d("MeshService", "Forwarding to JS id=${packet.id} type=${packet.type} hops=${packet.hopCount}")
            if (packet.type == "sos") android.util.Log.d("SOSReceiver", "SOS delivered to JS id=${packet.id}")
            cb.invoke(packet)
        } else {
            synchronized(startupBuffer) {
                if (startupBuffer.size < 20) startupBuffer.addLast(packet)
                else android.util.Log.w("MeshService", "startupBuffer full — dropping packet id=${packet.id}")
            }
        }

        if (relayEnabled && packet.type == "sos" && packet.hopCount > 1 &&
                !isRelayRateLimited(packet.originDeviceId)) {
            val relayed = packet.copy(hopCount = packet.hopCount - 1)
            android.util.Log.d("MeshService", "Relaying id=${packet.id} hops_remaining=${relayed.hopCount}")
            val (relaySuccess, strategyName) = broadcast(relayed)
            // Only count and notify when a transport actually accepted the relay.
            // Counting before broadcast() returned caused "1 relayed, 0 received."
            if (relaySuccess) {
                if (strategyName == "BLE") {
                    // Defer counter AND event to onWriteConfirmed — broadcast() is optimistic for BLE.
                    pendingRelayNotify[relayed.id] = relayed
                } else {
                    forwardedCount[packet.originDeviceId] =
                        (forwardedCount[packet.originDeviceId] ?: 0) + 1
                    onRelayedPacket?.invoke(relayed)
                }
            }
        }
        // ACKs propagate back toward the origin so the victim learns their SOS was received.
        if (relayEnabled && packet.type == "ack" && packet.hopCount > 1) {
            val relayedAck = packet.copy(hopCount = packet.hopCount - 1)
            broadcast(relayedAck)
        }
    }

    // ── Peers ────────────────────────────────────────────────────────────────────

    fun getPeers(): List<Map<String, Any>> {
        val strategy = strategies.filterIsInstance<BLEMeshStrategy>().firstOrNull()
            ?: return emptyList()
        return strategy.getDiscoveredPeers().map {
            // forwardedCount is keyed by originDeviceId (6-char hex from ANDROID_ID).
            // Use addressToOriginId to resolve the MAC → originId before looking up the count.
            val originId = strategy.getOriginIdForAddress(it.address)
            mapOf(
                "id"        to it.address,
                "transport" to "BLE",
                "lastSeen"  to strategy.getPeerLastSeen(it.address),
                "isRelaying"   to ((originId?.let { oid -> forwardedCount[oid] } ?: forwardedCount[it.address] ?: 0) > 0),
                "relayEnabled" to true,
                "signal"    to 3,
            )
        }
    }

    // ── Stats ────────────────────────────────────────────────────────────────────

    fun getStats(): Map<String, Any> {
        val activeStrategy = strategies.firstOrNull { it.isAvailable }
        return mapOf(
            "peersNearby"  to strategies.sumOf { it.peerCount },
            "transport"    to (activeStrategy?.name ?: "none"),
            "relayEnabled" to relayEnabled,
        )
    }

    fun getBLEStrategy(): BLEMeshStrategy? =
        strategies.filterIsInstance<BLEMeshStrategy>().firstOrNull()

    // ── Notification ─────────────────────────────────────────────────────────────

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Mesh Network",
                NotificationManager.IMPORTANCE_LOW,
            )
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(channel)
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SurvAIve Mesh Active")
            .setContentText("Emergency mesh relay is running")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .build()
    }
}
