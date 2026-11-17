import { invoke } from '@tauri-apps/api/core';
import { 
  SystemMetrics, 
  FileItem, 
  ApplicationInfo, 
  DriveInfo, 
  ProcessInfo, 
  LogEntry,
  Settings 
} from './types';

// Detect if we are running in Tauri
const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

export async function getSystemMetrics(): Promise<SystemMetrics> {
  if (isTauri) {
    try {
      return await invoke<SystemMetrics>('get_system_metrics');
    } catch (e) {
      console.error('Tauri invoke error:', e);
    }
  }
  
  return {
    cpuUsagePercent: 25 + Math.random() * 10,
    cpuCores: 8,
    cpuModel: 'Mock Processor (Web Mode)',
    cpuPerCore: [22.4, 31.0, 15.2, 44.8, 18.0, 29.5, 12.1, 38.6],
    ramUsedBytes: 8 * 1024 * 1024 * 1024,
    ramTotalBytes: 16 * 1024 * 1024 * 1024,
    ramUsagePercent: 50,
    swapUsedBytes: 512 * 1024 * 1024,
    swapTotalBytes: 4 * 1024 * 1024 * 1024,
    diskUsedBytes: 256 * 1024 * 1024 * 1024,
    diskTotalBytes: 1024 * 1024 * 1024 * 1024,
    diskUsagePercent: 25,
    networkReceivedBps: 125 * 1024,
    networkTransmittedBps: 45 * 1024,
    uptimeSeconds: 3600,
    activeProcessesCount: 120
  };
}

export async function searchFiles(query: string, options: { 
  rootPath?: string, 
  showHidden?: boolean
}): Promise<FileItem[]> {
  if (isTauri) {
    try {
      return await invoke<FileItem[]>('search_files', { query, ...options });
    } catch (e) {
      console.error('Tauri invoke error:', e);
    }
  }
  
  return [];
}

export async function scanDirectory(
  path: string,
  options?: { showHidden?: boolean }
): Promise<FileItem[]> {
  if (isTauri) {
    try {
      return await invoke<FileItem[]>('scan_directory', {
        path,
        showHidden: options?.showHidden,
      });
    } catch (e) {
      console.error('Tauri invoke error:', e);
    }
  }
  
  return [];
}

export async function getDrives(): Promise<DriveInfo[]> {
  if (isTauri) {
    try {
      return await invoke<DriveInfo[]>('get_drives');
    } catch (e) {
      console.error('Tauri invoke error:', e);
    }
  }
  
  return [
    {
      id: 'root',
      name: 'Local Disk (/)',
      path: '/',
      label: 'System SSD (/)',
      totalSpace: 1024 * 1024 * 1024 * 1024,
      freeSpace: 512 * 1024 * 1024 * 1024,
      driveType: 'fixed',
      isSystemDrive: true
    },
    {
      id: 'home',
      name: 'Home',
      path: '/home',
      label: 'Home Partition (/home)',
      totalSpace: 512 * 1024 * 1024 * 1024,
      freeSpace: 256 * 1024 * 1024 * 1024,
      driveType: 'fixed',
      isSystemDrive: false
    }
  ];
}

export async function deleteItems(paths: string[], permanent: boolean = false): Promise<number> {
  if (isTauri) {
    try {
      return await invoke<number>('delete_items', { paths, permanent });
    } catch (e) {
      console.error('Tauri invoke error:', e);
    }
  }

  console.log('Mock Delete:', paths, permanent);
  return paths.length;
}

export async function moveToTrash(path: string): Promise<void> {
  if (isTauri) {
    try {
      await invoke('move_to_trash', { path });
    } catch (e) {
      console.error('Tauri invoke error:', e);
      throw e;
    }
  } else {
    console.log('Mock Move to Trash:', path);
  }
}

