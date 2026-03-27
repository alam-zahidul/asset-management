import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { assetApi, FieldDefinition } from '../services/assets';
import { sanitize } from '../utils/helpers';
import toast from 'react-hot-toast';
import { ArrowLeft, Save } from 'lucide-react';

export default function AssetFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [assetTag, setAssetTag] = useState('');
  const [status, setStatus] = useState('active');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: fields } = useQuery({
    queryKey: ['fields'],
    queryFn: assetApi.getFields,
    staleTime: 300000,
  });

  const { data: existingAsset } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => assetApi.getById(id!),
    enabled: isEdit,
  });

  // Populate form for editing
  useEffect(() => {
    if (existingAsset) {
      setAssetTag(existingAsset.asset_tag || '');
      setStatus(existingAsset.status);
      const dataRecord: Record<string, string> = {};
      for (const [key, value] of Object.entries(existingAsset.data)) {
        dataRecord[key] = String(value ?? '');
      }
      setFormData(dataRecord);
    }
  }, [existingAsset]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Sanitize all values
      const sanitizedData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(formData)) {
        sanitizedData[key] = typeof value === 'string' ? sanitize(value) : value;
      }

      if (isEdit) {
        return assetApi.update(id, { asset_tag: assetTag || undefined, data: sanitizedData, status });
      } else {
        return assetApi.create({ asset_tag: assetTag || undefined, data: sanitizedData, status });
      }
    },
    onSuccess: (data) => {
      toast.success(isEdit ? 'Asset updated' : 'Asset created');
      navigate(`/assets/${data.id}`);
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err.response?.data?.error || 'Failed to save asset');
    },
  });

  const validateField = (field: FieldDefinition, value: string): string | null => {
    if (field.is_required && (!value || value.trim() === '')) {
      return `${field.display_name} is required`;
    }
    if (!value) return null;

    if (field.min_length && value.length < field.min_length) {
      return `${field.display_name} must be at least ${field.min_length} characters`;
    }
    if (field.max_length && value.length > field.max_length) {
      return `${field.display_name} must be at most ${field.max_length} characters`;
    }
    if (field.regex_pattern && !new RegExp(field.regex_pattern).test(value)) {
      return `${field.display_name} format is invalid`;
    }
    if (field.field_type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Invalid email address';
    }
    if (field.field_type === 'ip_address' &&
        !/^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(value)) {
      return 'Invalid IP address';
    }
    if (field.field_type === 'number' && isNaN(Number(value))) {
      return `${field.display_name} must be a number`;
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const newErrors: Record<string, string> = {};
    fields?.forEach((field) => {
      const error = validateField(field, formData[field.field_key] || '');
      if (error) newErrors[field.field_key] = error;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please fix the validation errors');
      return;
    }

    setErrors({});
    saveMutation.mutate();
  };

  const handleFieldChange = (fieldKey: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldKey]: value }));
    // Clear error on change
    if (errors[fieldKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    }
  };

  // Group fields by field_group
  const fieldGroups = new Map<string, FieldDefinition[]>();
  fields?.forEach((f) => {
    const group = f.field_group || 'general';
    if (!fieldGroups.has(group)) fieldGroups.set(group, []);
    fieldGroups.get(group)!.push(f);
  });

  const renderField = (field: FieldDefinition) => {
    const value = formData[field.field_key] || '';
    const error = errors[field.field_key];

    const baseClasses = `w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none ${
      error ? 'border-red-300 bg-red-50' : 'border-gray-300'
    }`;

    switch (field.field_type) {
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
            placeholder={field.placeholder || ''}
            maxLength={field.max_length || 2000}
            rows={3}
            className={baseClasses}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
            className={baseClasses}
          >
            <option value="">Select...</option>
            {field.select_options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case 'boolean':
        return (
          <select
            value={value}
            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
            className={baseClasses}
          >
            <option value="">Select...</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
            className={baseClasses}
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
            className={baseClasses}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
            placeholder={field.placeholder || ''}
            min={field.min_value ?? undefined}
            max={field.max_value ?? undefined}
            className={baseClasses}
          />
        );

      default:
        return (
          <input
            type={field.field_type === 'email' ? 'email' : field.field_type === 'url' ? 'url' : 'text'}
            value={value}
            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
            placeholder={field.placeholder || ''}
            maxLength={field.max_length || 500}
            className={baseClasses}
          />
        );
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Asset' : 'Add New Asset'}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Asset tag and status */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset Tag</label>
              <input
                type="text"
                value={assetTag}
                onChange={(e) => setAssetTag(e.target.value)}
                placeholder="e.g., SRV-001"
                maxLength={100}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
                <option value="decommissioned">Decommissioned</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dynamic fields grouped */}
        {Array.from(fieldGroups.entries()).map(([groupName, groupFields]) => (
          <div key={groupName} className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4 capitalize">{groupName.replace(/_/g, ' ')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupFields.map((field) => (
                <div key={field.field_key} className={field.field_type === 'textarea' ? 'md:col-span-2' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.display_name}
                    {field.is_required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {renderField(field)}
                  {field.help_text && <p className="text-xs text-gray-500 mt-1">{field.help_text}</p>}
                  {errors[field.field_key] && (
                    <p className="text-xs text-red-600 mt-1">{errors[field.field_key]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update Asset' : 'Create Asset'}
          </button>
        </div>
      </form>
    </div>
  );
}
