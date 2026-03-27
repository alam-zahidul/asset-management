import React, { useEffect, useState } from 'react';
import {
  Card, Table, Button, Space, Modal, Form, Input, Select, Switch, InputNumber,
  Tag, message, Popconfirm, Tooltip, Divider,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../services/api';
import DOMPurify from 'dompurify';

interface FieldDefinition {
  id: string;
  field_key: string;
  display_name: string;
  field_type: string;
  is_required: boolean;
  is_active: boolean;
  is_system: boolean;
  is_filterable: boolean;
  is_exportable: boolean;
  sort_order: number;
  validation_rules: Record<string, unknown> | null;
  select_options: string[] | null;
  default_value: string | null;
  placeholder: string | null;
  help_text: string | null;
  field_group: string | null;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
  { value: 'ip_address', label: 'IP Address' },
  { value: 'textarea', label: 'Text Area' },
];

const FieldManagementPage: React.FC = () => {
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
  const [form] = Form.useForm();
  const [selectedType, setSelectedType] = useState('text');

  const fetchFields = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/fields');
      setFields(data.data);
    } catch {
      message.error('Failed to load fields');
    }
    setLoading(false);
  };

  useEffect(() => { fetchFields(); }, []);

  const handleCreate = () => {
    setEditingField(null);
    form.resetFields();
    setSelectedType('text');
    setIsModalOpen(true);
  };

  const handleEdit = (field: FieldDefinition) => {
    setEditingField(field);
    setSelectedType(field.field_type);
    form.setFieldsValue({
      ...field,
      select_options_text: field.select_options?.join('\n') || '',
      validation_min: field.validation_rules?.min,
      validation_max: field.validation_rules?.max,
      validation_pattern: field.validation_rules?.pattern,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/fields/${id}`);
      message.success('Field deleted');
      fetchFields();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      message.error(e.response?.data?.message || 'Failed to delete');
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      // Build validation rules
      const validation_rules: Record<string, unknown> = {};
      if (values.validation_min !== undefined) validation_rules.min = values.validation_min;
      if (values.validation_max !== undefined) validation_rules.max = values.validation_max;
      if (values.validation_pattern) validation_rules.pattern = values.validation_pattern;

      // Build select options from textarea
      const select_options = values.select_options_text
        ? values.select_options_text.split('\n').map((s: string) => DOMPurify.sanitize(s.trim(), { ALLOWED_TAGS: [] })).filter(Boolean)
        : null;

      const payload = {
        field_key: DOMPurify.sanitize(values.field_key, { ALLOWED_TAGS: [] }),
        display_name: DOMPurify.sanitize(values.display_name, { ALLOWED_TAGS: [] }),
        field_type: values.field_type,
        is_required: values.is_required || false,
        is_active: values.is_active !== false,
        is_filterable: values.is_filterable !== false,
        is_exportable: values.is_exportable !== false,
        sort_order: values.sort_order || 0,
        validation_rules: Object.keys(validation_rules).length > 0 ? validation_rules : null,
        select_options,
        default_value: values.default_value || null,
        placeholder: values.placeholder || null,
        help_text: values.help_text || null,
        field_group: values.field_group || null,
      };

      if (editingField) {
        await api.put(`/fields/${editingField.id}`, payload);
        message.success('Field updated');
      } else {
        await api.post('/fields', payload);
        message.success('Field created');
      }

      setIsModalOpen(false);
      fetchFields();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      if (e.response?.data?.message) {
        message.error(e.response.data.message);
      }
    }
  };

  const columns: ColumnsType<FieldDefinition> = [
    { title: 'Order', dataIndex: 'sort_order', key: 'sort_order', width: 70, align: 'center' },
    {
      title: 'Field Key', dataIndex: 'field_key', key: 'field_key',
      render: (v: string, r: FieldDefinition) => (
        <Space>
          {v}
          {r.is_system && <Tag color="blue">System</Tag>}
        </Space>
      ),
    },
    { title: 'Display Name', dataIndex: 'display_name', key: 'display_name' },
    {
      title: 'Type', dataIndex: 'field_type', key: 'field_type', width: 110,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'Required', dataIndex: 'is_required', key: 'is_required', width: 90, align: 'center',
      render: (v: boolean) => v ? <Tag color="red">Yes</Tag> : <Tag>No</Tag>,
    },
    {
      title: 'Active', dataIndex: 'is_active', key: 'is_active', width: 80, align: 'center',
      render: (v: boolean) => v ? <Tag color="green">Yes</Tag> : <Tag color="default">No</Tag>,
    },
    { title: 'Group', dataIndex: 'field_group', key: 'field_group', width: 120 },
    {
      title: 'Actions', key: 'actions', width: 120,
      render: (_: unknown, record: FieldDefinition) => (
        <Space>
          <Tooltip title="Edit">
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          </Tooltip>
          {!record.is_system && (
            <Popconfirm title="Delete this field?" onConfirm={() => handleDelete(record.id)}>
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        title="Field Management"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>Add Field</Button>}
      >
        <Table columns={columns} dataSource={fields} rowKey="id" loading={loading} pagination={false} />
      </Card>

      <Modal
        title={editingField ? 'Edit Field' : 'Create Field'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSave}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ is_active: true, is_filterable: true, is_exportable: true, sort_order: 0 }}>
          <Form.Item name="field_key" label="Field Key"
            rules={[
              { required: true },
              { pattern: /^[a-z][a-z0-9_]*$/, message: 'Lowercase letters, numbers, underscores only. Must start with a letter.' },
            ]}
            tooltip="Unique identifier used internally (e.g. 'cpu_cores')"
          >
            <Input disabled={editingField?.is_system} maxLength={100} />
          </Form.Item>

          <Form.Item name="display_name" label="Display Name" rules={[{ required: true }]}>
            <Input maxLength={255} />
          </Form.Item>

          <Form.Item name="field_type" label="Field Type" rules={[{ required: true }]}>
            <Select options={FIELD_TYPES} onChange={setSelectedType} />
          </Form.Item>

          {selectedType === 'select' && (
            <Form.Item name="select_options_text" label="Options (one per line)" rules={[{ required: true }]}
              tooltip="Enter each option on a new line">
              <Input.TextArea rows={5} />
            </Form.Item>
          )}

          <Form.Item name="field_group" label="Group">
            <Input placeholder="e.g. Hardware, Network, General" maxLength={100} />
          </Form.Item>

          <Divider>Behavior</Divider>

          <Space size="large">
            <Form.Item name="is_required" label="Required" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="is_filterable" label="Filterable" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="is_exportable" label="Exportable" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item name="sort_order" label="Sort Order">
            <InputNumber min={0} />
          </Form.Item>

          <Divider>Validation</Divider>

          {(selectedType === 'text' || selectedType === 'textarea' || selectedType === 'number') && (
            <Space>
              <Form.Item name="validation_min" label="Min">
                <InputNumber />
              </Form.Item>
              <Form.Item name="validation_max" label="Max">
                <InputNumber />
              </Form.Item>
            </Space>
          )}

          {(selectedType === 'text' || selectedType === 'textarea') && (
            <Form.Item name="validation_pattern" label="Regex Pattern" tooltip="Regular expression for validation">
              <Input placeholder="e.g. ^[A-Z]{3}-\d{4}$" maxLength={500} />
            </Form.Item>
          )}

          <Divider>Display</Divider>

          <Form.Item name="placeholder" label="Placeholder">
            <Input maxLength={255} />
          </Form.Item>

          <Form.Item name="default_value" label="Default Value">
            <Input maxLength={500} />
          </Form.Item>

          <Form.Item name="help_text" label="Help Text">
            <Input maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default FieldManagementPage;
