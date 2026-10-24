package ph.survaive.app

import org.json.JSONObject
import java.util.UUID

/**
 * MeshPacket — the fundamental unit of data in the SurvAIve offline mesh network.
 *
 * Every SOS report, acknowledgement, or relay heartbeat is wrapped in a MeshPacket
 * before being transmitted over BLE GATT or Wi-Fi Direct.
 *
 * Deduplication: each device maintains a set of seen [id] values.  If the same
 * packet arrives from two different paths, only the first copy is processed and
 * forwarded — subsequent copies are silently dropped.
 *
 * TTL / hop-count: [hopCount] starts at MAX_HOPS (5).  Each relay node decrements
 * it before re-broadcasting.  A packet with hopCount == 0 is consumed locally
 * but not forwarded, preventing infinite relay loops.
 */
data class MeshPacket(
    /** UUID v4 — unique per packet, used for deduplication across the entire mesh */
    val id: String = UUID.randomUUID().toString(),

    /** Message category:
     *  "sos"    — an SOS report payload (victim → responder path)
     *  "ack"    — acknowledgement that an SOS was received by a responder
     *  "status" — periodic device heartbeat / relay advertisement
     *  "relay"  — generic data relay (future extension)
     */
    val type: String,

    /** JSON-encoded body (SOS fields, ack reference id, status stats, etc.) */
    val payload: String,

    /** Android ANDROID_ID of the device that *originated* the packet */
    val originDeviceId: String,

    /** Remaining relay hops — decremented on each forward; drop at 0 */
    var hopCount: Int = MAX_HOPS,

    /** Unix epoch milliseconds when the packet was first created */
    val timestamp: Long = System.currentTimeMillis(),
) {
    companion object {
        const val MAX_HOPS = 5

        /**
         * Deserialise a JSON string back into a MeshPacket.
         * Supports both compact wire keys (i/t/p/o/h) and legacy verbose keys for
         * backward-compat with older app versions still on the full-name format.
         */
        /**
         * Returns null if [json] is malformed or missing required fields, rather than
         * throwing JSONException. Callers must null-check before processing.
         */
        fun fromJson(json: String): MeshPacket? = try {
            val obj = JSONObject(json)
            val id             = obj.optString("i").ifEmpty { obj.optString("id") }
            val type           = obj.optString("t").ifEmpty { obj.optString("type") }
            val payload        = obj.optString("p").ifEmpty { obj.optString("payload") }
            val originDeviceId = obj.optString("o").ifEmpty { obj.optString("originDeviceId") }
            if (id.isEmpty() || type.isEmpty()) null   // required fields missing — drop
            else MeshPacket(
                id             = id,
                type           = type,
                payload        = payload.ifEmpty { "{}" },
                originDeviceId = originDeviceId.ifEmpty { "unknown" },
                hopCount       = obj.optInt("h", obj.optInt("hopCount", MAX_HOPS)).coerceIn(0, MAX_HOPS),
                timestamp      = obj.optLong("ts", obj.optLong("timestamp", System.currentTimeMillis())),
            )
        } catch (_: Exception) { null }
    }

    /**
     * Serialise to a compact JSON string for BLE/Wi-Fi transmission.
     *
     * Uses 1–2 character field names and omits the timestamp to stay well under
     * the 244-byte write limit for MTU-247 connections (the common Android BLE MTU).
     * Total wire size: SOS ~220 B, ACK ~150 B — both fit in a single ATT packet.
     */
    fun toJson(): String = JSONObject().apply {
        put("i", id)
        put("t", type)
        put("p", payload)
        put("o", originDeviceId)
        put("h", hopCount)
        put("ts", timestamp)
    }.toString()
}