export async function permanent_delete(path: string): Promise<void> {
  if (isTauri) {
    try {
      await invoke<void>('permanent_delete', { path });
    } catch (e) {
      console.error('Tauri invoke error:', e);
      throw e;
    }
  } else {
    console.log('Mock Permanent Delete:', path);
  }
}

export async function getProcesses(): Promise<ProcessInfo[]> {
  if (isTauri) {
    try {
      return await invoke<ProcessInfo[]>('get_processes');
    } catch (e) {
      console.error('Tauri invoke error:', e);
    }
  }
  return [
    {
      pid: 1240,
      name: 'gnome-shell',
      user: 'ananto',
      executablePath: '/usr/bin/gnome-shell',
      publisher: 'GNOME',
      version: '46.0',
      cpuPercent: 4.2,
      memoryBytes: 380 * 1024 * 1024,
      gpuPercent: 0,
      status: 'running',
      isHidden: false
    },
    {
      pid: 2451,
      name: 'firefox',
      user: 'ananto',
      executablePath: '/usr/lib/firefox/firefox',
      publisher: 'Mozilla',
      version: '128.0',
      cpuPercent: 12.8,
      memoryBytes: 1250 * 1024 * 1024,
      gpuPercent: 0,
      status: 'running',
      isHidden: false
    },
    {
      pid: 3102,
      name: 'code',
      user: 'ananto',
      executablePath: '/usr/share/code/code',
      publisher: 'Microsoft',
      version: '1.92.0',
      cpuPercent: 2.1,
      memoryBytes: 840 * 1024 * 1024,
      gpuPercent: 0,
      status: 'running',
      isHidden: false
    }
  ];
}

export async function getLogs(limit: number = 100): Promise<LogEntry[]> {
  if (isTauri) {
    try {
      return await invoke<LogEntry[]>('get_logs', { limit });
    } catch (e) {
      console.error('Tauri invoke error:', e);
    }
  }
  return [
    { id: '1', timestamp: new Date().toISOString(), level: 'info', source: 'System', message: 'Application started successfully.' },
    { id: '2', timestamp: new Date().toISOString(), level: 'warn', source: 'Backend', message: 'Disk read latency higher than normal.' },
    { id: '3', timestamp: new Date().toISOString(), level: 'info', source: 'UI', message: 'Theme switched to Dark mode.' }
  ];
}

export async function getApplicationsList(): Promise<ApplicationInfo[]> {
  if (isTauri) {
    try {
      return await invoke<ApplicationInfo[]>('get_applications_list');
    } catch (e) {
      console.error('Tauri invoke error:', e);
    }
  }
  
  return [];
}

export async function openPath(path: string): Promise<void> {
  if (isTauri) {
    try {
      await invoke('open_path', { path });
    } catch (e) {
      console.error('Tauri invoke error:', e);
    }
  } else {
    console.log('Mock Open Path:', path);
  }
}

export async function killProcess(pid: number): Promise<void> {
  if (isTauri) {
    try {
      await invoke('kill_process', { pid });
    } catch (e) {
      console.error('Tauri invoke error:', e);
      throw e;
    }
  } else {
    console.log('Mock Kill Process:', pid);
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  if (isTauri) {
    try {
      await invoke('save_settings', { settings });
    } catch (e) {
      console.error('Tauri invoke error:', e);
    }
  } else {
    localStorage.setItem('openssa-settings', JSON.stringify(settings));
  }
}

export async function loadSettings(): Promise<Settings> {
  if (isTauri) {
    try {
      return await invoke<Settings>('load_settings');
    } catch (e) {
      console.error('Tauri invoke error:', e);
    }
  }
  
  const saved = localStorage.getItem('openssa-settings');
  if (saved) return JSON.parse(saved);
  
  return {
    theme: 'dark',
    showHiddenFiles: true,
    scanDepth: 8,
    startupBehavior: 'home',
    deletePreference: 'trash',
    confirmDeletions: true,
    autoScanOnLaunch: false
  };
}