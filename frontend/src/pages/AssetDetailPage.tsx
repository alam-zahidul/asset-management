import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { assetApi } from '../services/assets';
import { formatDate } from '../utils/helpers';
import { ArrowLeft, Edit, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();

  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => assetApi.getById(id!),
    enabled: !!id,
  });

  const { data: fields } = useQuery({
    queryKey: ['fields'],
    queryFn: assetApi.getFields,
    staleTime: 300000,
  });

  const { data: history } = useQuery({
    queryKey: ['asset-history', id],
    queryFn: () => assetApi.getHistory(id!, 1, 10),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  }

  if (!asset) {
    return <div className="text-center py-12 text-gray-500">Asset not found</div>;
  }

  // Group fields
  const fieldGroups = new Map<string, typeof fields>();
  fields?.forEach((f) => {
    const group = f.field_group || 'general';
    if (!fieldGroups.has(group)) fieldGroups.set(group, []);
    fieldGroups.get(group)!.push(f);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to="/assets" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {asset.asset_tag || String(asset.data.hostname || 'Asset Details')}
            </h1>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
              asset.status === 'active' ? 'bg-green-100 text-green-700' :
              asset.status === 'maintenance' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>{asset.status}</span>
          </div>
        </div>
        {hasPermission('assets.update') && (
          <Link to={`/assets/${id}/edit`} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            <Edit className="h-4 w-4" /> Edit
          </Link>
        )}
      </div>

      {/* Field groups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {Array.from(fieldGroups.entries()).map(([groupName, groupFields]) => (
          <div key={groupName} className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="font-semibold text-gray-900 mb-4 capitalize">{groupName.replace(/_/g, ' ')}</h3>
            <dl className="space-y-3">
              {groupFields!.map((field) => (
                <div key={field.field_key} className="flex justify-between">
                  <dt className="text-sm text-gray-500">{field.display_name}</dt>
                  <dd className="text-sm font-medium text-gray-900 text-right">
                    {String(asset.data[field.field_key] ?? '-')}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
        <h3 className="font-semibold text-gray-900 mb-4">Metadata</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-500">Asset Tag:</span> <span className="font-medium">{asset.asset_tag || '-'}</span></div>
          <div><span className="text-gray-500">Created by:</span> <span className="font-medium">{asset.created_by_name || '-'}</span></div>
          <div><span className="text-gray-500">Created:</span> <span className="font-medium">{formatDate(asset.created_at)}</span></div>
          <div><span className="text-gray-500">Updated:</span> <span className="font-medium">{formatDate(asset.updated_at)}</span></div>
        </div>
      </div>

      {/* History */}
      {history?.data && history.data.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" /> Change History
          </h3>
          <div className="space-y-3">
            {history.data.map((entry: { id: string; change_type: string; changed_by_name: string; created_at: string; changed_fields: string[] }) => (
              <div key={entry.id} className="flex items-center gap-4 text-sm border-b pb-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  entry.change_type === 'create' ? 'bg-green-100 text-green-700' :
                  entry.change_type === 'update' ? 'bg-blue-100 text-blue-700' :
                  'bg-red-100 text-red-700'
                }`}>{entry.change_type}</span>
                <span className="text-gray-600">{entry.changed_by_name}</span>
                <span className="text-gray-400">{formatDate(entry.created_at)}</span>
                {entry.changed_fields?.length > 0 && (
                  <span className="text-gray-500 text-xs">Changed: {entry.changed_fields.join(', ')}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
