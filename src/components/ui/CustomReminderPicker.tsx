import React, { useState, useRef, useEffect } from 'react';
import { Minus, Plus, Bell, BellOff, ChevronDown, Check } from 'lucide-react';

export type ReminderUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

export interface ReminderConfig {
  enabled: boolean;
  value: number;
  unit: ReminderUnit;
}

interface CustomReminderPickerProps {
  value: ReminderConfig;
  onChange: (config: ReminderConfig) => void;
}

export function parseReminderOffset(offsetStr?: string): ReminderConfig {
  if (!offsetStr || offsetStr === 'none' || offsetStr === '0') {
    return { enabled: false, value: 1, unit: 'days' };
  }
  
  const parts = offsetStr.split('_');
  if (parts.length === 2) {
    const val = parseInt(parts[0], 10);
    let u = parts[1] as ReminderUnit;
    if (u === ('day' as any)) u = 'days';
    if (u === ('week' as any)) u = 'weeks';
    if (u === ('month' as any)) u = 'months';
    if (u === ('hour' as any)) u = 'hours';
    if (u === ('minute' as any)) u = 'minutes';
    return { enabled: true, value: isNaN(val) ? 1 : val, unit: u || 'days' };
  }

  const days = parseInt(offsetStr, 10);
  if (!isNaN(days) && days > 0) {
    return { enabled: true, value: days, unit: 'days' };
  }

  return { enabled: true, value: 1, unit: 'days' };
}

export function formatReminderConfig(config: ReminderConfig): string {
  if (!config.enabled) return 'none';
  return `${config.value}_${config.unit}`;
}

export function getReminderLabel(config: ReminderConfig): string {
  if (!config.enabled) return 'Без напоминания';
  const unitLabels: Record<ReminderUnit, string> = {
    minutes: config.value === 1 ? 'минуту' : (config.value >= 2 && config.value <= 4 ? 'минуты' : 'минут'),
    hours: config.value === 1 ? 'час' : (config.value >= 2 && config.value <= 4 ? 'часа' : 'часов'),
    days: config.value === 1 ? 'день' : (config.value >= 2 && config.value <= 4 ? 'дня' : 'дней'),
    weeks: config.value === 1 ? 'неделю' : (config.value >= 2 && config.value <= 4 ? 'недели' : 'недель'),
    months: config.value === 1 ? 'месяц' : (config.value >= 2 && config.value <= 4 ? 'месяца' : 'месяцев'),
  };
  return `За ${config.value} ${unitLabels[config.unit]}`;
}

const UNITS: { value: ReminderUnit; label: string }[] = [
  { value: 'minutes', label: 'Минут' },
  { value: 'hours', label: 'Часов' },
  { value: 'days', label: 'Дней' },
  { value: 'weeks', label: 'Недель' },
  { value: 'months', label: 'Месяцев' },
];

export function CustomReminderPicker({ value, onChange }: CustomReminderPickerProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const PRESETS: { label: string; config: ReminderConfig }[] = [
    { label: '15 мин', config: { enabled: true, value: 15, unit: 'minutes' } },
    { label: '1 час', config: { enabled: true, value: 1, unit: 'hours' } },
    { label: '3 часа', config: { enabled: true, value: 3, unit: 'hours' } },
    { label: '1 день', config: { enabled: true, value: 1, unit: 'days' } },
    { label: '2 дня', config: { enabled: true, value: 2, unit: 'days' } },
    { label: '1 неделя', config: { enabled: true, value: 1, unit: 'weeks' } },
    { label: '1 месяц', config: { enabled: true, value: 1, unit: 'months' } },
  ];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentUnitLabel = UNITS.find((u) => u.value === value.unit)?.label || 'Дней';

  return (
    <div className="flex flex-col gap-3 bg-surface p-3.5 rounded-2xl border border-border">
      {/* Toggle Header */}
      <div className="flex justify-between items-center">
        <label className="flex items-center gap-2 cursor-pointer font-medium text-sm">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
            className="w-4 h-4 rounded border-border accent-primary"
          />
          <span className="flex items-center gap-1.5">
            {value.enabled ? <Bell size={16} className="text-primary" /> : <BellOff size={16} className="text-secondary" />}
            {value.enabled ? 'Напоминать о платеже' : 'Без напоминания'}
          </span>
        </label>
        {value.enabled && (
          <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            {getReminderLabel(value)}
          </span>
        )}
      </div>

      {value.enabled && (
        <div className="flex flex-col gap-3 pt-2 border-t border-border">
          {/* Controls row */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-secondary">За</span>

            {/* Stepper with quantity */}
            <div className="flex items-center bg-bg rounded-xl border border-border p-1">
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface text-secondary hover:text-text transition-all disabled:opacity-30"
                disabled={value.value <= 1}
                onClick={() => onChange({ ...value, value: Math.max(1, value.value - 1) })}
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                min="1"
                max="99"
                value={value.value}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  onChange({ ...value, value: isNaN(val) ? 1 : Math.max(1, Math.min(99, val)) });
                }}
                className="w-12 text-center font-bold text-sm bg-transparent outline-none border-none text-text"
              />
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface text-secondary hover:text-text transition-all"
                onClick={() => onChange({ ...value, value: Math.min(99, value.value + 1) })}
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Custom Styled Dropdown Component */}
            <div className="relative flex-1" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between bg-bg border border-border text-sm font-medium rounded-xl px-3 py-2 text-text hover:border-primary transition-all"
              >
                <span>{currentUnitLabel}</span>
                <ChevronDown size={16} className={`text-secondary transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div
                  className="absolute top-full left-0 right-0 mt-1.5 border border-border rounded-xl shadow-2xl z-[100] overflow-hidden flex flex-col py-1"
                  style={{ backgroundColor: 'var(--color-surface)' }}
                >
                  {UNITS.map((u) => {
                    const isSelected = value.unit === u.value;
                    return (
                      <button
                        key={u.value}
                        type="button"
                        onClick={() => {
                          onChange({ ...value, unit: u.value });
                          setDropdownOpen(false);
                        }}
                        className={`flex items-center justify-between px-3.5 py-2 text-sm font-medium text-left transition-colors ${
                          isSelected
                            ? 'bg-primary/20 text-primary font-bold'
                            : 'text-text hover:bg-bg'
                        }`}
                      >
                        <span>{u.label}</span>
                        {isSelected && <Check size={14} className="text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <span className="text-xs font-medium text-secondary">до даты</span>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {PRESETS.map((p) => {
              const isSelected = value.enabled && value.value === p.config.value && value.unit === p.config.unit;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onChange(p.config)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-primary text-white border-primary font-semibold'
                      : 'bg-bg text-secondary border-border hover:border-primary/50'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
