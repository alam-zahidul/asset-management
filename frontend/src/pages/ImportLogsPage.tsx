import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Space, Button, message } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../services/api';

interface ImportLog {
  id: string;
  username: string;
  display_name: string;
  file_name: string;
  file_type: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  status: string;
  errors: unknown;
  started_at: string;
  completed_at: string;
}

const ImportLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/assets/import-logs', { params: { page, limit: 25 } });
      setLogs(data.data.data);
      setTotal(data.data.total);
    } catch {
      message.error('Failed to load import logs');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const columns: ColumnsType<ImportLog> = [
    { title: 'File Name', dataIndex: 'file_name', key: 'file_name' },
    { title: 'Uploaded By', dataIndex: 'display_name', key: 'display_name' },
    { title: 'Type', dataIndex: 'file_type', key: 'file_type', width: 80 },
    { title: 'Total', dataIndex: 'total_rows', key: 'total_rows', width: 80, align: 'center' },
    {
      title: 'Success', dataIndex: 'success_rows', key: 'success_rows', width: 80, align: 'center',
      render: (v: number) => <Tag color="green">{v}</Tag>,
    },
    {
      title: 'Errors', dataIndex: 'error_rows', key: 'error_rows', width: 80, align: 'center',
      render: (v: number) => v > 0 ? <Tag color="red">{v}</Tag> : <Tag>{v}</Tag>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (s: string) => (
        <Tag color={s === 'completed' ? 'green' : s === 'failed' ? 'red' : 'processing'}>
          {s.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Date', dataIndex: 'started_at', key: 'started_at', width: 180,
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  return (
    <Card title="Import Logs">
      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          total,
          pageSize: 25,
          onChange: setPage,
        }}
      />
    </Card>
  );
};

export default ImportLogsPage;
