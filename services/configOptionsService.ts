export type ConfigOptionType = 'service_modality' | 'expense_description' | 'originator' | 'reimbursement_party';

export interface ConfigOption {
  id: string;
  type: ConfigOptionType;
  label: string;
  value: string;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CONFIG_OPTION_TYPES = {
  SERVICE_MODALITY: 'service_modality',
  EXPENSE_DESCRIPTION: 'expense_description',
  ORIGINATOR: 'originator',
  REIMBURSEMENT_PARTY: 'reimbursement_party',
} as const;

const STORAGE_KEY = 'onebridge_cfo_configurable_options_v1';
export const CONFIG_OPTIONS_STORAGE_KEY = STORAGE_KEY;

const PARTNER_OPTIONS = [
  'Evandro (Profiscal)',
  'Julia/Samuel (Elevated)',
  "Walter (Moraes D'Angelo)",
];

const DEFAULT_LABELS: Record<ConfigOptionType, string[]> = {
  service_modality: [
    'Abertura Conta Bancária',
    'Abertura Delaware',
    'Abertura Flórida',
    'Abertura Off Shore B.V.I',
    'Abertura Wyoming',
    'Agente Registrado DE',
    'Agente Registrado FL',
    'Agente Registrado WY',
    'Apostilamento e Tradução',
    'Business Plan',
    'Compliance Anual Flórida',
    'Compliance B.V.I',
    'Compliance Delaware CORP',
    'Compliance Delaware LLC',
    'Compliance Wyoming',
    'Consultoria Contadores (hora)',
    'Customização Documentos',
    'Dissolução Delaware',
    'Dissolução Flórida',
    'Dissolução Wyoming',
    'Mudanças/Amendments',
    'Planej.Tributário Avançado',
    'Planej.Tributário Básico',
    'Registro Marca USPTO p/ classe',
    'Visto EB-1',
    'Visto EB-2',
    'Visto EB-3',
    'Visto E-2',
    'Visto L-1',
    'Visto O-1',
    'Visto - RFE',
    'Visto - Appeal / Motion',
    'Visto - Refile',
  ],
  expense_description: [
    'Taxa Governamental (Filing Fee)',
    'Apostilamento',
    'Tradução Juramentada',
    'Certidão de Good Standing',
    'Honorários Parceiros',
    'Marketing / Ads',
    'Software / Assinaturas',
    'Reembolso de Viagem',
    'Material de Escritório',
    'Contabilidade',
  ],
  originator: PARTNER_OPTIONS,
  reimbursement_party: PARTNER_OPTIONS,
};

export function normalizeOptionLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

function cleanLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ');
}

function nowIso(): string {
  return new Date().toISOString();
}

