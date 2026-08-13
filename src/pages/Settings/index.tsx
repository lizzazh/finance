import React, { useState } from 'react';
import {
  Moon, Sun, Monitor, Download, Upload, Trash2, AlertTriangle, ChevronRight, Palette, Coins, Bell, Wallet, PiggyBank, Database
} from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { CurrencyPicker } from '../../components/ui/CurrencyPicker';
import { CustomReminderPicker, parseReminderOffset, formatReminderConfig, type ReminderConfig } from '../../components/ui/CustomReminderPicker';
import { exportImportService } from '../../services/exportImport';
import { currencyService } from '../../services/currency/currencyService';
import { db } from '../../db/database';
import { generateId } from '../../utils/id';
import { today } from '../../utils/date';
import type { ThemeMode } from '../../types';

export default function SettingsPage() {
  const { settings, updateSetting } = useSettings();
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [refreshingRates, setRefreshingRates] = useState(false);
  const [ratesSuccess, setRatesSuccess] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('');
  const [changingCurrency, setChangingCurrency] = useState(false);
  const [newBudgetForCurrency, setNewBudgetForCurrency] = useState('');

  if (!settings) return null;

  const themes: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Светлая', icon: <Sun size={18} /> },
    { value: 'dark', label: 'Тёмная', icon: <Moon size={18} /> },
    { value: 'system', label: 'Системная', icon: <Monitor size={18} /> },
  ];

  const reminderConfig: ReminderConfig = parseReminderOffset(
    settings.reminderOffset || (settings.reminderDaysAhead ? `${settings.reminderDaysAhead}_days` : '1_days')
  );

  async function handleThemeChange(theme: ThemeMode) {
    await updateSetting('theme', theme);
  }

  async function handleReminderChange(config: ReminderConfig) {
    const formatted = formatReminderConfig(config);
    await updateSetting('reminderOffset', formatted);
    await updateSetting('reminderEnabled', config.enabled);
    if (config.unit === 'days') {
      await updateSetting('reminderDaysAhead', config.value);
    }
  }

  async function handleCurrencyChange(newCurrency: string) {
    if (newCurrency === settings.baseCurrency) return;
    setChangingCurrency(true);
    setNewBudgetForCurrency('');
  }

  async function confirmCurrencyChange(newCurrency: string) {
    await updateSetting('baseCurrency', newCurrency);
    await updateSetting('monthlyBudget', newBudgetForCurrency ? parseFloat(newBudgetForCurrency) : 0);
    setChangingCurrency(false);
  }

  async function handleExport() {
    const data = await exportImportService.exportData();
    exportImportService.downloadJSON(data);
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3000);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const data = await exportImportService.parseAndValidate(text);
      await exportImportService.importData(data);
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 3000);
    } catch (err) {
      setImportError((err as Error).message);
    }
    e.target.value = '';
  }

  async function handleClearData() {
    await exportImportService.clearAllData();
    setClearConfirm(false);
    window.location.reload();
  }

  async function handleBudgetSave() {
    const val = parseFloat(budgetInput);
    if (!isNaN(val) && val >= 0) {
      await updateSetting('monthlyBudget', val);
      setBudgetInput('');
    }
  }

  async function handleRefreshRates() {
    setRefreshingRates(true);
    try {
      await currencyService.refreshRates(settings.baseCurrency);
      setRatesSuccess(true);
      setTimeout(() => setRatesSuccess(false), 3000);
    } catch {
      // ignore
    }
    setRefreshingRates(false);
  }

  async function handleSaveOpeningBalance() {
    const val = parseFloat(openingBalance);
    if (!isNaN(val) && val !== 0) {
      const now = new Date().toISOString();
      await db.balanceAdjustments.add({
        id: generateId(),
        amount: Math.abs(val),
        currency: settings.baseCurrency,
        exchangeRate: 1,
        baseAmount: Math.abs(val),
        baseCurrency: settings.baseCurrency,
        date: today(),
        type: 'opening',
        description: 'Начальный баланс',
        createdAt: now,
        updatedAt: now,
      });
      setOpeningBalance('');
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <header className="sticky-header">
        <h1 className="text-2xl font-bold">Настройки</h1>
        <p className="text-sm text-secondary">Управление внешним видом, валютой и уведомлениями</p>
      </header>

      {/* Theme */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-secondary uppercase tracking-wider flex items-center gap-2">
          <Palette size={16} /> Оформление
        </h2>
        <div className="card">
          <div className="font-semibold text-sm mb-1">Тема оформления</div>
          <div className="text-xs text-secondary mb-3">Выберите удобную цветовую схему для интерфейса</div>
          <div className="theme-selector">
            {themes.map((t) => (
              <button
                key={t.value}
                className={`theme-btn ${settings.theme === t.value ? 'active' : ''}`}
                onClick={() => handleThemeChange(t.value)}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Currency */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-secondary uppercase tracking-wider flex items-center gap-2">
          <Coins size={16} /> Валюта и курсы
        </h2>
        <div className="card flex flex-col gap-4">
          <div className="flex justify-between items-center gap-4">
            <div>
              <div className="font-semibold text-sm">Основная валюта</div>
              <div className="text-xs text-secondary">Все расчёты и общий баланс ведутся в ней</div>
            </div>
            <CurrencyPicker
              value={settings.baseCurrency}
              onChange={handleCurrencyChange}
            />
          </div>

          {changingCurrency && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 font-bold text-amber-500">
                <AlertTriangle size={16} /> Историческая валюта изменится
              </div>
              <p>Старые операции сохранят оригинальные суммы. Для сводного отображения будут использованы курсы на дату операции.</p>
              <div className="form-group mt-2">
                <label className="label">Новый месячный бюджет</label>
                <input
                  type="number"
                  className="input"
                  placeholder="0"
                  value={newBudgetForCurrency}
                  onChange={(e) => setNewBudgetForCurrency(e.target.value)}
                />
              </div>
              <div className="flex gap-2 mt-1">
                <button className="btn-primary py-1.5 text-xs" onClick={() => confirmCurrencyChange(settings.baseCurrency)}>
                  Подтвердить
                </button>
                <button className="btn-ghost py-1.5 text-xs" onClick={() => setChangingCurrency(false)}>
                  Отмена
                </button>
              </div>
            </div>
          )}

          <div className="h-[1px] bg-border" />

          <div className="flex justify-between items-center gap-4">
            <div>
              <div className="font-semibold text-sm">Режим курсов</div>
              <div className="text-xs text-secondary">
                Обновлено: {settings.lastRatesUpdate ? new Date(settings.lastRatesUpdate).toLocaleString('ru-RU') : 'никогда'}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <select
                className="input text-xs w-auto py-2"
                value={settings.currencyRateMode}
                onChange={(e) => updateSetting('currencyRateMode', e.target.value as 'auto' | 'manual')}
              >
                <option value="auto">Авто (НБУ)</option>
                <option value="manual">Вручную</option>
              </select>
              {settings.currencyRateMode === 'auto' && (
                <button
                  className="btn-secondary text-xs py-2 px-3 whitespace-nowrap"
                  onClick={handleRefreshRates}
                  disabled={refreshingRates}
                >
                  {refreshingRates ? 'Загрузка...' : ratesSuccess ? '✓ Обновлено' : 'Обновить'}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Reminders & Notifications */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-secondary uppercase tracking-wider flex items-center gap-2">
          <Bell size={16} /> Напоминания по умолчанию
        </h2>
        <div className="card flex flex-col gap-4">
          <div>
            <div className="font-semibold text-sm mb-1">Колёсико выбора времени напоминания</div>
            <div className="text-xs text-secondary mb-3">Выберите за сколько минут, часов, дней, недель или месяцев отправлять напоминание</div>
            <CustomReminderPicker
              value={reminderConfig}
              onChange={handleReminderChange}
            />
          </div>

          <div className="h-[1px] bg-border" />

          <div className="flex justify-between items-center">
            <div className="text-xs text-secondary">
              Разрешение браузера: {typeof window !== 'undefined' && 'Notification' in window ? (Notification.permission === 'granted' ? '✓ Включено' : Notification.permission === 'denied' ? '❌ Заблокировано' : '⚠️ Требуется разрешение') : 'Не поддерживается браузером'}
            </div>
            <button
              className="btn-secondary text-xs py-1.5 px-3"
              onClick={async () => {
                if (typeof window !== 'undefined' && 'Notification' in window) {
                  const perm = await Notification.requestPermission();
                  if (perm === 'granted') alert('✓ Уведомления включены!');
                  window.location.reload();
                }
              }}
            >
              🔔 Включить уведомления
            </button>
          </div>
        </div>
      </section>

      {/* Monthly Budget */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-secondary uppercase tracking-wider flex items-center gap-2">
          <PiggyBank size={16} /> Бюджет
        </h2>
        <div className="card flex flex-col gap-3">
          <div className="font-semibold text-sm">Месячный лимит расходов</div>
          <div className="text-xs text-secondary">
            Текущий: {settings.monthlyBudget > 0 ? `${settings.monthlyBudget.toLocaleString('ru-RU')} ${settings.baseCurrency}` : 'не установлен'}
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              className="input text-sm"
              placeholder="Новый лимит бюджета"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
            />
            <button className="btn-primary text-sm whitespace-nowrap px-4" onClick={handleBudgetSave}>
              Сохранить
            </button>
          </div>
        </div>
      </section>

      {/* Opening Balance */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-secondary uppercase tracking-wider flex items-center gap-2">
          <Wallet size={16} /> Начальный баланс
        </h2>
        <div className="card flex flex-col gap-3">
          <div className="font-semibold text-sm">Внесите стартовую сумму баланса</div>
          <div className="text-xs text-secondary">
            Создаст стартовую запись, если вы запускаете учёт с имеющимися накоплениями.
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              className="input text-sm"
              placeholder={`Сумма в ${settings.baseCurrency}`}
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
            />
            <button className="btn-primary text-sm whitespace-nowrap px-4" onClick={handleSaveOpeningBalance}>
              Добавить
            </button>
          </div>
        </div>
      </section>

      {/* Data Management */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-secondary uppercase tracking-wider flex items-center gap-2">
          <Database size={16} /> Данные и резервные копии
        </h2>
        <div className="card flex flex-col divide-y divide-border">
          <button className="flex justify-between items-center py-3 text-left hover:text-primary transition-colors" onClick={handleExport}>
            <div className="flex items-center gap-3 text-sm font-medium">
              <Download size={18} className="text-primary" />
              <span>{exportSuccess ? '✓ Файл экспортирован' : 'Экспортировать всё в JSON'}</span>
            </div>
            <ChevronRight size={16} className="text-secondary" />
          </button>

          <label className="flex justify-between items-center py-3 text-left hover:text-primary transition-colors cursor-pointer">
            <div className="flex items-center gap-3 text-sm font-medium">
              <Upload size={18} className="text-primary" />
              <span>Импортировать из JSON</span>
            </div>
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            <ChevronRight size={16} className="text-secondary" />
          </label>

          {importError && <div className="text-xs text-red-500 py-2">{importError}</div>}
          {importSuccess && <div className="text-xs text-emerald-500 py-2">✓ Данные успешно импортированы</div>}

          {!clearConfirm ? (
            <button className="flex justify-between items-center py-3 text-left text-red-500 hover:text-red-600 transition-colors" onClick={() => setClearConfirm(true)}>
              <div className="flex items-center gap-3 text-sm font-medium">
                <Trash2 size={18} />
                <span>Очистить все данные</span>
              </div>
              <ChevronRight size={16} />
            </button>
          ) : (
            <div className="py-3 flex flex-col gap-2">
              <p className="text-xs text-red-500 flex items-center gap-1 font-medium">
                <AlertTriangle size={16} />
                Все данные будут удалены без возможности восстановления.
              </p>
              <div className="flex gap-2 mt-1">
                <button className="btn-primary bg-red-500 hover:bg-red-600 border-none text-xs py-1.5" onClick={handleClearData}>
                  Да, очистить всё
                </button>
                <button className="btn-ghost text-xs py-1.5" onClick={() => setClearConfirm(false)}>Отмена</button>
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="text-center text-xs text-secondary py-4">
        <p>Финансовый планировщик · local-first PWA</p>
        <p className="mt-0.5">Данные хранятся локально в IndexedDB вашего браузера</p>
      </footer>
    </div>
  );
}
