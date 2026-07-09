<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$body    = json_decode(file_get_contents('php://input'), true) ?? [];
$contact = $body['contact_number'] ?? '';
$email   = $body['gmail'] ?? '';
$pass    = $body['password'] ?? '';

if ($method !== 'POST') errorResponse('Method not allowed', 405);

$db = getDB();

$candidates = [
  ['superadmin', "SELECT id, name, password_hash, status, province, NULL AS municipality
                  FROM superadmins WHERE (contact_number=? OR gmail=?) AND status='active' LIMIT 1"],
  ['admin',      "SELECT id, name, password_hash, status, province, municipality
                  FROM admins WHERE (contact_number=? OR gmail=?) AND status='active' LIMIT 1"],
  ['responder',  "SELECT id, name, password_hash, status, province, municipality
                  FROM responders WHERE (contact_number=? OR gmail=?) AND status='active' LIMIT 1"],
];

$user = null;
$role = null;
foreach ($candidates as [$r, $sql]) {
    $stmt = $db->prepare($sql);
    $stmt->execute([$contact, $email]);
    $row = $stmt->fetch();
    if ($row && password_verify($pass, $row['password_hash'])) {
        $user = $row;
        $role = $r;
        break;
    }
}

if (!$user) errorResponse('Invalid credentials', 401);

$token = createJWT(['id' => $user['id'], 'role' => $role, 'name' => $user['name']]);
jsonResponse(['token' => $token, 'user' => [
    'id'           => $user['id'],
    'name'         => $user['name'],
    'role'         => $role,
    'province'     => $user['province'],
    'municipality' => $user['municipality'],
]]);
