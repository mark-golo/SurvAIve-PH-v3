<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$body = json_decode(file_get_contents('php://input'), true) ?? [];

if ($method !== 'POST') errorResponse('Method not allowed', 405);

$required = ['name', 'contact_number', 'province', 'municipality', 'barangay'];
foreach ($required as $field) {
    if (empty($body[$field])) errorResponse("Field '$field' is required");
}

$db = getDB();

// Check if user already exists
$stmt = $db->prepare("SELECT id FROM victims WHERE contact_number=? OR (gmail=? AND gmail IS NOT NULL AND gmail != '')");
$stmt->execute([$body['contact_number'], $body['gmail'] ?? '']);
if ($stmt->fetch()) errorResponse('Account already exists with this contact or email', 409);

$stmt = $db->prepare("
    INSERT INTO victims (name, contact_number, gmail, province, municipality, barangay, sitio,
                         household_count, vulnerabilities, medical_conditions,
                         emergency_contact_name, emergency_contact_number, emergency_contact_relationship,
                         pin_hash, status, is_verified, trust_score)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'active',1,'HIGH')
");
$stmt->execute([
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
    password_hash($body['pin'] ?? '0000', PASSWORD_DEFAULT),
]);

$userId = $db->lastInsertId();
$token  = createJWT(['id' => $userId, 'role' => 'victim', 'name' => $body['name']]);

jsonResponse(['success' => true, 'token' => $token, 'user' => [
    'id' => $userId, 'role' => 'victim', 'name' => $body['name'],
    'barangay' => $body['barangay'], 'municipality' => $body['municipality'],
]]);
