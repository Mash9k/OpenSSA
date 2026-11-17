'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sun, 
  Moon, 
  Monitor, 
  Eye, 
  EyeOff, 
  HardDrive, 
  Zap, 
  Shield,
  Save,
  Loader2,
  ArrowUpRight,
  FolderOpen
} from 'lucide-react';
import { Settings as SettingsType, Theme } from '@/lib/types';
import { cn } from '@/lib/utils';
import { saveSettings, openPath } from '@/lib/api';
import { useSettings } from '@/lib/SettingsContext';

interface SettingsTabProps {}

export function SettingsTab() {
  const { settings, updateSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState<SettingsType>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync local settings with context
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    let effective: 'dark' | 'light';
    if (theme === 'system') {
      effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      effective = theme;
    }
    root.setAttribute('data-theme', effective);
    if (effective === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('openssa-theme', theme);
    } catch {
      /* ignore */
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    await updateSettings(settings);
    applyTheme(settings.theme);
    setSaved(true);
    setIsSaving(false);
  };

  const handleThemeChange = async (theme: Theme) => {
    setLocalSettings(prev => ({ ...prev, theme }));
    await updateSettings({ theme });
    applyTheme(theme);
  };

  const toggleSetting = async (key: keyof SettingsType) => {
    const newValue = !localSettings[key];
    setLocalSettings(prev => ({ ...prev, [key]: newValue }));
    await updateSettings({ [key]: newValue });
  };

  const renderSettingRow = (title: string, description: string, children: React.ReactNode) => (
    <div className="setting-row">
      <div>
        <p className="setting-label">{title}</p>
        <p className="setting-description">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  );

  const Toggle = ({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) => (
    <button
      onClick={onChange}
      disabled={disabled}
      className={cn('toggle-switch', checked && 'active', disabled && 'opacity-50 cursor-not-allowed')}
      role="switch"
      aria-checked={checked}
    />
  );

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Settings</h1>
          <p className="text-zinc-500">Configure OpenSSA behavior and appearance</p>
        </div>

        {/* Appearance */}
        <section className="bg-white dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Appearance
          </h2>

          <div className="space-y-4">
            {renderSettingRow(
              'Theme',
              'Choose your preferred color scheme',
              <div className="flex items-center gap-3">
                {(['dark', 'light', 'system'] as const).map(theme => (
                  <button
                    key={theme}
                    onClick={() => handleThemeChange(theme)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all',
                      localSettings.theme === theme
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100'
                    )}
                  >
                    {theme === 'dark' && <Moon className="h-4 w-4" />}
                    {theme === 'light' && <Sun className="h-4 w-4" />}
                    {theme === 'system' && <Monitor className="h-4 w-4" />}
                    <span className="capitalize">{theme}</span>
                  </button>
                ))}
              </div>
            )}

            {renderSettingRow(
              'Show Hidden Files',
              'Display hidden system files and dotfiles (e.g., .config, .cache, AppData)',
              <Toggle checked={localSettings.showHiddenFiles} onChange={() => toggleSetting('showHiddenFiles')} />
            )}
          </div>
        </section>

        {/* Scanning */}
        <section className="bg-white dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Scanning
          </h2>

          <div className="space-y-4">
            {renderSettingRow(
              'Auto Scan on Launch',
              'Automatically scan the system drive when the app starts',
              <Toggle checked={localSettings.autoScanOnLaunch} onChange={() => toggleSetting('autoScanOnLaunch')} />
            )}

            <div className="p-3 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-600 dark:text-zinc-400">
              Scans always traverse the <span className="text-zinc-300 font-mono">entire drive</span> recursively
              (no result or depth caps), computing accurate bottom-up folder sizes like Baobab.
              Virtual filesystems (/proc, /sys, /dev) are skipped automatically.
            </div>
          </div>
        </section>

        {/* Deletion */}
        <section className="bg-white dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Deletion Behavior
          </h2>

          <div className="space-y-4">
            {renderSettingRow(
              'Default Delete Action',
              'Choose where deleted files go by default',
              <div className="flex items-center gap-3">
                {(['trash', 'permanent'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => {
                    setLocalSettings(prev => ({ ...prev, deletePreference: mode }));
                    updateSettings({ deletePreference: mode });
                  }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all flex-1',
                      localSettings.deletePreference === mode
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100'
                    )}
                  >
                    {mode === 'trash' && <FolderOpen className="h-4 w-4" />}
                    {mode === 'permanent' && <Zap className="h-4 w-4" />}
                    <span>{mode === 'trash' ? 'Move to Trash' : 'Permanent Delete'}</span>
                  </button>
                ))}
              </div>
            )}

            {renderSettingRow(
              'Confirm Deletions',
              'Show confirmation dialog before deleting files',
              <Toggle checked={localSettings.confirmDeletions} onChange={() => toggleSetting('confirmDeletions')} />
            )}

            {renderSettingRow(
              'Startup Tab',
              'Which tab to show when the app opens',
              <div className="flex items-center gap-3">
                {(['home', 'last-tab'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => {
                    setLocalSettings(prev => ({ ...prev, startupBehavior: tab }));
                    updateSettings({ startupBehavior: tab });
                  }}
                    className={cn(
                      'px-4 py-2 rounded-lg border transition-all',
                      localSettings.startupBehavior === tab
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100'
                    )}
                  >
                    {tab === 'home' ? 'Home (Dashboard)' : 'Last Used Tab'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Advanced */}
        <section className="bg-white dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Advanced
          </h2>

          <div className="space-y-4">
            {renderSettingRow(
              'Open Config Folder',
              'Open the application configuration directory in file manager',
              <button 
                onClick={() => openPath('')}
                className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
              >
                <FolderOpen className="h-4 w-4" />
                Open Config Folder
              </button>
            )}

            {renderSettingRow(
              'Reset to Defaults',
              'Restore all settings to their default values',
              <button 
                className="px-4 py-2 bg-white dark:bg-zinc-900 border border-red-500/50 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-50/10 dark:hover:bg-red-900/10 transition-colors"
              >
                Reset Settings
              </button>
            )}
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              'px-6 py-3 text-sm font-medium rounded-lg transition-colors flex items-center gap-2',
              isSaving ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed' : 'dark:bg-zinc-900 dark:text-zinc-100 hover:bg-zinc-800'
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <ArrowUpRight className="h-4 w-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}