<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $where  = [];
    $params = [];
    if (!empty($_GET['center_id'])) { $where[] = 'center_id=?'; $params[] = (int)$_GET['center_id']; }

    $sql = "SELECT id, center_id, current_occupancy, projected_incoming, projected_occupancy,
                   maximum_capacity, projected_remaining, forecast_status, forecast_method, generated_at
            FROM evacuation_capacity_forecasts"
         . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . ' ORDER BY generated_at DESC LIMIT 50';
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
            INSERT INTO evacuation_capacity_forecasts
              (center_id, current_occupancy, projected_incoming, projected_occupancy,
               maximum_capacity, projected_remaining, forecast_status, forecast_method)
            VALUES (?,?,?,?,?,?,?,?)
        ");
        $stmt->execute([
            (int)$body['center_id'],
            $body['current_occupancy']   ?? 0,
            $body['projected_incoming']  ?? 0,
            $body['projected_occupancy'] ?? 0,
            $body['maximum_capacity']    ?? 0,
            $body['projected_remaining'] ?? 0,
            $body['forecast_status']     ?? 'Can Accommodate',
            $body['forecast_method']     ?? 'deterministic',
        ]);
        jsonResponse(['id' => $db->lastInsertId()], 201);
    } catch (Exception $e) {
        errorResponse($e->getMessage(), 500);
    }
}

errorResponse('Method not allowed', 405);
