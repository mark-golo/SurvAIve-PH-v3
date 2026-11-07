<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$db     = getDB();
$id     = (int)$_GET['id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare("SELECT h.id, h.center_id, ec.name AS center_name, h.event_name, h.event_date,
                   h.previous_occupancy, h.maximum_occupancy, h.total_evacuees,
                   h.resource_summary, h.utilization_percentage, h.recorded_at
            FROM evacuation_history h
            JOIN evacuation_centers ec ON ec.id = h.center_id
            WHERE h.id=?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) errorResponse('Not found', 404);
    jsonResponse($row);
}

if ($method === 'PUT') {
    requireAuth('admin');
    $body    = json_decode(file_get_contents('php://input'), true) ?? [];
    $allowed = ['event_name', 'event_date', 'previous_occupancy', 'maximum_occupancy',
                'total_evacuees', 'utilization_percentage'];
    $sets    = [];
    $params  = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) { $sets[] = "$f=?"; $params[] = $body[$f]; }
    }
    if (array_key_exists('resource_summary', $body)) {
        $sets[]   = 'resource_summary=?';
        $params[] = json_encode($body['resource_summary']);
    }
    if (!$sets) errorResponse('No fields to update');
    $params[] = $id;
    $db->prepare("UPDATE evacuation_history SET " . implode(', ', $sets) . " WHERE id=?")->execute($params);
    jsonResponse(['success' => true]);
}

if ($method === 'DELETE') {
    requireAuth('admin');
    $db->prepare("DELETE FROM evacuation_history WHERE id=?")->execute([$id]);
    jsonResponse(['success' => true]);
}

errorResponse('Method not allowed', 405);
