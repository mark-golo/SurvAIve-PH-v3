/**
 * MeshNetworkPlugin.ts — TypeScript interface for the native Kotlin Capacitor plugin
 *
 * This file defines the JS-side contract for the MeshNetwork native plugin.
 * The Kotlin implementation lives at:
 *   android/app/src/main/java/ph/survaive/app/MeshNetworkPlugin.kt
 *
 * On the web (Admin dashboard), registerPlugin() loads MeshNetworkPluginWeb as
 * a fallback — it degrades gracefully to HTTP-based communication.
 */
import { registerPlugin } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'

// ── Data models ───────────────────────────────────────────────────────────────

/**
 * A single message routed through the offline mesh network.
 *
 * Packet flow:
 *   Victim A → [BLE / Wi-Fi Direct] → Device B (relay) → ... → Internet-connected Responder → Cloud
 *
 * Deduplication: each device tracks seen `id` values to avoid re-broadcasting
 *   the same packet multiple times. `hopCount` acts as TTL — packets with
 *   hopCount === 0 are dropped and not forwarded.
 */
export interface MeshPacket {
  /** UUID v4 — used for deduplication across the relay chain */
  id: string
  /** Message category */
  type: 'sos' | 'ack' | 'status' | 'relay'
  /** JSON-encoded payload (SOS report body, ack reference, etc.) */
  payload: string
  /** Android device ID of the originating device */
  originDeviceId: string
  /** Remaining relay hops — starts at 5, decremented on each forward */
  hopCount: number
  /** Unix timestamp (ms) when the packet was first created */
  timestamp: number
}

// ── Plugin interface ──────────────────────────────────────────────────────────

export interface MeshNetworkPlugin {
  /**
   * Start BLE advertising + scanning + Wi-Fi Direct listening.
   * Also triggers Android runtime permission requests for BLE and location.
   * Must be called before broadcast() or addListener().
   */
  startMesh(): Promise<{ success: boolean }>

  /** Stop all mesh transports and release system resources. */
  stopMesh(): Promise<void>

  /**
   * Broadcast a packet via the best available transport.
   * Strategy order: BLE GATT → Wi-Fi Direct.
   * Returns the name of the transport used, or 'none' on total failure.
   * On failure the caller should queue to IndexedDB for retry.
   */
  broadcast(options: {
    type: string
    payload: string
  }): Promise<{ success: boolean; transport: string }>

  /** Return current mesh statistics (peer count, active transport, relay flag). */
  getStats(): Promise<{
    peersNearby: number
    transport: string
    relayEnabled: boolean
  }>

  /**
   * Enable or disable this device acting as a relay node.
   * When disabled, the device still receives packets but does not forward them —
   * useful in Battery Saver mode.
   */
  setRelay(options: { enabled: boolean }): Promise<void>

  /**
   * Register a listener for packets received from nearby mesh peers.
   * Fires whenever the native BLE GATT server or Wi-Fi Direct HTTP endpoint
   * receives a new (non-duplicate, non-expired) packet.
   */
  addListener(
    eventName: 'meshPacketReceived',
    listenerFunc: (packet: MeshPacket) => void,
  ): Promise<PluginListenerHandle>
}

// ── Registration ──────────────────────────────────────────────────────────────

/**
 * The singleton `MeshNetwork` object exposed to React components and mesh.js.
 *
 * On Android: routes to the Kotlin MeshNetworkPlugin via the Capacitor bridge.
 * On web:     routes to MeshNetworkPluginWeb (HTTP fallback / no-op).
 */
export const MeshNetwork = registerPlugin<MeshNetworkPlugin>('MeshNetwork', {
  web: () =>
    import('./MeshNetworkPluginWeb').then((m) => new m.MeshNetworkPluginWeb()),
})
