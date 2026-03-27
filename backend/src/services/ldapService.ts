import ldap from 'ldapjs';
import config from '../config';
import logger from '../utils/logger';

export interface LdapUser {
  username: string;
  email: string;
  displayName: string;
  department: string;
  dn: string;
  groups: string[];
}

export async function authenticateLdap(username: string, password: string): Promise<LdapUser> {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({
      url: config.ldap.url,
      tlsOptions: { rejectUnauthorized: config.ldap.tlsRejectUnauthorized },
      connectTimeout: 10000,
      timeout: 10000,
    });

    client.on('error', (err) => {
      logger.error('LDAP client error', err);
      reject(new Error('LDAP connection error'));
    });

    // Bind with service account to search for user
    client.bind(config.ldap.bindDn, config.ldap.bindPassword, (bindErr) => {
      if (bindErr) {
        client.destroy();
        logger.error('LDAP service bind failed', bindErr);
        return reject(new Error('LDAP service authentication failed'));
      }

      const searchFilter = config.ldap.searchFilter.replace('{{username}}', ldap.parseDN(username).toString() ? username : username.replace(/[\\*()\x00/]/g, ''));
      const opts: ldap.SearchOptions = {
        filter: searchFilter,
        scope: 'sub',
        attributes: ['sAMAccountName', 'mail', 'displayName', 'department', 'dn', 'memberOf'],
        sizeLimit: 1,
      };

      client.search(config.ldap.baseDn, opts, (searchErr, res) => {
        if (searchErr) {
          client.destroy();
          return reject(new Error('LDAP search failed'));
        }

        let userEntry: LdapUser | null = null;

        res.on('searchEntry', (entry) => {
          const attrs = entry.pojo.attributes;
          const getAttr = (name: string): string => {
            const attr = attrs.find((a) => a.type.toLowerCase() === name.toLowerCase());
            return attr?.values?.[0] || '';
          };
          const getAttrArray = (name: string): string[] => {
            const attr = attrs.find((a) => a.type.toLowerCase() === name.toLowerCase());
            return attr?.values || [];
          };

          userEntry = {
            username: getAttr('sAMAccountName'),
            email: getAttr('mail'),
            displayName: getAttr('displayName'),
            department: getAttr('department'),
            dn: entry.pojo.objectName,
            groups: getAttrArray('memberOf'),
          };
        });

        res.on('error', (err) => {
          client.destroy();
          reject(new Error('LDAP search error: ' + err.message));
        });

        res.on('end', () => {
          if (!userEntry) {
            client.destroy();
            return reject(new Error('User not found in directory'));
          }

          // Now bind as the user to verify password
          client.bind(userEntry.dn, password, (userBindErr) => {
            client.destroy();
            if (userBindErr) {
              return reject(new Error('Invalid credentials'));
            }
            resolve(userEntry!);
          });
        });
      });
    });
  });
}
