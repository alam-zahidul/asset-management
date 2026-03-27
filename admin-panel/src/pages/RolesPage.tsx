import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';
import { Plus, Edit, Trash2, Shield } from 'lucide-react';

interface Role {
  id: string; name: string; description: string; is_system: boolean;
  user_count: number; permissions: string[];
}

interface Permission {
  id: string; name: string; resource: string; action: string; description: string;
}

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  const { data: roles, isLoading } = useQuery<Role[]>({
    queryKey: ['admin-roles'],
    queryFn: async () => (await api.get('/roles')).data,
  });

  const { data: permissions } = useQuery<Permission[]>({
    queryKey: ['admin-permissions'],
    queryFn: async () => (await api.get('/roles/permissions')).data,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string; permissionIds: string[] }) => api.post('/roles', data),
    onSuccess: () => { toast.success('Role created'); queryClient.invalidateQueries({ queryKey: ['admin-roles'] }); close(); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { description?: string; permissionIds: string[] } }) => api.put(`/roles/${id}`, data),
    onSuccess: () => { toast.success('Role updated'); queryClient.invalidateQueries({ queryKey: ['admin-roles'] }); close(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => { toast.success('Role deleted'); queryClient.invalidateQueries({ queryKey: ['admin-roles'] }); },
  });

  const close = () => { setShowForm(false); setEditingRole(null); setName(''); setDescription(''); setSelectedPerms([]); };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setName(role.name);
    setDescription(role.description || '');
    const permIds = permissions?.filter((p) => role.permissions?.includes(p.name)).map((p) => p.id) || [];
    setSelectedPerms(permIds);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = DOMPurify.sanitize(name, { ALLOWED_TAGS: [] }).trim();
    if (editingRole) {
      updateMutation.mutate({ id: editingRole.id, data: { description, permissionIds: selectedPerms } });
    } else {
      createMutation.mutate({ name: clean, description, permissionIds: selectedPerms });
    }
  };

  // Group permissions by resource
  const permsByResource = new Map<string, Permission[]>();
  permissions?.forEach((p) => {
    if (!permsByResource.has(p.resource)) permsByResource.set(p.resource, []);
    permsByResource.get(p.resource)!.push(p);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Roles & Permissions</h1>
        <button onClick={() => { close(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus className="h-4 w-4" /> Add Role
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingRole ? 'Edit Role' : 'Create Role'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    disabled={!!editingRole} pattern="^[a-z][a-z0-9_-]*$" maxLength={100}
                    className={`w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm ${editingRole ? 'opacity-50' : ''}`} required />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Description</label>
                  <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm" maxLength={500} />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-3">Permissions</h3>
                {Array.from(permsByResource.entries()).map(([resource, perms]) => (
                  <div key={resource} className="mb-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{resource}</h4>
                    <div className="grid grid-cols-2 gap-1">
                      {perms.map((perm) => (
                        <label key={perm.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-700 text-sm cursor-pointer">
                          <input type="checkbox" checked={selectedPerms.includes(perm.id)}
                            onChange={(e) => setSelectedPerms((prev) => e.target.checked ? [...prev, perm.id] : prev.filter((p) => p !== perm.id))}
                            className="rounded border-gray-500 text-primary-600" />
                          <span>{perm.action}</span>
                          <span className="text-xs text-gray-500">{perm.description}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                <button type="button" onClick={close} className="px-4 py-2 border border-gray-600 rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                  {editingRole ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? <p className="text-gray-500">Loading...</p> : roles?.map((role) => (
          <div key={role.id} className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary-400" />
                <h3 className="font-semibold capitalize">{role.name}</h3>
                {role.is_system && <span className="text-xs bg-yellow-900/50 text-yellow-300 px-1.5 py-0.5 rounded">system</span>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleEdit(role)} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-700">
                  <Edit className="h-4 w-4" />
                </button>
                {!role.is_system && (
                  <button onClick={() => { if (window.confirm('Delete this role?')) deleteMutation.mutate(role.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-400 rounded hover:bg-gray-700">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-3">{role.description || 'No description'}</p>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{role.user_count} users</span>
              <span>{role.permissions?.length || 0} permissions</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {role.permissions?.slice(0, 6).map((p) => (
                <span key={p} className="px-1.5 py-0.5 bg-gray-700 rounded text-xs text-gray-300">{p}</span>
              ))}
              {(role.permissions?.length || 0) > 6 && (
                <span className="px-1.5 py-0.5 text-xs text-gray-500">+{role.permissions.length - 6} more</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
