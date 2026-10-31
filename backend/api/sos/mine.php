<?php
// GET /sos/mine — returns only the authenticated victim's own SOS records.
// Identity is resolved from the JWT, never from a client-supplied param.
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    errorResponse('Method not allowed', 405);
}

$auth = requireAuth('victim');
$db   = getDB();

$stmt = $db->prepare("
    SELECT r.*,
           TIMESTAMPDIFF(MINUTE, r.timestamp, NOW()) AS minutes_ago
    FROM   sos_reports r
    WHERE  r.user_id = ?
    ORDER  BY r.timestamp DESC
    LIMIT  100
");
$stmt->execute([$auth['id']]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($rows as &$row) {
    if (isset($row['service_type'])) {
        $row['service_type'] = json_decode($row['service_type'] ?? 'null');
    }
    $mins = (int)($row['minutes_ago'] ?? 0);
    $row['time_ago'] = $mins < 1 ? 'just now' : ($mins < 60 ? "{$mins}m ago" : floor($mins / 60) . 'h ago');
    $score = (int)($row['ai_priority_score'] ?? 0);
    $row['priority'] = $score >= 80 ? 'CRITICAL' : ($score >= 60 ? 'HIGH' : ($score >= 40 ? 'MODERATE' : 'LOW'));
}

jsonResponse($rows);
