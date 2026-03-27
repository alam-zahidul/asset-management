import ldap from 'ldapjs';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface LdapUser {
  username: string;
  email: string;
  displayName: string;
  dn: string;
  department: string;
  groups: string[];
}

export class LdapService {
  private createClient(): ldap.Client {
    return ldap.createClient({
      url: config.ldap.url,
      tlsOptions: config.ldap.tlsOptions,
      timeout: 10000,
      connectTimeout: 10000,
    });
  }

  async authenticate(username: string, password: string): Promise<LdapUser | null> {
    const client = this.createClient();

    try {
      // Bind with service account to search for user
      await this.bind(client, config.ldap.bindDN, config.ldap.bindPassword);

      // Search for user
      const user = await this.searchUser(client, username);
      if (!user) {
        logger.warn('LDAP user not found', { username });
        return null;
      }

      // Verify user credentials by binding as the user
      const userClient = this.createClient();
      try {
        await this.bind(userClient, user.dn, password);
        userClient.unbind();
      } catch {
        logger.warn('LDAP authentication failed', { username });
        return null;
      }

      // Fetch groups
      const groups = await this.getUserGroups(client, user.dn);
      user.groups = groups;

      return user;
    } catch (err) {
      logger.error('LDAP error', { error: (err as Error).message });
      throw new Error('LDAP authentication service unavailable');
    } finally {
      client.unbind();
    }
  }

  private bind(client: ldap.Client, dn: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      client.bind(dn, password, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private searchUser(client: ldap.Client, username: string): Promise<LdapUser | null> {
    return new Promise((resolve, reject) => {
      const filter = config.ldap.searchFilter.replace('{{username}}', ldap.parseDN(username).toString() ? username : username.replace(/[^a-zA-Z0-9._@-]/g, ''));

      const opts: ldap.SearchOptions = {
        filter,
        scope: 'sub',
        attributes: ['sAMAccountName', 'mail', 'displayName', 'dn', 'department', 'memberOf'],
        sizeLimit: 1,
        timeLimit: 10,
      };

      client.search(config.ldap.baseDN, opts, (err, res) => {
        if (err) return reject(err);

        let user: LdapUser | null = null;

        res.on('searchEntry', (entry) => {
          const attrs = entry.ppiObject || {};
          user = {
            username: String(attrs.sAMAccountName || username),
            email: String(attrs.mail || ''),
            displayName: String(attrs.displayName || ''),
            dn: entry.objectName?.toString() || '',
            department: String(attrs.department || ''),
            groups: [],
          };
        });

        res.on('error', (err) => reject(err));
        res.on('end', () => resolve(user));
      });
    });
  }

  private getUserGroups(client: ldap.Client, userDN: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (!config.ldap.groupSearchBase) return resolve([]);

      const opts: ldap.SearchOptions = {
        filter: `(member=${userDN})`,
        scope: 'sub',
        attributes: ['cn'],
        timeLimit: 10,
      };

      const groups: string[] = [];

      client.search(config.ldap.groupSearchBase, opts, (err, res) => {
        if (err) return reject(err);

        res.on('searchEntry', (entry) => {
          const cn = entry.ppiObject?.cn;
          if (cn) groups.push(String(cn));
        });

        res.on('error', (err) => reject(err));
        res.on('end', () => resolve(groups));
      });
    });
  }
}

export const ldapService = new LdapService();
