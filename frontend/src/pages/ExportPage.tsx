import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { assetApi, FieldDefinition } from '../services/assets';
import { downloadBlob } from '../utils/helpers';
import toast from 'react-hot-toast';
import { Download, FileSpreadsheet, FileText, File } from 'lucide-react';

export default function ExportPage() {
  const [format, setFormat] = useState<'xlsx' | 'csv' | 'pdf'>('xlsx');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const { data: fields } = useQuery({
    queryKey: ['fields'],
    queryFn: assetApi.getFields,
    staleTime: 300000,
  });

  const exportableFields = fields?.filter((f) => f.is_exportable) || [];

  // Group fields by category
  const fieldsByGroup = new Map<string, FieldDefinition[]>();
  exportableFields.forEach((f) => {
    const group = f.field_group || 'general';
    if (!fieldsByGroup.has(group)) fieldsByGroup.set(group, []);
    fieldsByGroup.get(group)!.push(f);
  });

  const exportMutation = useMutation({
    mutationFn: () => assetApi.export({ format, fields: selectedFields, filters }),
    onSuccess: (blob) => {
      const filename = `asset-export-${new Date().toISOString().split('T')[0]}.${format}`;
      downloadBlob(blob, filename);
      toast.success('Export downloaded successfully');
    },
    onError: () => {
      toast.error('Export failed');
    },
  });

  const toggleField = (fieldKey: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldKey)
        ? prev.filter((f) => f !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  const selectAll = () => {
    setSelectedFields(exportableFields.map((f) => f.field_key));
  };

  const deselectAll = () => {
    setSelectedFields([]);
  };

  const handleFilterChange = (fieldKey: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value) {
        next[fieldKey] = value;
      } else {
        delete next[fieldKey];
      }
      return next;
    });
  };

  const formatIcons = {
    xlsx: FileSpreadsheet,
    csv: FileText,
    pdf: File,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Export Assets</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Format Selection */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Export Format</h3>
            <div className="flex gap-4">
              {(['xlsx', 'csv', 'pdf'] as const).map((fmt) => {
                const Icon = formatIcons[fmt];
                return (
                  <button
                    key={fmt}
                    onClick={() => setFormat(fmt)}
                    className={`flex items-center gap-3 px-6 py-3 rounded-lg border-2 transition-colors ${
                      format === fmt
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium uppercase">{fmt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Field Selection */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                Select Fields ({selectedFields.length} selected)
              </h3>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-sm text-primary-600 hover:underline">Select All</button>
                <span className="text-gray-300">|</span>
                <button onClick={deselectAll} className="text-sm text-gray-500 hover:underline">Deselect All</button>
              </div>
            </div>

            {/* System fields */}
            <div className="mb-4">
              <label className="flex items-center gap-2 py-1.5">
                <input
                  type="checkbox"
                  checked={selectedFields.includes('asset_tag')}
                  onChange={() => toggleField('asset_tag')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm">Asset Tag</span>
              </label>
              <label className="flex items-center gap-2 py-1.5">
                <input
                  type="checkbox"
                  checked={selectedFields.includes('status')}
                  onChange={() => toggleField('status')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm">Status</span>
              </label>
            </div>

            {/* Grouped dynamic fields */}
            {Array.from(fieldsByGroup.entries()).map(([group, groupFields]) => (
              <div key={group} className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {group.replace(/_/g, ' ')}
                </h4>
                <div className="grid grid-cols-2 gap-1">
                  {groupFields.map((field) => (
                    <label key={field.field_key} className="flex items-center gap-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={selectedFields.includes(field.field_key)}
                        onChange={() => toggleField(field.field_key)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm">{field.display_name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div>
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Filters (Optional)</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Status</label>
                <select
                  value={filters.status || ''}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="decommissioned">Decommissioned</option>
                </select>
              </div>

              {exportableFields
                .filter((f) => f.is_filterable && f.field_type === 'select')
                .slice(0, 5)
                .map((field) => (
                  <div key={field.field_key}>
                    <label className="block text-sm text-gray-600 mb-1">{field.display_name}</label>
                    <select
                      value={filters[field.field_key] || ''}
                      onChange={(e) => handleFilterChange(field.field_key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">All</option>
                      {field.select_options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                ))}
            </div>
          </div>

          <button
            onClick={() => exportMutation.mutate()}
            disabled={selectedFields.length === 0 || exportMutation.isPending}
            className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-medium"
          >
            <Download className="h-5 w-5" />
            {exportMutation.isPending ? 'Exporting...' : `Export ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
