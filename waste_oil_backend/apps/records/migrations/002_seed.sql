-- Demo data: 5 departments (stage pipeline) + 6 users (one per role).
-- Password for all demo users: demo123456
-- Django-compatible pbkdf2_sha256 hash (fits VARCHAR(128)).

INSERT INTO departments (id, name, code, stage_order) VALUES
    (
        '11111111-1111-1111-1111-111111111101',
        'StoreMan',
        'STM',
        1
    ),
    (
        '11111111-1111-1111-1111-111111111102',
        'Treatment',
        'TRT',
        2
    ),
    (
        '11111111-1111-1111-1111-111111111103',
        'Admin',
        'ADM',
        3
    ),
    (
        '11111111-1111-1111-1111-111111111104',
        'Manager',
        'MGR',
        4
    ),
    (
        '11111111-1111-1111-1111-111111111105',
        'GM',
        'GM',
        5
    );

INSERT INTO users (
    id,
    username,
    email,
    password_hash,
    full_name,
    role,
    department_id,
    is_active
) VALUES
    (
        '22222222-2222-2222-2222-222222222201',
        'demo_storeman',
        'storeman@demo.local',
        'pbkdf2_sha256$720000$WxKfIG01iA70T6U7zFFQTf$oX7sQMu3W6Al8fPtKubspaGDEF9UirxY2F9J/02xkjk=',
        'Demo Storeman',
        'storeman',
        '11111111-1111-1111-1111-111111111101',
        TRUE
    ),
    (
        '22222222-2222-2222-2222-222222222202',
        'demo_treatment',
        'treatment@demo.local',
        'pbkdf2_sha256$720000$WxKfIG01iA70T6U7zFFQTf$oX7sQMu3W6Al8fPtKubspaGDEF9UirxY2F9J/02xkjk=',
        'Demo Treatment',
        'treatment',
        '11111111-1111-1111-1111-111111111102',
        TRUE
    ),
    (
        '22222222-2222-2222-2222-222222222203',
        'demo_admin',
        'admin@demo.local',
        'pbkdf2_sha256$720000$WxKfIG01iA70T6U7zFFQTf$oX7sQMu3W6Al8fPtKubspaGDEF9UirxY2F9J/02xkjk=',
        'Demo Admin',
        'admin',
        '11111111-1111-1111-1111-111111111103',
        TRUE
    ),
    (
        '22222222-2222-2222-2222-222222222204',
        'demo_manager',
        'manager@demo.local',
        'pbkdf2_sha256$720000$WxKfIG01iA70T6U7zFFQTf$oX7sQMu3W6Al8fPtKubspaGDEF9UirxY2F9J/02xkjk=',
        'Demo Manager',
        'manager',
        '11111111-1111-1111-1111-111111111104',
        TRUE
    ),
    (
        '22222222-2222-2222-2222-222222222205',
        'demo_gm',
        'gm@demo.local',
        'pbkdf2_sha256$720000$WxKfIG01iA70T6U7zFFQTf$oX7sQMu3W6Al8fPtKubspaGDEF9UirxY2F9J/02xkjk=',
        'Demo General Manager',
        'gm',
        '11111111-1111-1111-1111-111111111105',
        TRUE
    ),
    (
        '22222222-2222-2222-2222-222222222206',
        'demo_superadmin',
        'superadmin@demo.local',
        'pbkdf2_sha256$720000$WxKfIG01iA70T6U7zFFQTf$oX7sQMu3W6Al8fPtKubspaGDEF9UirxY2F9J/02xkjk=',
        'Demo Superadmin',
        'superadmin',
        NULL,
        TRUE
    );
