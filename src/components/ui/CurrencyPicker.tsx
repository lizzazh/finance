import { useEffect, useRef, useState } from 'react';
import { Search, Check, ChevronDown } from 'lucide-react';
import { CURRENCIES, searchCurrencies } from '../../utils/currencies';
import type { CurrencyCode, CurrencyInfo } from '../../types';

interface CurrencyPickerProps {
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
  className?: string;
}

export function CurrencyPicker({ value, onChange, className = '' }: CurrencyPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = CURRENCIES.find((c) => c.code === value) ?? {
    code: value,
    name: value,
    symbol: value,
    flag: '🌐',
  };

  const filtered = query ? searchCurrencies(query) : CURRENCIES;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [open]);

  function handleSelect(currency: CurrencyInfo) {
    onChange(currency.code);
    setOpen(false);
  }

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-bg hover:border-primary transition-all cursor-pointer"
      >
        <span className="text-base">{selected.flag}</span>
        <span className="font-semibold text-sm">{selected.code}</span>
        <ChevronDown size={14} className={`text-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-2 w-72 rounded-xl border border-border shadow-2xl z-[100] overflow-hidden flex flex-col"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg border border-border">
              <Search size={14} className="text-secondary shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Поиск валюты..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm border-none text-text"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-4 py-3 text-sm text-secondary text-center">Ничего не найдено</div>
            )}
            {filtered.map((currency) => {
              const isSelected = currency.code === value;
              return (
                <button
                  key={currency.code}
                  type="button"
                  onClick={() => handleSelect(currency)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-text hover:bg-bg'
                  }`}
                >
                  <span className="text-lg w-6 text-center">{currency.flag}</span>
                  <span className="font-semibold text-sm w-10">{currency.code}</span>
                  <span className="text-sm text-secondary flex-1 truncate">{currency.name}</span>
                  {isSelected && <Check size={16} className="text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
