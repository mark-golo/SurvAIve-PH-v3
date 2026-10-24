<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

// Any authenticated role can manage their own profile
$payload = requireAuth();
$db      = getDB();
$method  = $_SERVER['REQUEST_METHOD'];

$tableMap = [
    'admin'           => 'admins',
    'superadmin'      => 'superadmins',
    'responder'       => 'responders',
    'response_agency' => 'response_agencies',
    'victim'          => 'victims',
];

$role  = $payload['role'] ?? '';
$id    = (int)($payload['id'] ?? 0);
$table = $tableMap[$role] ?? null;

if (!$table || !$id) errorResponse('Unknown role', 403);

if ($method === 'GET') {
    $stmt = $db->prepare("SELECT id, name, contact_number FROM $table WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) errorResponse('Not found', 404);
    jsonResponse($row);
}

if ($method === 'PUT') {
    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $sets   = [];
    $params = [];

    // Name change
    if (isset($body['name']) && $body['name'] !== '') {
        $name = trim($body['name']);
        if (strlen($name) < 2 || strlen($name) > 200)
            errorResponse('Name must be 2–200 characters', 400);
        $sets[]   = 'name = ?';
        $params[] = $name;
    }

    // Password / PIN change
    if (!empty($body['new_password'])) {
        if (empty($body['current_password']))
            errorResponse('Current password is required', 400);

        $pwCol = ($role === 'victim') ? 'pin_hash' : 'password_hash';
        $stmt  = $db->prepare("SELECT $pwCol FROM $table WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) errorResponse('Account not found', 404);

        if (!password_verify($body['current_password'], $row[$pwCol] ?? ''))
            errorResponse('Current password is incorrect', 400);

        $minLen = ($role === 'victim') ? 4 : 8;
        if (strlen($body['new_password']) < $minLen)
            errorResponse(($role === 'victim' ? 'PIN' : 'Password')
                . " must be at least $minLen characters", 400);

        $sets[]   = "$pwCol = ?";
        $params[] = password_hash($body['new_password'], PASSWORD_DEFAULT);
    }

    if (empty($sets)) errorResponse('Nothing to update', 400);

    $params[] = $id;
    $db->prepare('UPDATE ' . $table . ' SET ' . implode(', ', $sets) . ' WHERE id = ?')
       ->execute($params);

    jsonResponse(['ok' => true, 'name' => $body['name'] ?? null]);
}

errorResponse('Method not allowed', 405);
