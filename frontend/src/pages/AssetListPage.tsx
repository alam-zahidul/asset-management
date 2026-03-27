import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Card, Button, Space, Input, Upload, Modal, Form,
  Select, message, Tag, Tooltip, Row, Col, Drawer, Checkbox, Divider,
} from 'antd';
import {
  PlusOutlined, UploadOutlined, DownloadOutlined, SearchOutlined,
  EditOutlined, DeleteOutlined, FilterOutlined, ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../services/api';
import { useFieldStore, FieldDefinition } from '../store/fieldStore';
import { useAuthStore } from '../store/authStore';
import { sanitize } from '../utils/sanitizer';

interface Asset {
  id: string;
  asset_tag: string;
  field_values: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const AssetListPage: React.FC = () => {
  const { fields, loadFields } = useFieldStore();
  const { hasPermission } = useAuthStore();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportDrawerOpen, setIsExportDrawerOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const [exportForm] = Form.useForm();

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: pageSize };
      if (search) params.search = search;
      for (const [key, value] of Object.entries(filters)) {
        if (value) params[`filter_${key}`] = value;
      }
      const { data } = await api.get('/assets', { params });
      setAssets(data.data.data);
      setTotal(data.data.total);
    } catch {
      message.error('Failed to load assets');
    }
    setLoading(false);
  }, [page, pageSize, search, filters]);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleCreate = () => {
    setEditingAsset(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    form.setFieldsValue({
      asset_tag: asset.asset_tag,
      ...asset.field_values,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: 'Delete Asset',
      content: 'Are you sure you want to delete this asset?',
      okType: 'danger',
      onOk: async () => {
        await api.delete(`/assets/${id}`);
        message.success('Asset deleted');
        fetchAssets();
      },
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const { asset_tag, ...fieldValues } = values;

      // Sanitize all string values
      const sanitizedValues: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fieldValues)) {
        sanitizedValues[key] = typeof value === 'string' ? sanitize(value) : value;
      }

      if (editingAsset) {
        await api.put(`/assets/${editingAsset.id}`, { field_values: sanitizedValues });
        message.success('Asset updated');
      } else {
        await api.post('/assets', {
          asset_tag: sanitize(asset_tag),
          field_values: sanitizedValues,
        });
        message.success('Asset created');
      }
      setIsModalOpen(false);
      fetchAssets();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; details?: Record<string, string[]> } } };
      if (axiosErr.response?.data?.details) {
        const details = axiosErr.response.data.details;
        const fields = Object.entries(details).map(([name, errors]) => ({
          name,
          errors: errors as string[],
        }));
        form.setFields(fields);
      } else if (axiosErr.response?.data?.message) {
        message.error(axiosErr.response.data.message);
      }
    }
  };

  const handleImport = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await api.post('/assets/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const result = data.data;
      message.success(`Import complete: ${result.successRows} success, ${result.errorRows} errors out of ${result.totalRows} rows`);
      fetchAssets();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      message.error(axiosErr.response?.data?.message || 'Import failed');
    }
    return false; // Prevent antd default upload
  };

  const handleExport = async () => {
    try {
      const values = await exportForm.validateFields();
      const response = await api.post('/assets/export', {
        format: values.format,
        fieldIds: values.fieldIds,
        filters,
        search,
      }, { responseType: 'blob' });

      const contentDisposition = response.headers['content-disposition'];
      const fileName = contentDisposition
        ? contentDisposition.split('filename="')[1]?.replace('"', '')
        : `export.${values.format}`;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setIsExportDrawerOpen(false);
      message.success('Export downloaded');
    } catch {
      message.error('Export failed');
    }
  };

  const columns: ColumnsType<Asset> = [
    {
      title: 'Asset Tag',
      dataIndex: 'asset_tag',
      key: 'asset_tag',
      fixed: 'left',
      width: 140,
      sorter: true,
    },
    ...fields.map((field) => ({
      title: field.display_name,
      key: field.field_key,
      width: 150,
      ellipsis: true,
      render: (_: unknown, record: Asset) => {
        const value = record.field_values?.[field.field_key];
        if (value === null || value === undefined) return '-';
        if (field.field_type === 'boolean') return value ? 'Yes' : 'No';
        return String(value);
      },
    })),
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_: unknown, record: Asset) => (
        <Space>
          {hasPermission('assets:update') && (
            <Tooltip title="Edit">
              <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
            </Tooltip>
          )}
          {hasPermission('assets:delete') && (
            <Tooltip title="Delete">
              <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.id)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const renderFormField = (field: FieldDefinition) => {
    const rules = field.is_required ? [{ required: true, message: `${field.display_name} is required` }] : [];

    switch (field.field_type) {
      case 'select':
        return (
          <Form.Item key={field.field_key} name={field.field_key} label={field.display_name} rules={rules}
            tooltip={field.help_text}>
            <Select placeholder={field.placeholder || `Select ${field.display_name}`} allowClear>
              {(field.select_options || []).map((opt) => (
                <Select.Option key={opt} value={opt}>{opt}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        );
      case 'boolean':
        return (
          <Form.Item key={field.field_key} name={field.field_key} label={field.display_name}
            valuePropName="checked" tooltip={field.help_text}>
            <Checkbox />
          </Form.Item>
        );
      case 'textarea':
        return (
          <Form.Item key={field.field_key} name={field.field_key} label={field.display_name} rules={rules}
            tooltip={field.help_text}>
            <Input.TextArea rows={3} placeholder={field.placeholder} maxLength={2000} />
          </Form.Item>
        );
      case 'number':
        return (
          <Form.Item key={field.field_key} name={field.field_key} label={field.display_name} rules={rules}
            tooltip={field.help_text}>
            <Input type="number" placeholder={field.placeholder} />
          </Form.Item>
        );
      default:
        return (
          <Form.Item key={field.field_key} name={field.field_key} label={field.display_name} rules={rules}
            tooltip={field.help_text}>
            <Input placeholder={field.placeholder || `Enter ${field.display_name}`} maxLength={500} />
          </Form.Item>
        );
    }
  };

  return (
    <>
      <Card
        title="Server Inventory"
        extra={
          <Space>
            <Input.Search
              placeholder="Search assets..."
              allowClear
              style={{ width: 250 }}
              onSearch={(v) => { setSearch(v); setPage(1); }}
              maxLength={200}
            />
            <Button icon={<FilterOutlined />} onClick={() => setIsFilterDrawerOpen(true)}>
              Filters {Object.values(filters).filter(Boolean).length > 0 && (
                <Tag color="blue">{Object.values(filters).filter(Boolean).length}</Tag>
              )}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchAssets} />
            {hasPermission('assets:import') && (
              <Upload
                accept=".csv,.xlsx,.xls"
                showUploadList={false}
                beforeUpload={handleImport}
                maxCount={1}
              >
                <Button icon={<UploadOutlined />}>Import</Button>
              </Upload>
            )}
            {hasPermission('assets:export') && (
              <Button icon={<DownloadOutlined />} onClick={() => setIsExportDrawerOpen(true)}>
                Export
              </Button>
            )}
            {hasPermission('assets:create') && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                Add Asset
              </Button>
            )}
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={assets}
          rowKey="id"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} assets`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingAsset ? 'Edit Asset' : 'Add Asset'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSave}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {!editingAsset && (
            <Form.Item name="asset_tag" label="Asset Tag"
              rules={[{ required: true, message: 'Asset tag is required' }, { max: 100 }]}>
              <Input placeholder="e.g. SRV-001" maxLength={100} />
            </Form.Item>
          )}
          <Divider />
          {fields.map(renderFormField)}
        </Form>
      </Modal>

      {/* Export Drawer */}
      <Drawer
        title="Export Assets"
        open={isExportDrawerOpen}
        onClose={() => setIsExportDrawerOpen(false)}
        width={400}
        extra={<Button type="primary" onClick={handleExport}>Download</Button>}
      >
        <Form form={exportForm} layout="vertical" initialValues={{ format: 'xlsx' }}>
          <Form.Item name="format" label="Format" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="xlsx">Excel (.xlsx)</Select.Option>
              <Select.Option value="csv">CSV (.csv)</Select.Option>
              <Select.Option value="pdf">PDF (.pdf)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="fieldIds" label="Columns to Export (leave empty for all)">
            <Select mode="multiple" placeholder="Select fields" allowClear>
              {fields.filter((f) => f.is_exportable).map((f) => (
                <Select.Option key={f.id} value={f.id}>{f.display_name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Drawer>

      {/* Filter Drawer */}
      <Drawer
        title="Filter Assets"
        open={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        width={400}
        extra={
          <Space>
            <Button onClick={() => { setFilters({}); setPage(1); }}>Clear All</Button>
            <Button type="primary" onClick={() => { setIsFilterDrawerOpen(false); setPage(1); fetchAssets(); }}>
              Apply
            </Button>
          </Space>
        }
      >
        {fields.filter((f) => f.is_filterable).map((field) => (
          <div key={field.field_key} style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>{field.display_name}</label>
            {field.field_type === 'select' ? (
              <Select
                value={filters[field.field_key] || undefined}
                onChange={(v) => setFilters({ ...filters, [field.field_key]: v || '' })}
                placeholder={`Filter by ${field.display_name}`}
                allowClear
                style={{ width: '100%' }}
              >
                {(field.select_options || []).map((opt) => (
                  <Select.Option key={opt} value={opt}>{opt}</Select.Option>
                ))}
              </Select>
            ) : (
              <Input
                value={filters[field.field_key] || ''}
                onChange={(e) => setFilters({ ...filters, [field.field_key]: sanitize(e.target.value) })}
                placeholder={`Filter by ${field.display_name}`}
                allowClear
                maxLength={200}
              />
            )}
          </div>
        ))}
      </Drawer>
    </>
  );
};

export default AssetListPage;
