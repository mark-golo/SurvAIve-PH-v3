<?php
require_once __DIR__ . '/../../config/database.php';

$body = json_decode(file_get_contents('php://input'), true) ?? [];

if ($method === 'POST') {
    $action = $body['action'] ?? '';

    if ($action === 'send') {
        $contact = preg_replace('/\D/', '', $body['contact'] ?? '');
        if (strlen($contact) < 10) errorResponse('Invalid contact number');
        // In production: integrate SMS gateway here
        $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        // Store OTP in session/DB for verification (simplified: store in DB)
        $db = getDB();
        $db->prepare("INSERT INTO otp_requests (contact, otp, expires_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL 10 MINUTE))
                      ON DUPLICATE KEY UPDATE otp=VALUES(otp), expires_at=VALUES(expires_at)")
           ->execute([$contact, password_hash($otp, PASSWORD_DEFAULT)]);
        // Return OTP in response for demo (production would send via SMS)
        jsonResponse(['success' => true, 'demo_otp' => $otp, 'message' => 'OTP sent']);

    } elseif ($action === 'verify') {
        $contact = preg_replace('/\D/', '', $body['contact'] ?? '');
        $otp     = $body['otp'] ?? '';
        $db      = getDB();
        $row     = $db->prepare("SELECT otp FROM otp_requests WHERE contact=? AND expires_at > NOW()")
                      ->execute([$contact]) ? $db->prepare("SELECT otp FROM otp_requests WHERE contact=? AND expires_at > NOW()") : null;
        $stmt    = $db->prepare("SELECT otp FROM otp_requests WHERE contact=? AND expires_at > NOW()");
        $stmt->execute([$contact]);
        $row = $stmt->fetch();
        if (!$row || !password_verify($otp, $row['otp'])) errorResponse('Invalid or expired OTP', 401);
        // Check if user exists
        $stmt2 = $db->prepare("SELECT id, name, status, is_verified FROM victims WHERE contact_number=?");
        $stmt2->execute([$contact]);
        $user = $stmt2->fetch();
        if ($user) {
            require_once __DIR__ . '/../../middleware/auth.php';
            $token = createJWT(['id' => $user['id'], 'role' => 'victim', 'name' => $user['name']]);
            jsonResponse(['verified' => true, 'existing_user' => true, 'token' => $token, 'user' => $user]);
        }
        jsonResponse(['verified' => true, 'existing_user' => false]);
    } else {
        errorResponse('Unknown action');
    }
}
errorResponse('Method not allowed', 405);
