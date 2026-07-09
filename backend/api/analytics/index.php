<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

requireAuth();
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') errorResponse('Method not allowed', 405);

$scope  = [];
$params = [];
if (!empty($_GET['municipality'])) { $scope[] = 'r.municipality=?'; $params[] = $_GET['municipality']; }
if (!empty($_GET['province']))     { $scope[] = 'r.province=?';     $params[] = $_GET['province']; }
$where = $scope ? 'WHERE ' . implode(' AND ', $scope) : '';

// Status distribution
$stmt = $db->prepare("SELECT rescue_status, COUNT(*) as count FROM sos_reports r $where GROUP BY rescue_status");
$stmt->execute($params);
$statusDist = $stmt->fetchAll();

// Reports over time (last 7 days)
$stmt = $db->prepare("SELECT DATE(r.timestamp) as day,
       SUM(r.is_verified) as verified, SUM(1-r.is_verified) as guest
       FROM sos_reports r $where AND r.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(r.timestamp) ORDER BY day");
$stmt->execute($params);
$overTime = $stmt->fetchAll();

// Priority histogram
$stmt = $db->prepare("SELECT
    SUM(CASE WHEN ai_priority_score >= 80 THEN 1 ELSE 0 END) as critical,
    SUM(CASE WHEN ai_priority_score >= 60 AND ai_priority_score < 80 THEN 1 ELSE 0 END) as high,
    SUM(CASE WHEN ai_priority_score >= 40 AND ai_priority_score < 60 THEN 1 ELSE 0 END) as moderate,
    SUM(CASE WHEN ai_priority_score < 40 THEN 1 ELSE 0 END) as low,
    COUNT(*) as total,
    SUM(CASE WHEN is_verified=1 THEN 1 ELSE 0 END) as verified_count
    FROM sos_reports r $where");
$stmt->execute($params);
$summary = $stmt->fetch();

// Per-municipality (for super admin)
$stmt = $db->prepare("SELECT municipality,
       COUNT(*) as total, SUM(ai_priority_score>=80) as critical,
       SUM(rescue_status='rescued') as rescued,
       SUM(is_verified=1) as verified, SUM(is_verified=0) as guest,
       MAX(timestamp) as last_activity
       FROM sos_reports r $where GROUP BY municipality ORDER BY critical DESC");
$stmt->execute($params);
$byMunicipality = $stmt->fetchAll();

// Escalations
$stmt = $db->prepare("SELECT * FROM escalations ORDER BY timestamp DESC LIMIT 20");
$stmt->execute();
$escalations = $stmt->fetchAll();

jsonResponse(compact('statusDist', 'overTime', 'summary', 'byMunicipality', 'escalations'));
