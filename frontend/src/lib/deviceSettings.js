import { mesh } from './mesh'

const KEY = 'survAIve-devicesettings'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {} } catch { return {} }
}
function save(s) { localStorage.setItem(KEY, JSON.stringify(s)) }

export const deviceSettings = {
  getSettings() {
    const s = load()
    return {
      meshRelay:    s.meshRelay    ?? true,
      batterySaver: s.batterySaver ?? false,
    }
  },
  init() {
    const s = this.getSettings()
    mesh.setRelay(s.meshRelay)
    mesh.setBatterySaver(s.batterySaver)
  },
  setMeshRelay(enabled) {
    save({ ...load(), meshRelay: enabled })
    mesh.setRelay(enabled)
  },
  setBatterySaver(enabled) {
    save({ ...load(), batterySaver: enabled })
    mesh.setBatterySaver(enabled)
  },
}
