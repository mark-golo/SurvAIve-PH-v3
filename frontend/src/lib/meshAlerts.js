// M2 fix: ring buffer of the last 5 alerts so subscribers that mount after
// an alert was emitted (e.g. responder navigates away then back) still see it.
const MAX_BUFFER = 5
let _handlers = []
let _buffer = []   // [{ data, rawPacket, time }]

export function onMeshSOSAlert(fn) {
  _handlers.push(fn)
  // Replay buffered alerts missed while unsubscribed
  _buffer.forEach(({ data, rawPacket }) => {
    try { fn(data, rawPacket) } catch {}
  })
  return () => {
    _handlers = _handlers.filter((h) => h !== fn)
  }
}

export function emitMeshSOSAlert(data, rawPacket) {
  _buffer.push({ data, rawPacket, time: Date.now() })
  if (_buffer.length > MAX_BUFFER) _buffer.shift()
  _handlers.forEach((fn) => {
    try { fn(data, rawPacket) } catch {}
  })
}
