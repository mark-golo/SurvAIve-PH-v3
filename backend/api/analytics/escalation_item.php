<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$auth   = requireAuth('superadmin');
$id     = (int)$_GET['id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'PUT') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $db   = getDB();
    $sets = []; $params = [];
    if (array_key_exists('response_notes', $body)) { $sets[] = 'response_notes=?'; $params[] = $body['response_notes']; }
    if (array_key_exists('acknowledged',   $body)) { $sets[] = 'acknowledged=?';   $params[] = (int)$body['acknowledged']; }
    if ($sets) {
        $params[] = $id;
        $db->prepare('UPDATE escalations SET ' . implode(', ', $sets) . ' WHERE id=?')->execute($params);
    }
    jsonResponse(['success' => true]);
}
errorResponse('Method not allowed', 405);
