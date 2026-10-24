package ph.survaive.app.strategies

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import ph.survaive.app.MeshPacket
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.PrintWriter
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.ConcurrentHashMap

/**
 * WiFiDirectStrategy — Wi-Fi Direct P2P transport for the SurvAIve offline mesh.
 *
 * ── Role ───────────────────────────────────────────────────────────────────────
 * Wi-Fi Direct allows two devices to communicate at full Wi-Fi speed without a
 * conventional access point. This strategy runs a lightweight JSON relay server
 * on [RELAY_PORT] inside the P2P group and connects to peers' relay servers to
 * deliver larger payloads (e.g. photo evidence attached to an SOS report).
 *
 * ── Pairing policy ────────────────────────────────────────────────────────────
 * Android's Wi-Fi Direct `connect()` API always presents a system-level invitation
 * dialog on the receiving device ("Accept / Decline"). This dialog cannot be
 * suppressed via any public API. To achieve zero-user-interaction automatic mesh
 * delivery, this strategy deliberately does NOT call `manager.connect()`.
 * Peer discovery runs passively — peers are enumerated and counted but no group
 * formation is initiated. BLE (passive beacon + GATT) is the primary automatic
 * transport. Wi-Fi Direct TCP relay is available when a group has been formed
 * through another mechanism (e.g. the user explicitly joins a hotspot).
 *
 * ── Architecture ───────────────────────────────────────────────────────────────
 *  • Every device starts a [RelayServer] on port [RELAY_PORT] that accepts one
 *    TCP connection at a time, reads a JSON packet, and fires [onPacketReceived].
 *  • When [broadcast] is called and a group exists, a TCP client thread connects
 *    to the group owner IP (from [WifiP2pInfo]) and writes the packet JSON.
 *  • If this device is the group owner, it sends to all known client IPs.
 *  • Peer discovery is handled by [WifiP2pManager]; group formation is NOT.
 *
 * ── Permissions required (AndroidManifest.xml) ────────────────────────────────
 *  ACCESS_WIFI_STATE, CHANGE_WIFI_STATE, ACCESS_FINE_LOCATION
 *  Android 13+: NEARBY_WIFI_DEVICES
 */
class WiFiDirectStrategy : MeshStrategy {

    override val name = "WiFiDirect"

    companion object {
        const val RELAY_PORT = 8765
        private const val TAG = "WiFiDirect"
        private const val RETRY_DELAY_MS = 5000L
    }

    private var manager: android.net.wifi.p2p.WifiP2pManager? = null
    private var channel: android.net.wifi.p2p.WifiP2pManager.Channel? = null
    @Volatile private var groupOwnerAddress: String? = null
    @Volatile private var isGroupOwner = false
    private var discoveredDeviceCount = 0
    private var _p2pEnabled = false
    private var relayServer: RelayServer? = null
    private var onPacketReceived: ((MeshPacket) -> Unit)? = null
    private var _context: Context? = null
    private var p2pReceiver: BroadcastReceiver? = null
    private val handler = Handler(Looper.getMainLooper())

    override val isAvailable: Boolean get() {
        return _context?.getSystemService(Context.WIFI_P2P_SERVICE) != null && _p2pEnabled
    }

    override val peerCount: Int get() = discoveredDeviceCount

    // ── Lifecycle ─────────────────────────────────────────────────────────────────

