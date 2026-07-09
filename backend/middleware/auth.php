<?php
require_once __DIR__ . '/../config/database.php';

function base64UrlDecode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4));
}

function base64UrlEncode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function createJWT(array $payload): string {
    $header  = base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64UrlEncode(json_encode(array_merge($payload, ['iat' => time(), 'exp' => time() + 86400 * 7])));
    $sig     = base64UrlEncode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$sig";
}

function verifyJWT(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $sig] = $parts;
    $expected = base64UrlEncode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if (!hash_equals($expected, $sig)) return null;
    $data = json_decode(base64UrlDecode($payload), true);
    if (!$data || $data['exp'] < time()) return null;
    return $data;
}

function requireAuth(?string $role = null): array {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($header, 'Bearer ')) {
        errorResponse('Unauthorized', 401);
    }
    $token = substr($header, 7);

    // Dev bypass — localhost only, sentinel token
    $fromLocal = in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true);
    if ($token === 'dev-admin' && $fromLocal) {
        return ['id' => 1, 'role' => $role ?? 'admin', 'name' => 'Dev Admin'];
    }

    $payload = verifyJWT($token);
    if (!$payload) errorResponse('Invalid or expired token', 401);
    if ($role && $payload['role'] !== $role) errorResponse('Forbidden', 403);
    return $payload;
}
