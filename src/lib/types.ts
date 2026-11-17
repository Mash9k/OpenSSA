export type Theme = 'system' | 'dark' | 'light';
export type TabId = 'home' | 'safety' | 'remove' | 'monitor' | 'apps' | 'settings';

export type DeletionSafety = 'safe' | 'unsafe';
export type SystemHealth = 'healthy' | 'mixed' | 'issue';
export type RemovalStatus = 'no-issue' | 'mixed' | 'issue';

export type FileCategory = 
  | 'cache' 
  | 'temp' 
  | 'log' 
  | 'leftover' 
  | 'appdata' 
  | 'system' 
  | 'downloads' 
  | 'large_file' 
  | 'corrupted'
  | 'hidden';

export type DriveType = 'fixed' | 'removable' | 'network' | 'unknown' | 'sdcard';

export interface FileSummary {
  whatIsIt: string;
  creatorApp: string;
  whyItExists: string;
  consequenceOfRemoval: string;
  recommendation: 'Safe to Delete' | 'Keep File' | 'Inspect First' | 'Quarantine';
  riskScore: number;
}

export interface FileItem {
  id: string;
  name: string;
  path: string;
  sizeBytes: number;
  isFolder: boolean;
  category: FileCategory;
  deletionSafety: DeletionSafety;
  threatSignature?: string;
  systemHealth: SystemHealth;
  healthReason: string;
  removalStatus?: RemovalStatus;
  summary: FileSummary;
  children?: FileItem[];
  itemCount?: number;
  lastModified?: string;
  isHidden: boolean;
  selected?: boolean;
  expanded?: boolean;
  parentId?: string;
}

export interface DriveInfo {
  id: string;
  name: string;
  path: string;
  label: string; // Human-readable label like "Samsung SSD 980 (C:\)"
  totalSpace: number;
  freeSpace: number;
  driveType: DriveType; // matches Rust serde rename_all = "camelCase"
  isSystemDrive: boolean;
}

export interface SystemMetrics {
  cpuUsagePercent: number;
  cpuCores: number;
  cpuModel: string;
  cpuPerCore: number[];  // Per-core CPU usage percentages
  ramUsedBytes: number;
  ramTotalBytes: number;
  ramUsagePercent: number;
  swapUsedBytes: number;
  swapTotalBytes: number;
  gpuUsagePercent?: number;
  gpuName?: string;
  gpuMemoryUsedBytes?: number;
  gpuMemoryTotalBytes?: number;
  diskUsedBytes: number;
  diskTotalBytes: number;
  diskUsagePercent: number;
  networkReceivedBps: number;  // Bytes per second
  networkTransmittedBps: number;  // Bytes per second
  uptimeSeconds: number;
  activeProcessesCount: number;
}

export interface ResourcePoint {
  timestamp: string;
  cpu: number;
  ram: number;
  gpu?: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  user: string;
  executablePath: string;
  publisher: string;
  version: string;
  cpuPercent: number;
  memoryBytes: number;
  gpuPercent: number;
  status: 'running' | 'background' | 'stopped';
  isHidden: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
}

export interface ApplicationInfo {
  id: string;
  name: string;
  executablePath: string;
  publisher: string;
  version: string;
  installDate?: string;
  cpuPercent: number;
  memoryBytes: number;
  gpuPercent: number;
  storageBytes: number;
  binarySizeBytes: number;
  cacheSizeBytes: number;
  userDataSizeBytes: number;
  status: 'running' | 'background' | 'uninstalled_remnant' | 'stopped';
  backgroundServices: string[];
  associatedLeftovers: FileItem[];
  resourceHistory: { timestamp: string; cpu: number; ram: number }[];
  screenTimeMinutes?: number;
  launchCount?: number;
  lastUsed?: string;
  iconType?: string;
}

export interface LeftoverMatch {
  id: string;
  appName: string;
  publisher: string;
  status: 'completely_uninstalled' | 'partially_removed' | 'active_app_cache';
  totalSizeBytes: number;
  itemCount: number;
  files: FileItem[];
}

export interface ScanResult {
  driveId: string;
  files: FileItem[];
  totalSize: number;
  totalCount: number;
  scanDuration: number;
  timestamp: string;
}

export interface NavigationHistoryEntry {
  tab: TabId;
  path?: string;
  driveId?: string;
  scrollPosition?: number;
  timestamp: number;
}

export interface Settings {
  theme: Theme;
  showHiddenFiles: boolean;
  scanDepth: number;
  startupBehavior: 'dashboard' | 'last-tab' | 'home';
  deletePreference: 'trash' | 'permanent';
  confirmDeletions: boolean;
  autoScanOnLaunch: boolean;
}

export interface RulePattern {
  id: string;
  pattern: string;
  category: FileCategory;
  appName: string;
  os: 'windows' | 'linux' | 'macos' | 'android' | 'all';
  deletionSafety: DeletionSafety;
  threatSignature?: string;
  systemHealth: SystemHealth;
  healthReason: string;
  removalStatus?: RemovalStatus;
  whatIsIt: string;
  creatorApp: string;
  whyItExists: string;
  consequenceOfRemoval: string;
}