    override fun start(context: Context, onPacketReceived: (MeshPacket) -> Unit) {
        _context = context.applicationContext
        this.onPacketReceived = onPacketReceived

        manager = context.getSystemService(Context.WIFI_P2P_SERVICE) as? android.net.wifi.p2p.WifiP2pManager
        channel = manager?.initialize(context, Looper.getMainLooper()) {
            // Channel lost (Wi-Fi toggle, OEM stack crash) — reinitialize immediately so
            // subsequent discoverPeers/connect calls don't silently fail with P2P_UNSUPPORTED.
            Log.w(TAG, "Wi-Fi Direct channel lost — reinitializing")
            channel = manager?.initialize(context, Looper.getMainLooper(), null)
        }

        // Start the relay server immediately — listens for inbound packets
        relayServer = RelayServer(RELAY_PORT) { json ->
            try {
                val pkt = MeshPacket.fromJson(json)
                if (pkt != null) onPacketReceived(pkt)
                else Log.w(TAG, "RelayServer: malformed packet from TCP — discarded")
            } catch (_: Exception) {}
        }
        relayServer?.start()

        // Register Wi-Fi Direct state change receiver
        val filter = IntentFilter().apply {
            addAction(android.net.wifi.p2p.WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION)
            addAction(android.net.wifi.p2p.WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
            addAction(android.net.wifi.p2p.WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
            addAction(android.net.wifi.p2p.WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION)
        }
        p2pReceiver = createP2pReceiver()
        context.applicationContext.registerReceiver(p2pReceiver, filter)

        // Android only fires WIFI_P2P_STATE_CHANGED_ACTION on a *transition*, not on initial
        // registration if P2P is already enabled. Query the current state immediately so
        // _p2pEnabled is set correctly when WiFi Direct is already on at startup.
        manager?.requestGroupInfo(channel) { group ->
            if (group != null) {
                _p2pEnabled = true
                Log.d(TAG, "P2P already active at startup — _p2pEnabled set to true")
            }
        }

        // Start passive peer discovery — enumerates nearby devices without connecting.
        discoverPeers()
    }

    override fun stop() {
        handler.removeCallbacksAndMessages(null)
        relayServer?.stopServer()
        relayServer = null
        manager?.stopPeerDiscovery(channel, null)
        manager?.removeGroup(channel, null)
        try { _context?.unregisterReceiver(p2pReceiver) } catch (_: Exception) {}
        p2pReceiver = null
        groupOwnerAddress = null
        isGroupOwner = false
        discoveredDeviceCount = 0
        _p2pEnabled = false
        manager = null
        channel = null
    }

    // ── Discovery — passive enumeration only, no connect() ───────────────────────

    @SuppressLint("MissingPermission")
    private fun discoverPeers() {
        manager?.discoverPeers(channel, object : android.net.wifi.p2p.WifiP2pManager.ActionListener {
            override fun onSuccess() {
                Log.d(TAG, "discoverPeers started successfully")
            }
            override fun onFailure(reason: Int) {
                Log.e(TAG, "discoverPeers failed (reason=$reason) — retrying in ${RETRY_DELAY_MS}ms")
                handler.postDelayed({ discoverPeers() }, RETRY_DELAY_MS)
            }
        })
    }

    // ── Broadcast — send packet to group owner via TCP ────────────────────────────

    override fun broadcast(packet: MeshPacket): Boolean {
        // Group owner path: send to all connected client IPs.
        // clientAddresses is populated by RelayServer.run() when TCP clients connect.
        if (isGroupOwner) {
            val clients = relayServer?.clientAddresses?.toList() ?: return false
            if (clients.isEmpty()) {
                Log.d(TAG, "broadcast skipped — group owner has no connected clients yet")
                return false
            }
            var anySent = false
            for (addr in clients) {
                try {
                    Socket(addr, RELAY_PORT).use { sock ->
                        sock.soTimeout = 5_000
                        PrintWriter(sock.getOutputStream(), true).println(packet.toJson())
                        Log.d(TAG, "GO→client TCP write OK id=${packet.id} addr=$addr")
                        anySent = true
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "GO→client TCP failed for $addr: ${e.message}")
                    relayServer?.clientAddresses?.remove(addr)
                }
            }
            return anySent
        }

        val host = groupOwnerAddress ?: return false

        // RC-7: block until the TCP write actually succeeds or times out (10 s).
        val result = java.util.concurrent.CompletableFuture<Boolean>()
        Thread {
            try {
                Socket(host, RELAY_PORT).use { sock ->
                    sock.soTimeout = 10_000
                    PrintWriter(sock.getOutputStream(), true).println(packet.toJson())
                    Log.d(TAG, "TCP write OK id=${packet.id}")
                    result.complete(true)
                }
            } catch (e: Exception) {
                Log.e(TAG, "TCP write FAILED id=${packet.id}: ${e.message}")
                result.complete(false)
            }
        }.also { it.isDaemon = true; it.start() }

        return try {
            result.get(10, java.util.concurrent.TimeUnit.SECONDS)
        } catch (_: Exception) {
            Log.e(TAG, "TCP write timed out id=${packet.id}")
            false
        }
    }

    // ── Wi-Fi Direct broadcast receiver ───────────────────────────────────────────

    private fun createP2pReceiver() = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                android.net.wifi.p2p.WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION -> {
                    val state = intent.getIntExtra(android.net.wifi.p2p.WifiP2pManager.EXTRA_WIFI_STATE, -1)
                    if (state == android.net.wifi.p2p.WifiP2pManager.WIFI_P2P_STATE_ENABLED) {
                        Log.d(TAG, "Wi-Fi P2P enabled — starting discovery")
                        _p2pEnabled = true
                        discoverPeers()
                    } else {
                        Log.d(TAG, "Wi-Fi P2P disabled")
                        _p2pEnabled = false
                        groupOwnerAddress = null
                        discoveredDeviceCount = 0
                    }
                }
                android.net.wifi.p2p.WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> {
                    // Peers discovered — update the count for the UI but do NOT call connect().
                    // Android's connect() with default PBC always shows an invitation dialog on
                    // the receiving device; this cannot be suppressed. BLE handles automatic delivery.
                    manager?.requestPeers(channel) { peerList ->
                        val peers = peerList.deviceList.toList()
                        discoveredDeviceCount = peers.size
                        Log.d(TAG, "Peers changed: ${peers.size} Wi-Fi Direct peer(s) visible (passive only)")
                    }
                }
                android.net.wifi.p2p.WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {
                    // Group formed by an external mechanism (e.g. user joined a hotspot).
                    // If a group exists, wire up the TCP relay path.
                    manager?.requestConnectionInfo(channel) { info ->
                        if (info?.groupFormed == true) {
                            groupOwnerAddress = info.groupOwnerAddress?.hostAddress
                            isGroupOwner = info.isGroupOwner
                            Log.d(TAG, "P2P group formed — owner: $groupOwnerAddress isOwner: $isGroupOwner")
                        } else {
                            Log.d(TAG, "P2P group dissolved — restarting discovery")
                            groupOwnerAddress = null
                            isGroupOwner = false
                            discoverPeers()
                        }
                    }
                }
                android.net.wifi.p2p.WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION -> {
                    Log.d(TAG, "This device's P2P state changed")
                }
            }
        }
    }
}

