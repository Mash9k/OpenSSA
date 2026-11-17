'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Clock, 
  Cpu, 
  MemoryStick, 
  TrendingUp,
  Target,
  Zap,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff
} from 'lucide-react';
import { ApplicationInfo } from '@/lib/types';
import { formatBytes, cn, formatPercent, formatDate } from '@/lib/utils';
import { getApplicationsList } from '@/lib/api';

interface AppsTabProps {}

export function AppsTab() {
  const [apps, setApps] = useState<ApplicationInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<'most-used' | 'screen-time' | 'resource-hogs'>('most-used');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'launchCount', direction: 'desc' });
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const a = await getApplicationsList();
        setApps(a);
        setIsLoading(false);
      } catch (e) {
        console.error('Failed to fetch apps:', e);
        setIsLoading(false);
      }
    };
    fetchApps();
    const interval = setInterval(fetchApps, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const filteredApps = apps
    .filter(app => 
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.publisher.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.executablePath.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortConfig.key as keyof ApplicationInfo];
      const bVal = b[sortConfig.key as keyof ApplicationInfo];
      if (aVal === undefined || bVal === undefined) return 0;
      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * direction;
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * direction;
      }
      return 0;
    });

  return (
    <div className="h-full flex flex-col">
      {/* View Selector */}
      <div className="border-b border-zinc-800 bg-zinc-950/50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="segmented-control">
              <button
                onClick={() => setActiveView('most-used')}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2',
                  activeView === 'most-used' ? 'dark:bg-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                )}
              >
                <BarChart3 className="h-4 w-4" />
                Most Used
              </button>
              <button
                onClick={() => setActiveView('screen-time')}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2',
                  activeView === 'screen-time' ? 'dark:bg-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                )}
              >
                <Clock className="h-4 w-4" />
                Screen Time
              </button>
              <button
                onClick={() => setActiveView('resource-hogs')}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2',
                  activeView === 'resource-hogs' ? 'dark:bg-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                )}
              >
                <Zap className="h-4 w-4" />
                Resource Hogs
              </button>
            </div>

            <div className="relative flex-1 max-w-md ml-8">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search applications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg placeholder-zinc-600 focus:border-blue-500"
              />
            </div>

            <button
              className="p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="loading-spinner" />
            </div>
          ) : activeView === 'most-used' ? (
            <MostUsedView apps={filteredApps} sortConfig={sortConfig} onSort={handleSort} expandedApps={expandedApps} setExpandedApps={setExpandedApps} />
          ) : activeView === 'screen-time' ? (
            <ScreenTimeView apps={filteredApps} sortConfig={sortConfig} onSort={handleSort} expandedApps={expandedApps} setExpandedApps={setExpandedApps} />
          ) : (
            <ResourceHogsView apps={filteredApps} sortConfig={sortConfig} onSort={handleSort} expandedApps={expandedApps} setExpandedApps={setExpandedApps} />
          )}
        </div>
      </div>
    </div>
  );
}

