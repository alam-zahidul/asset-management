import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Card, Button, Space, Typography, message, Modal, Form, Input,
  InputNumber, Switch, Tag, Tooltip, Popconfirm, Descriptions, Badge,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CloudServerOutlined,
  ApiOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined,
  LoadingOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../services/api';

const { Title } = Typography;

interface VmwareConnection {
  id: string;
  name: string;
  server: string;
  username: string;
  tls_reject_unauthorized: boolean;
  is_active: boolean;
  sync_interval_minutes: number;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  last_sync_asset_count: number | null;
  created_at: string;
  updated_at: string;
}

interface ConnectionFormValues {
  name: string;
  server: string;
  username: string;
  password?: string;
  tls_reject_unauthorized: boolean;
  sync_interval_minutes: number;
}

const VmwareConnectionsPage: React.FC = () => {
  const [connections, setConnections] = useState<VmwareConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VmwareConnection | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [form] = Form.useForm<ConnectionFormValues>();

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/vmware/connections');
      setConnections(data.data || []);
    } catch {
      message.error('Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const handleCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ tls_reject_unauthorized: true, sync_interval_minutes: 60 });
    setModalOpen(true);
  };

  const handleEdit = (conn: VmwareConnection) => {
    setEditing(conn);
    form.setFieldsValue({
      name: conn.name,
      server: conn.server,
      username: conn.username,
      tls_reject_unauthorized: conn.tls_reject_unauthorized,
      sync_interval_minutes: conn.sync_interval_minutes,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      if (editing) {
        // Only send password if provided
        const payload: Record<string, unknown> = { ...values };
        if (!payload.password) delete payload.password;
        await api.put(`/vmware/connections/${editing.id}`, payload);
        message.success('Connection updated');
      } else {
        await api.post('/vmware/connections', values);
        message.success('Connection created');
      }

      setModalOpen(false);
      fetchConnections();
    } catch (err: any) {
      if (err.response?.data?.message) {
        message.error(err.response.data.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/vmware/connections/${id}`);
      message.success('Connection deleted');
      fetchConnections();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      await api.patch(`/vmware/connections/${id}/toggle-active`);
      fetchConnections();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to toggle status');
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const { data } = await api.post(`/vmware/connections/${id}/test`);
      const result = data.data;
      Modal.success({
        title: 'Connection Successful',
        content: (
          <Descriptions column={1} size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label="API Release">{result.release}</Descriptions.Item>
            <Descriptions.Item label="VMs Found">{result.vmCount}</Descriptions.Item>
            <Descriptions.Item label="Hosts Found">{result.hostCount}</Descriptions.Item>
          </Descriptions>
        ),
      });
    } catch (err: any) {
      Modal.error({
        title: 'Connection Failed',
        content: err.response?.data?.message || err.message,
      });
    } finally {
      setTesting(null);
    }
  };

  const handleTestDirect = async () => {
    try {
      const values = await form.validateFields();
      if (!values.password) {
        message.warning('Password is required to test');
        return;
      }
      setSaving(true);
      const { data } = await api.post('/vmware/test', {
        server: values.server,
        username: values.username,
        password: values.password,
        tls_reject_unauthorized: values.tls_reject_unauthorized,
      });
      const result = data.data;
      message.success(`Connected! Release: ${result.release}, VMs: ${result.vmCount}, Hosts: ${result.hostCount}`);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Connection test failed');
    } finally {
      setSaving(false);
    }
  };

  const statusTag = (status: string | null) => {
    if (!status) return <Tag>Never synced</Tag>;
    const map: Record<string, { color: string; icon: React.ReactNode }> = {
      success: { color: 'success', icon: <CheckCircleOutlined /> },
      failed: { color: 'error', icon: <CloseCircleOutlined /> },
      running: { color: 'processing', icon: <LoadingOutlined /> },
    };
    const conf = map[status] || { color: 'default', icon: null };
    return <Tag color={conf.color} icon={conf.icon}>{status.toUpperCase()}</Tag>;
  };

  const columns: ColumnsType<VmwareConnection> = [
    {
      title: 'Name', dataIndex: 'name', key: 'name',
      render: (name: string) => <Space><CloudServerOutlined />{name}</Space>,
    },
    { title: 'Server', dataIndex: 'server', key: 'server' },
    { title: 'Username', dataIndex: 'username', key: 'username' },
    {
      title: 'TLS Verify', dataIndex: 'tls_reject_unauthorized', key: 'tls',
      render: (v: boolean) => v ? <Tag color="green">Yes</Tag> : <Tag color="orange">No</Tag>,
    },
    {
      title: 'Active', key: 'active',
      render: (_, record) => (
        <Switch checked={record.is_active} onChange={() => handleToggleActive(record.id)} size="small" />
      ),
    },
    {
      title: 'Sync Interval', dataIndex: 'sync_interval_minutes', key: 'interval',
      render: (mins: number) => `${mins} min`,
    },
    {
      title: 'Last Sync', key: 'last_sync',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          {statusTag(record.last_sync_status)}
          {record.last_sync_at && (
            <small style={{ color: '#999' }}>{new Date(record.last_sync_at).toLocaleString()}</small>
          )}
          {record.last_sync_asset_count != null && (
            <small style={{ color: '#999' }}>{record.last_sync_asset_count} assets</small>
          )}
        </Space>
      ),
    },
    {
      title: 'Actions', key: 'actions', width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip title="Test Connection">
            <Button
              icon={<ApiOutlined />}
              size="small"
              loading={testing === record.id}
              onClick={() => handleTest(record.id)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm title="Delete this connection?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="Delete">
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>VMware vCenter Connections</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Add Connection
        </Button>
      </Space>

      <Card>
        <Table
          dataSource={connections}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={editing ? 'Edit Connection' : 'Add vCenter Connection'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={[
          <Button key="test" icon={<ApiOutlined />} onClick={handleTestDirect} loading={saving}>
            Test Connection
          </Button>,
          <Button key="cancel" onClick={() => setModalOpen(false)}>Cancel</Button>,
          <Button key="save" type="primary" onClick={handleSave} loading={saving}>
            {editing ? 'Update' : 'Create'}
          </Button>,
        ]}
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Connection Name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="Production vCenter" />
          </Form.Item>
          <Form.Item name="server" label="vCenter Server" rules={[{ required: true, message: 'Required' }]}
            help="Hostname or IP of vCenter Server (e.g. vcenter.company.com)">
            <Input placeholder="vcenter.company.com" />
          </Form.Item>
          <Form.Item name="username" label="Username" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="administrator@vsphere.local" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={editing ? [] : [{ required: true, message: 'Required' }]}
            help={editing ? 'Leave blank to keep existing password' : undefined}
          >
            <Input.Password placeholder="••••••••" />
          </Form.Item>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="tls_reject_unauthorized" label="Verify TLS Certificate" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="sync_interval_minutes" label="Sync Interval (minutes)"
              rules={[{ required: true }, { type: 'number', min: 5, max: 1440 }]}>
              <InputNumber min={5} max={1440} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default VmwareConnectionsPage;
