import { RulePattern, FileSummary, DeletionSafety, SystemHealth, RemovalStatus, FileCategory } from './types';

export const LOCAL_RULES_DATABASE: RulePattern[] = [
  // WINDOWS PATTERNS
  {
    id: 'win-temp-1',
    pattern: '**/AppData/Local/Temp/**',
    category: 'temp',
    appName: 'Windows System / Various Apps',
    os: 'windows',
    deletionSafety: 'safe',
    systemHealth: 'healthy',
    healthReason: 'Standard temporary files, safe to remove.',
    removalStatus: 'no-issue',
    whatIsIt: 'Temporary runtime data and installers created by operating software.',
    creatorApp: 'Windows Operating System & Installed Apps',
    whyItExists: 'Stores temporary buffer files while applications are actively running.',
    consequenceOfRemoval: 'Zero impact on installed applications; frees disk space immediately.'
  },
  {
    id: 'win-discord-cache',
    pattern: '**/AppData/Roaming/Discord/Cache/**',
    category: 'cache',
    appName: 'Discord',
    os: 'windows',
    deletionSafety: 'safe',
    systemHealth: 'healthy',
    healthReason: 'Standard application cache, regenerates automatically.',
    removalStatus: 'no-issue',
    whatIsIt: 'Audio buffers and cached image thumbnails from Discord channels.',
    creatorApp: 'Discord Desktop Client',
    whyItExists: 'Accelerates loading of images and media in chat rooms.',
    consequenceOfRemoval: 'Images in old Discord channels might take 1 second longer to load next time.'
  },
  {
    id: 'win-sys32-critical',
    pattern: '**/System32/drivers/etc/**',
    category: 'system',
    appName: 'Windows Kernel / Networking',
    os: 'windows',
    deletionSafety: 'unsafe',
    systemHealth: 'issue',
    healthReason: 'Critical OS network configuration files.',
    removalStatus: 'issue',
    whatIsIt: 'System network routing configuration files (hosts, services, networks).',
    creatorApp: 'Microsoft Windows Core OS',
    whyItExists: 'Translates domain names locally and handles system network protocols.',
    consequenceOfRemoval: 'CRITICAL WARNING: Will break internet connectivity and local network resolution.'
  },
  // THREAT & SUSPICIOUS PATTERNS (Modified to fit "Safe" vs "Unsafe" strictly)
  {
    id: 'threat-miner-script',
    pattern: '**/*.xmrig.vbs',
    category: 'corrupted',
    appName: 'CryptoMiner Trojan',
    os: 'all',
    deletionSafety: 'unsafe',
    threatSignature: 'Trojan.Script.XMRigMiner.Gen',
    systemHealth: 'issue',
    healthReason: 'Malicious mining script detected.',
    removalStatus: 'issue',
    whatIsIt: 'Unauthorized obfuscated script executing crypto mining in background.',
    creatorApp: 'Unknown Malware / Adware Installer',
    whyItExists: 'Injected into startup folders to steal CPU power for illegal crypto mining.',
    consequenceOfRemoval: 'Restores CPU performance and terminates unauthorized network activity.'
  },
  // MACOS PATTERNS
  {
    id: 'mac-xcode-derived-data',
    pattern: '**/Library/Developer/Xcode/DerivedData/**',
    category: 'temp',
    appName: 'Xcode',
    os: 'macos',
    deletionSafety: 'safe',
    systemHealth: 'healthy',
    healthReason: 'Build artifacts and indices, safe to clear.',
    removalStatus: 'no-issue',
    whatIsIt: 'Temporary build files, module caches, and project indices.',
    creatorApp: 'Apple Xcode IDE',
    whyItExists: 'Speeds up subsequent builds and provides IDE indexing.',
    consequenceOfRemoval: 'Frees gigabytes of space. Next project build will take longer as it re-indexes.'
  },
  // LINUX PATTERNS
  {
    id: 'linux-journal-logs',
    pattern: '**/var/log/journal/**',
    category: 'log',
    appName: 'Systemd Journal',
    os: 'linux',
    deletionSafety: 'safe',
    systemHealth: 'healthy',
    healthReason: 'Historical system logs, safe to rotate/clear.',
    removalStatus: 'no-issue',
    whatIsIt: 'Compressed binary logs containing system messages and service history.',
    creatorApp: 'systemd-journald',
    whyItExists: 'Provides audit trail and diagnostic history for system administrators.',
    consequenceOfRemoval: 'Clears old system logs. Will not affect current system operation.'
  },
  {
    id: 'linux-node-modules',
    pattern: '**/node_modules/**',
    category: 'cache',
    appName: 'Node.js Projects',
    os: 'all',
    deletionSafety: 'safe',
    systemHealth: 'mixed',
    healthReason: 'Large dependency folders, but may belong to active projects.',
    removalStatus: 'mixed',
    whatIsIt: 'JavaScript/TypeScript project dependencies installed via npm/yarn/pnpm.',
    creatorApp: 'Node.js Package Managers',
    whyItExists: 'Stores all project dependencies for development and build processes.',
    consequenceOfRemoval: 'Safe to delete for inactive projects; run npm install to restore.'
  }
];

