<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$db     = getDB();
$id     = (int)$_GET['id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare("
        SELECT ci.id, ci.center_id, ec.name AS center_name, ci.evacuee_id, ci.evacuee_name,
               ci.group_size, ci.checked_in_by, ci.checked_in_at, ci.status, ci.occupancy_event_id
        FROM evacuation_center_checkins ci
        JOIN evacuation_centers ec ON ec.id = ci.center_id
        WHERE ci.id=?
    ");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) errorResponse('Not found', 404);
    jsonResponse($row);
}

if ($method === 'PUT') {
    $body    = json_decode(file_get_contents('php://input'), true) ?? [];
    $allowed = ['status', 'evacuee_name', 'group_size'];
    $sets    = []; $params = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) { $sets[] = "$f=?"; $params[] = $body[$f]; }
    }
    if (!$sets) errorResponse('No fields to update');
    $params[] = $id;
    $db->prepare("UPDATE evacuation_center_checkins SET " . implode(', ', $sets) . " WHERE id=?")->execute($params);
    jsonResponse(['success' => true]);
}

errorResponse('Method not allowed', 405);
