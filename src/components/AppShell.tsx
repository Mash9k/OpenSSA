'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { HomeTab } from './HomeTab';
import { SafetyTab } from './SafetyTab';
import { RemoveTab } from './RemoveTab';
import { SystemMonitorTab as MonitorTab } from './MonitorTab';
import { AppsTab } from './AppsTab';
import { SettingsTab } from './SettingsTab';
import { FileItem, TabId, NavigationHistoryEntry } from '@/lib/types';
import { cn } from '@/lib/utils';
import { SettingsProvider, useSettings } from '@/lib/SettingsContext';
import { moveToTrash, deleteItems, permanent_delete } from '@/lib/api';
import { ConfirmationModal } from './ConfirmationModal';
import { ErrorBoundary } from './ErrorBoundary';

function AppShellInner() {
  const { settings, updateSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [scanResults, setScanResults] = useState<FileItem[]>([]);
  const [driveLabel, setDriveLabel] = useState<string>('');
  const [showDriveSelector, setShowDriveSelector] = useState(false);
  const [navigationHistory, setNavigationHistory] = useState<NavigationHistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [historyInitialized, setHistoryInitialized] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    file: FileItem | null;
    actionType: 'trash' | 'permanent';
  }>({ isOpen: false, file: null, actionType: 'trash' });

  // Apply theme to HTML element
  useEffect(() => {
    const applyTheme = async () => {
      try {
        const t = settings.theme || 'dark';
        setTheme(t as 'dark' | 'light' | 'system');
        const html = document.documentElement;
        let effective: 'dark' | 'light';
        if (t === 'system') {
          effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } else {
          effective = t;
        }
        html.setAttribute('data-theme', effective);
        html.classList.toggle('dark', effective === 'dark');
        try {
          localStorage.setItem('openssa-theme', t);
        } catch {
          /* ignore */
        }
      } catch {
        const html = document.documentElement;
        html.setAttribute('data-theme', 'dark');
        html.classList.add('dark');
      }
    };
    applyTheme();
  }, [settings.theme]);

  // Initialize navigation history with starting Home tab
  useEffect(() => {
    if (!historyInitialized) {
      setNavigationHistory([{ tab: 'home' as TabId, timestamp: Date.now() }]);
      setHistoryIndex(0);
      setHistoryInitialized(true);
    }
  }, [historyInitialized]);

  // Handle back navigation
  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      const entry = navigationHistory[historyIndex - 1];
      setActiveTab(entry.tab);
      // Restore other state if needed
    }
  }, [historyIndex, navigationHistory]);

  const canGoBack = historyIndex > 0;

  // Track navigation
  const navigateTo = useCallback((tab: TabId, extraData?: Partial<NavigationHistoryEntry>) => {
    if (activeTab !== tab) {
      const newEntry: NavigationHistoryEntry = {
        tab,
        timestamp: Date.now(),
        ...extraData
      };
      
      // If we're not at the end of history, truncate future history
      const newHistory = navigationHistory.slice(0, historyIndex + 1);
      newHistory.push(newEntry);
      
      setNavigationHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setActiveTab(tab);
    }
  }, [activeTab, navigationHistory, historyIndex]);

  // Handle file selection
  const handleFileSelect = (file: FileItem) => {
    setSelectedFile(file);
  };

  const handleCloseModal = () => {
    setSelectedFile(null);
  };

  /**
   * Deletes the given item (trash or permanent) and immediately removes it
   * (and its descendants) from the shared scan results so every tab's file
   * list reflects the change right away.
   */
  const removeItemFromResults = useCallback((path: string) => {
    setScanResults(prev => prev.filter(f => {
      const itemPath = f.path.replace(/\\/g, '/');
      const deletedPath = path.replace(/\\/g, '/');
      // Drop the item itself and anything nested inside it
      return itemPath !== deletedPath && !itemPath.startsWith(deletedPath + '/');
    }));
  }, []);

  const handleFileDelete = async (file: FileItem, permanent: boolean) => {
    // Check if item is dangerous (unsafe, mixed, or issue)
    const isDangerous = file.deletionSafety === 'unsafe' 
      || file.systemHealth === 'issue' 
      || file.removalStatus !== 'no-issue';
    
    // Show confirmation modal for dangerous items or if permanent delete
    if (isDangerous || permanent) {
      setConfirmationModal({
        isOpen: true,
        file,
        actionType: permanent ? 'permanent' : 'trash'
      });
      return;
    }
    
    // For safe items, move directly to trash
    try {
      await moveToTrash(file.path);
      removeItemFromResults(file.path);
    } catch (error) {
      console.error('Failed to move to trash:', error);
    }
  };

  const handleConfirmDeletion = async () => {
    const { file, actionType } = confirmationModal;
    if (!file) return;
    
    try {
      if (actionType === 'permanent') {
        // Call permanent_delete Tauri command
        await permanent_delete(file.path);
      } else {
        // Move to trash
        await moveToTrash(file.path);
      }
      // Immediately update the shared scan results
      removeItemFromResults(file.path);
    } catch (error) {
      console.error('Deletion failed:', error);
    } finally {
      setConfirmationModal({ isOpen: false, file: null, actionType: 'trash' });
      handleCloseModal();
    }
  };

  const handleCancelDeletion = () => {
    setConfirmationModal({ isOpen: false, file: null, actionType: 'trash' });
  };

  const handleOpenFolder = (file: FileItem) => {
    // Navigate into folder
    console.log('Open folder:', file.path);
  };

  // Handle scan results update from HomeTab
  const handleScanComplete = (results: FileItem[]) => {
    setScanResults(results);
  };

  const showHiddenFiles = settings.showHiddenFiles;

  const renderTab = () => {
    switch (activeTab) {
      case 'home':
        return (
          <ErrorBoundary fallback={<div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">Failed to load Home tab</div>}>
            <HomeTab
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              onCloseModal={handleCloseModal}
              onFileDelete={handleFileDelete}
              onOpenFolder={handleOpenFolder}
              onScanComplete={handleScanComplete}
              scanResults={scanResults}
              showHiddenFiles={showHiddenFiles}
            />
          </ErrorBoundary>
        );
      case 'safety':
        return (
          <ErrorBoundary fallback={<div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">Failed to load Safety tab</div>}>
            <SafetyTab
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              onCloseModal={handleCloseModal}
              onFileDelete={handleFileDelete}
              onOpenFolder={handleOpenFolder}
              scanResults={scanResults}
              showHiddenFiles={showHiddenFiles}
            />
          </ErrorBoundary>
        );
      case 'remove':
        return (
          <ErrorBoundary fallback={<div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">Failed to load Remove tab</div>}>
            <RemoveTab
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              onCloseModal={handleCloseModal}
              onFileDelete={handleFileDelete}
              onOpenFolder={handleOpenFolder}
              scanResults={scanResults}
              showHiddenFiles={showHiddenFiles}
            />
          </ErrorBoundary>
        );
      case 'monitor':
        return (
          <ErrorBoundary fallback={<div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">Failed to load Monitor tab</div>}>
            <MonitorTab />
          </ErrorBoundary>
        );
      case 'apps':
        return (
          <ErrorBoundary fallback={<div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">Failed to load Insights tab</div>}>
            <AppsTab />
          </ErrorBoundary>
        );
      case 'settings':
        return (
          <ErrorBoundary fallback={<div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">Failed to load Settings tab</div>}>
            <SettingsTab />
          </ErrorBoundary>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-full bg-zinc-50 dark:bg-zinc-950 flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={navigateTo}
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content */}
      <main className="main-content flex flex-col min-w-0">
        {/* Header */}
        <Header
          onBack={goBack}
          canGoBack={canGoBack}
          driveLabel={driveLabel}
          onDriveClick={() => setShowDriveSelector(true)}
        />

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          {renderTab()}
        </div>
      </main>

      {/* Confirmation Modal */}
      <ConfirmationModal
        file={confirmationModal.file}
        onConfirm={handleConfirmDeletion}
        onCancel={handleCancelDeletion}
        isOpen={confirmationModal.isOpen}
        actionType={confirmationModal.actionType}
      />
    </div>
  );
}

export function AppShell() {
  return (
    <SettingsProvider>
      <AppShellInner />
    </SettingsProvider>
  );
}
