import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Select, DatePicker, Space, message, Input, Row, Col } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import api from '../services/api';
import dayjs from 'dayjs';

interface AuditLog {
  id: string;
  username: string;
  display_name: string;
  action: string;
  resource: string;
  resource_id: string;
  old_values: unknown;
  new_values: unknown;
  ip_address: string;
  created_at: string;
}

const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/audit-logs', { params: { page, limit: 25, ...filters } });
      setLogs(data.data.data);
      setTotal(data.data.total);
    } catch {
      message.error('Failed to load audit logs');
    }
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [page, filters]);

  const actionColors: Record<string, string> = {
    create: 'green',
    update: 'blue',
    delete: 'red',
    import: 'orange',
    export: 'purple',
    assign_role: 'cyan',
    remove_role: 'magenta',
  };

  const columns: ColumnsType<AuditLog> = [
    {
      title: 'Time', dataIndex: 'created_at', key: 'created_at', width: 180,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    { title: 'User', dataIndex: 'display_name', key: 'display_name', width: 150 },
    {
      title: 'Action', dataIndex: 'action', key: 'action', width: 120,
      render: (v: string) => <Tag color={actionColors[v] || 'default'}>{v}</Tag>,
    },
    { title: 'Resource', dataIndex: 'resource', key: 'resource', width: 130 },
    { title: 'Resource ID', dataIndex: 'resource_id', key: 'resource_id', width: 150, ellipsis: true },
    { title: 'IP', dataIndex: 'ip_address', key: 'ip_address', width: 130 },
    {
      title: 'Changes', key: 'changes', ellipsis: true,
      render: (_: unknown, record: AuditLog) => {
        if (record.new_values) return JSON.stringify(record.new_values).substring(0, 100);
        return '-';
      },
    },
  ];

  return (
    <Card title="Audit Logs">
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Select
            placeholder="Filter by action"
            allowClear
            style={{ width: '100%' }}
            onChange={(v) => setFilters((f) => ({ ...f, action: v || '' }))}
          >
            {['create', 'update', 'delete', 'import', 'export', 'assign_role', 'remove_role'].map((a) => (
              <Select.Option key={a} value={a}>{a}</Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={6}>
          <Select
            placeholder="Filter by resource"
            allowClear
            style={{ width: '100%' }}
            onChange={(v) => setFilters((f) => ({ ...f, resource: v || '' }))}
          >
            {['asset', 'field', 'user_role', 'user', 'export_template'].map((r) => (
              <Select.Option key={r} value={r}>{r}</Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={6}>
          <DatePicker.RangePicker
            style={{ width: '100%' }}
            onChange={(dates) => {
              if (dates) {
                setFilters((f) => ({
                  ...f,
                  startDate: dates[0]?.toISOString() || '',
                  endDate: dates[1]?.toISOString() || '',
                }));
              } else {
                setFilters((f) => { const n = { ...f }; delete n.startDate; delete n.endDate; return n; });
              }
            }}
          />
        </Col>
      </Row>
      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page, pageSize: 25, total,
          onChange: setPage,
          showTotal: (t) => `Total ${t} logs`,
        }}
      />
    </Card>
  );
};

export default AuditLogsPage;
