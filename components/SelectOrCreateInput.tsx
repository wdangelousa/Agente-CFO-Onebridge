import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';

interface SelectOrCreateInputProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onCreate: (label: string) => Promise<string>;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
  accentClassName?: string;
}

const normalizeComparable = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

export const SelectOrCreateInput: React.FC<SelectOrCreateInputProps> = ({
  value,
  options,
  onChange,
  onCreate,
  placeholder = 'Selecione ou digite...',
  disabled = false,
  loading = false,
  error = null,
  accentClassName = 'focus:ring-[#D7FF3E]/50 focus:border-[#D7FF3E]',
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const normalizedInput = normalizeComparable(inputValue);

  const filteredOptions = useMemo(() => {
    const unique = new Map<string, string>();
    options.forEach((option) => {
      const normalized = normalizeComparable(option);
      if (normalized && !unique.has(normalized)) {
        unique.set(normalized, option);
      }
    });

    const allOptions = Array.from(unique.values());
    if (!normalizedInput) return allOptions.slice(0, 8);

    return allOptions
      .filter((option) => normalizeComparable(option).includes(normalizedInput))
      .slice(0, 8);
  }, [options, normalizedInput]);

  const hasExactMatch = options.some((option) => normalizeComparable(option) === normalizedInput);
  const canCreate = normalizedInput.length > 0 && !hasExactMatch;

  const commitSelection = (nextValue: string) => {
    setInputValue(nextValue);
    onChange(nextValue);
    setIsOpen(false);
    setCreateError(null);
  };

  const handleCreate = async () => {
    const label = inputValue.trim().replace(/\s+/g, ' ');
    if (!label) return;

    setCreating(true);
    setCreateError(null);

    try {
      const createdLabel = await onCreate(label);
      commitSelection(createdLabel);
    } catch (error) {
      console.error('Error creating option:', error);
      setCreateError('Não foi possível salvar a nova opção.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={inputValue}
          disabled={disabled || loading}
          onChange={(event) => {
            setInputValue(event.target.value);
            onChange(event.target.value);
            setIsOpen(true);
            setCreateError(null);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          placeholder={loading ? 'Carregando opções...' : placeholder}
          className={`w-full pl-10 pr-4 py-3.5 border border-slate-300/80 rounded-xl text-sm bg-white outline-none focus:ring-2 transition-all font-medium shadow-sm disabled:bg-slate-50 disabled:text-slate-400 ${accentClassName}`}
        />
        {(loading || creating) && <Loader2 className="w-4 h-4 animate-spin text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />}
      </div>

      {isOpen && !disabled && !loading && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xl">
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredOptions.map((option) => (
              <button
                type="button"
                key={option}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commitSelection(option)}
                className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {option}
              </button>
            ))}

            {canCreate && (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={handleCreate}
                disabled={creating}
                className="w-full flex items-center gap-2 border-t border-slate-100 px-4 py-3 text-left text-sm font-bold text-slate-900 hover:bg-[#D7FF3E]/10 transition-colors disabled:opacity-60"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add new: {inputValue.trim().replace(/\s+/g, ' ')}
              </button>
            )}

            {filteredOptions.length === 0 && !canCreate && (
              <div className="px-4 py-3 text-sm text-slate-400">Nenhuma opção encontrada.</div>
            )}
          </div>
        </div>
      )}

      {(error || createError) && (
        <p className="mt-2 text-[10px] font-semibold text-red-600">{createError || error}</p>
      )}
    </div>
  );
};
