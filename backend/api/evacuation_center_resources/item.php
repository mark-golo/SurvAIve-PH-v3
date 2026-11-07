<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$db     = getDB();
$id     = (int)$_GET['id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare("SELECT id, center_id, resource_name, quantity_available, unit, availability_status, last_updated_at
            FROM evacuation_center_resources WHERE id=?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) errorResponse('Not found', 404);
    jsonResponse($row);
}

if ($method === 'PUT') {
    requireAuth('admin');
    $body    = json_decode(file_get_contents('php://input'), true) ?? [];
    $allowed = ['resource_name', 'quantity_available', 'unit', 'availability_status'];
    $sets    = [];
    $params  = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) { $sets[] = "$f=?"; $params[] = $body[$f]; }
    }
    if (!$sets) errorResponse('No fields to update');
    $params[] = $id;
    $db->prepare("UPDATE evacuation_center_resources SET " . implode(', ', $sets) . " WHERE id=?")->execute($params);
    jsonResponse(['success' => true]);
}

if ($method === 'DELETE') {
    requireAuth('admin');
    $db->prepare("DELETE FROM evacuation_center_resources WHERE id=?")->execute([$id]);
    jsonResponse(['success' => true]);
}

errorResponse('Method not allowed', 405);
