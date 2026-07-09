// Simulated mesh networking layer
// In production: replaced with BLE/WebRTC/Wi-Fi Direct implementation

const PEER_NAMES = ['Node-A1', 'Node-B7', 'Node-C3', 'Node-D9', 'Node-E5', 'Node-F2']

function randomPeers(count = 3) {
  const shuffled = [...PEER_NAMES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).map((id) => ({
    id,
    signal: Math.floor(Math.random() * 4) + 1,
    lastSeen: `${Math.floor(Math.random() * 5) + 1}s ago`,
    forwarded: Math.floor(Math.random() * 20),
  }))
}

let _listeners = []
let _peers = randomPeers(Math.floor(Math.random() * 3) + 1)
let _messagesForwarded = Math.floor(Math.random() * 50)
let _connected = _peers.length > 0

export const mesh = {
  isConnected: () => _connected,
  getPeers: () => _peers,
  getStats: () => ({
    peersConnected: _peers.length,
    messagesForwarded: _messagesForwarded,
    dataRelayed: `${(_messagesForwarded * 0.8).toFixed(1)} KB`,
    lastSync: `${Math.floor(Math.random() * 10) + 1} min ago`,
  }),

  broadcast(data) {
    _messagesForwarded++
    _listeners.forEach((fn) => fn({ type: 'broadcast', data, timestamp: Date.now() }))
    return true
  },

  onMessage(fn) {
    _listeners.push(fn)
    return () => { _listeners = _listeners.filter((l) => l !== fn) }
  },

  // Simulate peer discovery refresh
  refresh() {
    const count = Math.floor(Math.random() * 4)
    _peers = randomPeers(count)
    _connected = count > 0
    return _peers
  },
}
