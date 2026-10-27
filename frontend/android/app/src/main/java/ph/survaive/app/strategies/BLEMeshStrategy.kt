package ph.survaive.app.strategies

import android.annotation.SuppressLint
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import android.util.Log
import org.json.JSONObject
import ph.survaive.app.MeshPacket
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean

/**
 * BLEMeshStrategy — BLE GATT-based transport for the SurvAIve offline mesh.
 *
 * ── Roles ──────────────────────────────────────────────────────────────────────
 * This device simultaneously acts as both a GATT Server and a BLE Scanner:
 *
 *  • GATT Server  → accepts write requests on [CHAR_UUID] from nearby senders.
 *                   Each write carries a [MeshPacket] JSON payload.
 *  • BLE Scanner  → discovers other SurvAIve devices advertising [SERVICE_UUID].
 *                   Cached devices are used as outbound write targets in [broadcast].
 *
 * ── Broadcast path ─────────────────────────────────────────────────────────────
 *  broadcast(packet) → for each cached peer → connectAndWrite → requestMtu(512)
 *                      → discoverServices → writeCharacteristic → disconnect
 *
 * ── Key robustness invariants ──────────────────────────────────────────────────
 *  1. Every GATT connection path that cannot complete a write calls gatt.disconnect()
 *     so the connection slot is freed and the retry loop can attempt a fresh connect.
 *  2. The 3s MTU timeout and onMtuChanged use getAndSet(true) so exactly one path
 *     calls discoverServices() — no double-discovery race.
 *  3. A 30s write-response watchdog disconnects and clears inFlightPacketIds if
 *     onCharacteristicWrite never fires (e.g. server's sendResponse was skipped).
 *  4. inFlightPacketIds prevents duplicate simultaneous GATT connections for the
 *     same packet; auto-expires after 12s to unblock hung connections.
 */
/** Per-sender fragment reassembly state. Parts keyed by fragment index. */
private data class FragmentAssembly(
    val senderAddress: String?,
    val totalFragments: Int,
    val createdAt: Long,
    val parts: java.util.TreeMap<Int, ByteArray> = java.util.TreeMap(),
)

@SuppressLint("MissingPermission")
class BLEMeshStrategy : MeshStrategy {

    override val name = "BLE"

    companion object {
        val SERVICE_UUID: UUID = UUID.fromString("12345678-0000-1000-8000-00805f9b34fb")
        val CHAR_UUID: UUID    = UUID.fromString("12345678-0001-1000-8000-00805f9b34fb")
        private const val MAX_CACHED_PEERS = 20
        private const val TAG = "BLEMesh"
        private const val COMPANY_ID = 0x1234
        private val STATUS_TO_CODE = mapOf("trapped" to 1, "injured" to 2, "rescue" to 3)
        private val CODE_TO_STATUS = mapOf(1 to "trapped", 2 to "injured", 3 to "rescue")
        // XOR mask applied to lat/lng before encoding into the BLE beacon payload.
        // Prevents passive decoding of GPS coordinates by commodity BLE scanners (obfuscation, not encryption).
        private const val GEO_XOR = 0x4B4E4750.toInt()  // "KNGP" as 32-bit mask
        // 30s avoids Android 7+ scan-window throttling (LOW_LATENCY windows shrink after ~30s inactivity).
        private const val SCAN_RESTART_INTERVAL_MS  = 30_000L
        private const val MAX_FRAGMENT_ASSEMBLIES   = 32
        private const val FRAGMENT_TTL_MS           = 30_000L
        private const val PEER_TTL_MS               = 30_000L
    }

    private val discoveredPeers = CopyOnWriteArrayList<BluetoothDevice>()

    private var gattServer: BluetoothGattServer? = null
    private var scanner: BluetoothLeScanner?     = null
    private var advertiser: BluetoothLeAdvertiser? = null
    private var advertiseCallback: AdvertiseCallback? = null
    private var btReceiver: BroadcastReceiver? = null
    private var onPacketReceived: ((MeshPacket) -> Unit)? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    // Prevents duplicate simultaneous GATT connections for the same packet.
    // Auto-expires after 12s so a hung connection never permanently blocks retries.
    private val inFlightPacketIds: MutableSet<String> = ConcurrentHashMap.newKeySet()

    // Per-peer single-flight gate. Prevents concurrent connectAndWrite() calls to the same
    // device address for *different* packet IDs, which cause write_enqueue_failed and
    // service-discovery collisions (226 failures in v8 logs).
    // Primary release path: STATE_DISCONNECTED in onConnectionStateChange.
    // Secondary paths: SecurityException catch and _context null guard (no disconnect fires).
    private val busyPeerAddresses: MutableSet<String> = ConcurrentHashMap.newKeySet()

    // Deduplicates passive beacon receives: onScanResult fires every ~100–500ms for
    // the same in-range beacon; only the first seen ID is forwarded to onPacketReceived.
    // FIFO-bounded: evicts the oldest insertion once capacity exceeds 256.
    private val seenBeaconIds: MutableSet<String> = java.util.Collections.synchronizedSet(
        java.util.Collections.newSetFromMap(
            object : java.util.LinkedHashMap<String, Boolean>(256 + 1, 0.75f, false) {
                override fun removeEldestEntry(e: Map.Entry<String, Boolean>) = size > 256
            }
        )
    )

    // Buffers ATT Prepare Write chunks per device for long-write reassembly in onExecuteWrite.
    // Key = device address, value = ordered map of byteOffset → chunk bytes.
    private val preparedWriteBuffers = ConcurrentHashMap<String, java.util.TreeMap<Int, ByteArray>>()

    // Buffers application-level fragment chunks for large SOS payloads that exceed MTU-3.
    // Key = 12-char hex fragment-set ID, value = ordered map of fragIndex → data bytes.
    // Each fragment carries a 9-byte binary header: [0xFE][index:1][total:1][id:6][data...].
    // Key = "${senderAddress}:${fragSetHex}" to isolate concurrent transfers from different peers.
    private val fragmentBuffers = ConcurrentHashMap<String, FragmentAssembly>()

    // Tracks when the SOS beacon fan-out window ends (RC2). ACK beacons are suppressed
    // during the window so the SOS beacon keeps advertising for its full 8-second radius.
    private var sosFanOutEndMs = 0L

    // Records the timestamp (ms) when each peer was last seen in a scan result.
    private val peerLastSeen = ConcurrentHashMap<String, Long>()

    // Maps BLE MAC address → originDeviceId (6-char hex) so getPeers() can look
    // up forwardedCount by the same key used in handleIncomingPacket.
    private val addressToOriginId = ConcurrentHashMap<String, String>()

    // Called by MeshNetworkService to remove the packet from pendingPackets when
    // onCharacteristicWrite(GATT_SUCCESS) confirms the write actually landed.
    var onWriteConfirmed: ((packetId: String) -> Unit)? = null

    // Stores the packet ID of the beacon being advertised; consumed by onStartSuccess.
    // null means no beacon-confirmed-write is pending (idle or GATT-only path).

    // Tracks whether BLE advertising is currently active.
    // Guards startAdvertising() against re-entrancy: onServiceAdded and updateBeacon()
    // both post startAdvertising() to the main thread; without this flag the second
    // call creates a NEW advertiseCallback, gets ADVERTISE_FAILED_ALREADY_STARTED,
    // and leaves advertiseCallback pointing at the dead callback so stopAdvertising()
    // can never cancel the running slot.
    private var _isAdvertising = false

    // True only after onServiceAdded() confirms GATT_SUCCESS for SERVICE_UUID.
    // Prevents startAdvertising() from running before the remote GATT database is ready,
    // which would make this device appear connectable with no usable service — the root
    // cause of 226 gatt_service_not_found failures observed in v7 logs.
    private var gattServiceReady = false

    // Bounded retry counter for ADVERTISE_FAILED_ALREADY_STARTED (error 3).
    // Reset to 0 on each onStartSuccess(). Capped at MAX_ADVERTISE_RETRIES.
    private var advertiseRetryCount = 0
    private val MAX_ADVERTISE_RETRIES = 3

    // Status callback — notifies JS of advertising_started / advertising_failed / awaiting_peers.
    // Set from MeshNetworkPlugin after binding; null in tests / before bind.
    var onBroadcastStatus: ((status: String, errorCode: Int) -> Unit)? = null

    // Buffer for mesh events fired before onMeshEvent is wired (service starts before plugin binds).
    // Drained immediately when onMeshEvent is first assigned. Cap at 10 to avoid OOM.
    private val pendingMeshEvents = ArrayDeque<Pair<String, Map<String, Any?>>>()

    // Generic low-level event callback — notifies JS of peer_discovered,
    // connection_established, peer_disconnected, sos_transmitted, transmission_failed, retry_attempted.
    var onMeshEvent: ((type: String, data: Map<String, Any?>) -> Unit)? = null
        set(value) {
            field = value
            if (value != null) {
                // Post drain with 300ms delay so call.resolve() fires first (MeshNetworkPlugin line 117),
                // giving the JS .then() handler time to call addListener('meshEvent') before events arrive.
                mainHandler.postDelayed({
                    val cb = field ?: return@postDelayed
                    val buffered = synchronized(pendingMeshEvents) { pendingMeshEvents.toList().also { pendingMeshEvents.clear() } }
                    buffered.forEach { (type, data) -> cb.invoke(type, data) }
                }, 300L)
            }
        }

