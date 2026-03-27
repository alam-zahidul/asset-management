import { create } from 'zustand';
import api from '../services/api';

export interface FieldDefinition {
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

interface FieldState {
  fields: FieldDefinition[];
  isLoading: boolean;
  loadFields: () => Promise<void>;
}

export const useFieldStore = create<FieldState>((set) => ({
  fields: [],
  isLoading: false,

  loadFields: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/fields/active');
      set({ fields: data.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
}));
