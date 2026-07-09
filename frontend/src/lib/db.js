import { openDB } from 'idb'

const DB_NAME = 'survAIve-ph'
const DB_VERSION = 1

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('sos_queue')) {
        const store = db.createObjectStore('sos_queue', { keyPath: 'localId', autoIncrement: true })
        store.createIndex('synced', 'synced')
      }
      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('sos_reports')) {
        db.createObjectStore('sos_reports', { keyPath: 'id' })
      }
    },
  })
}

export const db = {
  async queueSOS(report) {
    const database = await getDB()
    return database.add('sos_queue', { ...report, synced: false, createdAt: Date.now() })
  },

  async getPendingSOS() {
    const database = await getDB()
    return database.getAllFromIndex('sos_queue', 'synced', false)
  },

  async markSOSSynced(localId, serverId) {
    const database = await getDB()
    const item = await database.get('sos_queue', localId)
    if (item) await database.put('sos_queue', { ...item, synced: true, serverId })
  },

  async saveProfile(profile) {
    const database = await getDB()
    return database.put('profile', { ...profile, id: 'current' })
  },

  async getProfile() {
    const database = await getDB()
    return database.get('profile', 'current')
  },

  async cacheReports(reports) {
    const database = await getDB()
    const tx = database.transaction('sos_reports', 'readwrite')
    await Promise.all(reports.map((r) => tx.store.put(r)))
    await tx.done
  },

  async getCachedReports() {
    const database = await getDB()
    return database.getAll('sos_reports')
  },
}
