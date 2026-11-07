<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $where  = [];
    $params = [];
    if (!empty($_GET['center_id'])) { $where[] = 'center_id=?'; $params[] = (int)$_GET['center_id']; }

    $sql = "SELECT id, center_id, resource_name, quantity_available, unit, availability_status, last_updated_at
            FROM evacuation_center_resources"
         . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . ' ORDER BY resource_name ASC';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    requireAuth('admin');
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    if (empty($body['center_id']))     errorResponse('center_id is required');
    if (empty($body['resource_name'])) errorResponse('resource_name is required');

    try {
        $stmt = $db->prepare("
            INSERT INTO evacuation_center_resources
              (center_id, resource_name, quantity_available, unit, availability_status)
            VALUES (?,?,?,?,?)
        ");
        $stmt->execute([
            (int)$body['center_id'],
            $body['resource_name'],
            $body['quantity_available']  ?? 0,
            $body['unit']               ?? 'units',
            $body['availability_status'] ?? 'Available',
        ]);
        jsonResponse(['id' => $db->lastInsertId()], 201);
    } catch (Exception $e) {
        errorResponse($e->getMessage(), 500);
    }
}

errorResponse('Method not allowed', 405);
