<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$auth   = requireAuth('admin');
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $where  = ['1=1'];
    $params = [];
    if (!empty($_GET['municipality'])) { $where[] = 'municipality=?'; $params[] = $_GET['municipality']; }
    if (!empty($_GET['barangay']))     { $where[] = 'barangay=?';     $params[] = $_GET['barangay']; }
    if (!empty($_GET['status']))       { $where[] = 'status=?';       $params[] = $_GET['status']; }
    if (!empty($_GET['vulnerability'])) {
        $where[] = 'JSON_CONTAINS(vulnerabilities, ?)';
        $params[] = json_encode($_GET['vulnerability']);
    }

    $sql  = "SELECT id,name,contact_number,gmail,province,municipality,barangay,sitio,
                    household_count,vulnerabilities,medical_conditions,
                    emergency_contact_name,emergency_contact_number,emergency_contact_relationship,
                    status,is_verified,created_at
             FROM victims WHERE " . implode(' AND ', $where) . " ORDER BY barangay, name LIMIT 500";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) $r['vulnerabilities'] = json_decode($r['vulnerabilities'] ?? '[]');
    jsonResponse($rows);
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $stmt = $db->prepare("
        INSERT INTO victims (name,contact_number,gmail,province,municipality,barangay,sitio,
                             household_count,vulnerabilities,medical_conditions,
                             emergency_contact_name,emergency_contact_number,status,is_verified,trust_score)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'active',0,'ADMIN_ENTRY')
    ");
    $stmt->execute([
        $body['name'], $body['contact_number'] ?? null, $body['gmail'] ?? null,
        $body['province'], $body['municipality'], $body['barangay'], $body['sitio'] ?? null,
        (int)($body['household_count'] ?? 1), json_encode($body['vulnerabilities'] ?? []),
        $body['medical_conditions'] ?? null, $body['emergency_contact_name'] ?? null,
        $body['emergency_contact_number'] ?? null,
    ]);
    jsonResponse(['id' => $db->lastInsertId()], 201);
}

errorResponse('Method not allowed', 405);
