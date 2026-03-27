import https from 'https';
import http from 'http';
import logger from '../utils/logger';

/**
 * VMware VI/JSON API Client
 * Based on: https://blogs.vmware.com/code/2023/12/28/read-vcenter-inventory-using-vi-json-api/
 *
 * Implements the VI/JSON protocol to read vCenter inventory:
 * 1. Negotiate API release
 * 2. Login via SessionManager
 * 3. Use PropertyCollector + ContainerView to fetch VM/Host properties
 */

interface VIJsonResponse {
  value?: unknown;
  error?: { messages?: Array<{ default_message: string }> };
}

interface ManagedObjectReference {
  type: string;
  value: string;
}

interface PropertyValue {
  name: string;
  val?: unknown;
}

interface ObjectContent {
  obj: ManagedObjectReference;
  propSet?: PropertyValue[];
}

interface RetrieveResult {
  objects?: ObjectContent[];
  token?: string;
}

export interface VmwareVmInfo {
  moRef: string;
  name: string;
  ipAddress: string | null;
  numCpu: number | null;
  memorySizeMB: number | null;
  guestFullName: string | null;
  powerState: string | null;
  committedStorageBytes: number | null;
}

export interface VmwareHostInfo {
  moRef: string;
  name: string;
}

export interface VmwareInventoryResult {
  vms: VmwareVmInfo[];
  hosts: VmwareHostInfo[];
}

// Supported vSphere releases - from newest to oldest
const SUPPORTED_RELEASES = [
  'v8.0.2.0', 'v8.0.1.0', 'v8.0.0.1', 'v8.0.0.0',
  'v7.0.3.0', 'v7.0.2.0', 'v7.0.1.0', 'v7.0.0.0',
];

export class VmwareClient {
  private server: string;
  private username: string;
  private password: string;
  private tlsRejectUnauthorized: boolean;
  private release: string | null = null;
  private sessionId: string | null = null;
  private serviceContent: Record<string, unknown> | null = null;

  constructor(server: string, username: string, password: string, tlsRejectUnauthorized = true) {
    // Strip protocol if provided
    this.server = server.replace(/^https?:\/\//, '').replace(/\/$/, '');
    this.username = username;
    this.password = password;
    this.tlsRejectUnauthorized = tlsRejectUnauthorized;
  }

  /**
   * Make an HTTPS request to the vCenter VI/JSON endpoint.
   */
  private request(method: string, path: string, body?: unknown): Promise<VIJsonResponse> {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : undefined;
      const url = new URL(`https://${this.server}${path}`);

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method,
        rejectAuthorized: this.tlsRejectUnauthorized,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(this.sessionId ? { 'vmware-api-session-id': this.sessionId } : {}),
        },
      };

      const proto = url.protocol === 'http:' ? http : https;
      if (proto === https) {
        (options as https.RequestOptions).rejectUnauthorized = this.tlsRejectUnauthorized;
      }