    // Fires when a genuinely new BLE peer is added to discoveredPeers.
    // Wired in MeshNetworkService to trigger an immediate flushPending() instead of waiting 3s.
    var onNewPeerDiscovered: ((android.bluetooth.BluetoothDevice) -> Unit)? = null

    private fun fireMeshEvent(type: String, data: Map<String, Any?> = emptyMap()) {
        val cb = onMeshEvent
        if (cb != null) {
            cb.invoke(type, data)
        } else {
            synchronized(pendingMeshEvents) {
                if (pendingMeshEvents.size < 10) pendingMeshEvents.addLast(Pair(type, data))
            }
        }
    }

    // Current SOS/ACK beacon payload (20 bytes) broadcast in the main ADV_IND (connectable) packet.
    // Passively received by all nearby scanners — no SCAN_REQ or GATT connection needed.
    private var currentBeacon: ByteArray? = null

    // Exponential backoff delay for scan retries (5 s → 10 s → 20 s → 30 s cap).
    private var scanRetryDelayMs = 5_000L

    // Periodic scan restart every 30s to counteract Android BLE scan throttling.
    // Android 7+ shrinks SCAN_MODE_LOW_LATENCY windows after ~30s of low activity;
    // restarting the scan forces a fresh full-window cycle so new beacons are detected.
    private val _scanRestartHandler = Handler(Looper.getMainLooper())
    private val _scanRestartRunnable = object : Runnable {
        override fun run() {
            val ctx = _context ?: return
            if (isAvailable) {
                Log.d(TAG, "Periodic BLE scan restart (30s)")
                val cutoff = System.currentTimeMillis() - 60_000L
                val expired = discoveredPeers.filter { (peerLastSeen[it.address] ?: 0L) < cutoff }
                if (expired.isNotEmpty()) {
                    discoveredPeers.removeAll(expired)
                    expired.forEach { peer ->
                        peerLastSeen.remove(peer.address)
                        addressToOriginId.remove(peer.address)
                    }
                    Log.d(TAG, "Evicted ${expired.size} stale peer(s)")
                }
                try { scanner?.stopScan(scanCallback) } catch (_: Exception) {}
                startScanning(ctx)
            }
            _scanRestartHandler.postDelayed(this, SCAN_RESTART_INTERVAL_MS)
        }
    }

    override val isAvailable: Boolean
        get() {
            val bm = _context?.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            return bm?.adapter?.isEnabled == true
        }

    override val peerCount: Int get() = discoveredPeers.size

    fun getDiscoveredPeers(): List<BluetoothDevice> = discoveredPeers.toList()

    fun getPeerLastSeen(address: String): Long = peerLastSeen[address] ?: System.currentTimeMillis()

    fun getOriginIdForAddress(mac: String): String? = addressToOriginId[mac]

    private var _context: Context? = null

    // ── Lifecycle ────────────────────────────────────────────────────────────────