function MostUsedView({ apps, sortConfig, onSort, expandedApps, setExpandedApps }: {
  apps: ApplicationInfo[];
  sortConfig: { key: string; direction: 'asc' | 'desc' };
  onSort: (key: string) => void;
  expandedApps: Set<string>;
  setExpandedApps: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  return (
    <div className="space-y-4">
      <div className="px-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg grid grid-cols-12 gap-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">
        <div className="col-span-4 cursor-pointer hover:text-white" onClick={() => onSort('name')}>
          Application {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />)}
        </div>
        <div className="col-span-2 cursor-pointer hover:text-white" onClick={() => onSort('publisher')}>
          Publisher {sortConfig.key === 'publisher' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />)}
        </div>
        <div className="col-span-2 text-right cursor-pointer hover:text-white" onClick={() => onSort('launchCount')}>
          Launches {sortConfig.key === 'launchCount' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />)}
        </div>
        <div className="col-span-2 text-right cursor-pointer hover:text-white" onClick={() => onSort('screenTimeMinutes')}>
          Screen Time {sortConfig.key === 'screenTimeMinutes' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />)}
        </div>
        <div className="col-span-2 text-right">
          Status
        </div>
      </div>

      <div className="divide-y divide-zinc-800">
        {apps.map((app, index) => (
          <AppRow 
            key={app.id} 
            app={app} 
            rank={index + 1}
            expanded={expandedApps.has(app.id)}
            onToggle={() => setExpandedApps(prev => {
              const next = new Set(prev);
              if (next.has(app.id)) next.delete(app.id);
              else next.add(app.id);
              return next;
            })}
            showScreenTime={true}
          />
        ))}
        {apps.length === 0 && (
          <div className="empty-state py-12">
            <BarChart3 className="icon" />
            <p className="title">No applications found</p>
            <p className="desc">Run a scan or check permissions</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ScreenTimeView({ apps, sortConfig, onSort, expandedApps, setExpandedApps }: {
  apps: ApplicationInfo[];
  sortConfig: { key: string; direction: 'asc' | 'desc' };
  onSort: (key: string) => void;
  expandedApps: Set<string>;
  setExpandedApps: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  return (
    <div className="space-y-4">
      <div className="px-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg grid grid-cols-12 gap-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">
        <div className="col-span-4 cursor-pointer hover:text-white" onClick={() => onSort('name')}>
          Application
        </div>
        <div className="col-span-2 text-right cursor-pointer hover:text-white" onClick={() => onSort('screenTimeMinutes')}>
          Total Time {sortConfig.key === 'screenTimeMinutes' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />)}
        </div>
        <div className="col-span-2 text-right cursor-pointer hover:text-white" onClick={() => onSort('launchCount')}>
          Sessions {sortConfig.key === 'launchCount' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />)}
        </div>
        <div className="col-span-2 text-right cursor-pointer hover:text-white" onClick={() => onSort('lastUsed')}>
          Last Used {sortConfig.key === 'lastUsed' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />)}
        </div>
        <div className="col-span-2 text-right">
          Status
        </div>
      </div>

      <div className="divide-y divide-zinc-800">
        {apps.map((app) => (
          <AppRow 
            key={app.id} 
            app={app} 
            expanded={expandedApps.has(app.id)}
            onToggle={() => setExpandedApps(prev => {
              const next = new Set(prev);
              if (next.has(app.id)) next.delete(app.id);
              else next.add(app.id);
              return next;
            })}
            showScreenTime={true}
            screenTimeFocus={true}
          />
        ))}
        {apps.length === 0 && (
          <div className="empty-state py-12">
            <Clock className="icon" />
            <p className="title">No screen time data</p>
            <p className="desc">Enable tracking in settings</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ResourceHogsView({ apps, sortConfig, onSort, expandedApps, setExpandedApps }: {
  apps: ApplicationInfo[];
  sortConfig: { key: string; direction: 'asc' | 'desc' };
  onSort: (key: string) => void;
  expandedApps: Set<string>;
  setExpandedApps: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  return (
    <div className="space-y-4">
      <div className="px-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg grid grid-cols-12 gap-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">
        <div className="col-span-3 cursor-pointer hover:text-white" onClick={() => onSort('name')}>
          Application
        </div>
        <div className="col-span-2 text-right cursor-pointer hover:text-white" onClick={() => onSort('cpuPercent')}>
          CPU % {sortConfig.key === 'cpuPercent' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />)}
        </div>
        <div className="col-span-2 text-right cursor-pointer hover:text-white" onClick={() => onSort('memoryBytes')}>
          RAM {sortConfig.key === 'memoryBytes' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />)}
        </div>
        <div className="col-span-2 text-right cursor-pointer hover:text-white" onClick={() => onSort('gpuPercent')}>
          GPU % {sortConfig.key === 'gpuPercent' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />)}
        </div>
        <div className="col-span-2 text-right cursor-pointer hover:text-white" onClick={() => onSort('storageBytes')}>
          Disk {sortConfig.key === 'storageBytes' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />)}
        </div>
        <div className="col-span-1 text-right">
          Status
        </div>
      </div>

      <div className="divide-y divide-zinc-800">
        {apps.map((app) => (
          <AppRow 
            key={app.id} 
            app={app} 
            expanded={expandedApps.has(app.id)}
            onToggle={() => setExpandedApps(prev => {
              const next = new Set(prev);
              if (next.has(app.id)) next.delete(app.id);
              else next.add(app.id);
              return next;
            })}
            resourceFocus={true}
          />
        ))}
        {apps.length === 0 && (
          <div className="empty-state py-12">
            <Cpu className="icon" />
            <p className="title">No resource data</p>
            <p className="desc">Refresh to load process information</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface AppRowProps {
  app: ApplicationInfo;
  rank?: number;
  expanded: boolean;
  onToggle: () => void;
  showScreenTime?: boolean;
  screenTimeFocus?: boolean;
  resourceFocus?: boolean;
}

function AppRow({ app, rank, expanded, onToggle, showScreenTime, screenTimeFocus, resourceFocus }: AppRowProps) {
  return (
    <div className="bg-zinc-950/30 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={onToggle}>
        {rank && <span className="w-8 text-center text-zinc-500 font-mono text-sm">#{rank}</span>}
        <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
          <Target className="h-5 w-5 text-zinc-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white truncate">{app.name}</p>
          <p className="text-xs text-zinc-500 font-mono truncate">{app.executablePath}</p>
        </div>
        
        {resourceFocus && (
          <div className="flex items-center gap-4 text-sm font-mono text-zinc-400 whitespace-nowrap hidden md:flex">
            <div className="text-right">
              <span className={cn(app.cpuPercent > 50 ? 'text-red-400' : app.cpuPercent > 10 ? 'text-amber-400' : 'text-zinc-400')}>
                {app.cpuPercent.toFixed(1)}%
              </span>
              <span className="text-zinc-600 ml-1">CPU</span>
            </div>
            <div className="text-right">
              <span>{formatBytes(app.memoryBytes)}</span>
              <span className="text-zinc-600 ml-1">RAM</span>
            </div>
            <div className="text-right">
              <span>{app.gpuPercent.toFixed(1)}%</span>
              <span className="text-zinc-600 ml-1">GPU</span>
            </div>
            <div className="text-right">
              <span>{formatBytes(app.storageBytes)}</span>
              <span className="text-zinc-600 ml-1">Disk</span>
            </div>
          </div>
        )}

        {!resourceFocus && showScreenTime && (
          <div className="flex items-center gap-4 text-sm font-mono text-zinc-400 whitespace-nowrap hidden md:flex">
            <div className="text-right">
              <span className="text-white">{app.screenTimeMinutes || 0} min</span>
              <span className="text-zinc-600 ml-1">Total</span>
            </div>
            <div className="text-right">
              <span className="text-white">{app.launchCount || 0}</span>
              <span className="text-zinc-600 ml-1">Sessions</span>
            </div>
            <div className="text-right">
              <span>{app.lastUsed ? formatDate(app.lastUsed) : 'Never'}</span>
              <span className="text-zinc-600 ml-1">Last</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className={cn(
            'px-2 py-0.5 text-xs rounded-full font-mono',
            app.status === 'running' ? 'bg-green-500/20 text-green-400' : 
            app.status === 'background' ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-500/20 text-zinc-400'
          )}>
            {app.status}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
        </div>
      </div>

      {expanded && (
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="stats-card">
            <p className="label">CPU Usage</p>
            <p className="value text-blue-400">{app.cpuPercent.toFixed(1)}%</p>
          </div>
          <div className="stats-card">
            <p className="label">Memory</p>
            <p className="value text-green-400">{formatBytes(app.memoryBytes)}</p>
          </div>
          <div className="stats-card">
            <p className="label">Storage</p>
            <p className="value text-amber-400">{formatBytes(app.storageBytes)}</p>
          </div>
          
          <div className="md:col-span-3 space-y-2">
            <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Resource Utilization</h4>
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-4">
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-zinc-500 uppercase">CPU Intensity</span>
                  <span className="text-white">{app.cpuPercent.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 w-full bg-black rounded-full overflow-hidden border border-zinc-800">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-500" 
                    style={{ width: `${Math.min(100, app.cpuPercent * 2)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-zinc-500 uppercase">Memory Footprint</span>
                  <span className="text-white">{formatBytes(app.memoryBytes)}</span>
                </div>
                <div className="h-1.5 w-full bg-black rounded-full overflow-hidden border border-zinc-800">
                  <div 
                    className="h-full bg-green-500 transition-all duration-500" 
                    style={{ width: `${Math.min(100, (app.memoryBytes / (8 * 1024 ** 3)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {app.associatedLeftovers && app.associatedLeftovers.length > 0 && (
            <div className="md:col-span-3 space-y-2">
              <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Associated Leftover Files</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {app.associatedLeftovers.slice(0, 8).map(leftover => (
                  <div key={leftover.id} className="p-2 bg-zinc-900 border border-zinc-800 rounded text-xs">
                    <p className="font-mono text-white truncate">{leftover.name}</p>
                    <p className="text-zinc-500 truncate">{formatBytes(leftover.sizeBytes)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}