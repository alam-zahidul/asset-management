import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { ScrollText } from 'lucide-react';

interface AuditEntry {
  id: string;
  user_name: string;
  username: string;
  action: string;
  resource: string;
  resource_id: string;
  details: Record<string, unknown>;
  ip_address: string;
  created_at: string;
}

export default function AuditPage() {
  const [page, setPage] = React.useState(1);
  const [actionFilter, setActionFilter] = React.useState('');
  const [resourceFilter, setResourceFilter] = React.useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit', page, actionFilter, resourceFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (actionFilter) params.set('action', actionFilter);
      if (resourceFilter) params.set('resource', resourceFilter);
      return (await api.get(`/audit?${params}`)).data;
    },
  });

  const entries: AuditEntry[] = data?.data || [];
  const total = data?.total || 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <ScrollText className="h-6 w-6 text-primary-400" /> Audit Logs
      </h1>

      <div className="flex gap-4 mb-4">
        <input
          type="text" placeholder="Filter by action..."
          value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          maxLength={100}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm w-64"
        />
        <select value={resourceFilter} onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="">All Resources</option>
          <option value="asset">Asset</option>
          <option value="field">Field</option>
          <option value="user">User</option>
          <option value="role">Role</option>
          <option value="import">Import</option>
          <option value="export">Export</option>
        </select>
        <span className="text-gray-400 text-sm self-center">{total} entries</span>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left px-4 py-3 text-gray-400">Time</th>
              <th className="text-left px-4 py-3 text-gray-400">User</th>
              <th className="text-left px-4 py-3 text-gray-400">Action</th>
              <th className="text-left px-4 py-3 text-gray-400">Resource</th>
              <th className="text-left px-4 py-3 text-gray-400">IP</th>
              <th className="text-left px-4 py-3 text-gray-400">Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : entries.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(entry.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">{entry.user_name || entry.username || '-'}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">{entry.action}</span>
                </td>
                <td className="px-4 py-3 text-gray-400">{entry.resource}</td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono">{entry.ip_address}</td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                  {entry.details ? JSON.stringify(entry.details) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm disabled:opacity-50">Previous</button>
          <span className="text-sm text-gray-400">Page {page}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={entries.length < 50}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
