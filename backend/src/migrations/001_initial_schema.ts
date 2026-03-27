import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create separate schemas
  await knex.raw('CREATE SCHEMA IF NOT EXISTS auth');
  await knex.raw('CREATE SCHEMA IF NOT EXISTS app');
  await knex.raw('CREATE SCHEMA IF NOT EXISTS admin');

  // ===== AUTH SCHEMA =====
  await knex.schema.withSchema('auth').createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('username', 100).notNullable().unique();
    table.string('email', 255).notNullable();
    table.string('display_name', 255).notNullable();
    table.string('department', 255).nullable();
    table.string('ldap_dn', 500).nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('last_login').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index(['username']);
    table.index(['is_active']);
  });

  await knex.schema.withSchema('auth').createTable('roles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 50).notNullable().unique();
    table.string('description', 255).nullable();
    table.boolean('is_system').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('auth').createTable('permissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('resource', 100).notNullable();
    table.string('action', 50).notNullable();
    table.string('description', 255).nullable();
    table.unique(['resource', 'action']);
  });

  await knex.schema.withSchema('auth').createTable('role_permissions', (table) => {
    table.uuid('role_id').notNullable().references('id').inTable('auth.roles').onDelete('CASCADE');
    table.uuid('permission_id').notNullable().references('id').inTable('auth.permissions').onDelete('CASCADE');
    table.primary(['role_id', 'permission_id']);
  });

  await knex.schema.withSchema('auth').createTable('user_roles', (table) => {
    table.uuid('user_id').notNullable().references('id').inTable('auth.users').onDelete('CASCADE');
    table.uuid('role_id').notNullable().references('id').inTable('auth.roles').onDelete('CASCADE');
    table.uuid('assigned_by').nullable().references('id').inTable('auth.users');
    table.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now());
    table.primary(['user_id', 'role_id']);
  });

  await knex.schema.withSchema('auth').createTable('refresh_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('auth.users').onDelete('CASCADE');
    table.string('token_hash', 128).notNullable().unique();
    table.timestamp('expires_at').notNullable();
    table.boolean('is_revoked').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['user_id']);
    table.index(['token_hash']);
  });

  // ===== ADMIN SCHEMA =====
  await knex.schema.withSchema('admin').createTable('field_definitions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('field_key', 100).notNullable().unique();
    table.string('display_name', 255).notNullable();
    table.string('field_type', 50).notNullable(); // text, number, date, select, boolean, email, url, ip_address, textarea
    table.boolean('is_required').notNullable().defaultTo(false);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.boolean('is_system').notNullable().defaultTo(false); // system fields cannot be deleted
    table.boolean('is_filterable').notNullable().defaultTo(true);
    table.boolean('is_exportable').notNullable().defaultTo(true);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.jsonb('validation_rules').nullable(); // { min, max, pattern, options[], etc. }
    table.jsonb('select_options').nullable(); // for select type fields
    table.string('default_value', 500).nullable();
    table.string('placeholder', 255).nullable();
    table.string('help_text', 500).nullable();
    table.string('field_group', 100).nullable(); // grouping for UI
    table.uuid('created_by').nullable().references('id').inTable('auth.users');
    table.uuid('updated_by').nullable().references('id').inTable('auth.users');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index(['field_key']);
    table.index(['is_active']);
    table.index(['sort_order']);
  });

  await knex.schema.withSchema('admin').createTable('export_templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.jsonb('field_ids').notNullable(); // ordered array of field definition IDs to include
    table.jsonb('filters').nullable(); // saved filter criteria
    table.string('format', 20).notNullable().defaultTo('xlsx'); // xlsx, csv, pdf
    table.uuid('created_by').nullable().references('id').inTable('auth.users');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('admin').createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').nullable().references('id').inTable('auth.users');
    table.string('action', 100).notNullable();
    table.string('resource', 100).notNullable();
    table.string('resource_id', 100).nullable();
    table.jsonb('old_values').nullable();
    table.jsonb('new_values').nullable();
    table.string('ip_address', 45).nullable();
    table.string('user_agent', 500).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['user_id']);
    table.index(['resource', 'resource_id']);
    table.index(['created_at']);
  });

  // ===== APP SCHEMA =====
  await knex.schema.withSchema('app').createTable('assets', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('asset_tag', 100).notNullable().unique();
    table.jsonb('field_values').notNullable().defaultTo('{}');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.uuid('created_by').nullable().references('id').inTable('auth.users');
    table.uuid('updated_by').nullable().references('id').inTable('auth.users');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index(['asset_tag']);
    table.index(['is_active']);
  });

  // GIN index on JSONB for fast field value queries
  await knex.raw('CREATE INDEX idx_assets_field_values ON app.assets USING gin (field_values jsonb_path_ops)');

  await knex.schema.withSchema('app').createTable('import_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('auth.users');
    table.string('file_name', 255).notNullable();
    table.string('file_type', 10).notNullable();
    table.integer('total_rows').notNullable().defaultTo(0);
    table.integer('success_rows').notNullable().defaultTo(0);
    table.integer('error_rows').notNullable().defaultTo(0);
    table.string('status', 20).notNullable().defaultTo('processing'); // processing, completed, failed
    table.jsonb('errors').nullable(); // array of { row, field, message }
    table.timestamp('started_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('completed_at').nullable();
    table.index(['user_id']);
    table.index(['status']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema('app').dropTableIfExists('import_logs');
  await knex.schema.withSchema('app').dropTableIfExists('assets');
  await knex.schema.withSchema('admin').dropTableIfExists('audit_logs');
  await knex.schema.withSchema('admin').dropTableIfExists('export_templates');
  await knex.schema.withSchema('admin').dropTableIfExists('field_definitions');
  await knex.schema.withSchema('auth').dropTableIfExists('refresh_tokens');
  await knex.schema.withSchema('auth').dropTableIfExists('user_roles');
  await knex.schema.withSchema('auth').dropTableIfExists('role_permissions');
  await knex.schema.withSchema('auth').dropTableIfExists('permissions');
  await knex.schema.withSchema('auth').dropTableIfExists('roles');
  await knex.schema.withSchema('auth').dropTableIfExists('users');
  await knex.raw('DROP SCHEMA IF EXISTS app CASCADE');
  await knex.raw('DROP SCHEMA IF EXISTS admin CASCADE');
  await knex.raw('DROP SCHEMA IF EXISTS auth CASCADE');
}
