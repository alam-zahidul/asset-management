import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { assetApi, FieldDefinition } from '../services/assets';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/helpers';
import { Plus, Search, ChevronLeft, ChevronRight, Eye, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AssetListPage() {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');

  const page = parseInt(searchParams.get('page') || '1');
  const limit = 25;
  const status = searchParams.get('status') || '';

  const { data: fields } = useQuery({
    queryKey: ['fields'],
    queryFn: assetApi.getFields,
    staleTime: 300000,
  });

  const { data: assets, isLoading, refetch } = useQuery({
    queryKey: ['assets', page, limit, search, status],
    queryFn: () => assetApi.list({ page, limit, search, ...(status && { status }) }),
  });

  const displayFields = fields?.slice(0, 6) || [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ search, page: '1' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this asset?')) return;
    try {
      await assetApi.delete(id);
      toast.success('Asset deleted');
      refetch();
    } catch {
      toast.error('Failed to delete asset');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Server Inventory</h1>
        {hasPermission('assets.create') && (
          <Link
            to="/assets/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Asset
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assets..."
                maxLength={200}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              />
            </div>
          </form>

          <select
            value={status}
            onChange={(e) => setSearchParams({ search, status: e.target.value, page: '1' })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="maintenance">Maintenance</option>
            <option value="decommissioned">Decommissioned</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Asset Tag</th>
                {displayFields.map((f: FieldDefinition) => (
                  <th key={f.field_key} className="text-left px-4 py-3 font-medium text-gray-600">
                    {f.display_name}
                  </th>
                ))}
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Updated</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={displayFields.length + 4} className="px-4 py-12 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : assets?.data.length === 0 ? (
                <tr>
                  <td colSpan={displayFields.length + 4} className="px-4 py-12 text-center text-gray-500">
                    No assets found
                  </td>
                </tr>
              ) : (
                assets?.data.map((asset) => (
                  <tr key={asset.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm">{asset.asset_tag || '-'}</td>
                    {displayFields.map((f: FieldDefinition) => (
                      <td key={f.field_key} className="px-4 py-3">
                        {String(asset.data[f.field_key] ?? '-')}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        asset.status === 'active' ? 'bg-green-100 text-green-700' :
                        asset.status === 'maintenance' ? 'bg-yellow-100 text-yellow-700' :
                        asset.status === 'inactive' ? 'bg-gray-100 text-gray-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(asset.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/assets/${asset.id}`} className="p-1.5 text-gray-500 hover:text-primary-600 rounded-lg hover:bg-gray-100">
                          <Eye className="h-4 w-4" />
                        </Link>
                        {hasPermission('assets.update') && (
                          <Link to={`/assets/${asset.id}/edit`} className="p-1.5 text-gray-500 hover:text-primary-600 rounded-lg hover:bg-gray-100">
                            <Edit className="h-4 w-4" />
                          </Link>
                        )}
                        {hasPermission('assets.delete') && (
                          <button onClick={() => handleDelete(asset.id)} className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {assets && assets.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, assets.total)} of {assets.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchParams({ search, status, page: String(page - 1) })}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {assets.totalPages}
              </span>
              <button
                onClick={() => setSearchParams({ search, status, page: String(page + 1) })}
                disabled={page >= assets.totalPages}
                className="p-1.5 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
