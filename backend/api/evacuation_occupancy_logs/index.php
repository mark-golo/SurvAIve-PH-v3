<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $where  = [];
    $params = [];
    if (!empty($_GET['center_id'])) { $where[] = 'center_id=?'; $params[] = (int)$_GET['center_id']; }

    $sql = "SELECT id, center_id, previous_occupancy, updated_occupancy, maximum_capacity,
                   available_spaces, updated_by_role, recorded_at
            FROM evacuation_occupancy_logs"
         . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . ' ORDER BY recorded_at DESC LIMIT 100';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    requireAuth('admin');
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    if (empty($body['center_id'])) errorResponse('center_id is required');

    try {
        $stmt = $db->prepare("
            INSERT INTO evacuation_occupancy_logs
              (center_id, previous_occupancy, updated_occupancy, maximum_capacity,
               available_spaces, updated_by_role)
            VALUES (?,?,?,?,?,?)
        ");
        $stmt->execute([
            (int)$body['center_id'],
            $body['previous_occupancy'] ?? 0,
            $body['updated_occupancy']  ?? 0,
            $body['maximum_capacity']   ?? 0,
            $body['available_spaces']   ?? 0,
            $body['updated_by_role']    ?? null,
        ]);
        jsonResponse(['id' => $db->lastInsertId()], 201);
    } catch (Exception $e) {
        errorResponse($e->getMessage(), 500);
    }
}

errorResponse('Method not allowed', 405);
