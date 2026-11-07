<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $where  = [];
    $params = [];
    if (!empty($_GET['center_id']))   { $where[] = 'e.center_id=?';  $params[] = (int)$_GET['center_id']; }
    if (!empty($_GET['event_type']))  { $where[] = 'e.event_type=?'; $params[] = $_GET['event_type']; }

    $sql = "SELECT e.id, e.center_id, ec.name AS center_name, e.event_type, e.quantity,
                   e.source, e.verification_status, e.evacuee_ref, e.recorded_by,
                   e.reason, e.occurred_at, e.recorded_at
            FROM evacuation_center_occupancy_events e
            JOIN evacuation_centers ec ON ec.id = e.center_id"
         . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . ' ORDER BY e.occurred_at DESC LIMIT 100';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

errorResponse('Method not allowed', 405);
