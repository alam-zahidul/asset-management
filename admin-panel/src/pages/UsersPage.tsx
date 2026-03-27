import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import toast from 'react-hot-toast';

interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  department: string;
  is_active: boolean;
  last_login: string;
  roles: string[];
}

interface Role { id: string; name: string; }

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await api.get('/users')).data,
  });

  const { data: roles } = useQuery<Role[]>({
    queryKey: ['admin-roles-list'],
    queryFn: async () => (await api.get('/roles')).data,
  });

  const assignRolesMutation = useMutation({
    mutationFn: ({ userId, roleIds }: { userId: string; roleIds: string[] }) =>
      api.post(`/users/${userId}/roles`, { roleIds }),
    onSuccess: () => {
      toast.success('Roles updated');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditingUser(null);
    },
    onError: () => toast.error('Failed to update roles'),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ userId, is_active }: { userId: string; is_active: boolean }) =>
      api.patch(`/users/${userId}/status`, { is_active }),
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const handleEditRoles = (user: User) => {
    setEditingUser(user);
    const roleIds = roles?.filter((r) => user.roles?.includes(r.name)).map((r) => r.id) || [];
    setSelectedRoles(roleIds);
  };

  const users: User[] = usersData?.data || [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">User Management</h1>

      {/* Role Assignment Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-2">Assign Roles</h2>
            <p className="text-gray-400 text-sm mb-4">{editingUser.display_name || editingUser.username}</p>
            <div className="space-y-2 mb-6">
              {roles?.map((role) => (
                <label key={role.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.id)}
                    onChange={(e) => {
                      setSelectedRoles((prev) =>
                        e.target.checked ? [...prev, role.id] : prev.filter((r) => r !== role.id)
                      );
                    }}
                    className="rounded border-gray-500 text-primary-600"
                  />
                  <span className="capitalize">{role.name}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 border border-gray-600 rounded-lg text-sm hover:bg-gray-700">Cancel</button>
              <button
                onClick={() => assignRolesMutation.mutate({ userId: editingUser.id, roleIds: selectedRoles })}
                disabled={assignRolesMutation.isPending}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >Save</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left px-4 py-3 text-gray-400">Username</th>
              <th className="text-left px-4 py-3 text-gray-400">Name</th>
              <th className="text-left px-4 py-3 text-gray-400">Department</th>
              <th className="text-left px-4 py-3 text-gray-400">Roles</th>
              <th className="text-center px-4 py-3 text-gray-400">Active</th>
              <th className="text-left px-4 py-3 text-gray-400">Last Login</th>
              <th className="text-right px-4 py-3 text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : users.map((user) => (
              <tr key={user.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="px-4 py-3 font-mono text-sm">{user.username}</td>
                <td className="px-4 py-3">{user.display_name || '-'}</td>
                <td className="px-4 py-3 text-gray-400">{user.department || '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {user.roles?.map((role) => (
                      <span key={role} className="px-2 py-0.5 bg-primary-900/50 text-primary-300 rounded text-xs">{role}</span>
                    )) || <span className="text-gray-500">none</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleStatusMutation.mutate({ userId: user.id, is_active: !user.is_active })}
                    className={`px-2 py-0.5 rounded text-xs font-medium ${user.is_active ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                    {user.is_active ? 'Active' : 'Disabled'}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{user.last_login ? new Date(user.last_login).toLocaleString() : '-'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleEditRoles(user)} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded">
                    Manage Roles
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
