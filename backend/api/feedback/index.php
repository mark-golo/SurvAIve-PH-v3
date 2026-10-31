<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// ── GET ───────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $auth = requireAuth();
    $role = $auth['role'] ?? '';

    // /feedback?scope=mine  — victim sees their own submissions
    if ($role === 'victim' || (!empty($_GET['scope']) && $_GET['scope'] === 'mine')) {
        if ($role !== 'victim') {
            errorResponse('Forbidden', 403);
        }
        $stmt = $db->prepare("
            SELECT f.*, s.barangay, s.municipality, s.timestamp AS sos_date
            FROM   response_feedback f
            LEFT JOIN sos_reports s ON f.sos_id = s.id
            WHERE  f.victim_id = ?
            ORDER  BY f.created_at DESC
            LIMIT  100
        ");
        $stmt->execute([$auth['id']]);
        jsonResponse($stmt->fetchAll());
    }

    // /feedback?scope=admin  — admin reads all (municipality-scoped)
    if (in_array($role, ['admin', 'superadmin'], true)) {
        $where  = ["f.moderation_status != 'deleted'"];
        $params = [];
        if (!empty($_GET['municipality'])) { $where[] = 's.municipality=?'; $params[] = $_GET['municipality']; }
        if (!empty($_GET['target_type']))  { $where[] = 'f.target_type=?';  $params[] = $_GET['target_type']; }
        if (!empty($_GET['rating']))       { $where[] = 'f.rating=?';       $params[] = (int)$_GET['rating']; }
        if (!empty($_GET['from']))         { $where[] = 'f.created_at>=?';  $params[] = $_GET['from']; }
        if (!empty($_GET['to']))           { $where[] = 'f.created_at<=?';  $params[] = $_GET['to']; }

        $sql = "SELECT f.*,
                       s.barangay, s.municipality, s.timestamp AS sos_date,
                       v.name AS victim_name
                FROM   response_feedback f
                LEFT JOIN sos_reports s ON f.sos_id = s.id
                LEFT JOIN victims     v ON f.victim_id = v.id
                WHERE  " . implode(' AND ', $where) . "
                ORDER  BY f.created_at DESC
                LIMIT  500";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());
    }

    // /feedback?scope=agency  — agency reads feedback for their agency type
    if ($role === 'response_agency') {
        $agencyType = $auth['agency_type'] ?? null;
        if (!$agencyType) errorResponse('Agency type not set', 400);

        $stmt = $db->prepare("
            SELECT f.*, s.barangay, s.municipality, s.timestamp AS sos_date
            FROM   response_feedback f
            LEFT JOIN sos_reports s ON f.sos_id = s.id
            WHERE  f.target_type = 'agency'
              AND  f.target_id   = ?
              AND  f.moderation_status = 'visible'
            ORDER  BY f.created_at DESC
            LIMIT  200
        ");
        $stmt->execute([$agencyType]);
        jsonResponse($stmt->fetchAll());
    }

    // /feedback?scope=responder  — responder reads their own feedback
    if ($role === 'responder') {
        $stmt = $db->prepare("
            SELECT f.*, s.barangay, s.municipality, s.timestamp AS sos_date
            FROM   response_feedback f
            LEFT JOIN sos_reports s ON f.sos_id = s.id
            WHERE  f.target_type = 'responder'
              AND  f.target_id   = ?
              AND  f.moderation_status = 'visible'
            ORDER  BY f.created_at DESC
            LIMIT  100
        ");
        $stmt->execute([$auth['id']]);
        jsonResponse($stmt->fetchAll());
    }

    errorResponse('Forbidden', 403);
}

// ── POST ──────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $auth = requireAuth('victim');
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $sosId      = (int)($body['sos_id']      ?? 0);
    $targetType = $body['target_type']        ?? '';
    $targetId   = $body['target_id']          ?? '';
    $rating     = (int)($body['rating']       ?? 0);
    $comments   = isset($body['comments'])    ? substr(trim($body['comments']), 0, 2000) : null;
    $anon       = !empty($body['display_anonymously']) ? 1 : 0;

    if (!$sosId || !in_array($targetType, ['responder', 'agency'], true) || !$targetId) {
        errorResponse('Missing required fields: sos_id, target_type, target_id', 400);
    }
    if ($rating < 1 || $rating > 5) {
        errorResponse('Rating must be between 1 and 5', 400);
    }

    // Verify the SOS belongs to this victim and is rescued
    $chk = $db->prepare("SELECT id, rescue_status FROM sos_reports WHERE id=? AND user_id=? LIMIT 1");
    $chk->execute([$sosId, $auth['id']]);
    $sos = $chk->fetch(PDO::FETCH_ASSOC);
    if (!$sos) errorResponse('SOS not found or not yours', 404);
    if ($sos['rescue_status'] !== 'rescued') errorResponse('Feedback only allowed after rescue is completed', 403);

    // Prevent duplicate
    $dup = $db->prepare("
        SELECT id FROM response_feedback
        WHERE sos_id=? AND victim_id=? AND target_type=? AND target_id=? LIMIT 1
    ");
    $dup->execute([$sosId, $auth['id'], $targetType, $targetId]);
    if ($dup->fetch()) errorResponse('Feedback already submitted for this target', 409);

    $stmt = $db->prepare("
        INSERT INTO response_feedback
          (sos_id, victim_id, target_type, target_id, rating, comments, display_anonymously, moderation_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'visible', NOW())
    ");
    $stmt->execute([$sosId, $auth['id'], $targetType, $targetId, $rating, $comments, $anon]);
    $newId = $db->lastInsertId();

    jsonResponse(['id' => $newId, 'success' => true], 201);
}

errorResponse('Method not allowed', 405);
