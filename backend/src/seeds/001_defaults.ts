import type { Knex } from 'knex';
import { v4 as uuid } from 'uuid';

export async function seed(knex: Knex): Promise<void> {
  // Seed default roles
  const adminRoleId = uuid();
  const editorRoleId = uuid();
  const viewerRoleId = uuid();

  await knex('auth.roles').del();
  await knex('auth.roles').insert([
    { id: adminRoleId, name: 'admin', description: 'Full system access', is_system: true },
    { id: editorRoleId, name: 'editor', description: 'Can import, export and edit assets', is_system: true },
    { id: viewerRoleId, name: 'viewer', description: 'Read-only access to assets', is_system: true },
  ]);

  // Seed permissions
  const permissions = [
    { resource: 'assets', action: 'create' },
    { resource: 'assets', action: 'read' },
    { resource: 'assets', action: 'update' },
    { resource: 'assets', action: 'delete' },
    { resource: 'assets', action: 'import' },
    { resource: 'assets', action: 'export' },
    { resource: 'fields', action: 'create' },
    { resource: 'fields', action: 'read' },
    { resource: 'fields', action: 'update' },
    { resource: 'fields', action: 'delete' },
    { resource: 'users', action: 'read' },
    { resource: 'users', action: 'manage' },
    { resource: 'roles', action: 'manage' },
    { resource: 'audit', action: 'read' },
    { resource: 'templates', action: 'create' },
    { resource: 'templates', action: 'read' },
    { resource: 'templates', action: 'update' },
    { resource: 'templates', action: 'delete' },
  ].map((p) => ({ id: uuid(), ...p }));

  await knex('auth.permissions').del();
  await knex('auth.permissions').insert(permissions);

  // Admin gets all permissions
  await knex('auth.role_permissions').del();
  await knex('auth.role_permissions').insert(
    permissions.map((p) => ({ role_id: adminRoleId, permission_id: p.id }))
  );

  // Editor gets asset CRUD + import/export + field read + template CRUD
  const editorActions = [
    'assets:create', 'assets:read', 'assets:update', 'assets:import', 'assets:export',
    'fields:read', 'templates:create', 'templates:read', 'templates:update', 'templates:delete',
  ];
  const editorPerms = permissions.filter((p) => editorActions.includes(`${p.resource}:${p.action}`));
  await knex('auth.role_permissions').insert(
    editorPerms.map((p) => ({ role_id: editorRoleId, permission_id: p.id }))
  );

  // Viewer gets read + export
  const viewerActions = ['assets:read', 'assets:export', 'fields:read', 'templates:read'];
  const viewerPerms = permissions.filter((p) => viewerActions.includes(`${p.resource}:${p.action}`));
  await knex('auth.role_permissions').insert(
    viewerPerms.map((p) => ({ role_id: viewerRoleId, permission_id: p.id }))
  );

  // Seed default field definitions
  await knex('admin.field_definitions').del();
  const defaultFields = [
    { field_key: 'hostname', display_name: 'Hostname', field_type: 'text', is_required: true, is_system: true, sort_order: 1, field_group: 'General' },
    { field_key: 'ip_address', display_name: 'IP Address', field_type: 'ip_address', is_required: true, is_system: true, sort_order: 2, field_group: 'Network', validation_rules: JSON.stringify({ pattern: '^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$' }) },
    { field_key: 'operating_system', display_name: 'Operating System', field_type: 'select', is_required: true, is_system: false, sort_order: 3, field_group: 'General', select_options: JSON.stringify(['Windows Server 2022', 'Windows Server 2019', 'RHEL 9', 'RHEL 8', 'Ubuntu 22.04', 'Ubuntu 20.04', 'CentOS 7']) },
    { field_key: 'environment', display_name: 'Environment', field_type: 'select', is_required: true, is_system: false, sort_order: 4, field_group: 'General', select_options: JSON.stringify(['Production', 'Staging', 'Development', 'QA', 'DR']) },
    { field_key: 'location', display_name: 'Data Center / Location', field_type: 'text', is_required: false, is_system: false, sort_order: 5, field_group: 'Location' },
    { field_key: 'rack_number', display_name: 'Rack Number', field_type: 'text', is_required: false, is_system: false, sort_order: 6, field_group: 'Location' },
    { field_key: 'cpu_cores', display_name: 'CPU Cores', field_type: 'number', is_required: false, is_system: false, sort_order: 7, field_group: 'Hardware', validation_rules: JSON.stringify({ min: 1, max: 1024 }) },
    { field_key: 'ram_gb', display_name: 'RAM (GB)', field_type: 'number', is_required: false, is_system: false, sort_order: 8, field_group: 'Hardware', validation_rules: JSON.stringify({ min: 1, max: 65536 }) },
    { field_key: 'disk_gb', display_name: 'Disk (GB)', field_type: 'number', is_required: false, is_system: false, sort_order: 9, field_group: 'Hardware', validation_rules: JSON.stringify({ min: 1 }) },
    { field_key: 'status', display_name: 'Status', field_type: 'select', is_required: true, is_system: true, sort_order: 10, field_group: 'General', select_options: JSON.stringify(['Active', 'Inactive', 'Decommissioned', 'Maintenance']) },
    { field_key: 'owner', display_name: 'Owner / Team', field_type: 'text', is_required: false, is_system: false, sort_order: 11, field_group: 'Ownership' },
    { field_key: 'notes', display_name: 'Notes', field_type: 'textarea', is_required: false, is_system: false, sort_order: 12, field_group: 'General' },
  ].map((f) => ({ id: uuid(), ...f }));

  await knex('admin.field_definitions').insert(defaultFields);
}
