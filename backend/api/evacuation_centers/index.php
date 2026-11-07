<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $where  = [];
    $params = [];
    if (!empty($_GET['municipality'])) { $where[] = 'municipality=?'; $params[] = $_GET['municipality']; }
    if (!empty($_GET['province']))     { $where[] = 'province=?';     $params[] = $_GET['province']; }
    if (!empty($_GET['status']))       { $where[] = 'status=?';       $params[] = $_GET['status']; }

    $sql = "SELECT id, name, province, municipality, barangay, address, lat, lng,
                   capacity, current_occupancy, contact_number, status,
                   safety_status, operational_status, accessibility_status,
                   overall_status, last_verified_at, last_updated_at, created_at
            FROM evacuation_centers"
         . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . ' ORDER BY municipality, name';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    $auth = requireAuth('admin');
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    if (empty($body['name'])) errorResponse('name is required');
    if (!isset($body['lat']) || !isset($body['lng']) || $body['lat'] === '' || $body['lng'] === '') errorResponse('lat and lng are required');

    try {
        $stmt = $db->prepare("
            INSERT INTO evacuation_centers
              (name, province, municipality, barangay, address, lat, lng,
               capacity, current_occupancy, contact_number, status,
               safety_status, operational_status, accessibility_status, overall_status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ");
        $stmt->execute([
            $body['name'],
            $body['province']             ?? null,
            $body['municipality']         ?? null,
            $body['barangay']             ?? null,
            $body['address']              ?? null,
            $body['lat'],
            $body['lng'],
            $body['capacity']             ?? null,
            $body['current_occupancy']    ?? 0,
            $body['contact_number']       ?? null,
            $body['status']               ?? 'open',
            $body['safety_status']        ?? 'Unverified',
            $body['operational_status']   ?? 'Operational',
            $body['accessibility_status'] ?? 'Unverified',
            $body['overall_status']       ?? 'Unverified',
        ]);
        jsonResponse(['id' => $db->lastInsertId()], 201);
    } catch (Exception $e) {
        errorResponse($e->getMessage(), 500);
    }
}

errorResponse('Method not allowed', 405);
