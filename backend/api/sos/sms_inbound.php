<?php
/**
 * POST /api/sos/sms-inbound
 *
 * Receives inbound SMS emergency reports forwarded by PhilSMS as a webhook.
 * The victim's Android device sends an SMS to the provisioned PhilSMS number;
 * PhilSMS relays it here as a JSON POST.
 *
 * Always return 200 immediately so PhilSMS does not retry healthy deliveries.
 * All heavy processing happens after the acknowledgment.
 *
 * Requires PhilSMS inbound SMS / webhook capability on the account.
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../services/PhilSMSService.php';

// Read request body FIRST — php://input is a stream that becomes unavailable
// after fastcgi_finish_request() closes the FastCGI socket (Fix: moved before flush).
$rawBody = file_get_contents('php://input');

// Acknowledge before processing — PhilSMS must see 200 quickly.
http_response_code(200);
header('Content-Type: application/json');
echo json_encode(['received' => true]);

// Flush output to PhilSMS before the rest of the script runs.
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
} else {
    ob_flush(); flush();
}

// ── Rate limiting ─────────────────────────────────────────────────────────
require_once __DIR__ . '/../../middleware/RateLimit.php';
if (!checkRateLimit('sms_inbound', 200, 60, true)) {   // 200 webhook calls per minute globally — per-sender limit on line 66 handles abuse
    error_log('[sms_inbound] rate limit exceeded for ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    exit;
}

// ── Signature verification ────────────────────────────────────────────────
$signature = $_SERVER['HTTP_X_PHILSMS_SIGNATURE'] ?? $_SERVER['HTTP_X_PHILSMS_TOKEN'] ?? null;

if (!PhilSMSService::verifyWebhookSignature($rawBody, $signature)) {
    // Log the rejection but don't respond with 401 — we already sent 200.
    error_log('[sms_inbound] webhook signature mismatch — rejected');
    exit;
}

$data = json_decode($rawBody, true);
if (!is_array($data)) exit;

// ── Extract PhilSMS inbound payload fields ────────────────────────────────
// Field names follow the common PhilSMS convention; verify against their docs.
$senderNumber   = $data['from']       ?? $data['sender']          ?? null;
$messageBody    = $data['message']    ?? $data['text']            ?? null;
$providerMsgId  = $data['message_id'] ?? $data['id']              ?? null;

if (!$senderNumber || !$messageBody) {
    error_log('[sms_inbound] missing from/message in payload');
    exit;
}

// Per-sender rate limit — prevents a single number from flooding the queue.
// Checked after sender extraction so the IP-based limit above still guards the relay server.
if (!checkRateLimit('sms_sender:' . $senderNumber, 5, 60, true)) {
    error_log('[sms_inbound] per-sender rate limit exceeded for ' . $senderNumber);
    exit;
}

// ── Parse the structured SOS message ─────────────────────────────────────
// Expected format:
//   SURVAIvePH SOS
//   ID: SVP-XXXXXXXX
//   TYPE: MEDICAL
//   STATUS: UNSAFE
//   LOC: BARANGAY, MUNICIPALITY
//   GPS: 9.8123,126.1234    (optional)
//   MSG: free text          (optional)

if (!str_contains(strtolower($messageBody), 'survaiveph sos')) {
    // Dedup: skip logging if we already processed this provider message ID
    // (PhilSMS retries delivery for non-SOS messages would otherwise create duplicate log rows).
    if ($providerMsgId) {
        try {
            $dbEarly = getDB();
            $chkEarly = $dbEarly->prepare("SELECT id FROM sms_communication_log WHERE provider_msg_id = ? LIMIT 1");
            $chkEarly->execute([$providerMsgId]);
            if ($chkEarly->fetch()) exit;
        } catch (\Throwable $e) { /* log anyway if DB unavailable */ }
    }
    try { PhilSMSService::logInbound($senderNumber, $providerMsgId, null, 'ignored_not_sos'); } catch (\Throwable) {}
    exit;
}

$lines    = array_map('trim', explode("\n", $messageBody));
$parsed   = [];

foreach ($lines as $line) {
    if (preg_match('/^ID:\s*SVP-([A-Z0-9]{8})\b/i', $line, $m)) {
        $parsed['report_id'] = 'SVP-' . strtoupper(trim($m[1]));
    } elseif (preg_match('/^TYPE:\s*(.+)/i', $line, $m)) {
        $parsed['type']      = strtolower(trim($m[1]));
    } elseif (preg_match('/^STATUS:\s*(.+)/i', $line, $m)) {
        $parsed['status']    = strtolower(trim($m[1]));
    } elseif (preg_match('/^LOC:\s*(.+)/i', $line, $m)) {
        $locParts            = array_map('trim', explode(',', $m[1], 2));
        $parsed['barangay']  = $locParts[0] ?? null;
        $parsed['municipality'] = $locParts[1] ?? null;
    } elseif (preg_match('/^GPS:\s*([\-\d.]+),([\-\d.]+)/i', $line, $m)) {
        $lat = (float)$m[1];
        $lng = (float)$m[2];
        if ($lat >= -90.0 && $lat <= 90.0 && $lng >= -180.0 && $lng <= 180.0) {
            $parsed['lat'] = $lat;
            $parsed['lng'] = $lng;
        }
    } elseif (preg_match('/^MSG:\s*(.+)/i', $line, $m)) {
        $parsed['notes']     = trim($m[1]);
    }
}

