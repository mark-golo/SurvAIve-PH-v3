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
         * Throws [org.json.JSONException] if the JSON is malformed.
         */
        fun fromJson(json: String): MeshPacket {
            val obj = JSONObject(json)
            return MeshPacket(
                id             = obj.getString("id"),
                type           = obj.getString("type"),
                payload        = obj.getString("payload"),
                originDeviceId = obj.getString("originDeviceId"),
                hopCount       = obj.optInt("hopCount", MAX_HOPS),
                timestamp      = obj.optLong("timestamp", System.currentTimeMillis()),
            )
        }
    }

    /** Serialise this packet to a JSON string for BLE/Wi-Fi transmission. */
    fun toJson(): String = JSONObject().apply {
        put("id",             id)
        put("type",           type)
        put("payload",        payload)
        put("originDeviceId", originDeviceId)
        put("hopCount",       hopCount)
        put("timestamp",      timestamp)
    }.toString()
}
