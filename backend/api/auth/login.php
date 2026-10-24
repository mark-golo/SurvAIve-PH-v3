<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$body    = json_decode(file_get_contents('php://input'), true) ?? [];
$contact = $body['contact_number'] ?? '';
$email   = $body['gmail'] ?? '';
$pass    = $body['password'] ?? '';

if ($method !== 'POST') errorResponse('Method not allowed', 405);

$db = getDB();

$reqRole = $body['role'] ?? '';

$allCandidates = [
  'admin'           => ['admin',           "SELECT id, name, password_hash, status, province, municipality, NULL AS agency_type
                                            FROM admins WHERE (contact_number=? OR gmail=?) AND status='active' LIMIT 1"],
  'responder'       => ['responder',       "SELECT id, name, password_hash, status, province, municipality, NULL AS agency_type
                                            FROM responders WHERE (contact_number=? OR gmail=?) AND status='active' LIMIT 1"],
  'response_agency' => ['response_agency', "SELECT id, name, password_hash, status, province, municipality, agency_type
                                            FROM response_agencies WHERE (contact_number=? OR contact_number=?) AND status='active' LIMIT 1"],
];

$candidates = isset($allCandidates[$reqRole])
  ? [$allCandidates[$reqRole]]
  : array_values($allCandidates);

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

$jwtPayload = ['id' => $user['id'], 'role' => $role, 'name' => $user['name']];
if ($role === 'response_agency' && !empty($user['agency_type'])) {
    $jwtPayload['agency_type'] = $user['agency_type'];
}
$token = createJWT($jwtPayload);
jsonResponse(['token' => $token, 'user' => [
    'id'           => $user['id'],
    'name'         => $user['name'],
    'role'         => $role,
    'province'     => $user['province'],
    'municipality' => $user['municipality'],
    'agency_type'  => $user['agency_type'] ?? null,
]]);
