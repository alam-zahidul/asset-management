import React, { useEffect, useState } from 'react';
import {
  Card, Table, Button, Space, Tag, Select, message, Modal, Popconfirm, Input,
} from 'antd';
import { UserSwitchOutlined, StopOutlined, CheckOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../services/api';

interface Role {
  id: string;
  name: string;
  description: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  department: string;
  is_active: boolean;
  last_login: string;
  roles: Array<{ id: string; name: string }>;
}

const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users', { params: { page, limit: 25, search } });
      setUsers(data.data.data);
      setTotal(data.data.total);
    } catch {
      message.error('Failed to load users');
    }
    setLoading(false);
  };

  const fetchRoles = async () => {
    try {
      const { data } = await api.get('/admin/roles');
      setRoles(data.data);
    } catch {
      message.error('Failed to load roles');
    }
  };

  useEffect(() => { fetchRoles(); }, []);
  useEffect(() => { fetchUsers(); }, [page, search]);

  const handleAssignRole = async (userId: string, roleId: string) => {
    try {
      await api.post('/admin/users/roles/assign', { userId, roleId });
      message.success('Role assigned');
      fetchUsers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      message.error(e.response?.data?.message || 'Failed to assign role');
    }
  };

  const handleRemoveRole = async (userId: string, roleId: string) => {
    try {
      await api.post('/admin/users/roles/remove', { userId, roleId });
      message.success('Role removed');
      fetchUsers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      message.error(e.response?.data?.message || 'Failed to remove role');
    }
  };

  const handleToggleActive = async (userId: string) => {
    try {
      await api.patch(`/admin/users/${userId}/toggle-active`);
      message.success('User status updated');
      fetchUsers();
    } catch {
      message.error('Failed to update user status');
    }
  };

  const columns: ColumnsType<User> = [
    { title: 'Username', dataIndex: 'username', key: 'username' },
    { title: 'Name', dataIndex: 'display_name', key: 'display_name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Department', dataIndex: 'department', key: 'department' },
    {
      title: 'Roles', key: 'roles',
      render: (_: unknown, record: User) => (
        <Space wrap>
          {record.roles.map((role) => (
            <Tag
              key={role.id}
              color={role.name === 'admin' ? 'red' : role.name === 'editor' ? 'blue' : 'default'}
              closable
              onClose={(e) => { e.preventDefault(); handleRemoveRole(record.id, role.id); }}
            >
              {role.name}
            </Tag>
          ))}
          <Select
            size="small"
            placeholder="+ Add role"
            style={{ width: 120 }}
            onChange={(roleId) => handleAssignRole(record.id, roleId)}
            value={undefined}
          >
            {roles
              .filter((r) => !record.roles.find((ur) => ur.id === r.id))
              .map((r) => (
                <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>
              ))}
          </Select>
        </Space>
      ),
    },
    {
      title: 'Status', dataIndex: 'is_active', key: 'is_active', width: 100,
      render: (v: boolean) => v ? <Tag color="green">Active</Tag> : <Tag color="red">Disabled</Tag>,
    },
    {
      title: 'Last Login', dataIndex: 'last_login', key: 'last_login', width: 180,
      render: (v: string) => v ? new Date(v).toLocaleString() : 'Never',
    },
    {
      title: 'Actions', key: 'actions', width: 100,
      render: (_: unknown, record: User) => (
        <Popconfirm
          title={record.is_active ? 'Disable this user?' : 'Enable this user?'}
          onConfirm={() => handleToggleActive(record.id)}
        >
          <Button
            size="small"
            icon={record.is_active ? <StopOutlined /> : <CheckOutlined />}
            danger={record.is_active}
          >
            {record.is_active ? 'Disable' : 'Enable'}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card
      title="User Management"
      extra={
        <Input.Search
          placeholder="Search users..."
          style={{ width: 300 }}
          onSearch={(v) => { setSearch(v); setPage(1); }}
          allowClear
          maxLength={200}
        />
      }
    >
      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{ current: page, pageSize: 25, total, onChange: setPage, showTotal: (t) => `Total ${t} users` }}
      />
    </Card>
  );
};

export default UserManagementPage;
