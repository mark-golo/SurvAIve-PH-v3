export function fmtSosId(id) {
  if (id == null) return '—'
  return 'SOS-' + String(id).padStart(5, '0')
}
