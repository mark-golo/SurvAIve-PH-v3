<?php
/**
 * POST /api/sos/sms-status
 *
 * Receives SMS delivery status callbacks from PhilSMS.
 * Updates the sms_communication_log with the final delivery state.
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../services/PhilSMSService.php';

http_response_code(200);
header('Content-Type: application/json');
echo json_encode(['received' => true]);

if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
} else {
    ob_flush(); flush();
}

$rawBody   = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_PHILSMS_SIGNATURE'] ?? $_SERVER['HTTP_X_PHILSMS_TOKEN'] ?? null;

if (!PhilSMSService::verifyWebhookSignature($rawBody, $signature)) {
    error_log('[sms_status] webhook signature mismatch');
    exit;
}

$data = json_decode($rawBody, true);
if (!is_array($data)) exit;

// PhilSMS delivery status payload (verify field names against their docs)
$providerMsgId = $data['message_id'] ?? $data['id'] ?? null;
$status        = $data['status']     ?? $data['delivery_status'] ?? null;

if (!$providerMsgId || !$status) exit;

// Map PhilSMS status values to our internal vocabulary
$statusMap = [
    'delivered' => 'delivered',
    'failed'    => 'failed',
    'rejected'  => 'failed',
    'pending'   => 'pending',
    'sent'      => 'sent',
];
$internalStatus = $statusMap[strtolower($status)] ?? strtolower($status);

try {
    $db = getDB();
    $db->prepare("
        UPDATE sms_communication_log
           SET status = ?, updated_at = NOW()
         WHERE provider_msg_id = ?
    ")->execute([$internalStatus, $providerMsgId]);
} catch (\Throwable $e) {
    error_log('[sms_status] DB update error: ' . $e->getMessage());
}