export function matchFileRule(filePath: string, fileName: string, os: string = 'linux'): {
  deletionSafety: DeletionSafety;
  threatSignature?: string;
  systemHealth: SystemHealth;
  healthReason: string;
  removalStatus: RemovalStatus;
  category: FileCategory;
  summary: FileSummary;
} {
  const normalized = filePath.replace(/\\/g, '/');
  
  for (const rule of LOCAL_RULES_DATABASE) {
    const globPattern = rule.pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
    const regex = new RegExp(globPattern, 'i');
    
    if (regex.test(normalized) || fileName.toLowerCase().includes(rule.appName.toLowerCase())) {
      return {
        deletionSafety: rule.deletionSafety,
        threatSignature: rule.threatSignature,
        systemHealth: rule.systemHealth,
        healthReason: rule.healthReason,
        removalStatus: rule.removalStatus || 'no-issue',
        category: rule.category,
        summary: {
          whatIsIt: rule.whatIsIt,
          creatorApp: rule.creatorApp,
          whyItExists: rule.whyItExists,
          consequenceOfRemoval: rule.consequenceOfRemoval,
          recommendation: rule.deletionSafety === 'unsafe' ? 'Quarantine' : 'Safe to Delete',
          riskScore: rule.deletionSafety === 'unsafe' ? 95 : 10
        }
      };
    }
  }

  // Hidden files detection (heuristic)
  const isHidden = fileName.startsWith('.') || normalized.includes('/AppData/') || normalized.includes('/.local/') || normalized.includes('/.config/') || normalized.includes('/.cache/');

  // Fallback heuristic classification logic
  if (normalized.includes('system32') || normalized.includes('/usr/bin') || normalized.includes('/boot') || normalized.includes('/System/Library') || normalized.includes('/etc/')) {
    return {
      deletionSafety: 'unsafe',
      systemHealth: 'issue',
      healthReason: 'Critical operating system binary or configuration folder.',
      removalStatus: 'issue',
      category: 'system',
      summary: {
        whatIsIt: 'Core OS system files required for device booting and standard operation.',
        creatorApp: 'Operating System Core',
        whyItExists: 'Executes core kernel drivers and native window management.',
        consequenceOfRemoval: 'SYSTEM FAILURE: Deleting will render system unbootable.',
        recommendation: 'Keep File',
        riskScore: 100
      }
    };
  }

  if (normalized.includes('node_modules') || normalized.includes('target/') || normalized.includes('vendor/') || normalized.includes('.cache') || normalized.includes('cache') || normalized.includes('tmp') || normalized.includes('temp')) {
    return {
      deletionSafety: 'safe',
      systemHealth: normalized.includes('node_modules') ? 'mixed' : 'healthy',
      healthReason: 'Temporary application cache or build artifacts.',
      removalStatus: normalized.includes('node_modules') ? 'mixed' : 'no-issue',
      category: 'cache',
      summary: {
        whatIsIt: 'Cached data stored temporarily to accelerate application response.',
        creatorApp: 'Development Toolchains / Installed Applications',
        whyItExists: 'Reduces build times or speeds up interface render.',
        consequenceOfRemoval: 'Safe to delete; toolchains will regenerate on next build.',
        recommendation: 'Safe to Delete',
        riskScore: 10
      }
    };
  }

  return {
    deletionSafety: 'safe',
    systemHealth: 'healthy',
    healthReason: 'Standard user file or unclassified data.',
    removalStatus: 'no-issue',
    category: isHidden ? 'hidden' : 'large_file',
    summary: {
      whatIsIt: 'Unclassified data file or application asset.',
      creatorApp: 'User Application',
      whyItExists: 'Created during routine application or file save activities.',
      consequenceOfRemoval: 'Review file location before deleting.',
      recommendation: 'Inspect First',
      riskScore: 35
    }
  };
}