    override fun start(context: Context, onPacketReceived: (MeshPacket) -> Unit) {
        _context = context.applicationContext
        this.onPacketReceived = onPacketReceived

        btReceiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                val state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, -1)
                val c = _context ?: return
                if (state == BluetoothAdapter.STATE_ON) {
                    startGattServer(c); startScanning(c)
                    // Reschedule the periodic scan-restart runnable that fights OEM BLE scan
                    // throttling (Samsung/Xiaomi shrink LOW_LATENCY windows after ~30s of inactivity).
                    // Without this the runnable is permanently dead after the first BT cycle.
                    _scanRestartHandler.postDelayed(_scanRestartRunnable, SCAN_RESTART_INTERVAL_MS)
                } else if (state == BluetoothAdapter.STATE_OFF) {
                    _isAdvertising = false
                    gattServiceReady = false
                    advertiseRetryCount = 0
                    _scanRestartHandler.removeCallbacks(_scanRestartRunnable)
                    scanner?.stopScan(scanCallback)
                    advertiser?.stopAdvertising(advertiseCallback)
                    gattServer?.close()
                    gattServer = null; scanner = null; advertiser = null
                    discoveredPeers.clear()
                    // Notify JS that the radio is down so _isStarted can be reset and the
                    // next broadcast() call can re-invoke ensureStarted() after BT is re-enabled.
                    fireMeshEvent("bt_disabled", emptyMap())
                }
            }
        }
        context.applicationContext.registerReceiver(
            btReceiver, IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED)
        )

        if (!isAvailable) return
        startGattServer(context)
        startScanning(context)
        _scanRestartHandler.postDelayed(_scanRestartRunnable, SCAN_RESTART_INTERVAL_MS)
    }

    override fun stop() {
        _isAdvertising = false
        gattServiceReady = false
        advertiseRetryCount = 0
        _scanRestartHandler.removeCallbacks(_scanRestartRunnable)
        scanner?.stopScan(scanCallback)
        advertiser?.stopAdvertising(advertiseCallback)
        gattServer?.close()
        gattServer = null
        scanner    = null
        advertiser = null
        discoveredPeers.clear()
        seenBeaconIds.clear()
        try { _context?.unregisterReceiver(btReceiver) } catch (_: Exception) {}
        btReceiver = null
    }

    // ── GATT Server — receives incoming packets ───────────────────────────────────

    private fun startGattServer(context: Context) {
        val bm = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager

        // Fix 2: close any existing server before opening a new one.
        // Without this, retries (onServiceAdded failure) and BT-state-change restarts
        // accumulate ghost BluetoothGattServer instances. A ghost server can intercept
        // the sender's GATT connection before the active server's service is registered,
        // causing getService(SERVICE_UUID) to return null on the sender → write fails.
        gattServer?.close()
        gattServer = null

        try {
            gattServer = bm.openGattServer(context, object : BluetoothGattServerCallback() {

                override fun onServiceAdded(status: Int, service: BluetoothGattService) {
                    if (status == BluetoothGatt.GATT_SUCCESS) {
                        Log.d(TAG, "GATT service registered — advertising enabled")
                        gattServiceReady = true
                        fireMeshEvent("gatt_server_started", mapOf("serviceUuid" to service.uuid.toString()))
                        // startAdvertising must be called from the main thread on many OEM stacks.
                        // Guard: if an SOS beacon is already being advertised (e.g. updateBeacon()
                        // fired before onServiceAdded), skip — we must not clobber the running ad.
                        mainHandler.post { if (!_isAdvertising) startAdvertising(context) }
                    } else {
                        Log.e(TAG, "GATT addService failed: $status — retrying in 2s")
                        gattServiceReady = false
                        fireMeshEvent("gatt_service_add_failed", mapOf("status" to status.toString(), "reason" to "onServiceAdded_non_success"))
                        mainHandler.postDelayed({ startGattServer(context) }, 2000L)
                    }
                }

                override fun onCharacteristicWriteRequest(
                    device: BluetoothDevice,
                    requestId: Int,
                    characteristic: BluetoothGattCharacteristic,
                    preparedWrite: Boolean,
                    responseNeeded: Boolean,
                    offset: Int,
                    value: ByteArray,
                ) {
                    if (characteristic.uuid != CHAR_UUID) {
                        Log.w(TAG, "Rejected write to unexpected characteristic: ${characteristic.uuid} from ${device.address}")
                        if (responseNeeded) {
                            gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_WRITE_NOT_PERMITTED, offset, null)
                        }
                        fireMeshEvent("gatt_unexpected_characteristic", mapOf(
                            "deviceAddress"      to device.address,
                            "characteristicUuid" to characteristic.uuid.toString(),
                        ))
                        return
                    }
                    fireMeshEvent("rx_gatt_write", mapOf(
                        "from" to device.address,
                        "bytes" to value.size,
                        "preparedWrite" to preparedWrite,
                    ))
                    val srv = gattServer
                    if (preparedWrite) {
                        val buf = preparedWriteBuffers.getOrPut(device.address) { java.util.TreeMap() }
                        synchronized(buf) {
                            if (buf.size >= 50) {
                                Log.w(TAG, "Prepared write buffer overflow from ${device.address} — discarding")
                                preparedWriteBuffers.remove(device.address)
                                if (responseNeeded && srv != null)
                                    srv.sendResponse(device, requestId, BluetoothGatt.GATT_INVALID_ATTRIBUTE_LENGTH, offset, null)
                                return
                            }
                            if (responseNeeded && srv != null) {
                                srv.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value)
                            }
                            // Buffer this chunk at its byte offset; full payload assembled in onExecuteWrite.
                            // synchronized(buf): TreeMap is not thread-safe; on OEM BT stacks (Samsung Exynos)
                            // concurrent prepare-write callbacks from the same device may race here.
                            buf[offset] = value
                        }
                    } else {
                        if (responseNeeded && srv != null) {
                            srv.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value)
                        }
                        processIncomingPayload(value, device.address)
                    }
                }

                override fun onExecuteWrite(device: BluetoothDevice, requestId: Int, execute: Boolean) {
                    val srv = gattServer
                    srv?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
                    val chunks = preparedWriteBuffers.remove(device.address)
                    if (execute && chunks != null && chunks.isNotEmpty()) {
                        val assembled: ByteArray
                        synchronized(chunks) {
                            val lastEntry = chunks.entries.last()
                            val totalSize = lastEntry.key + lastEntry.value.size
                            assembled = ByteArray(totalSize)
                            for ((offset, bytes) in chunks) {
                                bytes.copyInto(assembled, offset)
                            }
                        }
                        processIncomingPayload(assembled, device.address)
                    }
                }

                override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
                    // Clean up stale prepare-write buffer when client drops before onExecuteWrite.
                    if (newState == android.bluetooth.BluetoothProfile.STATE_DISCONNECTED) {
                        preparedWriteBuffers.remove(device.address)
                    }
                }
            })
        } catch (e: SecurityException) {
            Log.e(TAG, "openGattServer denied — BLUETOOTH_CONNECT not granted: ${e.message}")
            fireMeshEvent("gatt_server_failed", mapOf("reason" to "security_exception", "message" to (e.message ?: "")))
            onBroadcastStatus?.invoke("gatt_server_failed", -1)
            return
        }

        val service = BluetoothGattService(
            SERVICE_UUID,
            BluetoothGattService.SERVICE_TYPE_PRIMARY,
        )
        val char = BluetoothGattCharacteristic(
            CHAR_UUID,
            BluetoothGattCharacteristic.PROPERTY_WRITE,
            BluetoothGattCharacteristic.PERMISSION_WRITE,
        )
        service.addCharacteristic(char)
        if (gattServer == null) {
            Log.e(TAG, "openGattServer returned null — retrying in 2s")
            gattServiceReady = false
            fireMeshEvent("gatt_server_open_failed", mapOf("reason" to "openGattServer_returned_null"))
            mainHandler.postDelayed({ _context?.let { startGattServer(it) } }, 2000L)
            return
        }
        val serviceAdded = gattServer?.addService(service) ?: false
        if (!serviceAdded) {
            Log.e(TAG, "addService returned false — scheduling retry")
            gattServiceReady = false
            fireMeshEvent("gatt_service_add_failed", mapOf("reason" to "addService_returned_false"))
            mainHandler.postDelayed({ _context?.let { startGattServer(it) } }, 2000L)
            return
        }
        Log.d(TAG, "GATT server open — waiting for onServiceAdded before advertising")
    }

    // ── BLE Advertising ───────────────────────────────────────────────────────────

    private fun startAdvertising(context: Context) {
        // Readiness guard: do not advertise this device as a connectable GATT peer until the
        // GATT service has been successfully registered. Without this, a scanner that connects
        // immediately after seeing the beacon will find an empty service list and emit 226+
        // gatt_service_not_found failures (observed in v7 logs).
        if (!gattServiceReady) {
            Log.d(TAG, "startAdvertising deferred — GATT service not ready yet")
            return
        }
        // Race guard: if BT stack is already advertising, a second startAdvertising() call
        // would get ADVERTISE_FAILED_ALREADY_STARTED (3), create a NEW dead callback, and
        // leave advertiseCallback pointing at the dead one so stopAdvertising() stops nothing.
        if (_isAdvertising) {
            Log.d(TAG, "startAdvertising skipped — already advertising")
            return
        }

        val bm = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        advertiser = bm.adapter.bluetoothLeAdvertiser
        if (advertiser == null) {
            Log.e(TAG, "bluetoothLeAdvertiser is null — BLUETOOTH_ADVERTISE may not be granted")
            return
        }

        // Create the callback only once and reuse it. Recreating it on every call means
        // advertiseCallback can point at a dead object if a second concurrent call fails,
        // permanently breaking stopAdvertising().
        if (advertiseCallback == null) {
            advertiseCallback = object : AdvertiseCallback() {
                override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
                    _isAdvertising = true
                    advertiseRetryCount = 0
                    Log.d(TAG, "BLE advertising started")
                    onBroadcastStatus?.invoke("advertising_started", 0)
                }
                override fun onStartFailure(errorCode: Int) {
                    _isAdvertising = false
                    Log.e(TAG, "BLE advertise failed: $errorCode")
                    when (errorCode) {
                        ADVERTISE_FAILED_ALREADY_STARTED -> {
                            advertiseRetryCount++
                            if (advertiseRetryCount > MAX_ADVERTISE_RETRIES) {
                                Log.e(TAG, "Advertising permanently failed after $advertiseRetryCount attempts (err $errorCode)")
                                advertiseRetryCount = 0
                                onBroadcastStatus?.invoke("advertising_failed", errorCode)
                                return
                            }
                            // Clear the stale platform advertising slot before retrying.
                            // Without this, the platform reports ALREADY_STARTED on every retry
                            // because the dead slot from a prior callback was never released.
                            Log.w(TAG, "Advertise error $errorCode — stopping stale slot, retry ${advertiseRetryCount}/$MAX_ADVERTISE_RETRIES in 800ms")
                            try { advertiser?.stopAdvertising(advertiseCallback) } catch (_: Exception) {}
                            mainHandler.postDelayed({ _context?.let { startAdvertising(it) } }, 800L)
                        }
                        ADVERTISE_FAILED_TOO_MANY_ADVERTISERS -> {
                            advertiseRetryCount++
                            if (advertiseRetryCount > MAX_ADVERTISE_RETRIES) {
                                Log.e(TAG, "Advertising permanently failed after $advertiseRetryCount attempts (err $errorCode)")
                                advertiseRetryCount = 0
                                onBroadcastStatus?.invoke("advertising_failed", errorCode)
                                return
                            }
                            Log.w(TAG, "Advertise error $errorCode — retry ${advertiseRetryCount}/$MAX_ADVERTISE_RETRIES in 2000ms")
                            mainHandler.postDelayed({ _context?.let { startAdvertising(it) } }, 2000L)
                        }
                        else -> {
                            advertiseRetryCount = 0
                            onBroadcastStatus?.invoke("advertising_failed", errorCode)
                        }
                    }
                }
            }
        }

        val beacon = currentBeacon
        // Notify JS that we are about to call startAdvertising() so the UI can show
        // a "requesting" state before onStartSuccess / onStartFailure fires.
        onBroadcastStatus?.invoke("advertising_requesting", 0)
        try {
            if (beacon != null) {
                // SOS/ACK active: beacon delivery via manufacturer data + connectable advertising.
                // The 20-byte beacon is embedded in manufacturer-specific AD type 0xFF so that
                // ALL nearby BLE scanners receive the SOS/ACK directly from the advertisement
                // without any GATT connection — onScanResult decodes it via decodeBeacon().
                //
                // PDU budget (BLE 4.2 AdvData = 31 bytes max):
                //   20-byte beacon: ManufData overhead (4) + beacon (20) = 24 bytes.
                //   FLAGS mandatory for connectable (3 bytes) → total 27 bytes.
                //   OEM firmware may append TX-Power-Level (3 bytes) → 30 bytes, still fits.
                //   setIncludeTxPowerLevel(false) is explicit so we never request TxPwr ourselves.
                //
                // Connectable is required so Device B can GATT-write ACKs back to Device A.
                // Without connectable, ACKs can only arrive via Device B's own beacon path,
                // but the relay SOS beacon on Device B takes priority — ACKs would be lost.
                //
                // Fix 1: Move 20-byte SOS beacon to MAIN ADV (not SCAN_RSP).
                //
                // Problem: On Samsung/Qualcomm/Xiaomi OEM stacks, scanRecord
                // .getManufacturerSpecificData(COMPANY_ID) returns null for manufacturer data
                // that is in the SCAN_RSP rather than the main ADV_IND. This means the receiver's
                // onScanResult beacon-decode block is never entered (mfgData == null check fails)
                // and the SOS is silently lost even though the peer is discovered.
                //
                // PDU budget with beacon in main ADV:
                //   FLAGS(3) + ManufData overhead(4) + beacon(20) = 27 B ≤ 31 B limit.
                //   With OEM TX-Power append(3): 30 B ≤ 31 B — still safe.
                //
                // SERVICE_UUID moves to SCAN_RSP (18 B), used as an enhanced secondary filter
                // on OEM stacks that DO aggregate scan responses correctly.
                val settings = AdvertiseSettings.Builder()
                    .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                    .setConnectable(true)       // connectable: allows GATT ACK writes back to this device
                    .setTimeout(0)
                    .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                    .build()
                val data = AdvertiseData.Builder()
                    .setIncludeDeviceName(false)
                    .setIncludeTxPowerLevel(false)
                    .addManufacturerData(COMPANY_ID, beacon)    // beacon in main ADV — received on ALL OEM stacks
                    .build()
                // Scan response requires API 26 (Android 8.0); minSdk = 24 so guard it.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val scanResponse = AdvertiseData.Builder()
                        .setIncludeDeviceName(false)
                        .addServiceUuid(ParcelUuid(SERVICE_UUID))   // UUID in SCAN_RSP — enhanced filter bonus
                        .build()
                    advertiser?.startAdvertising(settings, data, scanResponse, advertiseCallback!!)
                } else {
                    // API 24–25: no SCAN_RSP; beacon already in main ADV above.
                    advertiser?.startAdvertising(settings, data, advertiseCallback!!)
                }
                Log.d(TAG, "BLE advertising started (SOS/ACK connectable beacon in main ADV, ${beacon.size}B manuf data)")
            } else {
                // Idle: connectable advertising for GATT discovery.
                // A 1-byte alive marker ensures our manufacturer-data ScanFilter matches
                // this device even before any SOS is sent.
                val settings = AdvertiseSettings.Builder()
                    .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                    .setConnectable(true)
                    .setTimeout(0)
                    .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
                    .build()
                val data = AdvertiseData.Builder()
                    .setIncludeDeviceName(false)
                    .setIncludeTxPowerLevel(false)
                    .addServiceUuid(ParcelUuid(SERVICE_UUID))
                    .addManufacturerData(COMPANY_ID, byteArrayOf(0x00))
                    .build()
                advertiser?.startAdvertising(settings, data, advertiseCallback!!)
                Log.d(TAG, "BLE advertising started (idle, connectable, SERVICE_UUID + alive marker)")
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "startAdvertising denied — BLUETOOTH_ADVERTISE not granted: ${e.message}")
            onBroadcastStatus?.invoke("advertising_failed", -3)
        }
    }

    // ── BLE Scanner ───────────────────────────────────────────────────────────────

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val device = result.device
            // Software filter: accept only SurvAIve devices — those advertising SERVICE_UUID or
            // company ID 0x1234. Both idle (UUID+mfgData) and SOS (UUID-only) advertising include
            // SERVICE_UUID in the main ADV. Hardware filter dropped: SERVICE_UUID filter caused
            // silent scan failures on some OEM BLE chips; emptyList() + software check is reliable.
            val scanRecord = result.scanRecord
            val serviceUuids = scanRecord?.serviceUuids
            val mfgData = scanRecord?.getManufacturerSpecificData(COMPANY_ID)
            if ((serviceUuids == null || serviceUuids.none { it.uuid == SERVICE_UUID }) && mfgData == null) return
            peerLastSeen[device.address] = System.currentTimeMillis()
            if (discoveredPeers.none { it.address == device.address }) {
                if (discoveredPeers.size >= MAX_CACHED_PEERS) discoveredPeers.removeAt(0)
                discoveredPeers.add(device)
                Log.d(TAG, "New peer discovered: ${device.address} (total: ${discoveredPeers.size})")
                onNewPeerDiscovered?.invoke(device)
                fireMeshEvent("peer_discovered", mapOf("deviceAddress" to device.address, "peerCount" to discoveredPeers.size))
            }
            // Passive beacon decode: accept >= 18 bytes (all critical fields present; barangay
            // bytes 18–23 may be absent if OEM firmware truncated the PDU).
            if (mfgData != null && mfgData.size >= 18) {
                val packet = decodeBeacon(mfgData, device.address)
                if (packet != null) {
                    addressToOriginId[device.address] = packet.originDeviceId
                    // seenBeaconIds dedup: onScanResult fires every ~100–500ms for the same
                    // in-range beacon. Only the first decoded ID is forwarded to onPacketReceived;
                    // subsequent identical beacons are silently dropped at this layer.
                    if (seenBeaconIds.add(packet.id)) {
                        // Cap seenBeaconIds to prevent unbounded growth on long-running sessions.
                        if (seenBeaconIds.size > 200) {
                            val it = seenBeaconIds.iterator()
                            var pruned = 0
                            while (it.hasNext() && pruned < 50) { it.next(); it.remove(); pruned++ }
                        }
                        Log.d(TAG, "Provisional SOS beacon from ${device.address}: type=${packet.type} hops=${packet.hopCount}")
                        fireMeshEvent("beacon_provisional", mapOf(
                            "deviceAddress" to device.address,
                            "packetType"    to packet.type,
                            "beaconId"      to packet.id,
                            "originId"      to packet.originDeviceId,
                            "hopCount"      to packet.hopCount,
                        ))
                        // Forward beacon as provisional SOS — payload carries provisional=true
                        // and source=ble_beacon so JS can show a "pending" badge. GATT packet
                        // arriving later is the authoritative path; meshSync.js deduplicates
                        // by short-ID so DB only stores one row per incident.
                        onPacketReceived?.invoke(packet)
                    }
                } else {
                    // mfgData present and ≥18B but decodeBeacon returned null — type byte or
                    // content doesn't match expected format (wrong COMPANY_ID or corrupt data).
                    Log.w(TAG, "decodeBeacon null from ${device.address}: ${mfgData.size}B type=0x${"%02x".format(mfgData[0].toInt() and 0xFF)}")
                    fireMeshEvent("beacon_decode_failed", mapOf("deviceAddress" to device.address, "size" to mfgData.size))
                }
            } else {
                // Diagnostic: peer was accepted by the service-UUID filter but has no usable beacon.
                if (mfgData == null) {
                    // GATT-only peer: no manufacturer data in ADV — beacon path unavailable.
                    // This is normal for peers that have never sent an SOS (idle advertising).
                    Log.v(TAG, "No mfgData from ${device.address} — GATT-only peer")
                } else if (mfgData.size == 1 && mfgData[0] == 0x00.toByte()) {
                    // SurvAIve idle/alive marker — expected for non-SOS peers; no event.
                    Log.v(TAG, "Idle/alive marker from ${device.address}")
                } else {
                    // Truncated or foreign manufacturer data — unexpected.
                    Log.w(TAG, "mfgData too short from ${device.address}: ${mfgData.size}B < 18B minimum")
                    fireMeshEvent("beacon_too_short", mapOf("deviceAddress" to device.address, "size" to mfgData.size))
                }
            }
        }
        override fun onScanFailed(errorCode: Int) {
            Log.e(TAG, "BLE scan failed (code=$errorCode)")
            fireMeshEvent("scan_failed", mapOf("errorCode" to errorCode))
            if (errorCode == SCAN_FAILED_ALREADY_STARTED) return  // scanner is still running
            val ctx = _context ?: return
            mainHandler.postDelayed({
                Log.d(TAG, "BLE scan retry after failure (code=$errorCode, backoff=${scanRetryDelayMs}ms)")
                startScanning(ctx)
                scanRetryDelayMs = (scanRetryDelayMs * 2).coerceAtMost(30_000L)
            }, scanRetryDelayMs)
        }
    }

    private fun startScanning(context: Context) {
        val bm = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        scanner = bm.adapter.bluetoothLeScanner
        if (scanner == null) {
            // BT adapter not fully initialised yet (common when startMesh() races STATE_ON).
            // Fire a diagnostic event and retry in 3s — do NOT give up permanently.
            Log.e(TAG, "bluetoothLeScanner is null — BLUETOOTH_SCAN may not be granted; retrying in 3s")
            fireMeshEvent("scanner_null", emptyMap())
            mainHandler.postDelayed({ _context?.let { startScanning(it) } }, 3000L)
            return
        }

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
            .build()

        try {
            // No hardware filter: SERVICE_UUID and manufacturer-data hardware filters both cause
            // silent scan failures on some Samsung/Qualcomm OEM BLE chips. emptyList() (no
            // hardware filter) is universally reliable. SERVICE_UUID software check in onScanResult
            // isolates SurvAIve devices. Periodic restart every 30s counteracts Samsung/Xiaomi
            // background scan throttle that reduces no-filter scans to OPPORTUNISTIC.
            scanner?.startScan(emptyList(), settings, scanCallback)
            scanRetryDelayMs = 5_000L
            Log.d(TAG, "BLE scan started (no-filter, SERVICE_UUID software check)")
            fireMeshEvent("scan_started", mapOf("mode" to "LOW_LATENCY", "filter" to "software-UUID"))
        } catch (e: SecurityException) {
            Log.e(TAG, "startScan denied — BLUETOOTH_SCAN not granted: ${e.message}")
            fireMeshEvent("scan_permission_denied", mapOf("error" to (e.message ?: "SecurityException")))
            onBroadcastStatus?.invoke("scan_permission_denied", 0)
        }
    }

    // ── Broadcast ─────────────────────────────────────────────────────────────────

    override fun broadcast(packet: MeshPacket): Boolean {
        // Primary transport: advertisement beacon in main ADV_IND packet.
        // Passively broadcast every ~100ms; all nearby scanners receive it without
        // sending SCAN_REQ — no scan-response caching issues.
        if (packet.type == "sos" || packet.type == "ack") {
            if (packet.type == "sos") {
                // RC2: open 8-second fan-out window so ACK beacons can't replace the SOS beacon
                sosFanOutEndMs = System.currentTimeMillis() + 8_000L
                updateBeacon(packet)
                fireMeshEvent("sos_beacon_queued", mapOf(
                    "packetId" to packet.id,
                    "hopCount" to packet.hopCount,
                ))
            } else {
                // ACK beacon: only replace SOS after fan-out window expires
                if (System.currentTimeMillis() < sosFanOutEndMs) {
                    Log.d(TAG, "ACK beacon suppressed: SOS fan-out window active " +
                        "(${sosFanOutEndMs - System.currentTimeMillis()}ms remaining) — GATT only")
                    fireMeshEvent("ack_beacon_suppressed", mapOf(
                        "packetId"    to packet.id.take(8),
                        "remainingMs" to (sosFanOutEndMs - System.currentTimeMillis()),
                    ))
                } else {
                    updateBeacon(packet)
                }
            }
            if (discoveredPeers.isEmpty()) {
                onBroadcastStatus?.invoke("awaiting_peers", 0)
                fireMeshEvent("awaiting_peers", mapOf(
                    "packetId"   to packet.id,
                    "packetType" to packet.type,
                ))
                // Beacon is advertising passively but no GATT peer write was attempted.
                // Return false so MeshNetworkService keeps the packet in pendingPackets
                // and the 3-second retry loop re-attempts when a peer is discovered.
                return false
            }
        } else {
            if (discoveredPeers.isEmpty()) return false
        }

        // Belt-and-suspenders: also attempt a GATT write to discovered peers
        if (inFlightPacketIds.contains(packet.id)) {
            Log.d(TAG, "Packet ${packet.id.take(8)} already in-flight — skipping duplicate connect")
            fireMeshEvent("broadcast_already_in_flight", mapOf("packetId" to packet.id.take(8), "type" to packet.type))
            return true
        }
        inFlightPacketIds.add(packet.id)
        mainHandler.postDelayed({ inFlightPacketIds.remove(packet.id) }, 12000L)

        // Limit to 3 concurrent GATT connects — Android BLE supports 4-7 max.
        // Beacon advertising already delivers to all nearby scanners passively.
        // Only target peers seen within PEER_TTL_MS to avoid wasting a GATT slot on a device that moved away.
        val now = System.currentTimeMillis()
        val livePeers = discoveredPeers.filter { (peerLastSeen[it.address] ?: 0L) >= now - PEER_TTL_MS }
        if (livePeers.isEmpty() && discoveredPeers.isNotEmpty()) {
            fireMeshEvent("all_peers_stale", mapOf("staleCount" to discoveredPeers.size))
            onBroadcastStatus?.invoke("awaiting_peers", 0)
            return false
        }
        for (peer in livePeers.take(3)) {
            mainHandler.post { connectAndWrite(peer, packet) }
        }
        return true
    }

    /**
     * Full GATT client write flow with four layers of robustness:
     *
     *  Layer 1 — Connection retry: 2 retries at 1000ms for STATUS_133.
     *  Layer 2 — MTU negotiation fallback: if requestMtu() returns false, proceed immediately.
     *            3s timeout guards against onMtuChanged never firing. getAndSet ensures
     *            exactly one of (timeout, callback) calls discoverServices().
     *  Layer 3 — Write failure cleanup: any non-SUCCESS writeCharacteristic result calls
     *            gatt.disconnect() so the connection slot is freed for the next retry.
     *  Layer 4 — Write response watchdog: 30s timeout disconnects if onCharacteristicWrite
     *            never fires (e.g. server's sendResponse skipped due to gattServer==null).
     */
    private fun releasePeer(address: String) {
        busyPeerAddresses.remove(address)
    }

    private fun connectAndWrite(peer: BluetoothDevice, packet: MeshPacket, retriesLeft: Int = 2) {
        val address = peer.address
        if (!busyPeerAddresses.add(address)) {
            // A different packet's GATT flow is already active for this peer address.
            // Remove from inFlightPacketIds so MeshNetworkService.flushPending() can
            // retry this packet on the next 3s timer once the active flow releases the peer.
            inFlightPacketIds.remove(packet.id)
            fireMeshEvent("peer_busy_deferred", mapOf(
                "deviceAddress" to address,
                "packetId"      to packet.id.take(8),
            ))
            return
        }
        val ctx = _context ?: run { releasePeer(address); return }
        val payload = packet.toJson().toByteArray(Charsets.UTF_8)
        Log.d(TAG, "connectAndWrite: payload=${payload.size}B to ${peer.address} (retries=$retriesLeft)")
        fireMeshEvent("gatt_connecting", mapOf("peer" to peer.address, "packetId" to packet.id.take(8)))
        onBroadcastStatus?.invoke("connecting", 0)

        val mtuCallbackFired   = AtomicBoolean(false)
        val writeCallbackFired = AtomicBoolean(false)

        // Fragment-write state: non-null when the payload doesn't fit in a single MTU-3 write.
        // Fragments are drained one-by-one in onCharacteristicWrite after each GATT_SUCCESS ack.
        var currentMtu          = 23  // conservative default; updated in onMtuChanged
        var pendingFragments: ArrayDeque<ByteArray>? = null
        var fragmentChar: BluetoothGattCharacteristic? = null
        // Named runnable so removeCallbacks() can reliably cancel it between fragments.
        var writeWatchdog: Runnable? = null

        try {
            peer.connectGatt(ctx, false, object : BluetoothGattCallback() {

                override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
                    if (status != BluetoothGatt.GATT_SUCCESS) {
                        Log.e(TAG, "GATT connect error: status=$status addr=${gatt.device.address}")
                        // disconnect() before close() frees the connection slot on OEM stacks;
                        // skipping it leaks phantom connections on Samsung/Qualcomm firmware.
                        try { gatt.disconnect() } catch (_: Exception) {}
                        gatt.close()
                        if (retriesLeft > 0) {
                            Log.d(TAG, "Retrying GATT connect to ${gatt.device.address} ($retriesLeft left)")
                            fireMeshEvent("retry_attempted", mapOf("deviceAddress" to gatt.device.address, "packetId" to packet.id, "retriesLeft" to retriesLeft))
                            mainHandler.postDelayed({ connectAndWrite(peer, packet, retriesLeft - 1) }, 1000L)
                        } else {
                            Log.e(TAG, "All retries exhausted for ${gatt.device.address}")
                            fireMeshEvent("gatt_all_retries_failed", mapOf(
                                "deviceAddress" to gatt.device.address,
                                "packetId"      to packet.id,
                                "status"        to status,
                            ))
                            inFlightPacketIds.remove(packet.id)
                        }
                        return
                    }
                    if (newState == BluetoothProfile.STATE_CONNECTED) {
                        Log.d(TAG, "GATT connected to ${gatt.device.address} — requesting MTU 512")
                        fireMeshEvent("connection_established", mapOf("deviceAddress" to gatt.device.address, "packetId" to packet.id))
                        val mtuRequested = try { gatt.requestMtu(512) } catch (e: SecurityException) { false }
                        if (!mtuRequested) {
                            Log.w(TAG, "requestMtu returned false for ${gatt.device.address} — proceeding to discoverServices")
                            mtuCallbackFired.set(true)
                            fireMeshEvent("gatt_services_discovering", mapOf("deviceAddress" to gatt.device.address, "packetId" to packet.id.take(8)))
                            gatt.discoverServices()
                        } else {
                            mainHandler.postDelayed({
                                if (!mtuCallbackFired.getAndSet(true)) {
                                    Log.w(TAG, "onMtuChanged timeout for ${gatt.device.address} — proceeding to discoverServices")
                                    fireMeshEvent("gatt_services_discovering", mapOf("deviceAddress" to gatt.device.address, "packetId" to packet.id.take(8)))
                                    gatt.discoverServices()
                                }
                            }, 3000L)
                        }
                    } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                        releasePeer(gatt.device.address)
                        fireMeshEvent("peer_disconnected", mapOf("deviceAddress" to gatt.device.address))
                        gatt.close()
                    }
                }

                override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
                    // getAndSet: if timeout already fired, this is a no-op (avoids double discoverServices)
                    if (mtuCallbackFired.getAndSet(true)) return
                    if (status == BluetoothGatt.GATT_SUCCESS) {
                        currentMtu = mtu
                        Log.d(TAG, "MTU set to $mtu for ${gatt.device.address} (payload=${payload.size}B, max=${mtu - 3}B)")
                        if (payload.size > mtu - 3) {
                            // Payload exceeds single-write limit — onServicesDiscovered will fragment.
                            Log.w(TAG, "Payload ${payload.size}B > MTU-3 (${mtu - 3}B) for ${gatt.device.address} — will fragment")
                            fireMeshEvent("payload_exceeds_mtu", mapOf(
                                "deviceAddress" to gatt.device.address,
                                "payloadSize"   to payload.size,
                                "mtu"           to mtu,
                            ))
                        }
                    } else {
                        Log.w(TAG, "MTU negotiation failed (status=$status) for ${gatt.device.address} — using default ${currentMtu}B MTU")
                    }
                    fireMeshEvent("gatt_services_discovering", mapOf("deviceAddress" to gatt.device.address, "packetId" to packet.id.take(8)))
                    gatt.discoverServices()
                }

                override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
                    if (status != BluetoothGatt.GATT_SUCCESS) {
                        Log.e(TAG, "onServicesDiscovered failed: status=$status for ${gatt.device.address}")
                        inFlightPacketIds.remove(packet.id)
                        gatt.disconnect(); return
                    }
                    val service = gatt.getService(SERVICE_UUID)
                    if (service == null) {
                        val foundSvcs = gatt.services.joinToString { it.uuid.toString().take(8) }
                        Log.e(TAG, "Remote GATT service not found on ${gatt.device.address} — discovered: $foundSvcs (retriesLeft=$retriesLeft)")
                        fireMeshEvent("transmission_failed", mapOf(
                            "deviceAddress"      to gatt.device.address,
                            "packetId"           to packet.id,
                            "errorCode"          to -1,
                            "reason"             to "gatt_service_not_found",
                            "transport"          to "BLE_GATT",
                            "discoveredServices" to foundSvcs,
                        ))
                        inFlightPacketIds.remove(packet.id)
                        try { gatt.disconnect() } catch (_: Exception) {}
                        try { gatt.close()      } catch (_: Exception) {}
                        if (retriesLeft > 0) {
                            // Retry after 2s to allow the remote GATT server time to finish
                            // registering its service (the peer may be advertising before its
                            // onServiceAdded callback has fired).
                            mainHandler.postDelayed({ connectAndWrite(peer, packet, retriesLeft - 1) }, 2000L)
                        } else {
                            // All retries exhausted — evict this peer so the next broadcast()
                            // does not keep targeting a device with no usable GATT service.
                            discoveredPeers.remove(peer)
                            peerLastSeen.remove(peer.address)
                            fireMeshEvent("peer_evicted", mapOf(
                                "deviceAddress" to peer.address,
                                "reason"        to "gatt_service_not_found_exhausted",
                            ))
                        }
                        return
                    }
                    val char = service.getCharacteristic(CHAR_UUID)
                    if (char == null) {
                        Log.e(TAG, "Remote GATT characteristic not found on ${gatt.device.address}")
                        fireMeshEvent("transmission_failed", mapOf(
                            "deviceAddress" to gatt.device.address,
                            "packetId"      to packet.id,
                            "errorCode"     to -2,
                            "reason"        to "gatt_char_not_found",
                            "transport"     to "BLE_GATT",
                        ))
                        inFlightPacketIds.remove(packet.id)
                        gatt.disconnect(); return
                    }

                    // Assign the named write watchdog here where gatt is in scope.
                    // Armed before every writeOneChunk(); cancelled at the top of onCharacteristicWrite.
                    val watchdogGatt = gatt
                    writeWatchdog = Runnable {
                        if (!writeCallbackFired.getAndSet(true)) {
                            Log.e(TAG, "GATT write timeout: packet=${packet.id.take(8)} peer=${watchdogGatt.device.address}")
                            pendingFragments = null
                            fragmentChar = null
                            inFlightPacketIds.remove(packet.id)
                            fireMeshEvent("transmission_failed", mapOf(
                                "deviceAddress" to watchdogGatt.device.address,
                                "packetId"      to packet.id,
                                "reason"        to "write_response_timeout",
                                "transport"     to "BLE_GATT",
                            ))
                            try { watchdogGatt.disconnect() } catch (_: Exception) {}
                            try { watchdogGatt.close()      } catch (_: Exception) {}
                        }
                    }

                    // Choose single-write or fragment path based on negotiated MTU.
                    var writeStarted = false
                    val maxSingleWrite = currentMtu - 3
                    if (payload.size <= maxSingleWrite) {
                        // Single write — payload fits within negotiated MTU.
                        fireMeshEvent("gatt_write_started", mapOf(
                            "packetId"    to packet.id.take(8),
                            "peer"        to gatt.device.address,
                            "payloadSize" to payload.size,
                            "mode"        to "single",
                        ))
                        writeCallbackFired.set(false)
                        mainHandler.removeCallbacks(writeWatchdog!!)
                        mainHandler.postDelayed(writeWatchdog!!, 30_000L)
                        val ok = writeOneChunk(gatt, char, payload)
                        if (!ok) {
                            Log.e(TAG, "writeCharacteristic (single) failed for ${gatt.device.address}")
                            mainHandler.removeCallbacks(writeWatchdog!!)
                            inFlightPacketIds.remove(packet.id)
                            fireMeshEvent("transmission_failed", mapOf(
                                "deviceAddress" to gatt.device.address,
                                "packetId"      to packet.id,
                                "reason"        to "write_enqueue_failed",
                                "transport"     to "BLE_GATT",
                            ))
                            try { gatt.disconnect() } catch (_: Exception) {}
                            try { gatt.close()      } catch (_: Exception) {}
                            if (retriesLeft > 0) {
                                mainHandler.postDelayed({ connectAndWrite(peer, packet, retriesLeft - 1) }, 1000L)
                            }
                            return
                        }
                        writeStarted = true
                    } else {
                        // Fragment write — payload exceeds MTU-3; split into chunks with binary headers.
                        val maxDataPerFrag = currentMtu - 12   // 9-byte fragment header overhead
                        if (maxDataPerFrag < 10) {
                            Log.e(TAG, "MTU $currentMtu too small to fragment ${payload.size}B for ${gatt.device.address}")
                            fireMeshEvent("transmission_failed", mapOf(
                                "deviceAddress" to gatt.device.address, "packetId" to packet.id,
                                "reason" to "mtu_too_small_to_fragment", "mtu" to currentMtu,
                            ))
                            inFlightPacketIds.remove(packet.id); gatt.disconnect(); return
                        }
                        // Build the fragment queue
                        val fragId = ByteArray(6).also { java.security.SecureRandom().nextBytes(it) }
                        val frags  = ArrayDeque<ByteArray>()
                        var offset = 0
                        while (offset < payload.size) {
                            val end   = minOf(offset + maxDataPerFrag, payload.size)
                            val chunk = payload.copyOfRange(offset, end)
                            val frag  = ByteArray(9 + chunk.size)
                            frag[0] = 0xFE.toByte()
                            frag[1] = frags.size.toByte()   // fragment index (set before addLast)
                            frag[2] = 0                     // placeholder — total set after loop
                            fragId.copyInto(frag, 3)
                            chunk.copyInto(frag, 9)
                            frags.addLast(frag)
                            offset = end
                        }
                        val totalFrags = frags.size
                        if (totalFrags > 255) {
                            Log.e(TAG, "Too many fragments ($totalFrags) for ${peer.address} — payload ${payload.size}B")
                            fireMeshEvent("transmission_failed", mapOf(
                                "deviceAddress" to gatt.device.address, "packetId" to packet.id,
                                "reason" to "payload_too_large_to_fragment", "payloadSize" to payload.size,
                            ))
                            inFlightPacketIds.remove(packet.id); gatt.disconnect(); return
                        }
                        // Patch total-count byte now that we know it
                        frags.forEach { it[2] = totalFrags.toByte() }
                        pendingFragments = frags
                        fragmentChar = char
                        Log.d(TAG, "Fragment write: ${payload.size}B → $totalFrags frags of ≤${maxDataPerFrag}B to ${peer.address}")
                        fireMeshEvent("fragment_write_started", mapOf(
                            "deviceAddress" to peer.address,
                            "packetId"      to packet.id,
                            "totalChunks"   to totalFrags,
                            "payloadSize"   to payload.size,
                        ))
                        val firstFrag = frags.removeFirst()
                        writeCallbackFired.set(false)
                        mainHandler.removeCallbacks(writeWatchdog!!)
                        mainHandler.postDelayed(writeWatchdog!!, 30_000L)
                        val ok = writeOneChunk(gatt, char, firstFrag)
                        if (!ok) {
                            Log.e(TAG, "First fragment write failed for ${gatt.device.address}")
                            mainHandler.removeCallbacks(writeWatchdog!!)
                            pendingFragments = null; fragmentChar = null
                            inFlightPacketIds.remove(packet.id)
                            fireMeshEvent("transmission_failed", mapOf(
                                "deviceAddress" to gatt.device.address,
                                "packetId"      to packet.id,
                                "reason"        to "write_enqueue_failed",
                                "transport"     to "BLE_GATT",
                            ))
                            try { gatt.disconnect() } catch (_: Exception) {}
                            try { gatt.close()      } catch (_: Exception) {}
                            if (retriesLeft > 0) {
                                mainHandler.postDelayed({ connectAndWrite(peer, packet, retriesLeft - 1) }, 1000L)
                            }
                            return
                        }
                        writeStarted = true
                    }
                    // Watchdog armed inline before each writeOneChunk() above; no separate block needed.
                    @Suppress("UNUSED_EXPRESSION") writeStarted
                }

                override fun onCharacteristicWrite(
                    gatt: BluetoothGatt,
                    characteristic: BluetoothGattCharacteristic,
                    status: Int,
                ) {
                    // Cancel the per-write watchdog before any state inspection.
                    writeWatchdog?.let { mainHandler.removeCallbacks(it) }
                    writeCallbackFired.set(true)
                    if (status == BluetoothGatt.GATT_SUCCESS) {
                        val remaining = pendingFragments
                        if (remaining != null && remaining.isNotEmpty()) {
                            // More fragments to send — write next chunk and stay connected.
                            val nextFrag = remaining.removeFirst()
                            // Re-arm the watchdog for this specific fragment write.
                            writeCallbackFired.set(false)
                            writeWatchdog?.let { mainHandler.removeCallbacks(it); mainHandler.postDelayed(it, 30_000L) }
                            val ok = writeOneChunk(gatt, fragmentChar ?: characteristic, nextFrag)
                            if (!ok) {
                                Log.e(TAG, "Fragment write failed mid-sequence for ${gatt.device.address}")
                                pendingFragments = null; fragmentChar = null
                                inFlightPacketIds.remove(packet.id)
                                fireMeshEvent("transmission_failed", mapOf(
                                    "deviceAddress" to gatt.device.address, "packetId" to packet.id,
                                    "reason" to "fragment_write_failed", "transport" to "BLE_GATT",
                                ))
                                gatt.disconnect()
                            }
                            return   // don't disconnect — wait for next callback
                        }
                        // All data delivered (single write or last fragment)
                        pendingFragments = null; fragmentChar = null
                        Log.d(TAG, "Write confirmed to ${gatt.device.address} — packet ${packet.id.take(8)} delivered")
                        inFlightPacketIds.remove(packet.id)
                        onWriteConfirmed?.invoke(packet.id)
                        if (packet.type == "ack") {
                            onBroadcastStatus?.invoke("ack_transmitted", 0)
                            fireMeshEvent("ack_transmitted", mapOf("deviceAddress" to gatt.device.address, "packetId" to packet.id, "transport" to "BLE_GATT"))
                        } else {
                            onBroadcastStatus?.invoke("sos_transmitted", 0)
                            fireMeshEvent("sos_transmitted", mapOf("deviceAddress" to gatt.device.address, "packetId" to packet.id, "transport" to "BLE_GATT"))
                        }
                    } else {
                        Log.e(TAG, "Write failed: status=$status to ${gatt.device.address} — retry loop will re-send")
                        pendingFragments = null; fragmentChar = null
                        inFlightPacketIds.remove(packet.id)
                        fireMeshEvent("transmission_failed", mapOf("deviceAddress" to gatt.device.address, "packetId" to packet.id, "errorCode" to status, "transport" to "BLE_GATT"))
                    }
                    gatt.disconnect()
                }
            }, BluetoothDevice.TRANSPORT_LE)
        } catch (e: SecurityException) {
            Log.e(TAG, "connectGatt denied — BLUETOOTH_CONNECT not granted: ${e.message}")
            releasePeer(address)
            inFlightPacketIds.remove(packet.id)
        }
    }

    // ── BLE Advertisement Beacon encode/decode ────────────────────────────────────
    //
    // 20-byte binary format in the main ADV_IND (connectable) advertising packet
    // (manufacturer-specific AD type 0xFF, company ID COMPANY_ID).
    // Passively received by ALL nearby scanners — no SCAN_REQ, no GATT connection.
    // Total PDU: FLAGS(3) + ManufData overhead(4) + 20-byte payload = 27 bytes.
    // OEM TX-Power-Level append (3 bytes) → 30 bytes max — fits within 31-byte BLE limit.
    //
    // [0]    packet_type: 0x01=SOS, 0x02=ACK
    // [1]    hop_count
    // [2–5]  lat_int32 big-endian (lat×1e6)  [SOS] / zero [ACK]
    // [6–9]  lng_int32 big-endian (lng×1e6)  [SOS] / zero [ACK]
    // [10]   status_code [SOS: 0=sos,1=trapped,2=injured,3=rescue] / role [ACK: 0=device,1=responder,2=admin]
    // [11]   people_count [SOS] / reserved=0 [ACK]
    // [12–14] packet_id_3bytes: first 6 hex chars of packet UUID → 3 bytes
    // [15–17] origin_id_3bytes: first 6 hex chars of ANDROID_ID → 3 bytes
    // (barangay dropped from beacon to stay within PDU budget; still present in GATT payload)

    private fun encodeSosBeacon(packet: MeshPacket): ByteArray? = try {
        val inner = JSONObject(packet.payload)
        val lat = ((inner.optDouble("la", inner.optDouble("lat", 0.0))) * 1e6).toInt()
        val lng = ((inner.optDouble("lo", inner.optDouble("lng", 0.0))) * 1e6).toInt()
        val statusStr = inner.optString("s", inner.optString("status", "")).lowercase()
        val statusCode = (STATUS_TO_CODE[statusStr] ?: 0).toByte()
        val people = inner.optInt("n", inner.optInt("people_count", 0)).coerceIn(0, 255).toByte()
        val barangay = inner.optString("b", inner.optString("barangay", ""))
            .take(6).toByteArray(Charsets.UTF_8).copyOf(6)
        val idHex = when {
            packet.id.startsWith("beacon-") -> packet.id.removePrefix("beacon-")
            packet.id.startsWith("ack-")    -> packet.id.removePrefix("ack-")
            else -> packet.id.replace("-", "")
        }.take(6)
        val idBytes = try { idHex.chunked(2).map { it.toInt(16).toByte() }.toByteArray() } catch (_: Exception) { ByteArray(3) }
        val originHex = packet.originDeviceId.replace("-", "").take(6)
        val originBytes = try { originHex.chunked(2).map { it.toInt(16).toByte() }.toByteArray() } catch (_: Exception) { ByteArray(3) }
        // 20-byte beacon: drops 6-byte barangay field (bytes 18–23) to stay within BLE PDU.
        // Barangay is still present in the GATT payload (no size limit) — only the passive
        // advertisement beacon is trimmed. PDU = FLAGS(3) + ManufData(4+20) = 27 bytes, leaving
        // 4 bytes headroom for OEM TX-Power-Level appends (3 bytes → 30 bytes total, fits 31B max).
        val xLat = lat xor GEO_XOR
        val xLng = lng xor GEO_XOR
        ByteArray(20).also { b ->
            b[0] = 0x01; b[1] = packet.hopCount.coerceIn(0, 255).toByte()
            b[2] = (xLat shr 24 and 0xFF).toByte(); b[3] = (xLat shr 16 and 0xFF).toByte()
            b[4] = (xLat shr  8 and 0xFF).toByte(); b[5] = (xLat        and 0xFF).toByte()
            b[6] = (xLng shr 24 and 0xFF).toByte(); b[7] = (xLng shr 16 and 0xFF).toByte()
            b[8] = (xLng shr  8 and 0xFF).toByte(); b[9] = (xLng        and 0xFF).toByte()
            b[10] = statusCode; b[11] = people
            idBytes.copyInto(b, 12, 0, minOf(idBytes.size, 3))
            originBytes.copyInto(b, 15, 0, minOf(originBytes.size, 3))
        }
    } catch (e: Exception) {
        Log.w(TAG, "encodeSosBeacon failed: ${e.message}")
        null
    }

    private fun encodeAckBeacon(packet: MeshPacket): ByteArray? = try {
        val inner = JSONObject(packet.payload)
        val roleStr = inner.optString("rr", inner.optString("receiver_role", "device"))
        val role: Byte = when (roleStr) { "responder" -> 1; "admin" -> 2; else -> 0 }
        // Embed the SOS ID being ACKed (si field) so the victim can match it
        val sosId = inner.optString("si", "").replace("beacon-", "").replace("-", "")
        val idHex = if (sosId.length >= 6) sosId.take(6) else packet.id.replace("-", "").take(6)
        val idBytes = try { idHex.chunked(2).map { it.toInt(16).toByte() }.toByteArray() } catch (_: Exception) { ByteArray(3) }
        val originHex = packet.originDeviceId.replace("-", "").take(6)
        val originBytes = try { originHex.chunked(2).map { it.toInt(16).toByte() }.toByteArray() } catch (_: Exception) { ByteArray(3) }
        ByteArray(20).also { b ->
            b[0] = 0x02; b[1] = packet.hopCount.coerceIn(0, 255).toByte()
            b[10] = role
            idBytes.copyInto(b, 12, 0, minOf(idBytes.size, 3))
            originBytes.copyInto(b, 15, 0, minOf(originBytes.size, 3))
        }
    } catch (e: Exception) {
        Log.w(TAG, "encodeAckBeacon failed: ${e.message}")
        null
    }

    private fun decodeBeacon(bytes: ByteArray, sourceAddress: String): MeshPacket? {
        if (bytes.size < 18) return null   // minimum: type+hop+lat+lng+status+people+id3+origin3
        return try {
            val type     = bytes[0]
            val hopCount = bytes[1].toInt() and 0xFF
            // and 0xFF: Kotlin Byte is signed; without the mask, values >= 0x80 are
            // sign-extended to 8 hex chars ("ffffff84") instead of 2 ("84"), producing IDs
            // like "beacon-550effffff84" that defeat both the dedup check and the self-origin
            // check, causing the victim device to relay its own SOS and inflate forwardedCount.
            val idHex    = bytes.slice(12..14).joinToString("") { "%02x".format(it.toInt() and 0xFF) }
            val packetId = "beacon-$idHex"
            val originId = bytes.slice(15..17).joinToString("") { "%02x".format(it.toInt() and 0xFF) }
                .ifEmpty { sourceAddress.replace(":", "").take(6) }
            when (type) {
                0x01.toByte() -> {
                    val lat = (((bytes[2].toInt() and 0xFF) shl 24) or
                               ((bytes[3].toInt() and 0xFF) shl 16) or
                               ((bytes[4].toInt() and 0xFF) shl  8) or
                                (bytes[5].toInt() and 0xFF)) xor GEO_XOR
                    val lng = (((bytes[6].toInt() and 0xFF) shl 24) or
                               ((bytes[7].toInt() and 0xFF) shl 16) or
                               ((bytes[8].toInt() and 0xFF) shl  8) or
                                (bytes[9].toInt() and 0xFF)) xor GEO_XOR
                    val statusCode = bytes[10].toInt() and 0xFF
                    val people     = bytes[11].toInt() and 0xFF
                    // barangay only in bytes 18–23; omit gracefully if OEM truncated the PDU
                    val barangay   = if (bytes.size >= 24)
                        bytes.slice(18..23).toByteArray().toString(Charsets.UTF_8).trimEnd('\u0000')
                    else ""
                    val statusStr  = CODE_TO_STATUS[statusCode] ?: "sos"
                    val payload = JSONObject().apply {
                        put("t", "sos")
                        put("la", lat / 1e6)
                        put("lo", lng / 1e6)
                        put("s", statusStr)
                        if (people > 0) put("n", people)
                        if (barangay.isNotEmpty()) put("b", barangay)
                        put("provisional", true)       // beacon-only delivery; full fields in GATT packet
                        put("source", "ble_beacon")
                    }.toString()
                    MeshPacket(id = packetId, type = "sos", payload = payload,
                               originDeviceId = originId, hopCount = hopCount)
                }
                0x02.toByte() -> {
                    val roleCode = bytes[10].toInt() and 0xFF
                    val role     = when (roleCode) { 1 -> "responder"; 2 -> "admin"; else -> "device" }
                    val payload = JSONObject().apply {
                        put("t", "ack")
                        put("si", packetId)
                        put("hcr", hopCount)
                        put("rr", role)
                        put("stage", "beacon_seen")  // beacon ACK is provisional; only GATT ACK is authoritative
                    }.toString()
                    MeshPacket(id = "ack-$idHex", type = "ack", payload = payload,
                               originDeviceId = originId, hopCount = hopCount)
                }
                else -> null
            }
        } catch (e: Exception) {
            Log.w(TAG, "decodeBeacon failed: ${e.message}")
            null
        }
    }

    fun updateBeacon(packet: MeshPacket) {
        val ctx = _context ?: return
        val beacon = when (packet.type) {
            "sos" -> encodeSosBeacon(packet)
            "ack" -> encodeAckBeacon(packet)
            else  -> return
        } ?: run {
            Log.e(TAG, "updateBeacon: beacon encoding returned null for type=${packet.type}")
            fireMeshEvent("sos_beacon_encode_failed", mapOf(
                "packetId" to packet.id, "packetType" to packet.type
            ))
            return
        }
        // Idempotency guard: skip the stop/restart cycle if we're already advertising
        // the exact same beacon bytes. The flushPending() retry loop calls this every 3s,
        // and constant stop/restart causes Samsung/Xiaomi BLE firmware to silently stop
        // transmitting despite reporting onStartSuccess ("phantom success").
        if (_isAdvertising && currentBeacon != null && currentBeacon!!.contentEquals(beacon)) {
            Log.d(TAG, "updateBeacon: beacon unchanged and already advertising — skipping restart")
            return
        }
        currentBeacon = beacon
        Log.d(TAG, "updateBeacon: type=${packet.type} hopCount=${packet.hopCount} — restarting advertising")
        mainHandler.post {
            // Clear the flag BEFORE stopAdvertising so startAdvertising() in the postDelayed
            // below isn't blocked by the guard. stopAdvertising is async; the 300ms gap lets
            // the BT chip finish before the new startAdvertising call arrives.
            _isAdvertising = false
            try { advertiser?.stopAdvertising(advertiseCallback) } catch (_: Exception) {}
            mainHandler.postDelayed({ startAdvertising(ctx) }, 500L)
        }
    }

    // Writes one chunk to a GATT characteristic using WRITE_TYPE_DEFAULT.
    // Returns true if the write was successfully queued; false on any error.
    private fun writeOneChunk(
        gatt: BluetoothGatt,
        char: BluetoothGattCharacteristic,
        data: ByteArray,
    ): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                gatt.writeCharacteristic(char, data, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothStatusCodes.SUCCESS
            } else {
                @Suppress("DEPRECATION")
                char.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                @Suppress("DEPRECATION")
                char.value = data
                @Suppress("DEPRECATION")
                gatt.writeCharacteristic(char)
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "writeOneChunk SecurityException: ${e.message}")
            false
        }
    }

    private fun processIncomingPayload(value: ByteArray, senderAddress: String? = null) {
        // Fragment magic: 0xFE signals an application-level fragment chunk.
        // Binary header: [0xFE][fragIndex:1B][totalFrags:1B][fragSetId:6B][data...]
        if (value.isNotEmpty() && (value[0].toInt() and 0xFF) == 0xFE) {
            handleFragment(value, senderAddress)
            return
        }
        val json = value.toString(Charsets.UTF_8)
        fireMeshEvent("gatt_packet_received", mapOf("size" to value.size, "sender" to (senderAddress ?: "unknown")))
        try {
            val packet = MeshPacket.fromJson(json)
            if (packet == null) {
                fireMeshEvent("gatt_packet_parse_failed", mapOf("size" to value.size))
                Log.w(TAG, "processIncomingPayload: malformed/incomplete packet (${value.size}B) — discarded")
                return
            }
            // Populate address→originId mapping so getPeers() relay counter resolves correctly.
            if (senderAddress != null) addressToOriginId[senderAddress] = packet.originDeviceId
            // Stage 1 of receive chain: native packet forwarded to service layer.
            Log.d(TAG, "processIncomingPayload: invoking onPacketReceived id=${packet.id.take(8)} type=${packet.type}")
            fireMeshEvent("packet_delivered_to_service", mapOf(
                "packetId"      to packet.id,
                "packetType"    to packet.type,
                "senderAddress" to (senderAddress ?: "unknown"),
            ))
            onPacketReceived?.invoke(packet)
        } catch (_: Exception) {
            fireMeshEvent("gatt_packet_parse_failed", mapOf("size" to value.size))
            Log.w(TAG, "processIncomingPayload: unexpected error parsing packet (${value.size}B) — discarded")
        }
    }

    private fun handleFragment(value: ByteArray, senderAddress: String?) {
        if (value.size < 10) {
            Log.w(TAG, "Fragment too short: ${value.size}B — discarded"); return
        }
        val fragIndex = value[1].toInt() and 0xFF
        val totalFrags = value[2].toInt() and 0xFF
        if (totalFrags == 0 || fragIndex >= totalFrags) {
            Log.w(TAG, "Fragment header invalid: index=$fragIndex total=$totalFrags — discarded"); return
        }
        val fragSetHex = (3..8).joinToString("") { "%02x".format(value[it].toInt() and 0xFF) }
        val key        = "${senderAddress ?: "unknown"}:$fragSetHex"
        val dataBytes  = value.copyOfRange(9, value.size)
        val now        = System.currentTimeMillis()

        // Evict stale assemblies (> FRAGMENT_TTL_MS old) before inserting a new one.
        fragmentBuffers.entries.removeIf { (_, a) -> now - a.createdAt > FRAGMENT_TTL_MS }

        // Enforce concurrent-assembly cap to prevent unbounded memory growth.
        if (!fragmentBuffers.containsKey(key) && fragmentBuffers.size >= MAX_FRAGMENT_ASSEMBLIES) {
            Log.w(TAG, "Fragment assembly cap ($MAX_FRAGMENT_ASSEMBLIES) reached — discarding $key"); return
        }

        val assembly = fragmentBuffers.getOrPut(key) {
            FragmentAssembly(senderAddress = senderAddress, totalFragments = totalFrags, createdAt = now)
        }

        // Reject mid-transfer totalFrags change (retransmit from different burst).
        if (assembly.totalFragments != totalFrags) {
            Log.w(TAG, "Fragment totalFrags mismatch for $key: expected ${assembly.totalFragments} got $totalFrags — discarding")
            fragmentBuffers.remove(key); return
        }

        synchronized(assembly.parts) { assembly.parts[fragIndex] = dataBytes }
        Log.d(TAG, "Fragment: key=$key [$fragIndex/$totalFrags] ${dataBytes.size}B")

        val complete = synchronized(assembly.parts) { assembly.parts.size == totalFrags }
        if (!complete) return

        fragmentBuffers.remove(key)
        val assembled = synchronized(assembly.parts) {
            val parts = (0 until totalFrags).mapNotNull { assembly.parts[it] }
            if (parts.size != totalFrags) return@synchronized null
            val out = ByteArray(parts.sumOf { it.size })
            var pos = 0; for (p in parts) { p.copyInto(out, pos); pos += p.size }
            out
        } ?: run {
            Log.w(TAG, "Fragment assembly failed: $key — missing chunks"); return
        }

        Log.d(TAG, "Fragment assembly complete: $key ${assembled.size}B")
        fireMeshEvent("fragment_assembled", mapOf(
            "fragSetId"     to fragSetHex,
            "totalBytes"    to assembled.size,
            "senderAddress" to (senderAddress ?: "unknown"),
        ))
        processIncomingPayload(assembled, senderAddress)
    }
}
