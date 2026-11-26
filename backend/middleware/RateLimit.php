<?php
/**
 * IP-based rate limiter — APCu if available, file-based fallback.
 *
 * Usage:
 *   require_once __DIR__ . '/../middleware/RateLimit.php';
 *   if (!checkRateLimit('key', 20, 60)) { exit; }   // 20 req/min
 *
 * Returns true (allow) or false (deny).
 */
/**
 * @param bool $global When true, the key is not scoped to the caller's IP.
 *                     Use for per-entity limits (e.g. per sender number) where the
 *                     request always arrives from the same relay IP regardless of entity.
 */
function checkRateLimit(string $key, int $maxRequests, int $windowSeconds, bool $global = false): bool
{
    $trustedProxy = in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true);
    $ip = ($trustedProxy && isset($_SERVER['HTTP_X_FORWARDED_FOR']))
        ? filter_var(trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]), FILTER_VALIDATE_IP) ?: 'unknown'
        : ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $ck = $global ? ('rl:' . $key) : ('rl:' . $key . ':' . $ip);

    if (function_exists('apcu_fetch')) {
        $count = (int) apcu_fetch($ck, $exists);
        if (!$exists) {
            apcu_store($ck, 1, $windowSeconds);
            return true;
        }
        if ($count >= $maxRequests) return false;
        $newVal = apcu_inc($ck, 1, $success);
        if ($newVal === false || !$success) {
            // Key expired between fetch and inc — treat as a fresh window
            apcu_store($ck, 1, $windowSeconds);
            return true;
        }
        // Check post-increment value to close the concurrent burst race
        return $newVal <= $maxRequests;
    }

    // File-based fallback (suitable for XAMPP dev/pilot)
    $dir  = sys_get_temp_dir() . '/survAIve_rl';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
        error_log('[RateLimit] cannot create rate-limit dir: ' . $dir);
        return true;   // fail open rather than silently disable
    }
    $file = $dir . '/' . md5($ck) . '.json';

    // Atomic read-modify-write using an exclusive file lock to prevent TOCTOU races
    // between concurrent Apache worker processes.
    $fh = @fopen($file, 'c+');
    if (!$fh) {
        error_log('[RateLimit] cannot open rate-limit file: ' . $file);
        return true;
    }
    flock($fh, LOCK_EX);
    $raw  = stream_get_contents($fh);
    $data = $raw ? json_decode($raw, true) : null;
    $now  = time();
    if (!$data || $now - $data['start'] >= $windowSeconds) {
        $data = ['start' => $now, 'count' => 1];
        ftruncate($fh, 0); rewind($fh);
        fwrite($fh, json_encode($data));
        flock($fh, LOCK_UN); fclose($fh);
        return true;
    }
    if ($data['count'] >= $maxRequests) {
        flock($fh, LOCK_UN); fclose($fh);
        return false;
    }
    $data['count']++;
    ftruncate($fh, 0); rewind($fh);
    fwrite($fh, json_encode($data));
    flock($fh, LOCK_UN); fclose($fh);
    return true;
}
