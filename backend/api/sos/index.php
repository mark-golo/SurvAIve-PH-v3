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

    // AI priority scoring — unified heuristic
    $score    = 50;
    $status   = strtolower($body['status'] ?? '');
    $people   = (int)($body['people_count'] ?? 1);
    $ageGroup = $body['victim_age_group']   ?? 'adult';
    $conds    = $body['special_conditions'] ?? '';

    if      ($status === 'trapped') $score += 30;
    elseif  ($status === 'injured') $score += 20;
    elseif  ($status === 'missing') $score += 15;

    if      ($people >= 10) $score += 25;
    elseif  ($people >= 5)  $score += 15;
    elseif  ($people >= 2)  $score += 5;

    if      ($ageGroup === 'senior') $score += 20;
    elseif  ($ageGroup === 'child')  $score += 15;

    $condList = array_filter(explode(',', $conds));
    if (in_array('medical_emergency',   $condList)) $score += 20;
    if (in_array('fire',                $condList)) $score += 15;
    if (in_array('structural_collapse', $condList)) $score += 10;
    if (in_array('flooding',            $condList)) $score += 10;

    if (!$isVerified) $score -= 10;
    $score = min(99, $score);

    $stmt = $db->prepare("
        INSERT INTO sos_reports
          (user_id, barangay, municipality, province, lat, lng, status, people_count,
           victim_age_group, special_conditions, notes,
           is_verified, trust_score, ai_priority_score, rescue_status, timestamp)
        VALUES (?,?,?,?,?,?,?,?, ?,?,?, ?,?,?,'pending', NOW())
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
        $ageGroup,
        $conds,
        $body['notes']        ?? null,
        $isVerified ? 1 : 0,
        $trustScore,
        $score,
    ]);

    if ($userId) {
        $db->prepare("UPDATE victims SET status='sos_sent' WHERE id=?")->execute([$userId]);
    }

    jsonResponse(['id' => $db->lastInsertId(), 'ai_priority_score' => $score], 201);
}

errorResponse('Method not allowed', 405);
