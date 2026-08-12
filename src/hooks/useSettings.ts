import { useState, useEffect, useCallback } from 'react';
import type { AppSettings, ThemeMode } from '../types';
import { settingsRepo } from '../db/repositories';

const defaultSettings: AppSettings = {
  baseCurrency: 'UAH',
  currencyRateMode: 'auto',
  lastRatesUpdate: null,
  theme: 'system',
  monthlyBudget: 0,
  onboardingCompleted: false,
  planningIncomeSourceId: null,
  reminderEnabled: true,
  reminderDaysAhead: 1,
};

export function useSettings(): { settings: AppSettings; updateSetting: (key: keyof AppSettings, value: any) => Promise<void>; loading: boolean } {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    const loadSettings = async () => {
      try {
        const allSettings = await settingsRepo.getAll();
        if (mounted) {
          setSettings(prev => ({ ...prev, ...allSettings }));
        }
      } catch (err) {
        console.error('Failed to load settings', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadSettings();

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const applyTheme = (theme: ThemeMode) => {
      const isDark = 
        theme === 'dark' || 
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme(settings.theme);

    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [settings.theme]);

  const updateSetting = useCallback(async (key: keyof AppSettings, value: any) => {
    try {
      await settingsRepo.set(key, value);
      setSettings(prev => ({ ...prev, [key]: value }));
    } catch (err) {
      console.error(`Failed to update setting ${key}`, err);
    }
  }, []);

  return { settings, updateSetting, loading };
}
