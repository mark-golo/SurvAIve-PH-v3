package ph.survaive.app.strategies

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.wifi.p2p.*
import android.os.Looper
import ph.survaive.app.MeshPacket
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.PrintWriter
import java.net.ServerSocket
import java.net.Socket

/**
 * WiFiDirectStrategy — Wi-Fi Direct P2P transport for the SurvAIve offline mesh.
 *
 * ── Role ───────────────────────────────────────────────────────────────────────
 * Wi-Fi Direct allows two devices to communicate at full Wi-Fi speed without a
 * conventional access point.  This strategy runs a lightweight JSON relay server
 * on [RELAY_PORT] inside the P2P group and connects to peers' relay servers to
 * deliver larger payloads (e.g. photo evidence attached to an SOS report).
 *
 * ── Architecture ───────────────────────────────────────────────────────────────
 *  • Every device starts a [RelayServer] on port [RELAY_PORT] that accepts one
 *    TCP connection at a time, reads a JSON packet, and fires [onPacketReceived].
 *  • When [broadcast] is called, a TCP client thread connects to the group
 *    owner IP (from [WifiP2pInfo]) and writes the packet JSON.
 *  • Peer discovery and group formation are handled by [WifiP2pManager].
 *
 * ── Permissions required (AndroidManifest.xml) ────────────────────────────────
 *  ACCESS_WIFI_STATE, CHANGE_WIFI_STATE, ACCESS_FINE_LOCATION
 *  Android 13+: NEARBY_WIFI_DEVICES
 */
class WiFiDirectStrategy : MeshStrategy {

    override val name = "WiFiDirect"

    companion object {
        const val RELAY_PORT = 8765
    }

    private var manager: WifiP2pManager? = null
    private var channel: WifiP2pManager.Channel? = null
    private var groupOwnerAddress: String? = null
    private var relayServer: RelayServer? = null
    private var onPacketReceived: ((MeshPacket) -> Unit)? = null
    private var _context: Context? = null
    private var p2pReceiver: BroadcastReceiver? = null

    override val isAvailable: Boolean get() {
        return _context?.getSystemService(Context.WIFI_P2P_SERVICE) != null
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────────

    override fun start(context: Context, onPacketReceived: (MeshPacket) -> Unit) {
        _context = context.applicationContext
        this.onPacketReceived = onPacketReceived

        manager = context.getSystemService(Context.WIFI_P2P_SERVICE) as? WifiP2pManager
        channel = manager?.initialize(context, Looper.getMainLooper(), null)

        // Start the relay server immediately — listens for inbound packets
        relayServer = RelayServer(RELAY_PORT) { json ->
            try { onPacketReceived(MeshPacket.fromJson(json)) } catch (_: Exception) {}
        }
        relayServer?.start()

        // Register Wi-Fi Direct state change receiver
        val filter = IntentFilter().apply {
            addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
        }
        p2pReceiver = createP2pReceiver()
        context.applicationContext.registerReceiver(p2pReceiver, filter)

        // Start peer discovery
        manager?.discoverPeers(channel, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {}
            override fun onFailure(reason: Int) {}
        })
    }

    override fun stop() {
        relayServer?.stopServer()
        relayServer = null
        manager?.stopPeerDiscovery(channel, null)
        manager?.removeGroup(channel, null)
        try { _context?.unregisterReceiver(p2pReceiver) } catch (_: Exception) {}
        p2pReceiver = null
        groupOwnerAddress = null
        manager = null
        channel = null
    }

    // ── Broadcast — send packet to group owner via TCP ────────────────────────────

    override fun broadcast(packet: MeshPacket): Boolean {
        val host = groupOwnerAddress ?: return false
        return try {
            Thread {
                try {
                    Socket(host, RELAY_PORT).use { sock ->
                        PrintWriter(sock.getOutputStream(), true).println(packet.toJson())
                    }
                } catch (_: Exception) {}
            }.also { it.isDaemon = true }.start()
            true
        } catch (_: Exception) {
            false
        }
    }

    // ── Wi-Fi Direct broadcast receiver ───────────────────────────────────────────

    private fun createP2pReceiver() = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {
                    manager?.requestConnectionInfo(channel) { info ->
                        if (info?.groupFormed == true && info.isGroupOwner) {
                            // This device is the group owner — its IP is its own relay address
                            groupOwnerAddress = info.groupOwnerAddress?.hostAddress
                        } else if (info?.groupFormed == true) {
                            // This device is a client — connect to the group owner's relay server
                            groupOwnerAddress = info.groupOwnerAddress?.hostAddress
                        } else {
                            groupOwnerAddress = null
                        }
                    }
                }
            }
        }
    }
}

// ── Relay server — accepts one TCP connection at a time ───────────────────────────

private class RelayServer(
    private val port: Int,
    private val onJson: (String) -> Unit,
) : Thread() {

    @Volatile private var running = true
    private var serverSocket: ServerSocket? = null

    init { isDaemon = true; name = "SurvAIve-RelayServer" }

    override fun run() {
        try {
            serverSocket = ServerSocket(port)
            while (running) {
                val client = serverSocket?.accept() ?: break
                Thread {
                    try {
                        client.use { sock ->
                            val line = BufferedReader(InputStreamReader(sock.getInputStream())).readLine()
                            if (!line.isNullOrBlank()) onJson(line.trim())
                        }
                    } catch (_: Exception) {}
                }.also { it.isDaemon = true }.start()
            }
        } catch (_: Exception) {
            // Server closed or bind failed — exit silently
        }
    }

    fun stopServer() {
        running = false
        serverSocket?.close()
        serverSocket = null
    }
}
