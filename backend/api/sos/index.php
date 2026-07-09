<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $where  = [];
    $params = [];

    if (!empty($_GET['municipality'])) { $where[] = 'municipality=?'; $params[] = $_GET['municipality']; }
    if (!empty($_GET['province']))     { $where[] = 'province=?';     $params[] = $_GET['province']; }
    if (!empty($_GET['barangay']))     { $where[] = 'barangay=?';     $params[] = $_GET['barangay']; }
    if (!empty($_GET['assigned_to'])) {
        $auth = requireAuth('responder');
        $where[] = 'assigned_responder_id=?'; $params[] = $auth['id'];
    }

    $sql = "SELECT r.*, v.name, v.contact_number, v.household_count, v.vulnerabilities,
                   TIMESTAMPDIFF(MINUTE, r.timestamp, NOW()) as minutes_ago
            FROM sos_reports r LEFT JOIN victims v ON r.user_id=v.id"
         . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . ' ORDER BY r.ai_priority_score DESC, r.timestamp DESC LIMIT 200';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['vulnerabilities'] = json_decode($row['vulnerabilities'] ?? '[]');
        $mins = (int)$row['minutes_ago'];
        $row['time_ago'] = $mins < 1 ? 'just now' : ($mins < 60 ? "{$mins}m ago" : floor($mins/60) . 'h ago');
        $score = (int)$row['ai_priority_score'];
        $row['priority'] = $score >= 80 ? 'CRITICAL' : ($score >= 60 ? 'HIGH' : ($score >= 40 ? 'MODERATE' : 'LOW'));
    }
    jsonResponse($rows);
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    $userId = null;
    $isVerified = false;
    $trustScore = 'LOW';

    if (str_starts_with($authHeader, 'Bearer ')) {
        $payload = verifyJWT(substr($authHeader, 7));
        if ($payload) { $userId = $payload['id']; $isVerified = true; $trustScore = 'HIGH'; }
    }

    // AI priority scoring (simple heuristic)
    $score = 50;
    $status = strtolower($body['status'] ?? '');
    if ($status === 'trapped')  $score += 30;
    if ($status === 'injured')  $score += 20;
    $people = (int)($body['people_count'] ?? 1);
    if ($people >= 5)  $score += 15;
    if ($people >= 10) $score += 10;
    if (!$isVerified)  $score -= 10;

    $stmt = $db->prepare("
        INSERT INTO sos_reports
          (user_id, barangay, municipality, province, lat, lng, status, people_count, notes,
           is_verified, trust_score, ai_priority_score, rescue_status, timestamp)
        VALUES (?,?,?,?,?,?,?,?,?, ?,?,?,'pending', NOW())
    ");
    $stmt->execute([
        $userId,
        $body['barangay']     ?? null,
        $body['municipality'] ?? null,
        $body['province']     ?? null,
        $body['lat']          ?? null,
        $body['lng']          ?? null,
        $body['status']       ?? 'unknown',
        $people,
        $body['notes']        ?? null,
        $isVerified ? 1 : 0,
        $trustScore,
        min(100, $score),
    ]);

    if ($userId) {
        $db->prepare("UPDATE victims SET status='sos_sent' WHERE id=?")->execute([$userId]);
    }

    jsonResponse(['id' => $db->lastInsertId(), 'ai_priority_score' => min(100, $score)], 201);
}

errorResponse('Method not allowed', 405);
