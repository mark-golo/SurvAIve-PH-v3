<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../middleware/RateLimit.php';

try {
    $db = getDB();
} catch (\Throwable $e) {
    error_log('[sos/index] DB connection failed: ' . $e->getMessage());
    http_response_code(503);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Service temporarily unavailable']);
    exit;
}
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $authUser = requireAuth(['admin', 'response_agency', 'responder']);
    $where  = ['r.removed_from_view = 0'];
    $params = [];

    if (!empty($_GET['municipality']))  { $where[] = 'r.municipality=?';  $params[] = $_GET['municipality']; }
    if (!empty($_GET['province']))      { $where[] = 'r.province=?';      $params[] = $_GET['province']; }
    if (!empty($_GET['barangay']))      { $where[] = 'r.barangay=?';      $params[] = $_GET['barangay']; }
    if (!empty($_GET['service_type']))  { $where[] = "JSON_CONTAINS(service_type, JSON_QUOTE(?), '\$')";  $params[] = $_GET['service_type']; }
    if (!empty($_GET['assigned_to'])) {
        $where[] = 'assigned_responder_id=?'; $params[] = (int)$_GET['assigned_to'];
    }

    $sql = "SELECT r.*, v.name AS victim_name, v.contact_number, v.household_count, v.vulnerabilities,
                   TIMESTAMPDIFF(MINUTE, r.timestamp, NOW()) as minutes_ago
            FROM sos_reports r LEFT JOIN victims v ON r.user_id=v.id"
         . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . ' ORDER BY r.ai_priority_score DESC, r.timestamp DESC LIMIT 200';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['vulnerabilities'] = json_decode($row['vulnerabilities'] ?? '[]');
        if (isset($row['service_type'])) {
            $row['service_type'] = json_decode($row['service_type'] ?? 'null');
        }
        $mins = (int)$row['minutes_ago'];
        $row['time_ago'] = $mins < 1 ? 'just now' : ($mins < 60 ? "{$mins}m ago" : floor($mins/60) . 'h ago');
        $score = (int)$row['ai_priority_score'];
        $row['priority'] = $score >= 80 ? 'CRITICAL' : ($score >= 60 ? 'HIGH' : ($score >= 40 ? 'MODERATE' : 'LOW'));
    }
    jsonResponse($rows);
}

