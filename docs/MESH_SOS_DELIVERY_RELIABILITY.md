# SurvAIve PH v3 — SOS Mesh Delivery Reliability Patch

## Scope and evidence

This patch targets the current `main` state at commit `4434886bbf57b04375e1ebacccb56a7d2822cb8d` (24 October 2026). It rechecks the end-to-end path:

`SOSReport.jsx → mesh.js → MeshNetworkPlugin.kt → MeshNetworkService.broadcast → BLEMeshStrategy advertising/GATT → remote scan/GATT server → MeshNetworkService.handleIncomingPacket → MeshNetworkPlugin event → mesh.js → meshSync.js → IndexedDB/backend → MeshStatus/MeshCenter UI`.

These are code-level root causes confirmed by repository inspection. The patch has **not** been verified with two physical Android phones in this environment; the validation procedure below is required before calling the release fixed.

## Root cause 1 — BLE scanning can start without the runtime permission needed to receive beacons

**Files and functions**
- `frontend/android/app/src/main/AndroidManifest.xml`: the current manifest deliberately omits `android:usesPermissionFlags="neverForLocation"` from `BLUETOOTH_SCAN`.
- `frontend/android/app/src/main/java/ph/survaive/app/MeshNetworkPlugin.kt`, `startMeshAfterPermissions(call)`: before this patch, `ACCESS_FINE_LOCATION` was added to the required permission aliases only on Android 11/API 30 and earlier.

**Why delivery fails**
On Android 12+ the code no longer claims `neverForLocation`, but the plugin still allowed mesh startup without the declared runtime location permission. On affected device/OS combinations, the scanner can be started yet scan results are withheld. The sender's advertising callback can therefore say advertising started while the recipient never sees the SOS manufacturer-data advertisement. This is specifically a receive-side failure and can be one-way across the two phones.

**Fix implemented**
The plugin now requires `bluetoothScan`, `bluetoothAdvertise`, `bluetoothConnect`, and `location` on all API levels before reporting mesh startup success. The BLE scanner's `SecurityException` handler now emits `scan_permission_denied` and `scan_failed`, rather than only writing a log.

**Integration**
The permission aliases are declared in the same `@CapacitorPlugin` annotation, the permission strings exist in the manifest, and `startMeshAfterPermissions` is the guard before the foreground service starts. The recipient must grant Location access as well as Nearby devices/Bluetooth permissions. On Android 12+, confirm Location permission is granted in Android Settings; on some devices Location Services must also be enabled for scan results.

## Root cause 2 — the single advertiser could replace the SOS beacon with an ACK too early

**File and function**
- `frontend/android/app/src/main/java/ph/survaive/app/strategies/BLEMeshStrategy.kt`, `broadcast(packet)` and `updateBeacon(packet)`.

**Why delivery fails**
Legacy BLE advertising offers one advertisement payload at a time. The previous implementation called `updateBeacon(packet)` immediately for both SOS and ACK. Once the first nearby device decoded the SOS and generated an ACK, the sender could switch its advertisement to ACK while other nearby phones or relay nodes had not scanned the SOS yet. Those phones might then discover the device but never decode the original SOS beacon. Advertising the packet is not the same as all peers receiving it.

**Fix implemented**
A new SOS packet gets a fixed 30-second beacon fan-out window. A same-packet retry does not restart the window; an ACK still attempts GATT delivery immediately but does not replace the SOS beacon during the initial window. After the window expires, an ACK may take the beacon slot. A same SOS retry will not then immediately preempt the active ACK beacon. Encoding failures are logged as `sos_beacon_encode_failed`; only a successfully encoded/queued beacon is logged as `sos_beacon_queued`.

**Integration**
The full packet still uses GATT. The 20-byte advertisement remains a partial SOS intended to make emergency presence visible without connecting; a later GATT packet upgrades the partial report. The native service and JS activity store continue to deduplicate/merge beacon and full packet representations.

**Important boundary**
A single legacy advertiser cannot transmit two distinct beacon payloads at once. The grace interval improves fan-out but is not an application-level delivery guarantee. A sender must be tested with several recipients and the receiver ACK recorded separately.

## Root cause 3 — receipt persistence was delayed by an online-looking but unreachable backend

**File and function**
- `frontend/src/lib/meshSync.js`, `startMeshSync()`'s SOS `mesh.onMessage` handler.

**Why it matters**
The old flow displayed the SOS, then—if `getNetworkOnline()` returned true—awaited `api.post('/sos', ...)` before creating its local IndexedDB record or sending the receiver's application ACK. “Network connected” does not mean the backend is reachable. A slow/unreachable backend could delay durable storage and the ACK for the HTTP timeout even though the report had arrived over Bluetooth. A displayed card also did not by itself prove local persistence.