function createOptionId(type: ConfigOptionType, value: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${type}-${value.replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
}

function createDefaultOption(type: ConfigOptionType, label: string): ConfigOption {
  const normalizedLabel = cleanLabel(label);
  const value = normalizeOptionLabel(normalizedLabel);
  const timestamp = nowIso();

  return {
    id: `default-${type}-${value.replace(/[^a-z0-9]+/g, '-')}`,
    type,
    label: normalizedLabel,
    value,
    metadata: null,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function defaultOptions(): ConfigOption[] {
  return Object.entries(DEFAULT_LABELS).flatMap(([type, labels]) =>
    labels.map((label) => createDefaultOption(type as ConfigOptionType, label))
  );
}

let memoryOptions: ConfigOption[] | null = null;

export class ConfigOptionsService {
  static normalizeOptionLabel = normalizeOptionLabel;

  private static getStorage(): Storage | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    return window.localStorage;
  }

  private static readOptions(): ConfigOption[] {
    const storage = this.getStorage();

    if (!storage) {
      if (!memoryOptions) {
        memoryOptions = this.mergeOptions([], defaultOptions());
      }
      return memoryOptions;
    }

    try {
      const rawValue = storage.getItem(STORAGE_KEY);
      const parsed = rawValue ? JSON.parse(rawValue) : [];
      const storedOptions = Array.isArray(parsed) ? this.normalizeStoredOptions(parsed) : [];
      const seededOptions = this.mergeOptions(storedOptions, defaultOptions());
      this.writeOptions(seededOptions);
      return seededOptions;
    } catch (error) {
      console.warn('Failed to read local configurable options. Re-seeding defaults.', error);
      const seededOptions = defaultOptions();
      this.writeOptions(seededOptions);
      return seededOptions;
    }
  }

  private static writeOptions(options: ConfigOption[]): void {
    const normalizedOptions = this.normalizeStoredOptions(options);
    const storage = this.getStorage();

    if (!storage) {
      memoryOptions = normalizedOptions;
      return;
    }

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(normalizedOptions));
    } catch (error) {
      console.warn('Failed to persist local configurable options. Using in-memory options for this session.', error);
      memoryOptions = normalizedOptions;
    }
  }

  private static normalizeStoredOptions(options: unknown[]): ConfigOption[] {
    return options
      .filter((option): option is Partial<ConfigOption> => !!option && typeof option === 'object')
      .map((option) => {
        const type = option.type;
        const label = cleanLabel(String(option.label || ''));
        const value = normalizeOptionLabel(label || String(option.value || ''));
        const timestamp = nowIso();

        if (!this.isValidType(type) || !value) {
          return null;
        }

        return {
          id: String(option.id || createOptionId(type, value)),
          type,
          label: label || value,
          value,
          metadata: option.metadata && typeof option.metadata === 'object' ? option.metadata as Record<string, unknown> : null,
          isActive: option.isActive !== false,
          createdAt: String(option.createdAt || timestamp),
          updatedAt: String(option.updatedAt || option.createdAt || timestamp),
        };
      })
      .filter((option): option is ConfigOption => option !== null);
  }

  private static isValidType(type: unknown): type is ConfigOptionType {
    return Object.values(CONFIG_OPTION_TYPES).includes(type as ConfigOptionType);
  }

  private static mergeOptions(primary: ConfigOption[], additions: ConfigOption[]): ConfigOption[] {
    const byTypeAndValue = new Map<string, ConfigOption>();

    [...additions, ...primary].forEach((option) => {
      const normalizedLabel = cleanLabel(option.label);
      const value = normalizeOptionLabel(normalizedLabel);
      if (!this.isValidType(option.type) || !value) return;

      const key = `${option.type}:${value}`;
      const previous = byTypeAndValue.get(key);
      byTypeAndValue.set(key, {
        ...option,
        id: previous?.id || option.id,
        label: normalizedLabel,
        value,
        metadata: option.metadata || previous?.metadata || null,
        isActive: option.isActive,
        createdAt: previous?.createdAt || option.createdAt,
        updatedAt: option.updatedAt || previous?.updatedAt || nowIso(),
      });
    });

    return Array.from(byTypeAndValue.values()).sort((a, b) =>
      a.type === b.type ? a.label.localeCompare(b.label) : a.type.localeCompare(b.type)
    );
  }

  static async seedDefaultOptions(): Promise<ConfigOption[]> {
    const seededOptions = this.mergeOptions(this.readOptions(), defaultOptions());
    this.writeOptions(seededOptions);
    return seededOptions;
  }

  static async getAllOptions(): Promise<ConfigOption[]> {
    return this.readOptions();
  }

  static async listOptions(type: ConfigOptionType): Promise<ConfigOption[]> {
    if (!this.isValidType(type)) {
      return [];
    }

    return this.readOptions()
      .filter((option) => option.type === type && option.isActive)
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  static async createOption(
    type: ConfigOptionType,
    label: string,
    metadata?: Record<string, unknown>
  ): Promise<ConfigOption> {
    const normalizedLabel = cleanLabel(label);
    const value = normalizeOptionLabel(normalizedLabel);

    if (!this.isValidType(type)) {
      throw new Error('Invalid option type.');
    }

    if (!value) {
      throw new Error('Option label cannot be empty.');
    }

    const options = this.readOptions();
    const existingIndex = options.findIndex((option) => option.type === type && option.value === value);
    const timestamp = nowIso();

    if (existingIndex >= 0) {
      const existing = options[existingIndex];
      const updated = {
        ...existing,
        label: normalizedLabel,
        metadata: metadata || existing.metadata,
        isActive: true,
        updatedAt: timestamp,
      };

      options[existingIndex] = updated;
      this.writeOptions(options);
      return updated;
    }

    const option: ConfigOption = {
      id: createOptionId(type, value),
      type,
      label: normalizedLabel,
      value,
      metadata: metadata || null,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.writeOptions([...options, option]);
    return option;
  }

  static async deactivateOption(id: string): Promise<void> {
    const options = this.readOptions();
    const updatedOptions = options.map((option) =>
      option.id === id ? { ...option, isActive: false, updatedAt: nowIso() } : option
    );

    this.writeOptions(updatedOptions);
  }

  static async resetOptionsToDefaults(): Promise<ConfigOption[]> {
    const seededOptions = defaultOptions();
    this.writeOptions(seededOptions);
    return seededOptions;
  }

  static async exportOptions(): Promise<string> {
    return JSON.stringify(this.readOptions(), null, 2);
  }

  static async importOptions(json: string): Promise<ConfigOption[]> {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      throw new Error('Options import must be a JSON array.');
    }

    const importedOptions = this.mergeOptions(this.readOptions(), this.normalizeStoredOptions(parsed));
    this.writeOptions(importedOptions);
    return importedOptions;
  }

  static async replaceAll(options: ConfigOption[]): Promise<ConfigOption[]> {
    const normalizedOptions = this.mergeOptions([], this.normalizeStoredOptions(options));
    this.writeOptions(normalizedOptions);
    return normalizedOptions;
  }
}
