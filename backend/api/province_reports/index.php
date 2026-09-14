<?php
// Province Reports — daily snapshot store for the Superadmin Provincial Dashboard.
// No JWT check: this endpoint is local-only (XAMPP on the admin's machine).
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/cors.php';

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// ── GET /province_reports?province=Surigao+del+Norte ─────────────────────────
if ($method === 'GET') {
    $prov = $_GET['province'] ?? null;
    if (!$prov) errorResponse('province query param is required');

    $stmt = $db->prepare(
        'SELECT id, province, date, label, total, critical, rescued, reporting, saved_at
           FROM province_reports
          WHERE province = ?
          ORDER BY date DESC
          LIMIT 90'
    );
    $stmt->execute([$prov]);
    jsonResponse($stmt->fetchAll());
}

// ── POST /province_reports — upsert today's snapshot ─────────────────────────
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $prov  = $body['province']  ?? null;
    $date  = $body['date']      ?? null;
    $label = $body['label']     ?? '';
    $total = (int)($body['total']     ?? 0);
    $crit  = (int)($body['critical']  ?? 0);
    $resc  = (int)($body['rescued']   ?? 0);
    $rep   = (int)($body['reporting'] ?? 0);

    if (!$prov || !$date) errorResponse('province and date are required');

    $stmt = $db->prepare(
        'INSERT INTO province_reports
               (province, date, label, total, critical, rescued, reporting, saved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
               label     = VALUES(label),
               total     = VALUES(total),
               critical  = VALUES(critical),
               rescued   = VALUES(rescued),
               reporting = VALUES(reporting),
               saved_at  = NOW()'
    );
    $stmt->execute([$prov, $date, $label, $total, $crit, $resc, $rep]);
    jsonResponse(['ok' => true]);
}

errorResponse('Method not allowed', 405);
