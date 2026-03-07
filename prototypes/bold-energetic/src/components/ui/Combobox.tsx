import { ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

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
  const triggerId = useId();

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
    <div ref={containerRef} className="relative">
      {label && (
        <label
          htmlFor={triggerId}
          className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
        >
          {label}
        </label>
      )}

      {/* Trigger button */}
      <button
        id={triggerId}
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-10 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] px-3 text-sm text-left flex items-center gap-2 cursor-pointer hover:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 transition-colors"
      >
        <span className="flex-1 truncate text-[var(--text-primary)]">
          {selected ? (
            selected.label
          ) : (
            <span className="text-[var(--text-tertiary)]">{placeholder}</span>
          )}
        </span>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setQuery('');
            }}
            className="p-0.5 rounded hover:bg-[var(--bg-card)] text-[var(--text-tertiary)] cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
        <ChevronDown
          size={14}
          className={`text-[var(--text-tertiary)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-50 mt-1 w-full bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl shadow-lg overflow-hidden"
          style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
          {/* Search input */}
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

          {/* Options list */}
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
                  className={`w-full text-left px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                    option.value === value
                      ? 'bg-[var(--primary-muted)] text-[var(--primary)] font-medium'
                      : 'text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  <span className="block truncate">{option.label}</span>
                  {option.secondary && (
                    <span className="block text-xs text-[var(--text-tertiary)] truncate mt-0.5">
                      {option.secondary}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Count footer */}
          <div className="px-3 py-1.5 border-t border-[var(--border-default)] text-xs text-[var(--text-tertiary)]">
            {filtered.length} of {options.length} problems
          </div>
        </div>
      )}
    </div>
  );
}
