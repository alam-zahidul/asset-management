-- Initialize schemas for the asset management application
-- Each application domain gets its own schema for clear separation

-- Auth schema: LDAP user cache, sessions, audit logs
CREATE SCHEMA IF NOT EXISTS auth;

-- Admin schema: field definitions, roles, permissions
CREATE SCHEMA IF NOT EXISTS admin;

-- Inventory schema: asset data, import/export history
CREATE SCHEMA IF NOT EXISTS inventory;

-- Grant usage
GRANT USAGE ON SCHEMA auth TO postgres;
GRANT USAGE ON SCHEMA admin TO postgres;
GRANT USAGE ON SCHEMA inventory TO postgres;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA admin TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA inventory TO postgres;

ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA admin GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA inventory GRANT ALL ON TABLES TO postgres;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- AUTH SCHEMA
-- ============================================================

CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255),
    display_name VARCHAR(255),
    ldap_dn VARCHAR(500),
    department VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE auth.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE auth.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE auth.role_permissions (
    role_id UUID NOT NULL REFERENCES auth.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES auth.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE auth.user_roles (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES auth.roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE auth.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(256) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE auth.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id VARCHAR(200),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON auth.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON auth.audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON auth.audit_logs(created_at);
CREATE INDEX idx_refresh_tokens_user_id ON auth.refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON auth.refresh_tokens(expires_at);

-- ============================================================
-- ADMIN SCHEMA
-- ============================================================

CREATE TABLE admin.field_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_key VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    field_type VARCHAR(50) NOT NULL CHECK (field_type IN (
        'text', 'number', 'date', 'datetime', 'boolean',
        'select', 'multiselect', 'textarea', 'email', 'ip_address', 'url'
    )),
    is_required BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    display_order INT DEFAULT 0,
    field_group VARCHAR(100) DEFAULT 'general',
    placeholder VARCHAR(300),
    help_text TEXT,
    default_value TEXT,
    validation_rules JSONB DEFAULT '{}',
    select_options JSONB DEFAULT '[]',
    min_length INT,
    max_length INT,
    min_value NUMERIC,
    max_value NUMERIC,
    regex_pattern VARCHAR(500),
    is_unique BOOLEAN DEFAULT false,
    is_filterable BOOLEAN DEFAULT true,
    is_sortable BOOLEAN DEFAULT true,
    is_exportable BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin.field_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin.export_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    fields JSONB NOT NULL,
    filters JSONB DEFAULT '{}',
    format VARCHAR(10) NOT NULL CHECK (format IN ('xlsx', 'csv', 'pdf')),
    created_by UUID REFERENCES auth.users(id),
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_field_definitions_field_key ON admin.field_definitions(field_key);
CREATE INDEX idx_field_definitions_group ON admin.field_definitions(field_group);
CREATE INDEX idx_field_definitions_active ON admin.field_definitions(is_active);

-- ============================================================
-- INVENTORY SCHEMA
-- ============================================================

CREATE TABLE inventory.assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_tag VARCHAR(100) UNIQUE,
    data JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'decommissioned', 'maintenance')),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory.asset_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES inventory.assets(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES auth.users(id),
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('create', 'update', 'delete', 'import')),
    previous_data JSONB,
    new_data JSONB,
    changed_fields TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory.import_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(10) NOT NULL,
    total_rows INT DEFAULT 0,
    successful_rows INT DEFAULT 0,
    failed_rows INT DEFAULT 0,
    errors JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    imported_by UUID REFERENCES auth.users(id),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assets_asset_tag ON inventory.assets(asset_tag);
CREATE INDEX idx_assets_status ON inventory.assets(status);
CREATE INDEX idx_assets_data ON inventory.assets USING GIN(data);
CREATE INDEX idx_assets_created_at ON inventory.assets(created_at);
CREATE INDEX idx_asset_history_asset_id ON inventory.asset_history(asset_id);
CREATE INDEX idx_asset_history_created_at ON inventory.asset_history(created_at);
CREATE INDEX idx_import_logs_status ON inventory.import_logs(status);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default roles
INSERT INTO auth.roles (name, description, is_system) VALUES
    ('admin', 'Full system access including field management', true),
    ('manager', 'Can manage assets and users within their scope', true),
    ('operator', 'Can view and update assets', true),
    ('viewer', 'Read-only access to assets', true);

-- Default permissions
INSERT INTO auth.permissions (name, resource, action, description) VALUES
    ('assets.create', 'assets', 'create', 'Create new assets'),
    ('assets.read', 'assets', 'read', 'View assets'),
    ('assets.update', 'assets', 'update', 'Update existing assets'),
    ('assets.delete', 'assets', 'delete', 'Delete assets'),
    ('assets.import', 'assets', 'import', 'Import assets from files'),
    ('assets.export', 'assets', 'export', 'Export assets to files'),
    ('fields.create', 'fields', 'create', 'Create field definitions'),
    ('fields.read', 'fields', 'read', 'View field definitions'),
    ('fields.update', 'fields', 'update', 'Update field definitions'),
    ('fields.delete', 'fields', 'delete', 'Delete field definitions'),
    ('users.read', 'users', 'read', 'View users'),
    ('users.manage', 'users', 'manage', 'Manage user roles'),
    ('roles.manage', 'roles', 'manage', 'Manage roles and permissions'),
    ('audit.read', 'audit', 'read', 'View audit logs'),
    ('templates.create', 'templates', 'create', 'Create export templates'),
    ('templates.read', 'templates', 'read', 'View export templates'),
    ('templates.update', 'templates', 'update', 'Update export templates'),
    ('templates.delete', 'templates', 'delete', 'Delete export templates');

