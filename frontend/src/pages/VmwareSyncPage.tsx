import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Card, Button, Tag, Space, Typography, message, Modal,
  Descriptions, Tooltip, Select,
} from 'antd';
import {
  SyncOutlined, CloudServerOutlined, CheckCircleOutlined,
  CloseCircleOutlined, LoadingOutlined, ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

const { Title } = Typography;

interface VmwareConnection {
  id: string;
  name: string;
  server: string;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_asset_count: number | null;
  last_sync_error: string | null;
  sync_interval_minutes: number;
}

interface SyncLog {
  id: string;
  connection_id: string;
  connection_name: string;
  triggered_by_username: string | null;
  status: string;
  vms_found: number;
  hosts_found: number;
  assets_created: number;
  assets_updated: number;
  errors_count: number;
  error_details: unknown;
  started_at: string;
  completed_at: string | null;
}

const VmwareSyncPage: React.FC = () => {
  const { hasPermission } = useAuthStore();
  const [connections, setConnections] = useState<VmwareConnection[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [logsPagination, setLogsPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [selectedConnection, setSelectedConnection] = useState<string | undefined>();

  const canSync = hasPermission('vmware:sync');

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/vmware/connections');
      setConnections(data.data || []);
    } catch {
      message.error('Failed to load VMware connections');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSyncLogs = useCallback(async (page = 1, connectionId?: string) => {
    setLogsLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: logsPagination.limit };
      if (connectionId) params.connectionId = connectionId;
      const { data } = await api.get('/vmware/sync-logs', { params });
      setSyncLogs(data.data || []);
      setLogsPagination((prev) => ({ ...prev, page, total: data.total }));
    } catch {
      message.error('Failed to load sync logs');
    } finally {
      setLogsLoading(false);
    }
  }, [logsPagination.limit]);

  useEffect(() => {
    fetchConnections();
    fetchSyncLogs();
  }, [fetchConnections, fetchSyncLogs]);

  const handleSync = async (id: string) => {
    setSyncingIds((prev) => new Set(prev).add(id));
    try {
      const { data } = await api.post(`/vmware/connections/${id}/sync`);
      const result = data.data;
      message.success(
        `Sync completed: ${result.vmsFound} VMs found, ${result.assetsCreated} created, ${result.assetsUpdated} updated`
      );
      fetchConnections();
      fetchSyncLogs(1, selectedConnection);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Sync failed');
      fetchConnections();
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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

  const connectionColumns: ColumnsType<VmwareConnection> = [
    {
      title: 'Name', dataIndex: 'name', key: 'name',
      render: (name: string, record) => (
        <Space>
          <CloudServerOutlined />
          <span>{name}</span>
          {!record.is_active && <Tag color="default">Disabled</Tag>}
        </Space>
      ),
    },
    { title: 'Server', dataIndex: 'server', key: 'server' },
    {
      title: 'Last Sync', key: 'last_sync',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          {statusTag(record.last_sync_status)}
          {record.last_sync_at && (
            <small style={{ color: '#999' }}>
              {new Date(record.last_sync_at).toLocaleString()}
            </small>
          )}
        </Space>
      ),
    },
    {
      title: 'Assets Synced', dataIndex: 'last_sync_asset_count', key: 'assets',
      render: (count: number | null) => count ?? '—',
    },
    {
      title: 'Interval', dataIndex: 'sync_interval_minutes', key: 'interval',
      render: (mins: number) => `${mins} min`,
    },
    {
      title: 'Actions', key: 'actions',
      render: (_, record) => (
        <Space>
          {canSync && record.is_active && (
            <Tooltip title="Trigger sync now">
              <Button
                type="primary"
                icon={<SyncOutlined spin={syncingIds.has(record.id)} />}
                loading={syncingIds.has(record.id)}
                onClick={() => handleSync(record.id)}
              >
                Sync Now
              </Button>
            </Tooltip>
          )}
          {record.last_sync_error && (
            <Tooltip title={record.last_sync_error}>
              <Button danger type="text" icon={<CloseCircleOutlined />}>
                View Error
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const logColumns: ColumnsType<SyncLog> = [
    { title: 'Connection', dataIndex: 'connection_name', key: 'connection' },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (status: string) => statusTag(status),
    },
    { title: 'VMs Found', dataIndex: 'vms_found', key: 'vms' },
    { title: 'Hosts Found', dataIndex: 'hosts_found', key: 'hosts' },
    { title: 'Created', dataIndex: 'assets_created', key: 'created' },
    { title: 'Updated', dataIndex: 'assets_updated', key: 'updated' },
    {
      title: 'Errors', dataIndex: 'errors_count', key: 'errors',
      render: (count: number) => count > 0 ? <Tag color="error">{count}</Tag> : 0,
    },
    { title: 'Triggered By', dataIndex: 'triggered_by_username', key: 'user', render: (u: string | null) => u || 'System' },
    {
      title: 'Started', dataIndex: 'started_at', key: 'started',
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: 'Duration', key: 'duration',
      render: (_, record) => {
        if (!record.completed_at) return 'Running...';
        const ms = new Date(record.completed_at).getTime() - new Date(record.started_at).getTime();
        return `${(ms / 1000).toFixed(1)}s`;
      },
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>VMware Inventory Sync</Title>
        <Button icon={<ReloadOutlined />} onClick={() => { fetchConnections(); fetchSyncLogs(1, selectedConnection); }}>
          Refresh
        </Button>
      </Space>

      <Card title="vCenter Connections" style={{ marginBottom: 24 }}>
        <Table
          dataSource={connections}
          columns={connectionColumns}
          rowKey="id"
          loading={loading}
          pagination={false}
          locale={{ emptyText: 'No VMware connections configured. Ask an admin to add one.' }}
        />
      </Card>

      <Card
        title="Sync History"
        extra={
          <Select
            placeholder="All connections"
            allowClear
            style={{ width: 200 }}
            value={selectedConnection}
            onChange={(val) => {
              setSelectedConnection(val);
              fetchSyncLogs(1, val);
            }}
            options={connections.map((c) => ({ label: c.name, value: c.id }))}
          />
        }
      >
        <Table
          dataSource={syncLogs}
          columns={logColumns}
          rowKey="id"
          loading={logsLoading}
          pagination={{
            current: logsPagination.page,
            pageSize: logsPagination.limit,
            total: logsPagination.total,
            showSizeChanger: false,
            onChange: (page) => fetchSyncLogs(page, selectedConnection),
          }}
        />
      </Card>
    </div>
  );
};

export default VmwareSyncPage;
