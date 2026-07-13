// Mesh networking layer — real implementation requires BLE/WebRTC/Wi-Fi Direct hardware
// Returns empty/zero state until hardware integration is available

export const mesh = {
  isConnected: () => false,
  getPeers: () => [],
  getStats: () => ({
    peersConnected: 0,
    messagesForwarded: 0,
    dataRelayed: '0.0 KB',
    lastSync: '—',
  }),

  broadcast() { return false },
  onMessage(fn) { return () => {} },
  refresh() { return [] },
}
