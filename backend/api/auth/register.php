<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$body = json_decode(file_get_contents('php://input'), true) ?? [];

if ($method !== 'POST') errorResponse('Method not allowed', 405);

$required = ['name', 'contact_number', 'province', 'municipality', 'barangay'];
foreach ($required as $field) {
    if (empty($body[$field])) errorResponse("Field '$field' is required");
}

// PIN is required for device-bound registration
$pin    = (string)($body['pin'] ?? '');
$victimId = trim($body['victim_id'] ?? '');
$deviceKeyHash = trim($body['device_key_hash'] ?? '');
$pinSalt = trim($body['pin_salt'] ?? '');

if (strlen($pin) < 4) errorResponse("Field 'pin' is required (4–6 digits)");

$db = getDB();

// Check for duplicate contact / email
$stmt = $db->prepare("SELECT id FROM victims WHERE contact_number=? OR (gmail=? AND gmail IS NOT NULL AND gmail != '')");
$stmt->execute([$body['contact_number'], $body['gmail'] ?? '']);
if ($stmt->fetch()) errorResponse('Account already exists with this contact or email', 409);

// Check for duplicate victim_id (should be globally unique)
if ($victimId) {
    $stmt = $db->prepare("SELECT id FROM victims WHERE victim_id=?");
    $stmt->execute([$victimId]);
    if ($stmt->fetch()) errorResponse('Victim ID collision — please retry registration', 409);
}

$pinHash = password_hash($pin, PASSWORD_DEFAULT);

$stmt = $db->prepare("
    INSERT INTO victims (
        victim_id, name, contact_number, gmail,
        province, municipality, barangay, sitio,
        household_count, vulnerabilities, medical_conditions,
        emergency_contact_name, emergency_contact_number, emergency_contact_relationship,
        pin_hash, device_key_hash, pin_salt,
        status, is_verified, trust_score
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'active',1,'HIGH')
");
$stmt->execute([
    $victimId ?: null,
    $body['name'],
    $body['contact_number'],
    $body['gmail'] ?? null,
    $body['province'],
    $body['municipality'],
    $body['barangay'],
    $body['sitio'] ?? null,
    (int)($body['household_count'] ?? 1),
    json_encode($body['vulnerabilities'] ?? []),
    $body['medical_conditions'] ?? null,
    $body['emergency_contact_name'] ?? null,
    $body['emergency_contact_number'] ?? null,
    $body['emergency_contact_relationship'] ?? null,
    $pinHash,
    $deviceKeyHash ?: null,
    $pinSalt ?: null,
]);

$userId = $db->lastInsertId();
$token  = createJWT([
    'id'        => (int)$userId,
    'role'      => 'victim',
    'name'      => $body['name'],
    'victim_id' => $victimId ?: null,
]);

jsonResponse(['success' => true, 'token' => $token, 'user' => [
    'id'           => (int)$userId,
    'role'         => 'victim',
    'name'         => $body['name'],
    'victim_id'    => $victimId ?: null,
    'contact_number' => $body['contact_number'],
    'barangay'     => $body['barangay'],
    'municipality' => $body['municipality'],
    'province'     => $body['province'],
]]);
