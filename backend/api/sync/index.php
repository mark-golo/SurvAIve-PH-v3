<?php
// ── Sync endpoint ────────────────────────────────────────────────────────────
//
//  POST ?path=sync&action=staff
//    Body: { role, name, contact_number, province, municipality, password }
//    Upserts one staff member's credentials into the matching MySQL table so
//    offline login works after they've logged in at least once while online.
//
//  POST ?path=sync&action=sos
//    Body: { records: [...] }   (normalized SOS array from Supabase RPC)
//    Bulk-upserts all SOS records so the offline Command Center shows real data.
//
//  No auth required — only the admin's own browser calls this endpoint on the
//  same machine (or the same local hotspot network).
// ─────────────────────────────────────────────────────────────────────────────

require_once __DIR__ . '/../../config/database.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$action = trim($_GET['action'] ?? '');
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

$pdo = getDbConnection();

// ── action=staff ─────────────────────────────────────────────────────────────
if ($action === 'staff') {
    $role           = $body['role']           ?? '';
    $name           = $body['name']           ?? '';
    $contactNumber  = $body['contact_number'] ?? '';
    $province       = $body['province']       ?? null;
    $municipality   = $body['municipality']   ?? null;
    $password       = $body['password']       ?? '';

    if (!$contactNumber || !$password || !in_array($role, ['admin','superadmin','responder'], true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields (role, contact_number, password)']);
        exit;
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);

    $table = match ($role) {
        'superadmin' => 'superadmins',
        'responder'  => 'responders',
        default      => 'admins',
    };

    $sql = "INSERT INTO `{$table}`
              (name, contact_number, password_hash, province, municipality, status)
            VALUES
              (:name, :contact, :hash, :province, :municipality, 'active')
            ON DUPLICATE KEY UPDATE
              name           = VALUES(name),
              password_hash  = VALUES(password_hash),
              province       = VALUES(province),
              municipality   = VALUES(municipality)";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':name'         => $name,
        ':contact'      => $contactNumber,
        ':hash'         => $hash,
        ':province'     => $province,
        ':municipality' => $municipality,
    ]);

    echo json_encode(['ok' => true, 'table' => $table]);
    exit;
}

// ── action=sos ───────────────────────────────────────────────────────────────
if ($action === 'sos') {
    $records = $body['records'] ?? [];

    if (!is_array($records)) {
        http_response_code(400);
        echo json_encode(['error' => 'records must be an array']);
        exit;
    }

    $sql = "INSERT INTO sos_reports
              (id, user_id, barangay, municipality, province, lat, lng, status,
               people_count, victim_age_group, special_conditions, notes,
               is_verified, trust_score, ai_priority_score, rescue_status,
               dismissed, timestamp, synced_to_cloud)
            VALUES
              (:id, NULL, :barangay, :municipality, :province, :lat, :lng, :status,
               :people_count, :victim_age_group, :special_conditions, :notes,
               :is_verified, :trust_score, :ai_priority_score, :rescue_status,
               :dismissed, :timestamp, 1)
            ON DUPLICATE KEY UPDATE
              rescue_status     = VALUES(rescue_status),
              dismissed         = VALUES(dismissed),
              lat               = VALUES(lat),
              lng               = VALUES(lng),
              ai_priority_score = VALUES(ai_priority_score),
              status            = VALUES(status),
              synced_to_cloud   = 1";

    $stmt    = $pdo->prepare($sql);
    $upserted = 0;

    foreach ($records as $r) {
        // Guard: id must be a positive integer (Supabase integer PKs)
        $id = filter_var($r['id'] ?? null, FILTER_VALIDATE_INT);
        if ($id === false || $id === null || $id <= 0) continue;

        $stmt->execute([
            ':id'               => $id,
            ':barangay'         => $r['barangay']          ?? null,
            ':municipality'     => $r['municipality']      ?? null,
            ':province'         => $r['province']          ?? null,
            ':lat'              => isset($r['lat'])  ? (float)$r['lat']  : null,
            ':lng'              => isset($r['lng'])  ? (float)$r['lng']  : null,
            ':status'           => $r['status']            ?? 'unknown',
            ':people_count'     => (int)($r['people_count'] ?? 1),
            ':victim_age_group' => $r['victim_age_group']  ?? 'adult',
            ':special_conditions' => $r['special_conditions'] ?? '',
            ':notes'            => $r['notes']             ?? null,
            ':is_verified'      => $r['is_verified']  ? 1 : 0,
            ':trust_score'      => $r['trust_score']       ?? 'LOW',
            ':ai_priority_score'=> (int)($r['ai_priority_score'] ?? 50),
            ':rescue_status'    => $r['rescue_status']     ?? 'pending',
            ':dismissed'        => $r['dismissed']    ? 1 : 0,
            ':timestamp'        => $r['created_at']        ?? date('Y-m-d H:i:s'),
        ]);
        $upserted++;
    }

    echo json_encode(['ok' => true, 'upserted' => $upserted]);
    exit;
}

