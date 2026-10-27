<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

requireAuth(['admin', 'superadmin']);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    errorResponse('Method not allowed', 405);
}

$db   = getDB();
$rows = [];

$tables = [
    ['admins',            'admin'],
    ['responders',        'responder'],
    ['response_agencies', 'response_agency'],
];

foreach ($tables as [$table, $role]) {
    try {
        $stmt = $db->prepare(
            "SELECT contact_number, name, province, municipality, :role AS role
             FROM `$table`
             WHERE contact_number IS NOT NULL AND contact_number != ''
             ORDER BY name"
        );
        $stmt->bindValue(':role', $role);
        $stmt->execute();
        $rows = array_merge($rows, $stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (Exception $e) {
        // Skip missing table gracefully
    }
}

jsonResponse($rows);