-- Assign permissions to roles
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name = 'admin';

INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name = 'manager' AND p.name IN (
    'assets.create', 'assets.read', 'assets.update', 'assets.import',
    'assets.export', 'fields.read', 'users.read', 'templates.create',
    'templates.read', 'templates.update', 'audit.read'
);

INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name = 'operator' AND p.name IN (
    'assets.create', 'assets.read', 'assets.update', 'assets.import',
    'assets.export', 'fields.read', 'templates.read'
);

INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name = 'viewer' AND p.name IN (
    'assets.read', 'fields.read', 'assets.export', 'templates.read'
);

-- Default field groups
INSERT INTO admin.field_groups (name, display_name, display_order) VALUES
    ('general', 'General Information', 1),
    ('hardware', 'Hardware Specifications', 2),
    ('network', 'Network Configuration', 3),
    ('software', 'Software & OS', 4),
    ('location', 'Location & Assignment', 5),
    ('lifecycle', 'Lifecycle & Warranty', 6);

-- Default field definitions for server inventory
INSERT INTO admin.field_definitions (field_key, display_name, field_type, is_required, is_system, display_order, field_group, placeholder, max_length) VALUES
    ('hostname', 'Hostname', 'text', true, true, 1, 'general', 'e.g., srv-web-01', 200),
    ('ip_address', 'IP Address', 'ip_address', true, true, 2, 'network', 'e.g., 192.168.1.100', 45),
    ('mac_address', 'MAC Address', 'text', false, false, 3, 'network', 'e.g., AA:BB:CC:DD:EE:FF', 17),
    ('serial_number', 'Serial Number', 'text', false, true, 4, 'general', 'Enter serial number', 100),
    ('manufacturer', 'Manufacturer', 'select', false, false, 5, 'hardware', NULL, NULL),
    ('model', 'Model', 'text', false, false, 6, 'hardware', 'e.g., PowerEdge R740', 200),
    ('cpu', 'CPU', 'text', false, false, 7, 'hardware', 'e.g., Intel Xeon Gold 6248', 200),
    ('cpu_cores', 'CPU Cores', 'number', false, false, 8, 'hardware', 'e.g., 24', NULL),
    ('ram_gb', 'RAM (GB)', 'number', false, false, 9, 'hardware', 'e.g., 128', NULL),
    ('storage', 'Storage', 'text', false, false, 10, 'hardware', 'e.g., 2x 1TB SSD RAID1', 500),
    ('os', 'Operating System', 'select', false, false, 11, 'software', NULL, NULL),
    ('os_version', 'OS Version', 'text', false, false, 12, 'software', 'e.g., 22.04 LTS', 100),
    ('environment', 'Environment', 'select', true, false, 13, 'general', NULL, NULL),
    ('datacenter', 'Datacenter', 'select', false, false, 14, 'location', NULL, NULL),
    ('rack', 'Rack', 'text', false, false, 15, 'location', 'e.g., R12-A03', 50),
    ('rack_unit', 'Rack Unit', 'text', false, false, 16, 'location', 'e.g., U24-U26', 20),
    ('assigned_to', 'Assigned To', 'text', false, false, 17, 'location', 'Team or person', 200),
    ('purchase_date', 'Purchase Date', 'date', false, false, 18, 'lifecycle', NULL, NULL),
    ('warranty_expiry', 'Warranty Expiry', 'date', false, false, 19, 'lifecycle', NULL, NULL),
    ('notes', 'Notes', 'textarea', false, false, 20, 'general', 'Additional notes', 2000);

-- Default select options
UPDATE admin.field_definitions SET select_options = '["Dell", "HP", "Lenovo", "Cisco", "Supermicro", "Other"]'::jsonb WHERE field_key = 'manufacturer';
UPDATE admin.field_definitions SET select_options = '["Ubuntu", "CentOS", "RHEL", "Windows Server", "Debian", "SUSE", "VMware ESXi", "Other"]'::jsonb WHERE field_key = 'os';
UPDATE admin.field_definitions SET select_options = '["Production", "Staging", "Development", "Testing", "DR"]'::jsonb WHERE field_key = 'environment';
UPDATE admin.field_definitions SET select_options = '["DC1", "DC2", "Cloud-AWS", "Cloud-Azure", "Cloud-GCP", "Other"]'::jsonb WHERE field_key = 'datacenter';

-- Add validation rules
UPDATE admin.field_definitions SET validation_rules = '{"pattern": "^[a-zA-Z0-9][a-zA-Z0-9.-]*$"}'::jsonb WHERE field_key = 'hostname';
UPDATE admin.field_definitions SET validation_rules = '{"pattern": "^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$"}'::jsonb WHERE field_key = 'mac_address';
