import { openDB } from 'idb'

const DB_NAME    = 'survAIve-ph'
const DB_VERSION = 2

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // ── Version 1 stores (created fresh on first install) ──────────────────────
      if (oldVersion < 1) {
        const profile = db.createObjectStore('profile', { keyPath: 'id' })    // eslint-disable-line no-unused-vars
        const reports = db.createObjectStore('sos_reports', { keyPath: 'id' }) // eslint-disable-line no-unused-vars
      }

      // ── Version 2: rebuild sos_queue with new fields; add mesh state stores ────
      if (oldVersion < 2) {
        // Recreate sos_queue with additional fields (IndexedDB cannot add indexes to
        // an existing store without deleting and recreating it).
        if (db.objectStoreNames.contains('sos_queue')) {
          db.deleteObjectStore('sos_queue')
        }
        const q = db.createObjectStore('sos_queue', { keyPath: 'localId', autoIncrement: true })
        q.createIndex('synced',        'synced',        { unique: false })
        q.createIndex('meshPacketId',  'meshPacketId',  { unique: false })
        q.createIndex('retryCount',    'retryCount',    { unique: false })

        // Persistent mesh event log — survives app restarts (max 200 rows enforced in writes)
        const evtStore = db.createObjectStore('mesh_event_log', { keyPath: 'id', autoIncrement: true })
        evtStore.createIndex('type',       'type',      { unique: false })
        evtStore.createIndex('createdAt',  'createdAt', { unique: false })

        // Small key-value store for mesh engine state (active SOS, etc.)
        db.createObjectStore('mesh_state', { keyPath: 'key' })

        // sos_reports created in v1 block above; also guard for version-1 installs
        // that may not have run the v1 block (e.g. schema was version 1 already).
        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('sos_reports')) {
          db.createObjectStore('sos_reports', { keyPath: 'id' })
        }
      }
    },
  })
}

export const db = {
  // ── SOS queue ──────────────────────────────────────────────────────────────

  async queueSOS(report) {
    const database = await getDB()
    return database.add('sos_queue', {
      ...report,
      synced:        false,
      createdAt:     Date.now(),
      retryCount:    0,
      lastAttemptAt: null,
      meshPacketId:  report.meshPacketId ?? report.mesh_packet_id ?? null,
    })
  },

  async getPendingSOS() {
    const database = await getDB()
    return database.getAllFromIndex('sos_queue', 'synced', false)
  },

  async markSOSSynced(localId, serverId) {
    const database = await getDB()
    const item = await database.get('sos_queue', localId)
    if (item) await database.put('sos_queue', { ...item, synced: true, serverId: serverId ?? null, syncedAt: Date.now() })
  },

  async addRetryCount(localId) {
    const database = await getDB()
    const item = await database.get('sos_queue', localId)
    if (item) {
      await database.put('sos_queue', {
        ...item,
        retryCount:    (item.retryCount ?? 0) + 1,
        lastAttemptAt: Date.now(),
      })
    }
  },

  async purgeSyncedSOS(olderThanMs = 7 * 24 * 60 * 60 * 1000) {
    const database = await getDB()
    const all = await database.getAll('sos_queue')
    const cutoff = Date.now() - olderThanMs
    const toDelete = all.filter(r => r.synced && (r.syncedAt ?? 0) < cutoff)
    const tx = database.transaction('sos_queue', 'readwrite')
    await Promise.all(toDelete.map(r => tx.store.delete(r.localId)))
    await tx.done
    return toDelete.length
  },

  // ── Mesh event log ─────────────────────────────────────────────────────────

  async logMeshEvent(type, data) {
    try {
      const database = await getDB()
      await database.add('mesh_event_log', { type, data, createdAt: Date.now() })
      // Cap at 200 rows — delete oldest when over limit
      const count = await database.count('mesh_event_log')
      if (count > 200) {
        const cursor = await database.transaction('mesh_event_log', 'readwrite').store.openCursor()
        if (cursor) { await cursor.delete() }
      }
    } catch {}
  },

  async getMeshEventLog(limit = 50) {
    try {
      const database = await getDB()
      const all = await database.getAll('mesh_event_log')
      // Return newest first
      return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)
    } catch {
      return []
    }
  },

  // ── Mesh engine state ───────────────────────────────────────────────────────

  async saveMeshState(key, value) {
    try {
      const database = await getDB()
      await database.put('mesh_state', { key, value, savedAt: Date.now() })
    } catch {}
  },

  async getMeshState(key) {
    try {
      const database = await getDB()
      return (await database.get('mesh_state', key))?.value ?? null
    } catch {
      return null
    }
  },

  // ── Profile and cached reports ─────────────────────────────────────────────

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
