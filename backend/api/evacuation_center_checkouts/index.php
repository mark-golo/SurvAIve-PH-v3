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
    if (!empty($_GET['center_id'])) { $where[] = 'co.center_id=?'; $params[] = (int)$_GET['center_id']; }

    $sql = "SELECT co.id, co.center_id, ec.name AS center_name, co.checkin_id, co.evacuee_id,
                   co.evacuee_name, co.group_size, co.checked_out_by, co.checked_out_at, co.status
            FROM evacuation_center_checkouts co
            JOIN evacuation_centers ec ON ec.id = co.center_id"
         . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . ' ORDER BY co.checked_out_at DESC LIMIT 100';
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
            'DEPARTURE',
            $groupSize,
            $body['source'] ?? 'ADMIN',
            $body['evacuee_id'] ?? null,
            $body['checked_out_by'] ?? null,
        ]);
        $eventId = $db->lastInsertId();

        // 2. Create checkout record
        $db->prepare("
            INSERT INTO evacuation_center_checkouts
              (center_id, checkin_id, evacuee_id, evacuee_name, group_size, occupancy_event_id, checked_out_by, checked_out_at, status)
            VALUES (?,?,?,?,?,?,?,NOW(),'Confirmed')
        ")->execute([
            $centerId,
            $body['checkin_id'] ?? null,
            $body['evacuee_id']   ?? null,
            $body['evacuee_name'] ?? null,
            $groupSize,
            $eventId,
            $body['checked_out_by'] ?? null,
        ]);
        $checkoutId = $db->lastInsertId();

        // 3. Update center occupancy (floor at 0)
        $centerStmt = $db->prepare("SELECT current_occupancy, capacity FROM evacuation_centers WHERE id=?");
        $centerStmt->execute([$centerId]);
        $center = $centerStmt->fetch();
        $newOcc = max(0, ($center['current_occupancy'] ?? 0) - $groupSize);
        $capStatus = computeCapacityStatus($newOcc, $center['capacity'] ?? 0);

        $db->prepare("
            UPDATE evacuation_centers
            SET current_occupancy=?, capacity_status=?, last_occupancy_update=NOW(), occupancy_data_source='QR_SCAN'
            WHERE id=?
        ")->execute([$newOcc, $capStatus, $centerId]);

        // 4. Mark matching checkin as departed (best-effort)
        if (!empty($body['checkin_id'])) {
            $db->prepare("UPDATE evacuation_center_checkins SET status='Departed' WHERE id=?")
               ->execute([(int)$body['checkin_id']]);
        }

        $db->commit();
        jsonResponse(['id' => $checkoutId, 'event_id' => $eventId, 'new_occupancy' => $newOcc, 'capacity_status' => $capStatus], 201);
    } catch (Exception $e) {
        $db->rollBack();
        errorResponse($e->getMessage(), 500);
    }
}

errorResponse('Method not allowed', 405);
