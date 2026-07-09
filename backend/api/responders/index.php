<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Responder fetching own profile
    if (!empty($_GET['me'])) {
        $auth = requireAuth('responder');
        $stmt = $db->prepare("SELECT * FROM responders WHERE id=?");
        $stmt->execute([$auth['id']]);
        jsonResponse($stmt->fetch() ?: []);
    }

    $auth   = requireAuth();
    $where  = [];
    $params = [];
    if (!empty($_GET['municipality'])) { $where[] = 'municipality=?'; $params[] = $_GET['municipality']; }

    $sql = "SELECT id, name, municipality, team_id, unit_name, assigned_zone,
                   assigned_barangay, duty_status, active_mesh_relay
            FROM responders"
         . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . ' ORDER BY duty_status DESC';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'PUT') {
    // Responder updates own duty/relay/zone
    $auth    = requireAuth('responder');
    $body    = json_decode(file_get_contents('php://input'), true) ?? [];
    $allowed = ['duty_status', 'active_mesh_relay', 'assigned_zone', 'assigned_barangay'];
    $sets    = [];
    $params  = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) { $sets[] = "$f=?"; $params[] = $body[$f]; }
    }
    if ($sets) {
        $params[] = $auth['id'];
        $db->prepare("UPDATE responders SET " . implode(', ', $sets) . " WHERE id=?")->execute($params);
    }
    jsonResponse(['success' => true]);
}

if ($method === 'POST') {
    // Admin creates a new responder account
    $auth = requireAuth('admin');
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    if (empty($body['name']))     errorResponse('name is required');
    if (empty($body['password'])) errorResponse('password is required');

    $stmt = $db->prepare("
        INSERT INTO responders
          (name, contact_number, gmail, province, municipality, barangay, password_hash, status,
           team_id, unit_name, assigned_zone, assigned_barangay, duty_status, active_mesh_relay)
        VALUES (?,?,?,?,?,?,?,'active', ?,?,?,?,'standby',0)
    ");
    $stmt->execute([
        $body['name'],
        $body['contact_number'] ?? null,
        $body['gmail']          ?? null,
        $body['province']       ?? null,
        $body['municipality']   ?? null,
        $body['barangay']       ?? null,
        password_hash($body['password'], PASSWORD_DEFAULT),
        $body['team_id']        ?? null,
        $body['unit_name']      ?? null,
        $body['assigned_zone']  ?? null,
        $body['assigned_barangay'] ?? null,
    ]);
    jsonResponse(['id' => $db->lastInsertId()], 201);
}

errorResponse('Method not allowed', 405);