**Fix implemented**
After displaying/logging the packet, the handler now writes the received SOS to IndexedDB first. Only after local durable storage (or a successful backend-only fallback if local storage itself fails) does it attempt the application ACK. Backend sync runs afterwards; a failure leaves the IndexedDB item pending and logs `backend_sync_pending`. A backend-confirmed record emits `sos_persisted`. An ACK is no longer logged as sent simply because a call to `mesh.broadcast` was made.

**Integration**
The queued record carries `receivedViaMesh`, `meshOriginId`, `meshPacketId`, and the receive timestamp. It stays compatible with `db.getPendingSOS()`, `db.markSOSSynced()`, and `drainOfflineQueue()`. The UI's `addReceivedSOS()` is still invoked immediately, and ACK sending remains a separate mesh packet.

## Root cause 4 — BLE advertising/startup states could be mistaken for delivered packets

**Files and functions**
- `BLEMeshStrategy.kt`, `broadcast(packet)`, `startGattServer(context)`, and `startScanning(context)`.
- `frontend/src/lib/mesh.js`, `getStats()`.
- `frontend/src/pages/responder/MeshCenter.jsx`, event labels and Overview ACK count.

**Why delivery fails or diagnostics mislead**
Before the patch, the native SOS beacon branch emitted `sos_transmitted` when it merely scheduled/restarted advertising. The UI could therefore suggest transmission without a scan result, GATT write response, JS handler, or app-level ACK. Also, `gattServer?.addService(service)` ignored a false return; the server could remain open without registering the characteristic, making the peer unable to write to it. Finally, `mesh.getStats()` swallowed native startup errors and could look like a generic zero-peer state.

**Fix implemented**
- Beacon scheduling now logs `sos_beacon_queued`, not `sos_transmitted`.
- `sos_transmitted` is emitted after `onCharacteristicWrite` returns `GATT_SUCCESS`, with `confirmation=gatt_write_response`. That proves the GATT server acknowledged the write, **not** that the receiving JavaScript handler stored the SOS.
- ACK writes have their own `ack_transmitted` event.
- Null GATT server and `addService()` rejection emit explicit failure events and a retry for rejected registration.
- `getStats()` exposes `transport=start_failed` and the startup error instead of hiding the cause.
- The responder Mesh dashboard distinguishes queued beacon, confirmed GATT write, pending backend sync, and ACK write. The ACK count uses the confirmed `ack_transmitted` events rather than unverified broadcast dispatches.

## Receive-chain checkpoints

Check these milestones on the **recipient** for the exact packet ID. Each missing milestone narrows the fault:

1. `scan_started` — scanner was started.
2. `peer_discovered` — Android found the advertiser. Discovery alone is not SOS reception.
3. `beacon_decoded` — the SOS manufacturer payload was decoded; for full SOS data, look for `gatt_packet_received` or `packet_delivered_to_service`.
4. Android log `MeshService: Packet received` — native service accepted the packet after its own-origin, age and duplicate checks.
5. `MeshPlugin: notifyListeners meshPacketReceived` and JS `[mesh] meshPacketReceived` — native bridge delivered the packet to the web view.
6. `[meshSync] SOS received via mesh` and activity event `sos_received` — application handler processed it and UI state was updated.
7. `sos_stored_locally` or `sos_persisted` — a durable store accepted the report.
8. Sender receives the recipient ACK — application-level confirmation that the receiver persisted the message. Do not infer this from `sos_beacon_queued`, `peer_discovered`, `sos_transmitted`, or a peer counter.

## Wi-Fi Direct limitation found

`frontend/android/app/src/main/java/ph/survaive/app/strategies/WiFiDirectStrategy.kt` explicitly performs passive peer discovery and does **not** create/connect a Wi-Fi Direct group. Its TCP relay path only works if a group has been formed externally and group-owner/client IP information is available. Therefore Wi-Fi Direct is not a fully automatic backup transport for arbitrary nearby phones in the current design. This patch does not introduce group formation because it changes Android system connectivity and user-consent behavior and should not be claimed working without device testing. BLE remains the primary automatic nearby transport.

## Two-physical-device validation (offline)

Use two Android phones (A = sender/victim, B = receiver/responder), both with freshly rebuilt APKs from this branch, Bluetooth ON, Location permission granted, Nearby devices/Bluetooth permissions granted, and Location Services ON if the OEM requires it. Turn **mobile data and Wi-Fi/internet off** on both devices. Keep the app visible and the screens awake for the first test.

