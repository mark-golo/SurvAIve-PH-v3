<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$db     = getDB();
$id     = (int)$_GET['id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare("SELECT id, name, province, municipality, barangay, address, lat, lng, capacity, contact_number, status, created_at FROM evacuation_centers WHERE id=?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) errorResponse('Not found', 404);
    jsonResponse($row);
}

if ($method === 'PUT') {
    requireAuth('admin');
    $body    = json_decode(file_get_contents('php://input'), true) ?? [];
    $allowed = ['name', 'province', 'municipality', 'barangay', 'address', 'lat', 'lng', 'capacity', 'contact_number', 'status'];
    $sets    = [];
    $params  = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) { $sets[] = "$f=?"; $params[] = $body[$f]; }
    }
    if (!$sets) errorResponse('No fields to update');
    $params[] = $id;
    $db->prepare("UPDATE evacuation_centers SET " . implode(', ', $sets) . " WHERE id=?")->execute($params);
    jsonResponse(['success' => true]);
}

if ($method === 'DELETE') {
    requireAuth('admin');
    $db->prepare("DELETE FROM evacuation_centers WHERE id=?")->execute([$id]);
    jsonResponse(['success' => true]);
}

errorResponse('Method not allowed', 405);
