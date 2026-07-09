<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$auth   = requireAuth('superadmin');
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $where  = [];
    $params = [];
    if (!empty($_GET['province'])) { $where[] = 'province=?'; $params[] = $_GET['province']; }
    if (!empty($_GET['status']))   { $where[] = 'status=?';   $params[] = $_GET['status']; }

    $sql = "SELECT id, name, contact_number, gmail, province, status, is_verified, created_at
            FROM superadmins"
         . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . ' ORDER BY created_at DESC';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    if (empty($body['name']))     errorResponse('name is required');
    if (empty($body['password'])) errorResponse('password is required');

    $stmt = $db->prepare("INSERT INTO superadmins (name, contact_number, gmail, province, password_hash, status)
                          VALUES (?,?,?,?,?,'active')");
    $stmt->execute([
        $body['name'],
        $body['contact_number'] ?? null,
        $body['gmail']          ?? null,
        $body['province']       ?? null,
        password_hash($body['password'], PASSWORD_DEFAULT),
    ]);
    jsonResponse(['id' => $db->lastInsertId()], 201);
}

errorResponse('Method not allowed', 405);