// ── Map TYPE to service_type ──────────────────────────────────────────────
$typeMap = [
    'mdrrmo'   => 'mdrrmo',
    'disaster' => 'mdrrmo',
    'medical'  => 'hospital',
    'hospital' => 'hospital',
    'fire'     => 'bfp',
    'bfp'      => 'bfp',
    'crime'    => 'pnp',
    'security' => 'pnp',
    'pnp'      => 'pnp',
    'maritime' => 'pcg',
    'pcg'      => 'pcg',
];
$svcType    = $typeMap[$parsed['type'] ?? ''] ?? 'mdrrmo';
$statusMap  = ['unsafe' => 'trapped', 'safe' => 'safe', 'trapped' => 'trapped',
               'injured' => 'injured', 'missing' => 'missing'];
$statusVal  = $statusMap[strtolower($parsed['status'] ?? '')] ?? 'unknown';

// mesh_packet_id is derived from the SVP- token so the record can be deduped
// if the victim later syncs the same report over the internet.
// Regex now enforces exactly 8 chars so no truncation needed; just uppercase the full token.
$meshPacketId = isset($parsed['report_id']) ? strtoupper($parsed['report_id']) : null;

// ── Idempotency check + atomic INSERT ────────────────────────────────────
try {
    $db = getDB();

    // Serializable isolation prevents two concurrent webhook retries from both
    // passing the duplicate check and inserting the same report.
    $db->exec('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    $db->beginTransaction();

    if ($meshPacketId) {
        $dup = $db->prepare("SELECT id FROM sos_reports WHERE mesh_packet_id = ? LIMIT 1");
        $dup->execute([$meshPacketId]);
        if ($dup->fetch()) {
            $db->rollBack();
            try { PhilSMSService::logInbound($senderNumber, $providerMsgId, null, 'duplicate'); } catch (\Throwable) {}
            exit;
        }
        // Reverse cross-channel dedup: internet-first row stores a full UUID (e.g. 'abcd1234-e5f6-...').
        // The SMS short ID 'SVP-ABCD1234' won't match it exactly, so do a hex-prefix search.
        $shortHex = strtolower(substr(str_replace('SVP-', '', $meshPacketId), 0, 8));
        if (strlen($shortHex) === 8 && ctype_xdigit($shortHex)) {
            $dupRev = $db->prepare(
                "SELECT id FROM sos_reports
                 WHERE REPLACE(LOWER(mesh_packet_id), '-', '') LIKE ?
                   AND source_channel = 'internet' LIMIT 1"
            );
            $dupRev->execute([$shortHex . '%']);
            if ($dupRev->fetch()) {
                $db->rollBack();
                try { PhilSMSService::logInbound($senderNumber, $providerMsgId, null, 'duplicate_cross_channel'); } catch (\Throwable) {}
                exit;
            }
        }
    }

    // Also deduplicate by PhilSMS message ID.
    if ($providerMsgId) {
        // Check sos_reports (inside this SERIALIZABLE transaction), not sms_communication_log
        // which is written after commit and therefore cannot serve as the dedup anchor.
        $dupMsg = $db->prepare("SELECT id FROM sos_reports WHERE sms_provider_msg_id = ? LIMIT 1");
        $dupMsg->execute([$providerMsgId]);
        if ($dupMsg->fetch()) {
            $db->rollBack();
            try { PhilSMSService::logInbound($senderNumber, $providerMsgId, null, 'duplicate'); } catch (\Throwable) {}
            exit;
        }
    }

    // Last-resort dedup: same sender + SOS within last 60 s when both dedup IDs are absent.
    if (!$meshPacketId && !$providerMsgId) {
        $dupFallback = $db->prepare(
            "SELECT id FROM sos_reports
             WHERE source_channel = 'sms'
               AND sms_sender_number = ?
               AND timestamp >= DATE_SUB(NOW(), INTERVAL 60 SECOND)
             LIMIT 1"
        );
        $dupFallback->execute([$senderNumber]);
        if ($dupFallback->fetch()) {
            $db->rollBack();
            try { PhilSMSService::logInbound($senderNumber, $providerMsgId, null, 'duplicate_fallback'); } catch (\Throwable) {}
            exit;
        }
    }

    // ── AI priority scoring (mirrors sos/index.php logic) ─────────────────
    $score  = 50;
    if ($statusVal === 'trapped')  $score += 30;
    elseif ($statusVal === 'injured') $score += 20;
    elseif ($statusVal === 'missing') $score += 15;
    $score        = max(0, min(99, $score - 10)); // Unverified trust penalty
    $aiConfidence = 50; // SMS inbound has no keyword analysis — use neutral confidence

    $serviceTypeJson = json_encode([$svcType]);
    $notes           = substr($parsed['notes'] ?? '', 0, 500);
    $barangay        = substr($parsed['barangay'] ?? '', 0, 100);
    $municipality    = substr($parsed['municipality'] ?? '', 0, 100);

    // Capture insertion time once so MySQL and Supabase records carry the same timestamp.
    $insertTime = date('Y-m-d H:i:s');

    $stmt = $db->prepare("
        INSERT INTO sos_reports
          (name, barangay, municipality, notes, lat, lng, status, people_count,
           is_verified, trust_score, ai_priority_score, rescue_status,
           service_type, mesh_packet_id, timestamp, source_channel,
           sms_sender_number, sms_provider_msg_id,
           ai_classification, ai_confidence, ai_rules_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1,
                0, 'LOW', ?, 'pending',
                ?, ?, ?, 'sms',
                ?, ?,
                ?, ?, '1.0')
    ");
    $stmt->execute([
        'SMS Report',
        $barangay     ?: null,
        $municipality ?: null,
        $notes        ?: null,
        $parsed['lat'] ?? null,
        $parsed['lng'] ?? null,
        $statusVal,
        $score,
        $serviceTypeJson,
        $meshPacketId,
        $insertTime,
        $senderNumber,
        $providerMsgId,
        $svcType,
        $aiConfidence,
    ]);

    $newReportId = (int)$db->lastInsertId();
    $db->commit();
    try { PhilSMSService::logInbound($senderNumber, $providerMsgId, $newReportId, 'processed'); } catch (\Throwable) {}

    // ── Send acknowledgment SMS back to the victim ────────────────────────
    // Sent before the Supabase sync so the victim is not delayed by the curl timeout.
    $normalised = PhilSMSService::normalizeNumber($senderNumber);
    if ($normalised) {
        $reportIdLabel = substr($parsed['report_id'] ?? 'N/A', 0, 12);
        $ackMsg = "SurvAIve PH: Your emergency report has been received (ID: {$reportIdLabel}). "
                . "Responders have been notified. Stay safe.";
        PhilSMSService::send($normalised, $ackMsg, $newReportId);
    }

    // ── Best-effort Supabase sync ─────────────────────────────────────────
    // Mirrors the dual-write in api.js so cloud-deployed admins (Vercel) can
    // see this report without being on the XAMPP hotspot.
    // Fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in config/supabase.php.
    require_once __DIR__ . '/../../config/supabase.php';
    if (defined('SUPABASE_URL') && defined('SUPABASE_SERVICE_ROLE_KEY')
        && SUPABASE_SERVICE_ROLE_KEY !== 'replace_with_service_role_key') {
        $sbPayload = json_encode([
            'name'              => 'SMS Report',
            'barangay'          => $barangay      ?: null,
            'municipality'      => $municipality  ?: null,
            'notes'             => $notes         ?: null,
            'lat'               => $parsed['lat'] ?? null,
            'lng'               => $parsed['lng'] ?? null,
            'status'            => $statusVal,
            'people_count'      => 1,
            'is_verified'       => false,
            'trust_score'       => 'LOW',
            'ai_priority_score' => $score,
            'rescue_status'     => 'pending',
            'service_type'      => [$svcType],
            'mesh_packet_id'    => $meshPacketId,
            'source_channel'      => 'sms',
            'sms_sender_number'   => $senderNumber,
            'sms_provider_msg_id' => $providerMsgId,
            'ai_classification'   => $svcType,
            'ai_confidence'       => $aiConfidence,
            'ai_rules_version'    => '1.0',
            'timestamp'           => $insertTime,
        ]);
        $sbCh = curl_init(SUPABASE_URL . '/rest/v1/sos_reports');
        curl_setopt_array($sbCh, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $sbPayload,
            CURLOPT_TIMEOUT        => 8,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'apikey: '           . SUPABASE_SERVICE_ROLE_KEY,
                'Authorization: Bearer ' . SUPABASE_SERVICE_ROLE_KEY,
                'Prefer: return=minimal',
            ],
        ]);
        $sbResult = curl_exec($sbCh);
        $sbCode   = curl_getinfo($sbCh, CURLINFO_HTTP_CODE);
        curl_close($sbCh);
        if ($sbCode < 200 || $sbCode >= 300) {
            error_log('[sms_inbound] Supabase sync failed — HTTP ' . $sbCode . ': ' . $sbResult);
        }
    }

} catch (\Throwable $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    error_log('[sms_inbound] processing error: ' . $e->getMessage());
}
