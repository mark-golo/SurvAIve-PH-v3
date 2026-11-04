<?php
require_once __DIR__ . '/../middleware/cors.php';
require_once __DIR__ . '/../middleware/auth.php';

applyCors();

// Auto-apply pending DB schema migrations on first request after deployment.
// Uses a _migrations tracking table so each migration runs exactly once.
_runPendingMigrations();

function _runPendingMigrations(): void {
    try {
        require_once __DIR__ . '/../config/database.php';
        $db = getDB();
        $db->exec("CREATE TABLE IF NOT EXISTS _migrations (
            name       VARCHAR(100) PRIMARY KEY,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB");
        $name = '20261104_add_acknowledged_rescue_status';
        $st = $db->prepare("SELECT 1 FROM _migrations WHERE name = ?");
        $st->execute([$name]);
        if (!$st->fetch()) {
            $db->exec("ALTER TABLE sos_reports MODIFY COLUMN rescue_status
                ENUM('pending','acknowledged','en_route','on_scene','rescued','cannot_reach')
                NOT NULL DEFAULT 'pending'");
            $db->prepare("INSERT INTO _migrations (name) VALUES (?)")->execute([$name]);
        }
    } catch (\Throwable $e) {
        // Never break an API request over a migration check
    }
}

$path   = trim($_GET['path'] ?? '', '/');
$method = $_SERVER['REQUEST_METHOD'];

$routes = [
  'auth/login'         => __DIR__ . '/auth/login.php',
  'auth/register'      => __DIR__ . '/auth/register.php',
  'auth/victim-login'  => __DIR__ . '/auth/victim-login.php',
  'auth/otp'           => __DIR__ . '/auth/otp.php',
  'profile'            => __DIR__ . '/profile/index.php',
  'sos'           => __DIR__ . '/sos/index.php',
  'constituents'  => __DIR__ . '/constituents/index.php',
  'responders'    => __DIR__ . '/responders/index.php',
  'superadmins'        => __DIR__ . '/superadmins/index.php',
  'admins'             => __DIR__ . '/admins/index.php',
  'agencies'           => __DIR__ . '/agencies/index.php',
  'evacuation_centers' => __DIR__ . '/evacuation_centers/index.php',
  'analytics'     => __DIR__ . '/analytics/index.php',
  'feedback'      => __DIR__ . '/feedback/index.php',
  'sync'               => __DIR__ . '/sync/index.php',
  'staff'              => __DIR__ . '/staff/index.php',
  'province_reports'   => __DIR__ . '/province_reports/index.php',
];

// Dynamic routes — order matters (most specific first)

// /sos/mine — victim-scoped SOS list (must come before /sos/:id)
if ($path === 'sos/mine') {
  require __DIR__ . '/sos/mine.php';
  exit;
}

if (preg_match('#^feedback/(\d+)$#', $path, $m)) {
  $_GET['id'] = $m[1];
  require __DIR__ . '/feedback/item.php';
  exit;
}

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
