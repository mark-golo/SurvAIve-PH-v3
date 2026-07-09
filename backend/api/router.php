<?php
require_once __DIR__ . '/../middleware/cors.php';
require_once __DIR__ . '/../middleware/auth.php';

applyCors();

$path   = trim($_GET['path'] ?? '', '/');
$method = $_SERVER['REQUEST_METHOD'];

$routes = [
  'auth/login'    => __DIR__ . '/auth/login.php',
  'auth/register' => __DIR__ . '/auth/register.php',
  'auth/otp'      => __DIR__ . '/auth/otp.php',
  'sos'           => __DIR__ . '/sos/index.php',
  'constituents'  => __DIR__ . '/constituents/index.php',
  'responders'    => __DIR__ . '/responders/index.php',
  'superadmins'        => __DIR__ . '/superadmins/index.php',
  'admins'             => __DIR__ . '/admins/index.php',
  'evacuation_centers' => __DIR__ . '/evacuation_centers/index.php',
  'analytics'     => __DIR__ . '/analytics/index.php',
];

// Dynamic routes — order matters (most specific first)
if (preg_match('#^sos/(\d+)$#', $path, $m)) {
  $_GET['id'] = $m[1];
  require __DIR__ . '/sos/item.php';
  exit;
}

if (preg_match('#^escalations/(\d+)$#', $path, $m)) {
  $_GET['id'] = $m[1];
  require __DIR__ . '/analytics/escalation_item.php';
  exit;
}

if (preg_match('#^superadmins/(\d+)$#', $path, $m)) {
  $_GET['id'] = $m[1];
  require __DIR__ . '/superadmins/item.php';
  exit;
}

if (preg_match('#^admins/(\d+)$#', $path, $m)) {
  $_GET['id'] = $m[1];
  require __DIR__ . '/admins/item.php';
  exit;
}

if (preg_match('#^responders/(\d+)$#', $path, $m)) {
  $_GET['id'] = $m[1];
  require __DIR__ . '/responders/item.php';
  exit;
}

if (preg_match('#^constituents/(\d+)$#', $path, $m)) {
  $_GET['id'] = $m[1];
  require __DIR__ . '/constituents/item.php';
  exit;
}

if (preg_match('#^evacuation_centers/(\d+)$#', $path, $m)) {
  $_GET['id'] = $m[1];
  require __DIR__ . '/evacuation_centers/item.php';
  exit;
}

if (isset($routes[$path])) {
  require $routes[$path];
} else {
  errorResponse('Not found', 404);
}
