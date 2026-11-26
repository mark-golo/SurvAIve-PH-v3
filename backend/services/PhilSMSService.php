<?php
require_once __DIR__ . '/../config/sms.php';
require_once __DIR__ . '/../config/database.php';

/**
 * Thin wrapper around the PhilSMS REST API (v3).
 *
 * Keep all network calls here so the endpoint files stay clean and the
 * gateway can be swapped later without touching emergency logic.
 *
 * Verify field names against https://app.philsms.com/api/v3/documentation
 * before going live — the structure below matches the common Philippine
 * gateway convention.
 */
class PhilSMSService
{
    // ── Outbound SMS ────────────────────────────────────────────────────────

    /**
     * Send a single SMS through the PhilSMS API.
     *
     * @param  string $recipient  Normalised Philippine number (09XXXXXXXXX)
     * @param  string $message    Plain-text message body
     * @param  int|null $reportId Optional sos_reports.id for audit logging
     * @return array{success: bool, provider_message_id: string|null, error: string|null}
     */
    public static function send(string $recipient, string $message, ?int $reportId = null): array
    {
        $recipient = self::normalizeNumber($recipient);
        if (!$recipient) {
            return ['success' => false, 'provider_message_id' => null, 'error' => 'Invalid recipient number'];
        }

        $payload = json_encode([
            'recipient' => $recipient,
            'sender_id' => PHILSMS_SENDER_ID,
            'message'   => $message,
        ]);

        $ch = curl_init(PHILSMS_API_BASE_URL . '/sms/send');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Accept: application/json',
                'Authorization: Bearer ' . PHILSMS_API_TOKEN,
            ],
        ]);

        $raw      = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        if ($curlErr) {
            self::logOutbound($recipient, $message, $reportId, null, 'curl_error', $curlErr);
            return ['success' => false, 'provider_message_id' => null, 'error' => "cURL error: $curlErr"];
        }

        $data = json_decode($raw ?: '', true);

        // PhilSMS returns 200/201 on success; response typically includes a message_id
        $providerMsgId = $data['message_id'] ?? $data['data']['message_id'] ?? null;
        if ($httpCode >= 200 && $httpCode < 300) {
            self::logOutbound($recipient, $message, $reportId, $providerMsgId, 'sent', null);
            return ['success' => true, 'provider_message_id' => $providerMsgId, 'error' => null];
        }

        $errMsg = $data['message'] ?? $data['error'] ?? "HTTP $httpCode";
        self::logOutbound($recipient, $message, $reportId, null, 'api_error', $errMsg);
        return ['success' => false, 'provider_message_id' => null, 'error' => $errMsg];
    }

    // ── Inbound webhook verification ────────────────────────────────────────

    /**
     * Verify that a webhook POST came from PhilSMS.
     *
     * PhilSMS may send an HMAC-SHA256 signature in X-PhilSMS-Signature or a
     * shared-secret token in X-PhilSMS-Token depending on account settings.
     * Extend this method to match the actual mechanism your account uses.
     */
    public static function verifyWebhookSignature(string $rawBody, ?string $signature): bool
    {
        if (empty(PHILSMS_WEBHOOK_SECRET)) {
            error_log('[PhilSMS] verifyWebhookSignature: PHILSMS_WEBHOOK_SECRET not configured — rejecting');
            return false;
        }
        if (!$signature) {
            return false;
        }
        // HMAC-SHA256 path (X-PhilSMS-Signature header)
        $expected = hash_hmac('sha256', $rawBody, PHILSMS_WEBHOOK_SECRET);
        if (hash_equals($expected, strtolower($signature))) return true;
        // Plain shared-token path (X-PhilSMS-Token header)
        return hash_equals(PHILSMS_WEBHOOK_SECRET, $signature);
    }

    // ── Number normalisation ────────────────────────────────────────────────

    /**
     * Normalise a Philippine mobile number to the 09XXXXXXXXX format.
     * Accepts: +639XXXXXXXXX, 639XXXXXXXXX, 09XXXXXXXXX, 9XXXXXXXXX
     * Returns null if the number cannot be normalised.
     */
    public static function normalizeNumber(string $raw): ?string
    {
        $digits = preg_replace('/\D/', '', $raw);
        if (!$digits) return null;

        // 0063XXXXXXXXXX (IDD trunk prefix used by older PSTN / feature phones)
        if (str_starts_with($digits, '0063') && strlen($digits) === 14) {
            $digits = '0' . substr($digits, 4);
        } elseif (str_starts_with($digits, '630') && strlen($digits) === 13) {
            // User typed +6309… (redundant 0 after country code) — strip it
            $digits = '0' . substr($digits, 3);
        } elseif (str_starts_with($digits, '63') && strlen($digits) === 12) {
            $digits = '0' . substr($digits, 2);
        } elseif (str_starts_with($digits, '9') && strlen($digits) === 10) {
            $digits = '0' . $digits;
        }

        if (preg_match('/^09\d{9}$/', $digits)) {
            return $digits;
        }
        return null;
    }

    // ── Internal audit logging ──────────────────────────────────────────────

    private static function logOutbound(
        string  $recipient,
        string  $message,
        ?int    $reportId,
        ?string $providerMsgId,
        string  $status,
        ?string $errorCode
    ): void {
        try {
            $db = getDB();
            $db->prepare("
                INSERT INTO sms_communication_log
                  (report_id, channel, direction, provider_msg_id, recipient_number, status, error_code)
                VALUES (?, 'philsms', 'outbound', ?, ?, ?, ?)
            ")->execute([$reportId, $providerMsgId, $recipient, $status, $errorCode]);
        } catch (\Throwable) { /* never break a request over a log write */ }
    }

    public static function logInbound(
        string  $senderNumber,
        ?string $providerMsgId,
        ?int    $reportId,
        string  $status
    ): void {
        try {
            $db = getDB();
            $db->prepare("
                INSERT INTO sms_communication_log
                  (report_id, channel, direction, provider_msg_id, sender_number, status)
                VALUES (?, 'philsms', 'inbound', ?, ?, ?)
            ")->execute([$reportId, $providerMsgId, $senderNumber, $status]);
        } catch (\Throwable $e) { error_log('[PhilSMSService] logInbound failed: ' . $e->getMessage()); }
    }
}