// ── action=evacuation_centers ─────────────────────────────────────────────────
if ($action === 'evacuation_centers') {
    $records = $body['records'] ?? [];
    if (!is_array($records)) {
        http_response_code(400);
        echo json_encode(['error' => 'records must be an array']);
        exit;
    }

    $sql = "INSERT INTO evacuation_centers
              (id, name, barangay, municipality, province, lat, lng,
               capacity, current_count, status)
            VALUES
              (:id, :name, :barangay, :municipality, :province, :lat, :lng,
               :capacity, :current_count, :status)
            ON DUPLICATE KEY UPDATE
              name          = VALUES(name),
              lat           = VALUES(lat),
              lng           = VALUES(lng),
              capacity      = VALUES(capacity),
              current_count = VALUES(current_count),
              status        = VALUES(status)";

    $stmt     = $pdo->prepare($sql);
    $upserted = 0;

    foreach ($records as $r) {
        $id = filter_var($r['id'] ?? null, FILTER_VALIDATE_INT);
        if ($id === false || $id === null || $id <= 0) continue;

        $stmt->execute([
            ':id'           => $id,
            ':name'         => $r['name']          ?? '',
            ':barangay'     => $r['barangay']      ?? null,
            ':municipality' => $r['municipality']  ?? null,
            ':province'     => $r['province']      ?? null,
            ':lat'          => isset($r['lat'])    ? (float)$r['lat']  : null,
            ':lng'          => isset($r['lng'])    ? (float)$r['lng']  : null,
            ':capacity'     => (int)($r['capacity']      ?? 0),
            ':current_count'=> (int)($r['current_count'] ?? 0),
            ':status'       => $r['status']        ?? 'open',
        ]);
        $upserted++;
    }

    echo json_encode(['ok' => true, 'upserted' => $upserted]);
    exit;
}

