<?php
/**
 * POST /api/notifications/sms
 *
 * Sends a server-originated SMS through PhilSMS.
 * Used by admin, agency, and responder roles to notify victims or field staff.
 *
 * Body: { "recipient": "09...", "message": "...", "report_id": 123 }
 *
 * Requires a valid JWT with admin, agency, or responder role.
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../middleware/RateLimit.php';
require_once __DIR__ . '/../../services/PhilSMSService.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'POST') {
    errorResponse('Method not allowed', 405);
}

$auth = requireAuth(['admin', 'response_agency', 'responder']);

if (!checkRateLimit('sms_notify', 10, 60)) {    // 10 sends per IP per minute
    errorResponse('Rate limit exceeded. Wait before sending another SMS.', 429);
}

$body      = json_decode(file_get_contents('php://input'), true) ?? [];
$recipient = trim($body['recipient'] ?? '');
$message   = trim($body['message']   ?? '');
$reportId  = isset($body['report_id']) ? (int)$body['report_id'] : null;

if (!$recipient) errorResponse('recipient is required', 422);
if (!$message)   errorResponse('message is required',   422);

$normalised = PhilSMSService::normalizeNumber($recipient);
if (!$normalised) errorResponse('Invalid Philippine mobile number', 422);

// Basic message length guard — PhilSMS charges per segment (160 chars)
if (mb_strlen($message, 'UTF-8') > 800) errorResponse('message exceeds maximum length (800 chars)', 422);

error_log('[sms_notify] outbound SMS by user=' . ($auth['id'] ?? 'unknown')
        . ' role=' . ($auth['role'] ?? 'unknown') . ' report_id=' . $reportId);

$result = PhilSMSService::send($normalised, $message, $reportId);

if ($result['success']) {
    jsonResponse([
        'success'             => true,
        'provider_message_id' => $result['provider_message_id'],
    ], 200);
} else {
    jsonResponse([
        'success' => false,
        'error'   => $result['error'] ?? 'SMS send failed',
    ], 502);
}