// ── Relay server — accepts TCP connections, tracks client IPs for GO→client send ─

private class RelayServer(
    private val port: Int,
    private val onJson: (String) -> Unit,
) : Thread() {

    @Volatile private var running = true
    private var serverSocket: ServerSocket? = null

    // Group owner uses this set to know which client IPs are connected,
    // so it can push packets to them instead of only receiving.
    val clientAddresses: MutableSet<String> = ConcurrentHashMap.newKeySet()

    init { isDaemon = true; name = "SurvAIve-RelayServer" }

    override fun run() {
        // Iterative retry loop — avoids StackOverflow from recursive run() calls on
        // repeated bind failures (original code: `if (running) run()` was recursive).
        while (running) {
            try {
                serverSocket = ServerSocket(port)
                Log.d("WiFiDirect", "RelayServer bound on port $port")
                while (running) {
                    val client = serverSocket?.accept() ?: break
                    // Record client IP before handing off to a per-connection thread.
                    // This allows the group owner to broadcast back to known clients.
                    val clientIp = client.inetAddress?.hostAddress
                    if (clientIp != null) clientAddresses.add(clientIp)
                    Thread {
                        try {
                            client.use { sock ->
                                sock.soTimeout = 5_000  // prevent readLine() blocking indefinitely on hung connections
                                val line = BufferedReader(InputStreamReader(sock.getInputStream())).readLine()
                                if (!line.isNullOrBlank()) onJson(line.trim())
                            }
                        } catch (_: Exception) {}
                    }.also { it.isDaemon = true }.start()
                }
            } catch (e: Exception) {
                if (!running) break
                Log.e("WiFiDirect", "RelayServer bind failed on port $port — retrying in 5s: ${e.message}")
                try { Thread.sleep(5000) } catch (_: InterruptedException) { break }
            } finally {
                try { serverSocket?.close() } catch (_: Exception) {}
                serverSocket = null
            }
        }
    }

    fun stopServer() {
        running = false
        serverSocket?.close()
        serverSocket = null
    }
}
