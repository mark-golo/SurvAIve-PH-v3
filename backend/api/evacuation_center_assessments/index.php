<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $where  = [];
    $params = [];
    if (!empty($_GET['center_id'])) { $where[] = 'center_id=?'; $params[] = (int)$_GET['center_id']; }

    $sql = "SELECT id, center_id, safety_status, operational_status, accessibility_status,
                   hazard_report, assessment_result, assessment_source,
                   assessed_by, verified_by, assessed_at, verified_at
            FROM evacuation_center_assessments"
         . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . ' ORDER BY assessed_at DESC';
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
            INSERT INTO evacuation_center_assessments
              (center_id, safety_status, operational_status, accessibility_status,
               hazard_report, assessment_result, assessment_source, assessed_by, verified_by, verified_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        ");
        $stmt->execute([
            (int)$body['center_id'],
            $body['safety_status']        ?? 'Unverified',
            $body['operational_status']   ?? 'Operational',
            $body['accessibility_status'] ?? 'Unverified',
            $body['hazard_report']        ?? null,
            $body['assessment_result']    ?? 'Unverified',
            $body['assessment_source']    ?? null,
            $body['assessed_by']          ?? null,
            $body['verified_by']          ?? null,
            $body['verified_at']          ?? null,
        ]);
        jsonResponse(['id' => $db->lastInsertId()], 201);
    } catch (Exception $e) {
        errorResponse($e->getMessage(), 500);
    }
}

errorResponse('Method not allowed', 405);
