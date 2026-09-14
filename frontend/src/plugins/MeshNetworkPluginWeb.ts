/**
 * MeshNetworkPluginWeb.ts — Browser fallback for the MeshNetwork Capacitor plugin
 *
 * Used when SurvAIve PH runs in a browser (Admin dashboard, dev server).
 * BLE and Wi-Fi Direct are not available on the web, so this implementation
 * falls back to HTTP POST to the local XAMPP backend when online, and returns
 * success:false (prompting IndexedDB queuing) when offline.
 *
 * The Admin dashboard never calls startMesh() in normal use — only the Victim
 * and Responder apps do. This file exists so the import chain doesn't break
 * during web builds.
 */
import { WebPlugin } from '@capacitor/core'
import type { MeshNetworkPlugin, MeshPacket } from './MeshNetworkPlugin'

export class MeshNetworkPluginWeb extends WebPlugin implements MeshNetworkPlugin {
  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async startMesh(): Promise<{ success: boolean }> {
    console.info('[MeshNetworkPluginWeb] startMesh() — no-op in browser context')
    return { success: true }
  }

  async stopMesh(): Promise<void> {
    // nothing to stop in the browser
  }

  // ── Broadcast ───────────────────────────────────────────────────────────────

  /**
   * On web: attempts HTTP POST to the local XAMPP PHP backend.
   * This mirrors what the native Kotlin plugin does as a last resort when
   * BLE and Wi-Fi Direct both fail (internet-connected path).
   */
  async broadcast(options: { type: string; payload: string }): Promise<{ success: boolean; transport: string }> {
    try {
      const { hostname, protocol } = window.location
      const url = `${protocol}//${hostname}/SurvAIve%20PH%20v3/backend/api/router.php?path=sos`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: options.payload,
      })
      return { success: res.ok, transport: 'wifi-http' }
    } catch {
      return { success: false, transport: 'none' }
    }
  }

  // ── Stats ───────────────────────────────────────────────────────────────────

  async getStats(): Promise<{ peersNearby: number; transport: string; relayEnabled: boolean }> {
    return { peersNearby: 0, transport: 'web', relayEnabled: false }
  }

  // ── Relay flag ──────────────────────────────────────────────────────────────

  async setRelay(_opts: { enabled: boolean }): Promise<void> {
    // no-op on web
  }

  // ── Event listener (typed override) ─────────────────────────────────────────

  // The base WebPlugin class handles addListener() / removeAllListeners().
  // On the web, 'meshPacketReceived' events are never fired because there is
  // no BLE scanner — but the subscription doesn't error, keeping component
  // code portable between native and web contexts.
  async addListener(
    eventName: 'meshPacketReceived',
    listenerFunc: (packet: MeshPacket) => void,
  ) {
    return super.addListener(eventName, listenerFunc)
  }
}