      const req = proto.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(raw ? JSON.parse(raw) : {});
            } catch {
              resolve({ value: raw });
            }
          } else if (res.statusCode === 204) {
            resolve({});
          } else {
            reject(new Error(`vCenter API ${method} ${path} returned ${res.statusCode}: ${raw.slice(0, 500)}`));
          }
        });
      });

      req.on('error', (err) => reject(new Error(`vCenter connection to ${this.server} failed: ${err.message}`)));
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error(`vCenter request to ${this.server}${path} timed out`));
      });

      if (payload) req.write(payload);
      req.end();
    });
  }

  /**
   * Step 1: Negotiate the API release version.
   * POST /sdk/vim25/v8.0.2.0/ServiceInstance/ServiceInstance/RetrieveServiceContent
   * Falls back to the REST hello endpoint or uses a known release.
   */
  async negotiateRelease(): Promise<string> {
    // Try each release to find one that works
    for (const rel of SUPPORTED_RELEASES) {
      try {
        const result = await this.request(
          'POST',
          `/sdk/vim25/${rel}/ServiceInstance/ServiceInstance/RetrieveServiceContent`
        );
        if (result.value) {
          this.release = rel;
          this.serviceContent = result.value as Record<string, unknown>;
          logger.info(`VMware: Negotiated release ${rel} with ${this.server}`);
          return rel;
        }
      } catch {
        continue;
      }
    }
    throw new Error(`Could not negotiate API release with vCenter ${this.server}`);
  }

  /**
   * Build the VI/JSON URL for a managed object.
   */
  private viUrl(moRefType: string, moRefValue: string, method?: string): string {
    if (!this.release) throw new Error('Release not negotiated');
    const base = `/sdk/vim25/${this.release}/${moRefType}/${moRefValue}`;
    return method ? `${base}/${method}` : base;
  }

  /**
   * Step 2: Login via SessionManager.
   * Returns a session ID stored in the vmware-api-session-id header.
   */
  async login(): Promise<void> {
    if (!this.serviceContent) {
      await this.negotiateRelease();
    }

    const sessionManager = this.serviceContent?.sessionManager as ManagedObjectReference | undefined;
    if (!sessionManager) throw new Error('SessionManager not found in ServiceContent');

    // Use the full POST pattern: /sdk/vim25/{release}/SessionManager/{moref}/Login
    const result = await this.request(
      'POST',
      this.viUrl(sessionManager.type, sessionManager.value, 'Login'),
      { userName: this.username, password: this.password }
    );

    // The session key from the response body
    const session = result.value as { key?: string } | undefined;
    if (session?.key) {
      this.sessionId = session.key;
      logger.info(`VMware: Logged in to ${this.server}`);
    } else {
      throw new Error('Login failed: no session key returned');
    }
  }

  /**
   * Logout and destroy the session.
   */
  async logout(): Promise<void> {
    if (!this.sessionId || !this.serviceContent) return;
    const sessionManager = this.serviceContent.sessionManager as ManagedObjectReference | undefined;
    if (!sessionManager) return;

    try {
      await this.request(
        'POST',
        this.viUrl(sessionManager.type, sessionManager.value, 'Logout')
      );
    } catch (err) {
      logger.warn(`VMware: Logout cleanup error: ${(err as Error).message}`);
    } finally {
      this.sessionId = null;
    }
  }

  /**
   * Step 3: Create a ContainerView for container (rootFolder) + type list.
   */
  private async createContainerView(container: ManagedObjectReference, types: string[], recursive = true): Promise<ManagedObjectReference> {
    const viewManager = this.serviceContent?.viewManager as ManagedObjectReference | undefined;
    if (!viewManager) throw new Error('ViewManager not found');

    const result = await this.request(
      'POST',
      this.viUrl(viewManager.type, viewManager.value, 'CreateContainerView'),
      { container, type: types, recursive }
    );

    return result.value as ManagedObjectReference;
  }

  /**
   * Destroy a view.
   */
  private async destroyView(view: ManagedObjectReference): Promise<void> {
    try {
      await this.request(
        'POST',
        this.viUrl(view.type, view.value, 'DestroyView')
      );
    } catch (err) {
      logger.warn(`VMware: DestroyView cleanup error: ${(err as Error).message}`);
    }
  }

  /**
   * Step 4: Use PropertyCollector to retrieve properties for all objects in a view.
   * Handles pagination via token-based ContinueRetrievePropertiesEx.
   */
  private async retrieveProperties(
    view: ManagedObjectReference,
    objectType: string,
    properties: string[]
  ): Promise<ObjectContent[]> {
    const propCollector = this.serviceContent?.propertyCollector as ManagedObjectReference | undefined;
    if (!propCollector) throw new Error('PropertyCollector not found');

    const specSet = [{
      propSet: [{
        type: objectType,
        pathSet: properties,
      }],
      objectSet: [{
        obj: view,
        skip: true,
        selectSet: [{
          _typeName: 'TraversalSpec',
          name: 'traverseEntities',
          type: view.type,
          path: 'view',
          skip: false,
        }],
      }],
    }];

    const options = { maxObjects: 500 };

    // Initial retrieve
    const result = await this.request(
      'POST',
      this.viUrl(propCollector.type, propCollector.value, 'RetrievePropertiesEx'),
      { specSet, options }
    );

    const retrieveResult = result.value as RetrieveResult | undefined;
    const allObjects: ObjectContent[] = [...(retrieveResult?.objects || [])];

    // Handle pagination
    let token = retrieveResult?.token;
    while (token) {
      const contResult = await this.request(
        'POST',
        this.viUrl(propCollector.type, propCollector.value, 'ContinueRetrievePropertiesEx'),
        { token }
      );
      const contData = contResult.value as RetrieveResult | undefined;
      allObjects.push(...(contData?.objects || []));
      token = contData?.token;
    }

    return allObjects;
  }

  /**
   * Extract a nested property from a PropertyValue.
   * Handles dot-notation paths like "summary.guest.ipAddress".
   */
  private extractPropertyValue(propSet: PropertyValue[] | undefined, propName: string): unknown {
    if (!propSet) return null;
    const prop = propSet.find((p) => p.name === propName);
    return prop?.val ?? null;
  }

  /**
   * Fetch the full VM inventory from vCenter.
   */
  async getVirtualMachines(): Promise<VmwareVmInfo[]> {
    const rootFolder = this.serviceContent?.rootFolder as ManagedObjectReference | undefined;
    if (!rootFolder) throw new Error('rootFolder not found in ServiceContent');

    const view = await this.createContainerView(rootFolder, ['VirtualMachine']);

    try {
      const objects = await this.retrieveProperties(view, 'VirtualMachine', [
        'name',
        'summary.guest.ipAddress',
        'summary.config.numCpu',
        'summary.config.memorySizeMB',
        'summary.config.guestFullName',
        'runtime.powerState',
        'summary.storage.committed',
      ]);

      return objects.map((obj) => ({
        moRef: obj.obj.value,
        name: (this.extractPropertyValue(obj.propSet, 'name') as string) || 'Unknown',
        ipAddress: (this.extractPropertyValue(obj.propSet, 'summary.guest.ipAddress') as string) || null,
        numCpu: (this.extractPropertyValue(obj.propSet, 'summary.config.numCpu') as number) || null,
        memorySizeMB: (this.extractPropertyValue(obj.propSet, 'summary.config.memorySizeMB') as number) || null,
        guestFullName: (this.extractPropertyValue(obj.propSet, 'summary.config.guestFullName') as string) || null,
        powerState: (this.extractPropertyValue(obj.propSet, 'runtime.powerState') as string) || null,
        committedStorageBytes: (this.extractPropertyValue(obj.propSet, 'summary.storage.committed') as number) || null,
      }));
    } finally {
      await this.destroyView(view);
    }
  }

  /**
   * Fetch the host inventory from vCenter.
   */
  async getHosts(): Promise<VmwareHostInfo[]> {
    const rootFolder = this.serviceContent?.rootFolder as ManagedObjectReference | undefined;
    if (!rootFolder) throw new Error('rootFolder not found in ServiceContent');

    const view = await this.createContainerView(rootFolder, ['HostSystem']);

    try {
      const objects = await this.retrieveProperties(view, 'HostSystem', ['name']);

      return objects.map((obj) => ({
        moRef: obj.obj.value,
        name: (this.extractPropertyValue(obj.propSet, 'name') as string) || 'Unknown',
      }));
    } finally {
      await this.destroyView(view);
    }
  }

  /**
   * Fetch full inventory (VMs + Hosts).
   */
  async getInventory(): Promise<VmwareInventoryResult> {
    const [vms, hosts] = await Promise.all([
      this.getVirtualMachines(),
      this.getHosts(),
    ]);
    return { vms, hosts };
  }

  /**
   * Test connection to vCenter without fetching inventory.
   */
  async testConnection(): Promise<{ success: boolean; release: string; vmCount?: number; hostCount?: number }> {
    await this.login();
    try {
      const inventory = await this.getInventory();
      return {
        success: true,
        release: this.release!,
        vmCount: inventory.vms.length,
        hostCount: inventory.hosts.length,
      };
    } finally {
      await this.logout();
    }
  }
}
