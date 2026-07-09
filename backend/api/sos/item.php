<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$db     = getDB();
$id     = (int)$_GET['id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare("SELECT r.*, v.name, v.contact_number FROM sos_reports r LEFT JOIN victims v ON r.user_id=v.id WHERE r.id=?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) errorResponse('Not found', 404);
    jsonResponse($row);
}

if ($method === 'PUT') {
    $auth = requireAuth();
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $allowed = ['rescue_status', 'assigned_responder_id', 'notes', 'status'];
    $sets    = [];
    $params  = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) { $sets[] = "$f=?"; $params[] = $body[$f]; }
    }
    if (!$sets) errorResponse('No fields to update');

    // Update user status if rescued
    if (($body['rescue_status'] ?? '') === 'rescued') {
        $stmt = $db->prepare("SELECT user_id FROM sos_reports WHERE id=?");
        $stmt->execute([$id]);
        $r = $stmt->fetch();
        if ($r['user_id']) {
            $db->prepare("UPDATE victims SET status='rescued' WHERE id=?")->execute([$r['user_id']]);
        }
    }

    $params[] = $id;
    $db->prepare("UPDATE sos_reports SET " . implode(', ', $sets) . " WHERE id=?")->execute($params);
    jsonResponse(['success' => true]);
}

errorResponse('Method not allowed', 405);