if ($method === 'POST') {
    if (!checkRateLimit('sos_post', 15, 60)) {
        errorResponse('Rate limit exceeded', 429);
    }
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    $userId = null;
    $isVerified = false;
    $trustScore = 'LOW';

    // Verify auth first so unauthenticated callers cannot probe the idempotency table.
    if (str_starts_with($authHeader, 'Bearer ')) {
        $payload = verifyJWT(substr($authHeader, 7));
        if ($payload) { $userId = $payload['id']; $isVerified = true; $trustScore = 'HIGH'; }
    }

    // Idempotency: if mesh_packet_id was supplied and a record already exists, return it.
    $meshPacketId = isset($body['mesh_packet_id']) ? substr(trim($body['mesh_packet_id']), 0, 36) : null;
    if ($meshPacketId) {
        $exists = $db->prepare("SELECT id, ai_priority_score FROM sos_reports WHERE mesh_packet_id = ? LIMIT 1");
        $exists->execute([$meshPacketId]);
        $existingRow = $exists->fetch(PDO::FETCH_ASSOC);
        if (!$existingRow) {
            // Cross-channel dedup: if an SMS inbound already stored this report under its
            // SVP-{first 8 chars of UUID} short ID, treat it as the same record.
            $noHyphens = str_replace('-', '', strtoupper($meshPacketId));
            if (strlen($noHyphens) >= 8) {
                $shortId   = 'SVP-' . substr($noHyphens, 0, 8);
                $existsSms = $db->prepare(
                    "SELECT id, ai_priority_score FROM sos_reports WHERE mesh_packet_id = ? AND source_channel = 'sms' LIMIT 1"
                );
                $existsSms->execute([$shortId]);
                $existingRow = $existsSms->fetch(PDO::FETCH_ASSOC) ?: null;
            }
        }
        if ($existingRow) {
            jsonResponse(['id' => $existingRow['id'], 'ai_priority_score' => $existingRow['ai_priority_score'], 'idempotent' => true], 200);
            exit;
        }
    }

    // Fallback: device-auth victims carry an offline token that fails JWT verify.
    // Accept victim_id from the request body and look up the MySQL row instead.
    if (!$userId && !empty($body['victim_id'])) {
        $vs = $db->prepare("SELECT id FROM victims WHERE victim_id = ? LIMIT 1");
        $vs->execute([$body['victim_id']]);
        $vrow = $vs->fetch(PDO::FETCH_ASSOC);
        if ($vrow) {
            $userId     = $vrow['id'];
            $isVerified = true;
            $trustScore = 'MEDIUM';
        }
    }

    // AI priority scoring — unified heuristic
    $score    = 50;
    $status   = strtolower($body['status'] ?? '');
    $people   = max(1, (int)($body['people_count'] ?? 1));
    $ageGroup = $body['victim_age_group']   ?? 'adult';
    $conds    = $body['special_conditions'] ?? '';

    if      ($status === 'trapped')  $score += 30;
    elseif  ($status === 'injured')  $score += 20;
    elseif  ($status === 'missing')  $score += 15;
    elseif  ($status === 'stranded') $score += 10;

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
    if (in_array('needs_evacuation',    $condList)) $score += 15;

    if (!$isVerified) $score -= 10;
    $score = min(99, $score);

    // AI classification — mirrors frontend emergencyIntelligence.js / lexicon.js
    $desc    = strtolower(($body['description'] ?? '') . ' ' . ($body['notes'] ?? ''));
    $aiLexicon = [
      'mdrrmo'   => ['flood','baha','landslide','guho','earthquake','lindol','typhoon','bagyo',
                     'storm','stranded','evacuat','trapped','nakulong','rescue','sakuna','disaster',
                     'collapsed','bumagsak','nasiraan'],
      'hospital' => ['injured','nasugatan','medical','hospital','heart','stroke','unconscious',
                     'himatay','breathing','hininga','bleed','dugo','sick','maysakit','baby','anak',
                     'seizure','labor','buntis','nanghihina','hindi makagalaw'],
      'bfp'      => ['fire','sunog','burning','nasusunog','smoke','usok','flame','apoy','nagliliyab'],
      'pnp'      => ['crime','krimen','robbery','holdap','assault','threat','banta','violence',
                     'missing person','nawala','kidnap','suspicio','nagtatago','armado','droga'],
      'pcg'      => ['sea','dagat','boat','bangka','capsiz','drown','nalunod','coast','shore',
                     'maritime','vessel','ship','tubig','nalubog','nasiraan sa dagat'],
    ];
    $aiScores = ['mdrrmo' => 0, 'hospital' => 0, 'bfp' => 0, 'pnp' => 0, 'pcg' => 0];
    foreach ($aiLexicon as $type => $terms) {
      foreach ($terms as $term) {
        if ($term !== '' && str_contains($desc, $term)) $aiScores[$type]++;
      }
    }
    $reporterName = isset($body['name']) ? substr(trim($body['name']), 0, 200) : null;

    $rawTypes     = $body['service_type'] ?? [];
    $validTypes   = ['mdrrmo','hospital','bfp','pnp','pcg'];
    if (is_string($rawTypes)) $rawTypes = [$rawTypes];
    $serviceTypes    = array_values(array_filter((array)$rawTypes, fn($t) => in_array($t, $validTypes, true)));
    $serviceTypeJson = !empty($serviceTypes) ? json_encode($serviceTypes) : null;

    arsort($aiScores);
    $aiPrimary    = array_key_first($aiScores);
    $aiTopScore   = $aiScores[$aiPrimary];
    $aiTotal      = array_sum($aiScores);
    $aiConfidence = $aiTotal > 0 ? (int)round(($aiTopScore / $aiTotal) * 100) : 0;
    if ($aiTopScore === 0 && !empty($serviceTypes)) {
      $aiPrimary    = $serviceTypes[0];
      $aiConfidence = 50;
    }

    $lat = isset($body['lat']) ? (float)$body['lat'] : null;
    $lng = isset($body['lng']) ? (float)$body['lng'] : null;
    if ($lat !== null && ($lat < -90.0  || $lat >  90.0))  $lat = null;
    if ($lng !== null && ($lng < -180.0 || $lng > 180.0))  $lng = null;

    $stmt = $db->prepare("
        INSERT INTO sos_reports
          (user_id, name, barangay, municipality, province, lat, lng, status, people_count,
           victim_age_group, special_conditions, notes,
           is_verified, trust_score, ai_priority_score, rescue_status,
           service_type, mesh_packet_id, timestamp, source_channel,
           ai_classification, ai_confidence, ai_rules_version)
        VALUES (?,?,?,?,?,?,?,?,?, ?,?,?, ?,?,?,'pending', ?, ?, NOW(), 'internet', ?,?,?)
    ");
    try {
        $db->beginTransaction();
        $stmt->execute([
            $userId,
            $reporterName,
            $body['barangay']     ?? null,
            $body['municipality'] ?? null,
            $body['province']     ?? null,
            $lat,
            $lng,
            $body['status']       ?? 'unknown',
            $people,
            $ageGroup,
            $conds,
            $body['notes'] ?? $body['description'] ?? null,
            $isVerified ? 1 : 0,
            $trustScore,
            $score,
            $serviceTypeJson,
            $meshPacketId,
            $aiPrimary,
            $aiConfidence,
            '1.0',
        ]);
        $newId = (int)$db->lastInsertId();

        if ($userId) {
            $db->prepare("UPDATE victims SET status='sos_sent' WHERE id=?")->execute([$userId]);
        }
        $db->commit();
    } catch (\PDOException $e) {
        $db->rollBack();
        if (str_starts_with((string)$e->getCode(), '23') || str_contains($e->getMessage(), '1062')) {
            if ($meshPacketId) {
                $dup = $db->prepare("SELECT id, ai_priority_score FROM sos_reports WHERE mesh_packet_id = ? LIMIT 1");
                $dup->execute([$meshPacketId]);
                $dupRow = $dup->fetch(PDO::FETCH_ASSOC);
                if ($dupRow) {
                    jsonResponse(['id' => $dupRow['id'], 'ai_priority_score' => $dupRow['ai_priority_score'], 'idempotent' => true], 200);
                }
            }
        }
        error_log('[sos/index] INSERT transaction failed: ' . $e->getMessage());
        errorResponse('Failed to save SOS report', 500);
    }

    jsonResponse(['id' => $newId, 'ai_priority_score' => $score], 201);
}

errorResponse('Method not allowed', 405);
