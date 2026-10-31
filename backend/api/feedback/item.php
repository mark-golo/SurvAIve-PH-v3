<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$db     = getDB();
$id     = (int)$_GET['id'];
$method = $_SERVER['REQUEST_METHOD'];

// ── GET ───────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $auth = requireAuth();
    $role = $auth['role'] ?? '';

    $stmt = $db->prepare("
        SELECT f.*, s.barangay, s.municipality, s.timestamp AS sos_date, v.name AS victim_name
        FROM   response_feedback f
        LEFT JOIN sos_reports s ON f.sos_id = s.id
        LEFT JOIN victims     v ON f.victim_id = v.id
        WHERE  f.id = ?
        LIMIT  1
    ");
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) errorResponse('Not found', 404);

    // Victim can only read their own; staff read all
    if ($role === 'victim' && (int)$row['victim_id'] !== (int)$auth['id']) {
        errorResponse('Forbidden', 403);
    }

    jsonResponse($row);
}

// ── PUT — moderation only (admin) ─────────────────────────────────────────────
if ($method === 'PUT') {
    $auth = requireAuth();
    $role = $auth['role'] ?? '';
    if (!in_array($role, ['admin', 'superadmin'], true)) errorResponse('Forbidden', 403);

    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $status = $body['moderation_status'] ?? null;
    $reason = isset($body['moderation_reason']) ? substr(trim($body['moderation_reason']), 0, 500) : null;

    $allowed = ['visible', 'flagged', 'hidden'];
    if (!in_array($status, $allowed, true)) {
        errorResponse('moderation_status must be one of: ' . implode(', ', $allowed), 400);
    }

    // Never allow rating or comments to be updated
    $stmt = $db->prepare("
        UPDATE response_feedback
        SET    moderation_status=?, moderation_reason=?,
               moderated_by=?, moderated_at=NOW()
        WHERE  id=?
    ");
    $stmt->execute([$status, $reason, $auth['id'], $id]);

    if ($db->rowCount() === 0) errorResponse('Not found', 404);
    jsonResponse(['success' => true]);
}

errorResponse('Method not allowed', 405);
