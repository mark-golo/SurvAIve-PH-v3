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

// ── Signature verification ────────────────────────────────────────────────
$rawBody   = file_get_contents('php://input');
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
    // Not a SurvAIve PH emergency message — ignore silently.
    PhilSMSService::logInbound($senderNumber, $providerMsgId, null, 'ignored_not_sos');
    exit;
}

$lines    = array_map('trim', explode("\n", $messageBody));
$parsed   = [];

foreach ($lines as $line) {
    if (preg_match('/^ID:\s*SVP-([A-Z0-9\-]+)/i', $line, $m)) {
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
        $parsed['lat']       = (float)$m[1];
        $parsed['lng']       = (float)$m[2];
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
$meshPacketId = isset($parsed['report_id'])
    ? substr(preg_replace('/[^A-Z0-9]/', '', strtoupper($parsed['report_id'])), 0, 36)
    : null;

// ── Idempotency check ─────────────────────────────────────────────────────
try {
    $db = getDB();

    if ($meshPacketId) {
        $dup = $db->prepare("SELECT id FROM sos_reports WHERE mesh_packet_id = ? LIMIT 1");
        $dup->execute([$meshPacketId]);
        if ($dup->fetch()) {
            PhilSMSService::logInbound($senderNumber, $providerMsgId, null, 'duplicate');
            exit;
        }
    }

    // Also deduplicate by PhilSMS message ID.
    if ($providerMsgId) {
        $dupMsg = $db->prepare("SELECT id FROM sms_communication_log WHERE provider_msg_id = ? LIMIT 1");
        $dupMsg->execute([$providerMsgId]);
        if ($dupMsg->fetch()) {
            exit;
        }
    }

    // ── AI priority scoring (mirrors sos/index.php logic) ─────────────────
    $score  = 50;
    $people = 1;
    if ($statusVal === 'trapped')  $score += 30;
    elseif ($statusVal === 'injured') $score += 20;
    elseif ($statusVal === 'missing') $score += 15;
    $score  = min(99, $score - 10); // Unverified trust penalty

    $serviceTypeJson = json_encode([$svcType]);
    $notes           = substr($parsed['notes'] ?? '', 0, 500);
    $barangay        = substr($parsed['barangay'] ?? '', 0, 100);
    $municipality    = substr($parsed['municipality'] ?? '', 0, 100);

    $stmt = $db->prepare("
        INSERT INTO sos_reports
          (name, barangay, municipality, lat, lng, status, people_count,
           is_verified, trust_score, ai_priority_score, rescue_status,
           service_type, mesh_packet_id, timestamp, source_channel,
           sms_sender_number, sms_provider_msg_id,
           ai_classification, ai_confidence, ai_rules_version)
        VALUES (?, ?, ?, ?, ?, ?, 1,
                0, 'LOW', ?, 'pending',
                ?, ?, NOW(), 'sms',
                ?, ?,
                ?, 50, '1.0')
    ");
    $stmt->execute([
        'SMS Report',
        $barangay   ?: null,
        $municipality ?: null,
        $parsed['lat'] ?? null,
        $parsed['lng'] ?? null,
        $statusVal,
        $score,
        $serviceTypeJson,
        $meshPacketId,
        $senderNumber,
        $providerMsgId,
        $svcType,
    ]);

    $newReportId = (int)$db->lastInsertId();

    PhilSMSService::logInbound($senderNumber, $providerMsgId, $newReportId, 'processed');

    // ── Send acknowledgment SMS back to the victim ────────────────────────
    $normalised = PhilSMSService::normalizeNumber($senderNumber);
    if ($normalised) {
        $ackMsg = "SurvAIve PH: Your emergency report has been received (ID: {$parsed['report_id']}). "
                . "Responders have been notified. Stay safe.";
        PhilSMSService::send($normalised, $ackMsg, $newReportId);
    }

} catch (\Throwable $e) {
    error_log('[sms_inbound] processing error: ' . $e->getMessage());
}
