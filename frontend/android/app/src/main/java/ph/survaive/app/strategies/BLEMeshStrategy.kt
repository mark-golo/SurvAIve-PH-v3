package ph.survaive.app.strategies

import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import android.provider.Settings
import ph.survaive.app.MeshPacket
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList

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
 *  broadcast(packet) → for each cached peer → connect GATT → write to char → disconnect
 *
 * ── Permissions required (declared in AndroidManifest.xml) ────────────────────
 *  Android 12+: BLUETOOTH_ADVERTISE, BLUETOOTH_CONNECT, BLUETOOTH_SCAN
 *  Android 11-: BLUETOOTH, BLUETOOTH_ADMIN
 *  Always:      ACCESS_FINE_LOCATION (required for BLE scan on all API levels)
 */
class BLEMeshStrategy : MeshStrategy {

    override val name = "BLE"

    companion object {
        // Randomly generated UUIDs unique to SurvAIve PH — do not change after deploy
        val SERVICE_UUID: UUID = UUID.fromString("12345678-0000-1000-8000-00805f9b34fb")
        val CHAR_UUID: UUID    = UUID.fromString("12345678-0001-1000-8000-00805f9b34fb")
        private const val MAX_CACHED_PEERS = 20
    }

    // Peers discovered by the BLE scanner — used as outbound write targets
    private val discoveredPeers = CopyOnWriteArrayList<BluetoothDevice>()

    private var gattServer: BluetoothGattServer? = null
    private var scanner: BluetoothLeScanner?     = null
    private var advertiser: BluetoothLeAdvertiser? = null
    private var onPacketReceived: ((MeshPacket) -> Unit)? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    override val isAvailable: Boolean
        get() {
            val bm = _context?.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            return bm?.adapter?.isEnabled == true
        }

    private var _context: Context? = null

    // ── Lifecycle ────────────────────────────────────────────────────────────────

    override fun start(context: Context, onPacketReceived: (MeshPacket) -> Unit) {
        _context = context.applicationContext
        this.onPacketReceived = onPacketReceived

        startGattServer(context)
        startAdvertising(context)
        startScanning(context)
    }

    override fun stop() {
        scanner?.stopScan(scanCallback)
        advertiser?.stopAdvertising(null)
        gattServer?.close()
        gattServer = null
        scanner    = null
        advertiser = null
        discoveredPeers.clear()
    }

    // ── GATT Server — receives incoming packets ───────────────────────────────────

    private fun startGattServer(context: Context) {
        val bm = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager

        gattServer = bm.openGattServer(context, object : BluetoothGattServerCallback() {

            override fun onCharacteristicWriteRequest(
                device: BluetoothDevice,
                requestId: Int,
                characteristic: BluetoothGattCharacteristic,
                preparedWrite: Boolean,
                responseNeeded: Boolean,
                offset: Int,
                value: ByteArray,
            ) {
                if (responseNeeded) {
                    gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
                }
                // Parse packet on the calling thread (already off main thread)
                val json = value.toString(Charsets.UTF_8)
                try {
                    val packet = MeshPacket.fromJson(json)
                    onPacketReceived?.invoke(packet)
                } catch (_: Exception) {
                    // Malformed packet — discard
                }
            }
        })

        // Register the SurvAIve primary service + writable characteristic
        val service = BluetoothGattService(
            SERVICE_UUID,
            BluetoothGattService.SERVICE_TYPE_PRIMARY,
        )
        val char = BluetoothGattCharacteristic(
            CHAR_UUID,
            BluetoothGattCharacteristic.PROPERTY_WRITE or
                    BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
            BluetoothGattCharacteristic.PERMISSION_WRITE,
        )
        service.addCharacteristic(char)
        gattServer?.addService(service)
    }

    // ── BLE Advertising — makes this device discoverable ─────────────────────────

    private fun startAdvertising(context: Context) {
        val bm = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        advertiser = bm.adapter.bluetoothLeAdvertiser ?: return

        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setConnectable(true)
            .setTimeout(0)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
            .build()

        val data = AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .addServiceUuid(ParcelUuid(SERVICE_UUID))
            .build()

        advertiser?.startAdvertising(settings, data, object : AdvertiseCallback() {
            override fun onStartFailure(errorCode: Int) {
                // Advertising may fail if hardware doesn't support peripheral mode —
                // scanner-only mode still allows receiving packets from other advertisers.
            }
        })
    }

    // ── BLE Scanner — discovers nearby SurvAIve devices ──────────────────────────

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val device = result.device
            if (discoveredPeers.none { it.address == device.address }) {
                if (discoveredPeers.size >= MAX_CACHED_PEERS) {
                    discoveredPeers.removeAt(0)
                }
                discoveredPeers.add(device)
            }
        }
    }

    private fun startScanning(context: Context) {
        val bm = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        scanner = bm.adapter.bluetoothLeScanner ?: return

        val filter = ScanFilter.Builder()
            .setServiceUuid(ParcelUuid(SERVICE_UUID))
            .build()

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        scanner?.startScan(listOf(filter), settings, scanCallback)
    }

    // ── Broadcast — write packet to each known peer ───────────────────────────────

    override fun broadcast(packet: MeshPacket): Boolean {
        if (discoveredPeers.isEmpty()) return false

        val payload  = packet.toJson().toByteArray(Charsets.UTF_8)
        var anySent  = false

        // Connect to each cached peer and write the characteristic.
        // This is fire-and-forget — we don't wait for GATT callbacks here.
        for (peer in discoveredPeers.toList()) {
            try {
                peer.connectGatt(_context, false, object : BluetoothGattCallback() {
                    override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
                        if (newState == BluetoothProfile.STATE_CONNECTED) {
                            gatt.discoverServices()
                        } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                            gatt.close()
                        }
                    }

                    override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
                        val service = gatt.getService(SERVICE_UUID) ?: return gatt.disconnect()
                        val char    = service.getCharacteristic(CHAR_UUID) ?: return gatt.disconnect()
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            gatt.writeCharacteristic(char, payload, BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE)
                        } else {
                            @Suppress("DEPRECATION")
                            char.value = payload
                            @Suppress("DEPRECATION")
                            gatt.writeCharacteristic(char)
                        }
                    }

                    override fun onCharacteristicWrite(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
                        gatt.disconnect()
                    }
                })
                anySent = true
            } catch (_: Exception) {
                // Skip this peer and continue
            }
        }
        return anySent
    }
}
