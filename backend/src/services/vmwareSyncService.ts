import crypto from 'crypto';
import db from '../config/database';
import config from '../config';
import logger from '../utils/logger';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { VmwareClient, VmwareVmInfo } from './vmwareClient';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = config.vmware.encryptionKey;
  if (!key || key.length < 16) {
    throw new Error('VMWARE_ENCRYPTION_KEY must be set (min 16 chars)');
  }
  // Derive a 32-byte key from the configured value
  return crypto.scryptSync(key, 'vmware-salt', 32);
}

function encryptPassword(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as: iv:tag:encrypted (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptPassword(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted password format');
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = Buffer.from(parts[2], 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

// --- Connection CRUD ---

export interface VmwareConnectionInput {
  name: string;
  server: string;
  username: string;
  password: string;
  tls_reject_unauthorized?: boolean;
  sync_interval_minutes?: number;
}

export async function createConnection(input: VmwareConnectionInput, userId: string) {
  const encrypted = encryptPassword(input.password);

  const [conn] = await db('admin.vmware_connections')
    .insert({
      name: input.name,
      server: input.server,
      username: input.username,
      encrypted_password: encrypted,
      tls_reject_unauthorized: input.tls_reject_unauthorized ?? true,
      sync_interval_minutes: input.sync_interval_minutes ?? 60,
      created_by: userId,
      updated_by: userId,
    })
    .returning('*');

  const { encrypted_password, ...safe } = conn;
  return safe;
}

export async function updateConnection(id: string, input: Partial<VmwareConnectionInput>, userId: string) {
  const existing = await db('admin.vmware_connections').where('id', id).first();
  if (!existing) throw new NotFoundError('VMware connection not found');

  const update: Record<string, unknown> = { updated_by: userId, updated_at: db.fn.now() };
  if (input.name !== undefined) update.name = input.name;
  if (input.server !== undefined) update.server = input.server;
  if (input.username !== undefined) update.username = input.username;
  if (input.password !== undefined) update.encrypted_password = encryptPassword(input.password);
  if (input.tls_reject_unauthorized !== undefined) update.tls_reject_unauthorized = input.tls_reject_unauthorized;
  if (input.sync_interval_minutes !== undefined) update.sync_interval_minutes = input.sync_interval_minutes;

  const [conn] = await db('admin.vmware_connections')
    .where('id', id)
    .update(update)
    .returning('*');

  const { encrypted_password, ...safe } = conn;
  return safe;
}

export async function deleteConnection(id: string) {
  const existing = await db('admin.vmware_connections').where('id', id).first();
  if (!existing) throw new NotFoundError('VMware connection not found');
  await db('admin.vmware_connections').where('id', id).del();
}

export async function getConnections() {
  const connections = await db('admin.vmware_connections')
    .select('id', 'name', 'server', 'username', 'tls_reject_unauthorized', 'is_active',
      'sync_interval_minutes', 'last_sync_at', 'last_sync_status', 'last_sync_error',
      'last_sync_asset_count', 'created_at', 'updated_at')
    .orderBy('created_at', 'desc');
  return connections;
}

export async function getConnectionById(id: string) {
  const conn = await db('admin.vmware_connections')
    .select('id', 'name', 'server', 'username', 'tls_reject_unauthorized', 'is_active',
      'sync_interval_minutes', 'last_sync_at', 'last_sync_status', 'last_sync_error',
      'last_sync_asset_count', 'created_at', 'updated_at')
    .where('id', id)
    .first();
  if (!conn) throw new NotFoundError('VMware connection not found');
  return conn;
}

export async function toggleConnectionActive(id: string) {
  const existing = await db('admin.vmware_connections').where('id', id).first();
  if (!existing) throw new NotFoundError('VMware connection not found');
  const [conn] = await db('admin.vmware_connections')
    .where('id', id)
    .update({ is_active: !existing.is_active, updated_at: db.fn.now() })
    .returning(['id', 'is_active']);
  return conn;
}

// --- Test Connection ---

export async function testConnection(id: string) {
  const conn = await db('admin.vmware_connections').where('id', id).first();
  if (!conn) throw new NotFoundError('VMware connection not found');

  const password = decryptPassword(conn.encrypted_password);
  const client = new VmwareClient(conn.server, conn.username, password, conn.tls_reject_unauthorized);

  return client.testConnection();
}

export async function testConnectionDirect(input: { server: string; username: string; password: string; tls_reject_unauthorized?: boolean }) {
  const client = new VmwareClient(input.server, input.username, input.password, input.tls_reject_unauthorized ?? true);
  return client.testConnection();
}

// --- Sync Inventory ---

function mapVmToAsset(vm: VmwareVmInfo, connectionId: string): {
  asset_tag: string;
  field_values: Record<string, unknown>;
  source: string;
  source_ref: string;
  source_connection_id: string;
} {
  const storageGB = vm.committedStorageBytes
    ? Math.round(vm.committedStorageBytes / (1024 * 1024 * 1024))
    : null;

  return {
    asset_tag: `vmware-${vm.moRef}`,
    field_values: {
      hostname: vm.name,
      ip_address: vm.ipAddress || '',
      cpu_cores: vm.numCpu,
      ram_gb: vm.memorySizeMB ? Math.round(vm.memorySizeMB / 1024) : null,
      disk_gb: storageGB,
      operating_system: vm.guestFullName || '',
      status: vm.powerState === 'poweredOn' ? 'Active' : 'Inactive',
    },
    source: 'vmware',
    source_ref: vm.moRef,
    source_connection_id: connectionId,
  };
}

export async function syncInventory(connectionId: string, triggeredBy?: string) {
  const conn = await db('admin.vmware_connections').where('id', connectionId).first();
  if (!conn) throw new NotFoundError('VMware connection not found');
  if (!conn.is_active) throw new BadRequestError('Connection is not active');

  // Create sync log entry
  const [syncLog] = await db('app.vmware_sync_logs')
    .insert({
      connection_id: connectionId,
      triggered_by: triggeredBy || null,
      status: 'running',
    })
    .returning('*');

  // Mark connection as syncing
  await db('admin.vmware_connections').where('id', connectionId).update({
    last_sync_status: 'running',
    last_sync_error: null,
  });

  try {
    const password = decryptPassword(conn.encrypted_password);
    const client = new VmwareClient(conn.server, conn.username, password, conn.tls_reject_unauthorized);

    await client.login();

    let inventory;
    try {
      inventory = await client.getInventory();
    } finally {
      await client.logout();
    }

    // Map VMs to asset records
    const assetRecords = inventory.vms.map((vm) => mapVmToAsset(vm, connectionId));

    let created = 0;
    let updated = 0;
    const errors: Array<{ vm: string; error: string }> = [];

    for (const record of assetRecords) {
      try {
        const existing = await db('app.assets')
          .where('source', 'vmware')
          .where('source_ref', record.source_ref)
          .where('source_connection_id', connectionId)
          .first();

        if (existing) {
          // Merge: keep manual overrides, update VMware-sourced fields
          const merged = { ...existing.field_values };
          for (const [key, value] of Object.entries(record.field_values)) {
            if (value !== null && value !== undefined && value !== '') {
              merged[key] = value;
            }
          }
          await db('app.assets').where('id', existing.id).update({
            field_values: JSON.stringify(merged),
            updated_at: db.fn.now(),
            is_active: true,
          });
          updated++;
        } else {
          // Filter out null/empty field values for new records
          const cleanValues: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(record.field_values)) {
            if (value !== null && value !== undefined && value !== '') {
              cleanValues[key] = value;
            }
          }
          await db('app.assets').insert({
            asset_tag: record.asset_tag,
            field_values: JSON.stringify(cleanValues),
            source: record.source,
            source_ref: record.source_ref,
            source_connection_id: record.source_connection_id,
            created_by: triggeredBy || null,
            updated_by: triggeredBy || null,
          });
          created++;
        }
      } catch (err) {
        errors.push({ vm: record.asset_tag, error: (err as Error).message });
      }
    }

    // Update sync log
    await db('app.vmware_sync_logs').where('id', syncLog.id).update({
      status: 'success',
      vms_found: inventory.vms.length,
      hosts_found: inventory.hosts.length,
      assets_created: created,
      assets_updated: updated,
      errors_count: errors.length,
      error_details: errors.length > 0 ? JSON.stringify(errors) : null,
      completed_at: db.fn.now(),
    });

    // Update connection status
    await db('admin.vmware_connections').where('id', connectionId).update({
      last_sync_at: db.fn.now(),
      last_sync_status: 'success',
      last_sync_error: null,
      last_sync_asset_count: created + updated,
      updated_at: db.fn.now(),
    });

    logger.info(`VMware sync completed for ${conn.name}: ${created} created, ${updated} updated, ${errors.length} errors`);

    return {
      connectionId,
      vmsFound: inventory.vms.length,
      hostsFound: inventory.hosts.length,
      assetsCreated: created,
      assetsUpdated: updated,
      errors: errors.length,
    };
  } catch (err) {
    const errorMsg = (err as Error).message;
    logger.error(`VMware sync failed for ${conn.name}: ${errorMsg}`);

    await db('app.vmware_sync_logs').where('id', syncLog.id).update({
      status: 'failed',
      error_details: JSON.stringify([{ error: errorMsg }]),
      completed_at: db.fn.now(),
    });

    await db('admin.vmware_connections').where('id', connectionId).update({
      last_sync_at: db.fn.now(),
      last_sync_status: 'failed',
      last_sync_error: errorMsg,
      updated_at: db.fn.now(),
    });

    throw err;
  }
}

// --- Sync Logs ---

export async function getSyncLogs(connectionId?: string, page = 1, limit = 25) {
  const query = db('app.vmware_sync_logs')
    .leftJoin('auth.users', 'app.vmware_sync_logs.triggered_by', 'auth.users.id')
    .leftJoin('admin.vmware_connections', 'app.vmware_sync_logs.connection_id', 'admin.vmware_connections.id')
    .select(
      'app.vmware_sync_logs.*',
      'auth.users.username as triggered_by_username',
      'admin.vmware_connections.name as connection_name'
    );

  if (connectionId) {
    query.where('app.vmware_sync_logs.connection_id', connectionId);
  }

  const countResult = await query.clone().clearSelect().count('app.vmware_sync_logs.id as total').first();
  const total = Number(countResult?.total || 0);

  const data = await query
    .orderBy('app.vmware_sync_logs.started_at', 'desc')
    .offset((page - 1) * limit)
    .limit(limit);

  return { data, total, page, limit };
}
