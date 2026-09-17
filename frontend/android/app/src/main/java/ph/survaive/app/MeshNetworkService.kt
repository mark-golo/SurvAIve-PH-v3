package ph.survaive.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Binder
import android.os.IBinder
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
        private const val MAX_SEEN_IDS   = 500
        private const val MAX_PENDING    = 20
    }

    inner class LocalBinder : Binder() {
        fun getService(): MeshNetworkService = this@MeshNetworkService
    }

    private val binder = LocalBinder()

    // ── Deduplication set ────────────────────────────────────────────────────────
    private val seenPacketIds: MutableSet<String> = ConcurrentHashMap.newKeySet()

    // ── Store-and-forward buffer (packets that failed to send because no peer was available) ──
    private val pendingPackets: ArrayDeque<MeshPacket> = ArrayDeque()

    // ── Callback registered by MeshNetworkPlugin → forwarded to JavaScript ────────
    var onPacketReceived: ((MeshPacket) -> Unit)? = null

    // ── Transport strategies ─────────────────────────────────────────────────────
    private val strategies: List<MeshStrategy> = listOf(
        BLEMeshStrategy(),
        WiFiDirectStrategy(),
    )

    var relayEnabled: Boolean = true

    private var started = false

    private val deviceId: String by lazy {
        android.provider.Settings.Secure.getString(
            contentResolver,
            android.provider.Settings.Secure.ANDROID_ID,
        ) ?: "unknown"
    }

    // ── Service lifecycle ────────────────────────────────────────────────────────

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (!started) {
            startForeground(NOTIF_ID, buildNotification())
            strategies.forEach { strategy ->
                strategy.start(applicationContext) { packet -> handleIncomingPacket(packet) }
            }
            started = true
        }
        return START_STICKY
    }

    override fun onDestroy() {
        strategies.forEach { it.stop() }
        started = false
        super.onDestroy()
    }

    // ── Broadcast ────────────────────────────────────────────────────────────────

    fun broadcast(packet: MeshPacket): Pair<Boolean, String> {
        seenPacketIds.add(packet.id)
        for (strategy in strategies) {
            if (strategy.isAvailable) {
                val sent = strategy.broadcast(packet)
                if (sent) {
                    flushPending()
                    return Pair(true, strategy.name)
                }
            }
        }
        // No strategy succeeded — buffer for when a peer becomes reachable
        synchronized(pendingPackets) {
            if (pendingPackets.none { it.id == packet.id }) {
                if (pendingPackets.size >= MAX_PENDING) pendingPackets.removeFirst()
                pendingPackets.addLast(packet)
            }
        }
        return Pair(false, "none")
    }

    private fun flushPending() {
        val toFlush = synchronized(pendingPackets) { pendingPackets.toList().also { pendingPackets.clear() } }
        for (p in toFlush) {
            for (strategy in strategies) {
                if (strategy.isAvailable && strategy.broadcast(p)) break
            }
        }
    }

    // ── Incoming packet handling ─────────────────────────────────────────────────

    private fun handleIncomingPacket(packet: MeshPacket) {
        if (seenPacketIds.contains(packet.id)) return
        seenPacketIds.add(packet.id)

        if (seenPacketIds.size > MAX_SEEN_IDS) {
            seenPacketIds.iterator().let { it.next(); it.remove() }
        }

        // A peer sent us a packet — they're reachable, so try flushing buffered packets
        flushPending()

        onPacketReceived?.invoke(packet)

        if (relayEnabled && packet.hopCount > 1) {
            val relayed = packet.copy(hopCount = packet.hopCount - 1)
            broadcast(relayed)
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

    // ── Notification ─────────────────────────────────────────────────────────────

    private fun buildNotification(): Notification {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Mesh Network",
            NotificationManager.IMPORTANCE_LOW,
        )
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
            .createNotificationChannel(channel)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SurvAIve Mesh Active")
            .setContentText("Emergency mesh relay is running")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .build()
    }
}
