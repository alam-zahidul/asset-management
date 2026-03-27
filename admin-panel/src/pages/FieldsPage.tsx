import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';
import { Plus, Edit, Trash2, GripVertical, ToggleLeft, ToggleRight } from 'lucide-react';

interface Field {
  id: string;
  field_key: string;
  display_name: string;
  field_type: string;
  is_required: boolean;
  is_active: boolean;
  is_system: boolean;
  display_order: number;
  field_group: string;
  placeholder: string | null;
  help_text: string | null;
  select_options: string[];
  min_length: number | null;
  max_length: number | null;
  is_unique: boolean;
  is_filterable: boolean;
  is_sortable: boolean;
  is_exportable: boolean;
}

const FIELD_TYPES = ['text', 'number', 'date', 'datetime', 'boolean', 'select', 'multiselect', 'textarea', 'email', 'ip_address', 'url'];

export default function FieldsPage() {
  const queryClient = useQueryClient();
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    field_key: '', display_name: '', field_type: 'text', is_required: false,
    display_order: 0, field_group: 'general', placeholder: '', help_text: '',
    select_options: [] as string[], min_length: null as number | null,
    max_length: null as number | null, is_unique: false, is_filterable: true,
    is_sortable: true, is_exportable: true,
  });

  const { data: fields, isLoading } = useQuery<Field[]>({
    queryKey: ['admin-fields'],
    queryFn: async () => (await api.get('/fields')).data,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/fields', data),
    onSuccess: () => { toast.success('Field created'); queryClient.invalidateQueries({ queryKey: ['admin-fields'] }); setShowForm(false); resetForm(); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof form> }) => api.put(`/fields/${id}`, data),
    onSuccess: () => { toast.success('Field updated'); queryClient.invalidateQueries({ queryKey: ['admin-fields'] }); setEditingField(null); setShowForm(false); resetForm(); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/fields/${id}`),
    onSuccess: () => { toast.success('Field deactivated'); queryClient.invalidateQueries({ queryKey: ['admin-fields'] }); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.put(`/fields/${id}`, { is_active: active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-fields'] }),
  });

  const resetForm = () => {
    setForm({ field_key: '', display_name: '', field_type: 'text', is_required: false,
      display_order: 0, field_group: 'general', placeholder: '', help_text: '',
      select_options: [], min_length: null, max_length: null, is_unique: false,
      is_filterable: true, is_sortable: true, is_exportable: true });
  };

  const handleEdit = (field: Field) => {
    setEditingField(field);
    setForm({
      field_key: field.field_key, display_name: field.display_name, field_type: field.field_type,
      is_required: field.is_required, display_order: field.display_order, field_group: field.field_group,
      placeholder: field.placeholder || '', help_text: field.help_text || '',
      select_options: field.select_options || [], min_length: field.min_length,
      max_length: field.max_length, is_unique: field.is_unique,
      is_filterable: field.is_filterable, is_sortable: field.is_sortable, is_exportable: field.is_exportable,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = {
      ...form,
      display_name: DOMPurify.sanitize(form.display_name, { ALLOWED_TAGS: [] }),
      placeholder: form.placeholder ? DOMPurify.sanitize(form.placeholder, { ALLOWED_TAGS: [] }) : '',
      help_text: form.help_text ? DOMPurify.sanitize(form.help_text, { ALLOWED_TAGS: [] }) : '',
    };

    if (editingField) {
      const { field_key, ...updateData } = sanitized;
      updateMutation.mutate({ id: editingField.id, data: updateData });
    } else {
      createMutation.mutate(sanitized);
    }
  };

  const inputClasses = "w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Field Management</h1>
        <button
          onClick={() => { resetForm(); setEditingField(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> Add Field
        </button>
      </div>

      {/* Field Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingField ? 'Edit Field' : 'Add New Field'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Field Key</label>
                  <input type="text" value={form.field_key} onChange={(e) => setForm({ ...form, field_key: e.target.value })}
                    disabled={!!editingField} pattern="^[a-z][a-z0-9_]*$" maxLength={100}
                    className={`${inputClasses} ${editingField ? 'opacity-50' : ''}`} placeholder="e.g., server_type" required />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Display Name</label>
                  <input type="text" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                    className={inputClasses} placeholder="e.g., Server Type" maxLength={200} required />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Field Type</label>
                  <select value={form.field_type} onChange={(e) => setForm({ ...form, field_type: e.target.value })}
                    className={inputClasses} disabled={editingField?.is_system}>
                    {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Field Group</label>
                  <input type="text" value={form.field_group} onChange={(e) => setForm({ ...form, field_group: e.target.value })}
                    className={inputClasses} placeholder="e.g., hardware" maxLength={100} />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Display Order</label>
                  <input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
                    className={inputClasses} min={0} />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Placeholder</label>
                  <input type="text" value={form.placeholder} onChange={(e) => setForm({ ...form, placeholder: e.target.value })}
                    className={inputClasses} maxLength={300} />
                </div>
              </div>

              {(form.field_type === 'select' || form.field_type === 'multiselect') && (
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Options (comma-separated)</label>
                  <input type="text" value={form.select_options.join(', ')}
                    onChange={(e) => setForm({ ...form, select_options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                    className={inputClasses} placeholder="Option1, Option2, Option3" />
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-300 mb-1">Help Text</label>
                <input type="text" value={form.help_text} onChange={(e) => setForm({ ...form, help_text: e.target.value })}
                  className={inputClasses} maxLength={1000} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Min Length</label>
                  <input type="number" value={form.min_length ?? ''} onChange={(e) => setForm({ ...form, min_length: e.target.value ? parseInt(e.target.value) : null })}
                    className={inputClasses} min={0} />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Max Length</label>
                  <input type="number" value={form.max_length ?? ''} onChange={(e) => setForm({ ...form, max_length: e.target.value ? parseInt(e.target.value) : null })}
                    className={inputClasses} min={1} />
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                {[
                  { key: 'is_required', label: 'Required' },
                  { key: 'is_unique', label: 'Unique' },
                  { key: 'is_filterable', label: 'Filterable' },
                  { key: 'is_sortable', label: 'Sortable' },
                  { key: 'is_exportable', label: 'Exportable' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={(form as any)[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                      className="rounded border-gray-500 text-primary-600 focus:ring-primary-500" />
                    {label}
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-600 rounded-lg text-sm hover:bg-gray-700">Cancel</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {editingField ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fields Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Order</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Key</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Display Name</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Type</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Group</th>
              <th className="text-center px-4 py-3 text-gray-400 font-medium">Required</th>
              <th className="text-center px-4 py-3 text-gray-400 font-medium">Active</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : fields?.map((field) => (
              <tr key={field.id} className={`border-b border-gray-700/50 hover:bg-gray-700/30 ${!field.is_active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 text-gray-400">{field.display_order}</td>
                <td className="px-4 py-3 font-mono text-xs text-primary-300">{field.field_key}</td>
                <td className="px-4 py-3">{field.display_name} {field.is_system && <span className="text-xs text-yellow-400 ml-1">(system)</span>}</td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 bg-gray-700 rounded text-xs">{field.field_type}</span></td>
                <td className="px-4 py-3 text-gray-400">{field.field_group}</td>
                <td className="px-4 py-3 text-center">{field.is_required ? '✓' : '-'}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleMutation.mutate({ id: field.id, active: !field.is_active })}>
                    {field.is_active
                      ? <ToggleRight className="h-5 w-5 text-green-400 inline" />
                      : <ToggleLeft className="h-5 w-5 text-gray-500 inline" />}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleEdit(field)} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-700">
                    <Edit className="h-4 w-4" />
                  </button>
                  {!field.is_system && (
                    <button onClick={() => { if (window.confirm('Deactivate this field?')) deleteMutation.mutate(field.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-400 rounded hover:bg-gray-700 ml-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
