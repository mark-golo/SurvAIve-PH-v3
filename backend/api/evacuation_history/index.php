<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $where  = [];
    $params = [];
    if (!empty($_GET['center_id']))   { $where[] = 'h.center_id=?';        $params[] = (int)$_GET['center_id']; }
    if (!empty($_GET['municipality'])) { $where[] = 'ec.municipality=?';    $params[] = $_GET['municipality']; }

    $sql = "SELECT h.id, h.center_id, ec.name AS center_name, h.event_name, h.event_date,
                   h.previous_occupancy, h.maximum_occupancy, h.total_evacuees,
                   h.resource_summary, h.utilization_percentage, h.recorded_at
            FROM evacuation_history h
            JOIN evacuation_centers ec ON ec.id = h.center_id"
         . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . ' ORDER BY h.event_date DESC, h.recorded_at DESC';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    requireAuth('admin');
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    if (empty($body['center_id']))  errorResponse('center_id is required');
    if (empty($body['event_name'])) errorResponse('event_name is required');
    if (empty($body['event_date'])) errorResponse('event_date is required');

    try {
        $resourceSummary = isset($body['resource_summary']) ? json_encode($body['resource_summary']) : null;
        $stmt = $db->prepare("
            INSERT INTO evacuation_history
              (center_id, event_name, event_date, previous_occupancy, maximum_occupancy,
               total_evacuees, resource_summary, utilization_percentage)
            VALUES (?,?,?,?,?,?,?,?)
        ");
        $stmt->execute([
            (int)$body['center_id'],
            $body['event_name'],
            $body['event_date'],
            $body['previous_occupancy']     ?? 0,
            $body['maximum_occupancy']      ?? 0,
            $body['total_evacuees']         ?? 0,
            $resourceSummary,
            $body['utilization_percentage'] ?? 0,
        ]);
        jsonResponse(['id' => $db->lastInsertId()], 201);
    } catch (Exception $e) {
        errorResponse($e->getMessage(), 500);
    }
}

errorResponse('Method not allowed', 405);
