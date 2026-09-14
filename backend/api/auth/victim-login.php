<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$body = json_decode(file_get_contents('php://input'), true) ?? [];

if ($method !== 'POST') errorResponse('Method not allowed', 405);

$victim_id      = trim($body['victim_id']       ?? '');
$pin            = trim($body['pin']              ?? '');
$device_key_hash = trim($body['device_key_hash'] ?? '');

if (!$victim_id || !$pin || !$device_key_hash) {
    errorResponse('victim_id, pin, and device_key_hash are required', 400);
}

$db = getDB();

// Look up victim by Victim ID
$stmt = $db->prepare("
    SELECT id, name, contact_number, province, municipality, barangay,
           pin_hash, device_key_hash AS stored_device_key_hash, status
    FROM victims
    WHERE victim_id = ?
    LIMIT 1
");
$stmt->execute([$victim_id]);
$victim = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$victim) {
    errorResponse('Invalid Victim ID or PIN', 401);
}

if ($victim['status'] !== 'active') {
    errorResponse('Account is not active. Contact your local DRRM office.', 403);
}

// Verify PIN (bcrypt)
if (!password_verify($pin, $victim['pin_hash'] ?? '')) {
    errorResponse('Invalid Victim ID or PIN', 401);
}

// Verify device key hash (constant-time compare)
if (!hash_equals($victim['stored_device_key_hash'] ?? '', $device_key_hash)) {
    errorResponse('Device not recognised. Please log in from your registered device.', 401);
}

$token = createJWT([
    'id'           => (int)$victim['id'],
    'role'         => 'victim',
    'name'         => $victim['name'],
    'victim_id'    => $victim_id,
    'municipality' => $victim['municipality'],
]);

jsonResponse([
    'token' => $token,
    'user'  => [
        'id'           => (int)$victim['id'],
        'role'         => 'victim',
        'name'         => $victim['name'],
        'victim_id'    => $victim_id,
        'contact_number' => $victim['contact_number'],
        'province'     => $victim['province'],
        'municipality' => $victim['municipality'],
        'barangay'     => $victim['barangay'],
    ],
]);