// ── action=victims ────────────────────────────────────────────────────────────
if ($action === 'victims') {
    $records = $body['records'] ?? [];
    if (!is_array($records)) {
        http_response_code(400);
        echo json_encode(['error' => 'records must be an array']);
        exit;
    }

    $sql = "INSERT INTO victims
              (id, name, contact_number, province, municipality, barangay, sitio,
               household_count, vulnerabilities, medical_conditions,
               emergency_contact_name, emergency_contact_number,
               emergency_contact_relationship, status)
            VALUES
              (:id, :name, :contact_number, :province, :municipality, :barangay, :sitio,
               :household_count, :vulnerabilities, :medical_conditions,
               :emergency_contact_name, :emergency_contact_number,
               :emergency_contact_relationship, :status)
            ON DUPLICATE KEY UPDATE
              name                           = VALUES(name),
              barangay                       = VALUES(barangay),
              household_count                = VALUES(household_count),
              vulnerabilities                = VALUES(vulnerabilities),
              medical_conditions             = VALUES(medical_conditions),
              emergency_contact_name         = VALUES(emergency_contact_name),
              emergency_contact_number       = VALUES(emergency_contact_number),
              emergency_contact_relationship = VALUES(emergency_contact_relationship),
              status                         = VALUES(status)";

    $stmt     = $pdo->prepare($sql);
    $upserted = 0;

    foreach ($records as $r) {
        $id = filter_var($r['id'] ?? null, FILTER_VALIDATE_INT);
        if ($id === false || $id === null || $id <= 0) continue;

        // vulnerabilities may be an array/object — store as JSON string
        $vulns = null;
        if (isset($r['vulnerabilities'])) {
            $vulns = is_string($r['vulnerabilities'])
                ? $r['vulnerabilities']
                : json_encode($r['vulnerabilities']);
        }

        $stmt->execute([
            ':id'                           => $id,
            ':name'                         => $r['name']                           ?? null,
            ':contact_number'               => $r['contact_number']                ?? null,
            ':province'                     => $r['province']                      ?? null,
            ':municipality'                 => $r['municipality']                  ?? null,
            ':barangay'                     => $r['barangay']                      ?? null,
            ':sitio'                        => $r['sitio']                         ?? null,
            ':household_count'              => (int)($r['household_count']         ?? 1),
            ':vulnerabilities'              => $vulns,
            ':medical_conditions'           => $r['medical_conditions']            ?? null,
            ':emergency_contact_name'       => $r['emergency_contact_name']        ?? null,
            ':emergency_contact_number'     => $r['emergency_contact_number']      ?? null,
            ':emergency_contact_relationship' => $r['emergency_contact_relationship'] ?? null,
            ':status'                       => $r['status']                        ?? 'active',
        ]);
        $upserted++;
    }

    echo json_encode(['ok' => true, 'upserted' => $upserted]);
    exit;
}

// ── action=responders ─────────────────────────────────────────────────────────
if ($action === 'responders') {
    $records = $body['records'] ?? [];
    if (!is_array($records)) {
        http_response_code(400);
        echo json_encode(['error' => 'records must be an array']);
        exit;
    }

    // Only update operational fields — never touch password_hash set by action=staff
    $sql = "INSERT INTO responders
              (id, name, contact_number, province, municipality,
               unit_name, assigned_zone, duty_status, status, lat, lng, last_seen_at)
            VALUES
              (:id, :name, :contact_number, :province, :municipality,
               :unit_name, :assigned_zone, :duty_status, :status, :lat, :lng, :last_seen_at)
            ON DUPLICATE KEY UPDATE
              name          = VALUES(name),
              duty_status   = VALUES(duty_status),
              unit_name     = VALUES(unit_name),
              assigned_zone = VALUES(assigned_zone),
              lat           = VALUES(lat),
              lng           = VALUES(lng),
              last_seen_at  = VALUES(last_seen_at),
              status        = VALUES(status)";

    $stmt     = $pdo->prepare($sql);
    $upserted = 0;

    foreach ($records as $r) {
        $id = filter_var($r['id'] ?? null, FILTER_VALIDATE_INT);
        if ($id === false || $id === null || $id <= 0) continue;

        $stmt->execute([
            ':id'            => $id,
            ':name'          => $r['name']          ?? null,
            ':contact_number'=> $r['contact_number'] ?? null,
            ':province'      => $r['province']      ?? null,
            ':municipality'  => $r['municipality']  ?? null,
            ':unit_name'     => $r['unit_name']     ?? null,
            ':assigned_zone' => $r['assigned_zone'] ?? null,
            ':duty_status'   => $r['duty_status']   ?? 'standby',
            ':status'        => $r['status']        ?? 'active',
            ':lat'           => isset($r['lat'])    ? (float)$r['lat'] : null,
            ':lng'           => isset($r['lng'])    ? (float)$r['lng'] : null,
            ':last_seen_at'  => $r['last_seen_at']  ?? null,
        ]);
        $upserted++;
    }

    echo json_encode(['ok' => true, 'upserted' => $upserted]);
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Unknown action. Use action=staff, action=sos, action=evacuation_centers, action=victims, or action=responders']);
