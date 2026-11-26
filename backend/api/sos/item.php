<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

try {
    $db = getDB();
} catch (\Throwable $e) {
    error_log('[sos/item] DB connection failed: ' . $e->getMessage());
    http_response_code(503);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Service temporarily unavailable']);
    exit;
}
$id     = (int)$_GET['id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    requireAuth(['admin', 'response_agency', 'responder']);
    $stmt = $db->prepare("SELECT r.*, v.name AS victim_name, v.contact_number FROM sos_reports r LEFT JOIN victims v ON r.user_id=v.id WHERE r.id=?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) errorResponse('Not found', 404);
    jsonResponse($row);
}

if ($method === 'PUT') {
    $auth = requireAuth(['admin', 'response_agency', 'responder']);
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $responderFields = ['rescue_status', 'notes', 'confirmed_by_name', 'confirmed_at'];
    $agencyFields    = array_merge($responderFields, [
        'assigned_responder_id', 'dismissed', 'flagged', 'removed_from_view',
        'ai_review_status', 'ai_review_note', 'ai_reviewed_by', 'ai_reviewed_at',
        'status', 'confirmed_by_role',
    ]);
    $allowed = ($auth['role'] === 'responder') ? $responderFields : $agencyFields;
    $sets    = [];
    $params  = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) { $sets[] = "$f=?"; $params[] = $body[$f]; }
    }
    if (!$sets) errorResponse('No fields to update');

    try {
        $db->beginTransaction();

        // Update user status if rescued (must happen before the sos_reports UPDATE in same transaction)
        if (($body['rescue_status'] ?? '') === 'rescued') {
            $stmt = $db->prepare("SELECT user_id FROM sos_reports WHERE id=?");
            $stmt->execute([$id]);
            $r = $stmt->fetch();
            if ($r && $r['user_id']) {
                $db->prepare("UPDATE victims SET status='rescued' WHERE id=?")->execute([$r['user_id']]);
            }
        }

        $params[] = $id;
        $updateStmt = $db->prepare("UPDATE sos_reports SET " . implode(', ', $sets) . " WHERE id=?");
        $updateStmt->execute($params);

        if ($updateStmt->rowCount() === 0) {
            $db->rollBack();
            errorResponse('Not found', 404);
        }

        $db->commit();
        jsonResponse(['success' => true]);
    } catch (\PDOException $e) {
        if ($db->inTransaction()) $db->rollBack();
        error_log('[sos/item] PUT failed: ' . $e->getMessage());
        errorResponse('Database error', 500);
    }
}

errorResponse('Method not allowed', 405);
