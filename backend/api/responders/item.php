<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$db     = getDB();
$id     = (int)$_GET['id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    requireAuth();
    $stmt = $db->prepare("SELECT id, name, contact_number, gmail, province, municipality, barangay,
                                 status, team_id, unit_name, assigned_zone, assigned_barangay,
                                 duty_status, active_mesh_relay, created_at
                          FROM responders WHERE id=?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) errorResponse('Not found', 404);
    jsonResponse($row);
}

if ($method === 'PUT') {
    $auth    = requireAuth('admin');
    $body    = json_decode(file_get_contents('php://input'), true) ?? [];
    $allowed = ['name', 'contact_number', 'gmail', 'province', 'municipality', 'barangay',
                'status', 'team_id', 'unit_name', 'assigned_zone', 'assigned_barangay',
                'duty_status', 'active_mesh_relay'];
    $sets    = [];
    $params  = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) { $sets[] = "$f=?"; $params[] = $body[$f]; }
    }
    if (!empty($body['password'])) {
        $sets[]   = 'password_hash=?';
        $params[] = password_hash($body['password'], PASSWORD_DEFAULT);
    }
    if (!$sets) errorResponse('No fields to update');
    $params[] = $id;
    $db->prepare("UPDATE responders SET " . implode(', ', $sets) . " WHERE id=?")->execute($params);
    jsonResponse(['success' => true]);
}

if ($method === 'DELETE') {
    requireAuth('admin');
    $db->prepare("DELETE FROM responders WHERE id=?")->execute([$id]);
    jsonResponse(['success' => true]);
}

errorResponse('Method not allowed', 405);