1. **Start and verify scanning**
   - Open Mesh on B and record the time.
   - Expected B logs: `scan_started`; no `scan_permission_denied`, `scanner_null` loops, or `start_failed`.
   - If scan permission is denied, fix Android app permissions before proceeding. An advertising-only log on A is insufficient.

2. **Create one SOS**
   - On A submit exactly one simple SOS (status Trapped, people count 1, short barangay).
   - Record the packet ID shown in A's `sos_broadcast` / `broadcast_dispatched` event.
   - Expected A: `sos_beacon_queued`; status may show `awaiting_peers` until scanning identifies B. This is not confirmation that B has received it.

3. **Verify beacon reception on B**
   - Within 30 seconds, B should show `peer_discovered` and `beacon_decoded`, then `sos_received` and a received SOS card marked partial if GATT has not yet arrived.
   - If B discovers A but no `beacon_decoded`, inspect B's `mfgData` length / `beacon_too_short` / `beacon_decode_failed` events and ensure the APK includes this branch's manifest and permissions.
   - If no peer is discovered, compare scan/advertising permissions and the Android logcat scan callbacks before debugging database/UI code.

4. **Verify full GATT message**
   - Expected native log on A: connection established and write confirmed to B; native log on B: `gatt_packet_received`, `packet_delivered_to_service`, `Packet received`, then `notifyListeners meshPacketReceived`.
   - B's partial SOS should upgrade to a full entry containing the barangay/municipality/service type; it should not create a second duplicate card.
   - If beacon works but full report does not, check service UUID `12345678-0000-1000-8000-00805f9b34fb`, characteristic UUID `12345678-0001-1000-8000-00805f9b34fb`, `gatt_service_not_found`, `gatt_char_not_found`, fragment events, `gatt_packet_parse_failed`, and `transmission_failed`.

5. **Verify persistence and ACK**
   - B must log `sos_stored_locally` (or `sos_persisted` only if local storage itself failed and the backend succeeded) before it broadcasts an ACK.
   - With internet off, expected B: `sos_stored_locally`, followed by `ack_transport_accepted` or `ack_transport_pending`; A should eventually log `ack_received` when the corresponding ACK arrives.
   - An ACK transport event alone is not proof that A received the ACK. The end-to-end pass criterion is the received SOS visibly listed on B, a local durable store event for the same packet ID, and A logging `ack_received`.

6. **Fan-out test**
   - Repeat the test with a third phone C in the same area.
   - B's first ACK must not immediately overwrite A's SOS beacon: A should keep its SOS beacon active for the first 30 seconds. Verify both B and C log the same originating SOS ID (the beacon ID can be truncated, while GATT carries the full packet ID).

7. **Failure/retry test**
   - Keep B running but deny Location permission, then submit a new SOS from A. Expected B: permission/start failure becomes visible; do not count this as a delivery success.
   - Regrant permission and retry. Ensure a fresh SOS is received, stored, and acknowledged.
   - Force a backend/API failure while keeping Bluetooth enabled. B must still store the SOS locally and attempt its ACK before backend sync times out; `backend_sync_pending` is expected.

## Regression checks

- **Online submission:** sender's existing `api.post('/sos')` path still runs. Incoming mesh reports are saved locally first and later marked synced after backend success.
- **Offline queue:** incoming SOS records still use `db.queueSOS`, retain their mesh metadata, and are drained by the existing `drainOfflineQueue()` when online.
- **Fragmented GATT writes:** check payloads with notes/long data, all fragments acknowledged, `fragment_assembled`, valid `MeshPacket.fromJson`, and no stuck write watchdog.
- **Dedup and partial upgrade:** receiving beacon then GATT yields one card upgraded to full fields; repeated scan results do not multiply SOS cards.
- **Relay:** B should forward one SOS with decremented hop count; a duplicate packet should not trigger an additional relay storm. Only report a relay after the existing native confirmation event path.
- **ACK state:** A's ACK level changes only on an ACK decoded/received from the mesh; a queued broadcast or GATT write confirmation is not equal to receiver receipt.
- **No internet:** both phones must complete discovery, beacon or GATT reception, local storage, display and ACK while disconnected from the backend.

## Files changed in this patch

- `frontend/android/app/src/main/java/ph/survaive/app/MeshNetworkPlugin.kt`
- `frontend/android/app/src/main/java/ph/survaive/app/strategies/BLEMeshStrategy.kt`
- `frontend/src/lib/mesh.js`
- `frontend/src/lib/meshSync.js`
- `frontend/src/pages/responder/MeshCenter.jsx`

The separate victim/responder entry points were rechecked and already start `startMeshSync()` in current `main`; no startup-handler changes were needed.
