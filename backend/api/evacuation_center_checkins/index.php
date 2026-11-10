<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

function computeCapacityStatus($occupancy, $capacity) {
    if ($capacity <= 0) return 'Unknown';
    $pct = ($occupancy / $capacity) * 100;
    if ($pct >= 100) return 'Full';
    if ($pct >= 90)  return 'Nearly Full';
    if ($pct >= 70)  return 'Mostly Occupied';
    return 'Not Full';
}

if ($method === 'GET') {
    $where  = [];
    $params = [];
    if (!empty($_GET['center_id']))  { $where[] = 'ci.center_id=?';  $params[] = (int)$_GET['center_id']; }
    if (!empty($_GET['status']))     { $where[] = 'ci.status=?';     $params[] = $_GET['status']; }
    if (!empty($_GET['evacuee_id'])) { $where[] = 'ci.evacuee_id=?'; $params[] = $_GET['evacuee_id']; }

    $sql = "SELECT ci.id, ci.center_id, ec.name AS center_name, ci.evacuee_id, ci.evacuee_name,
                   ci.group_size, ci.checked_in_by, ci.checked_in_at, ci.status, ci.occupancy_event_id
            FROM evacuation_center_checkins ci
            JOIN evacuation_centers ec ON ec.id = ci.center_id"
         . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . ' ORDER BY ci.checked_in_at DESC LIMIT 100';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    if (empty($body['center_id'])) errorResponse('center_id is required');

    $centerId  = (int)$body['center_id'];
    $groupSize = max(1, (int)($body['group_size'] ?? 1));

    try {
        $db->beginTransaction();

        // 1. Create occupancy event
        $db->prepare("
            INSERT INTO evacuation_center_occupancy_events
              (center_id, event_type, quantity, source, evacuee_ref, recorded_by, occurred_at, recorded_at)
            VALUES (?,?,?,?,?,?,NOW(),NOW())
        ")->execute([
            $centerId,
            'ARRIVAL',
            $groupSize,
            $body['source'] ?? 'ADMIN',
            $body['evacuee_id'] ?? null,
            $body['checked_in_by'] ?? null,
        ]);
        $eventId = $db->lastInsertId();

        // 2. Create check-in record
        $db->prepare("
            INSERT INTO evacuation_center_checkins
              (center_id, evacuee_id, evacuee_name, group_size, occupancy_event_id, checked_in_by, checked_in_at, status)
            VALUES (?,?,?,?,?,?,NOW(),'Active')
        ")->execute([
            $centerId,
            $body['evacuee_id']   ?? null,
            $body['evacuee_name'] ?? null,
            $groupSize,
            $eventId,
            $body['checked_in_by'] ?? null,
        ]);
        $checkinId = $db->lastInsertId();

        // 3. Update center occupancy
        $centerStmt = $db->prepare("SELECT current_occupancy, capacity FROM evacuation_centers WHERE id=?");
        $centerStmt->execute([$centerId]);
        $center = $centerStmt->fetch();
        $newOcc = ($center['current_occupancy'] ?? 0) + $groupSize;
        $capStatus = computeCapacityStatus($newOcc, $center['capacity'] ?? 0);

        $db->prepare("
            UPDATE evacuation_centers
            SET current_occupancy=?, capacity_status=?, last_occupancy_update=NOW(), occupancy_data_source='QR_SCAN'
            WHERE id=?
        ")->execute([$newOcc, $capStatus, $centerId]);

        $db->commit();
        jsonResponse(['id' => $checkinId, 'event_id' => $eventId, 'new_occupancy' => $newOcc, 'capacity_status' => $capStatus], 201);
    } catch (Exception $e) {
        $db->rollBack();
        errorResponse($e->getMessage(), 500);
    }
}

errorResponse('Method not allowed', 405);
