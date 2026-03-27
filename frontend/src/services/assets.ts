import api from './api';

export interface Asset {
  id: string;
  asset_tag: string;
  data: Record<string, unknown>;
  status: string;
  created_by_name: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface AssetListResponse {
  data: Asset[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FieldDefinition {
  id: string;
  field_key: string;
  display_name: string;
  field_type: string;
  is_required: boolean;
  is_active: boolean;
  display_order: number;
  field_group: string;
  placeholder: string | null;
  help_text: string | null;
  default_value: string | null;
  validation_rules: Record<string, unknown>;
  select_options: string[];
  min_length: number | null;
  max_length: number | null;
  min_value: number | null;
  max_value: number | null;
  regex_pattern: string | null;
  is_unique: boolean;
  is_filterable: boolean;
  is_sortable: boolean;
  is_exportable: boolean;
}

export interface ExportRequest {
  format: 'xlsx' | 'csv' | 'pdf';
  fields: string[];
  filters?: Record<string, string>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const assetApi = {
  list: async (params: Record<string, string | number>): Promise<AssetListResponse> => {
    const response = await api.get('/assets', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Asset> => {
    const response = await api.get(`/assets/${id}`);
    return response.data;
  },

  create: async (data: { asset_tag?: string; data: Record<string, unknown>; status?: string }): Promise<Asset> => {
    const response = await api.post('/assets', data);
    return response.data;
  },

  update: async (id: string, data: { asset_tag?: string; data?: Record<string, unknown>; status?: string }): Promise<Asset> => {
    const response = await api.put(`/assets/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/assets/${id}`);
  },

  getHistory: async (id: string, page = 1, limit = 20) => {
    const response = await api.get(`/assets/${id}/history`, { params: { page, limit } });
    return response.data;
  },

  getFields: async (): Promise<FieldDefinition[]> => {
    const response = await api.get('/meta/fields');
    return response.data;
  },

  getFieldGroups: async () => {
    const response = await api.get('/meta/field-groups');
    return response.data;
  },

  import: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/io/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return response.data;
  },

  export: async (params: ExportRequest): Promise<Blob> => {
    const response = await api.post('/io/export', params, {
      responseType: 'blob',
    });
    return response.data;
  },

  getImportLogs: async (page = 1, limit = 20) => {
    const response = await api.get('/io/imports', { params: { page, limit } });
    return response.data;
  },
};
