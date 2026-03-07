import { ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ComboboxOption {
  value: string;
  label: string;
  secondary?: string;
}

interface ComboboxProps {
  label?: string;
  placeholder?: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
}

export function Combobox({
  label,
  placeholder = 'Search...',
  options,
  value,
  onChange,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = query
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          o.secondary?.toLowerCase().includes(query.toLowerCase()),
      )
    : options;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-9 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-sm text-left flex items-center gap-2 cursor-pointer hover:border-[var(--border-strong)] focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--accent-muted)] focus:outline-none transition-colors"
      >
        <span className="flex-1 truncate">
          {selected ? (
            <span className="text-[var(--text-primary)]">{selected.label}</span>
          ) : (
            <span className="text-[var(--text-tertiary)]">{placeholder}</span>
          )}
        </span>
        {value && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setQuery('');
            }}
            className="p-0.5 rounded hover:bg-[var(--bg-overlay)] text-[var(--text-tertiary)]"
          >
            <X size={12} />
          </span>
        )}
        <ChevronDown
          size={14}
          className={`text-[var(--text-tertiary)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[var(--bg-overlay)] border border-[var(--border-default)] rounded-md shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-default)]">
            <Search size={14} className="text-[var(--text-tertiary)] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none border-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-0.5 rounded hover:bg-[var(--bg-subtle)] text-[var(--text-tertiary)] cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-[var(--text-tertiary)]">
                No results found
              </div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors ${
                    option.value === value
                      ? 'bg-[var(--accent-muted)] text-[var(--accent)] font-medium'
                      : 'text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  <span className="block truncate">{option.label}</span>
                  {option.secondary && (
                    <span className="block font-mono text-[10px] text-[var(--text-tertiary)] truncate mt-0.5">
                      {option.secondary}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="px-3 py-1.5 border-t border-[var(--border-default)] font-mono text-[10px] text-[var(--text-tertiary)]">
            {filtered.length} of {options.length} problems
          </div>
        </div>
      )}
    </div>
  );
}
