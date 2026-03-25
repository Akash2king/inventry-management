-- Waste Oil Management System — PostgreSQL schema (records domain + shared tables)
-- Requires PostgreSQL 13+ (gen_random_uuid in core).

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10) NOT NULL,
    stage_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_departments_name UNIQUE (name),
    CONSTRAINT uq_departments_code UNIQUE (code)
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(128) NOT NULL,
    full_name VARCHAR(200),
    role VARCHAR(20) NOT NULL,
    department_id UUID REFERENCES departments (id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_users_role CHECK (
        role IN ('storeman', 'treatment', 'admin', 'manager', 'gm', 'superadmin')
    )
);

CREATE TABLE waste_oil_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_number VARCHAR(30) NOT NULL,
    vendor_name VARCHAR(200) NOT NULL,
    vendor_contact VARCHAR(100),
    quantity_litres NUMERIC(10, 2) NOT NULL,
    oil_type VARCHAR(100) NOT NULL,
    collection_date DATE NOT NULL,
    remarks TEXT,
    attachment_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
    current_stage INTEGER NOT NULL DEFAULT 1,
    current_holder_id UUID REFERENCES users (id) ON DELETE SET NULL,
    current_department_id UUID REFERENCES departments (id) ON DELETE SET NULL,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    disposal_deadline DATE NOT NULL,
    alert_level VARCHAR(10) NOT NULL DEFAULT 'green',
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_waste_oil_records_record_number UNIQUE (record_number),
    CONSTRAINT chk_waste_oil_records_current_stage CHECK (
        current_stage >= 1 AND current_stage <= 5
    ),
    CONSTRAINT chk_waste_oil_records_alert_level CHECK (
        alert_level IN ('green', 'yellow', 'red', 'completed')
    )
);

CREATE TABLE stage_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES waste_oil_records (id) ON DELETE CASCADE,
    from_stage INTEGER NOT NULL,
    to_stage INTEGER NOT NULL,
    from_department_id UUID REFERENCES departments (id) ON DELETE SET NULL,
    to_department_id UUID REFERENCES departments (id) ON DELETE SET NULL,
    transitioned_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    transition_type VARCHAR(10) NOT NULL,
    note TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_stage_transitions_type CHECK (
        transition_type IN ('forward', 'return')
    )
);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    action VARCHAR(30) NOT NULL,
    record_id UUID REFERENCES waste_oil_records (id) ON DELETE SET NULL,
    description TEXT,
    previous_data JSONB,
    new_data JSONB,
    ip_address INET,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_audit_log_action CHECK (
        action IN (
            'CREATE',
            'EDIT',
            'FORWARD',
            'RETURN',
            'APPROVE',
            'LOGIN',
            'LOGOUT',
            'EXPORT',
            'ALERT_SENT'
        )
    )
);

CREATE TABLE alert_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES waste_oil_records (id) ON DELETE CASCADE,
    level VARCHAR(10) NOT NULL,
    sent_to JSONB,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivery_status VARCHAR(20)
);

CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_waste_oil_records_collection_date ON waste_oil_records (collection_date);
CREATE INDEX idx_waste_oil_records_disposal_deadline ON waste_oil_records (disposal_deadline);
CREATE INDEX idx_waste_oil_records_current_stage ON waste_oil_records (current_stage);
CREATE INDEX idx_waste_oil_records_alert_level ON waste_oil_records (alert_level);
CREATE INDEX idx_waste_oil_records_current_holder ON waste_oil_records (current_holder_id);
CREATE INDEX idx_waste_oil_records_current_department ON waste_oil_records (current_department_id);
CREATE INDEX idx_stage_transitions_record_id ON stage_transitions (record_id);
CREATE INDEX idx_audit_log_user_id ON audit_log (user_id);
CREATE INDEX idx_audit_log_record_id ON audit_log (record_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log (timestamp);
CREATE INDEX idx_alert_notifications_record_id ON alert_notifications (record_id);
