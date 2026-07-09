<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$auth   = requireAuth('superadmin');
$db     = getDB();
$id     = (int)$_GET['id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare("SELECT id, name, contact_number, gmail, province, status, is_verified, created_at FROM superadmins WHERE id=?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) errorResponse('Not found', 404);
    jsonResponse($row);
}

if ($method === 'PUT') {
    $body    = json_decode(file_get_contents('php://input'), true) ?? [];
    $allowed = ['name', 'contact_number', 'gmail', 'province', 'status'];
    $sets    = [];
    $params  = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) { $sets[] = "$f=?"; $params[] = $body[$f]; }
    }
    if (!empty($body['password'])) {
        $sets[]   = 'password_hash=?';
        $params[] = password_hash($body['password'], PASSWORD_DEFAULT);
    }
    if (!$sets) errorResponse('No fields to update');
    $params[] = $id;
    $db->prepare("UPDATE superadmins SET " . implode(', ', $sets) . " WHERE id=?")->execute($params);
    jsonResponse(['success' => true]);
}

if ($method === 'DELETE') {
    // Prevent self-delete
    if ($id === (int)$auth['id']) errorResponse('Cannot delete your own account', 403);
    $db->prepare("DELETE FROM superadmins WHERE id=?")->execute([$id]);
    jsonResponse(['success' => true]);
}

errorResponse('Method not allowed', 405);
