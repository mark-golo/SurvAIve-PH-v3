<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$auth   = requireAuth('admin');
$db     = getDB();
$id     = (int)$_GET['id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare("SELECT id,name,contact_number,gmail,province,municipality,barangay,sitio,
                                 household_count,vulnerabilities,medical_conditions,
                                 emergency_contact_name,emergency_contact_number,emergency_contact_relationship,
                                 status,is_verified,created_at
                          FROM victims WHERE id=?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) errorResponse('Not found', 404);
    $row['vulnerabilities'] = json_decode($row['vulnerabilities'] ?? '[]');
    jsonResponse($row);
}

if ($method === 'PUT') {
    $body    = json_decode(file_get_contents('php://input'), true) ?? [];
    $allowed = ['name', 'contact_number', 'barangay', 'sitio', 'household_count',
                'medical_conditions', 'status',
                'emergency_contact_name', 'emergency_contact_number', 'emergency_contact_relationship'];
    $sets    = [];
    $params  = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) { $sets[] = "$f=?"; $params[] = $body[$f]; }
    }
    if (array_key_exists('vulnerabilities', $body)) {
        $sets[]   = 'vulnerabilities=?';
        $params[] = json_encode($body['vulnerabilities']);
    }
    if (!$sets) errorResponse('No fields to update');
    $params[] = $id;
    $db->prepare("UPDATE victims SET " . implode(', ', $sets) . " WHERE id=?")->execute($params);
    jsonResponse(['success' => true]);
}

if ($method === 'DELETE') {
    $db->prepare("DELETE FROM victims WHERE id=?")->execute([$id]);
    jsonResponse(['success' => true]);
}

errorResponse('Method not allowed', 405);
