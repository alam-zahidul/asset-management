import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // VMware vCenter connections managed by admins
  await knex.schema.withSchema('admin').createTable('vmware_connections', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.string('server', 500).notNullable();
    table.string('username', 255).notNullable();
    table.text('encrypted_password').notNullable();
    table.boolean('tls_reject_unauthorized').notNullable().defaultTo(true);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.integer('sync_interval_minutes').notNullable().defaultTo(60);
    table.timestamp('last_sync_at').nullable();
    table.string('last_sync_status', 20).nullable(); // success, failed, running
    table.text('last_sync_error').nullable();
    table.integer('last_sync_asset_count').nullable();
    table.uuid('created_by').nullable().references('id').inTable('auth.users');
    table.uuid('updated_by').nullable().references('id').inTable('auth.users');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index(['is_active']);
  });

  // Sync history / logs
  await knex.schema.withSchema('app').createTable('vmware_sync_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('connection_id').notNullable().references('id').inTable('admin.vmware_connections').onDelete('CASCADE');
    table.uuid('triggered_by').nullable().references('id').inTable('auth.users');
    table.string('status', 20).notNullable().defaultTo('running'); // running, success, failed
    table.integer('vms_found').notNullable().defaultTo(0);
    table.integer('hosts_found').notNullable().defaultTo(0);
    table.integer('assets_created').notNullable().defaultTo(0);
    table.integer('assets_updated').notNullable().defaultTo(0);
    table.integer('errors_count').notNullable().defaultTo(0);
    table.jsonb('error_details').nullable();
    table.timestamp('started_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('completed_at').nullable();
    table.index(['connection_id']);
    table.index(['status']);
    table.index(['started_at']);
  });

  // Add source tracking to assets
  await knex.schema.withSchema('app').alterTable('assets', (table) => {
    table.string('source', 50).notNullable().defaultTo('manual'); // manual, vmware
    table.string('source_ref', 500).nullable(); // e.g. vmware moref "vm-123"
    table.uuid('source_connection_id').nullable().references('id').inTable('admin.vmware_connections').onDelete('SET NULL');
    table.index(['source']);
    table.index(['source_ref']);
  });

  // Add VMware permissions
  await knex('auth.permissions').insert([
    { id: knex.raw('gen_random_uuid()'), resource: 'vmware', action: 'read', description: 'View VMware connections and sync status' },
    { id: knex.raw('gen_random_uuid()'), resource: 'vmware', action: 'manage', description: 'Manage VMware connections' },
    { id: knex.raw('gen_random_uuid()'), resource: 'vmware', action: 'sync', description: 'Trigger VMware inventory sync' },
  ]);

  // Grant VMware permissions to admin role
  const adminRole = await knex('auth.roles').where('name', 'admin').first();
  if (adminRole) {
    const vmwarePerms = await knex('auth.permissions').where('resource', 'vmware');
    for (const perm of vmwarePerms) {
      await knex('auth.role_permissions').insert({ role_id: adminRole.id, permission_id: perm.id }).onConflict().ignore();
    }
  }

  // Grant vmware:read and vmware:sync to editor role
  const editorRole = await knex('auth.roles').where('name', 'editor').first();
  if (editorRole) {
    const readPerm = await knex('auth.permissions').where({ resource: 'vmware', action: 'read' }).first();
    const syncPerm = await knex('auth.permissions').where({ resource: 'vmware', action: 'sync' }).first();
    if (readPerm) await knex('auth.role_permissions').insert({ role_id: editorRole.id, permission_id: readPerm.id }).onConflict().ignore();
    if (syncPerm) await knex('auth.role_permissions').insert({ role_id: editorRole.id, permission_id: syncPerm.id }).onConflict().ignore();
  }
}

export async function down(knex: Knex): Promise<void> {
  // Remove VMware permissions
  const vmwarePerms = await knex('auth.permissions').where('resource', 'vmware');
  for (const perm of vmwarePerms) {
    await knex('auth.role_permissions').where('permission_id', perm.id).del();
  }
  await knex('auth.permissions').where('resource', 'vmware').del();

  // Remove source columns from assets
  await knex.schema.withSchema('app').alterTable('assets', (table) => {
    table.dropIndex(['source']);
    table.dropIndex(['source_ref']);
    table.dropColumn('source_connection_id');
    table.dropColumn('source_ref');
    table.dropColumn('source');
  });

  await knex.schema.withSchema('app').dropTableIfExists('vmware_sync_logs');
  await knex.schema.withSchema('admin').dropTableIfExists('vmware_connections');
}
