'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  HardDrive, 
  Database, 
  RefreshCw, 
  Trash2, 
  Zap,
  CheckCircle,
  AlertTriangle,
  Folder,
  File,
  Search,
  X,
  ChevronDown
} from 'lucide-react';
import { FileItem, DriveInfo } from '@/lib/types';
import { formatBytes, cn } from '@/lib/utils';
import { searchFiles, getDrives, deleteItems, scanDirectory, permanent_delete } from '@/lib/api';
import { IndicatorBadge } from './ui/IndicatorBadge';
import { FileDetailModal } from './FileDetailModal';

interface HomeTabProps {
  selectedFile: FileItem | null;
  onFileSelect: (file: FileItem) => void;
  onCloseModal: () => void;
  onFileDelete: (file: FileItem, permanent: boolean) => void;
  onOpenFolder: (file: FileItem) => void;
  onScanComplete: (results: FileItem[]) => void;
  /** Shared scan results from AppShell — kept in sync so deletions reflect immediately. */
  scanResults: FileItem[];
  showHiddenFiles: boolean;
}

export function HomeTab({ 
  selectedFile, 
  onFileSelect, 
  onCloseModal,
  onFileDelete,
  onOpenFolder,
  onScanComplete,
  scanResults,
  showHiddenFiles
}: HomeTabProps) {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [selectedDrive, setSelectedDrive] = useState<DriveInfo | null>(null);
  const [showDriveSelector, setShowDriveSelector] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [treeData, setTreeData] = useState<FileItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [scanStats, setScanStats] = useState({ totalSize: 0, totalCount: 0, safeCount: 0, unsafeCount: 0 });
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Load drives on mount
  useEffect(() => {
    getDrives().then((d) => {
      setDrives(d);
      if (d.length > 0 && !selectedDrive) {
        setSelectedDrive(d[0]);
      }
    });
  }, []);

  // Update stats when scanResults change
  useEffect(() => {
    setScanStats({
      totalSize: scanResults.reduce((sum, f) => sum + f.sizeBytes, 0),
      totalCount: scanResults.length,
      safeCount: scanResults.filter(f => f.deletionSafety === 'safe').length,
      unsafeCount: scanResults.filter(f => f.deletionSafety === 'unsafe').length
    });
    if (scanResults.length > 0) {
      setTreeData(buildTree(scanResults));
    }
  }, [scanResults]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDriveSelector) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.drive-dropdown') && !target.closest('[data-drive-button]')) {
        setShowDriveSelector(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showDriveSelector]);

  const handleDriveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    setShowDriveSelector(true);
  };

  const buildTree = (items: FileItem[]): FileItem[] => {
    const map = new Map<string, FileItem>();
    const roots: FileItem[] = [];

    items.forEach(file => {
      map.set(file.id, { ...file, children: [] });
    });

    items.forEach(file => {
      const item = map.get(file.id)!;
      if (file.parentId && map.has(file.parentId)) {
        const parent = map.get(file.parentId)!;
        if (!parent.children) parent.children = [];
        parent.children!.push(item);
      } else {
        roots.push(item);
      }
    });

    return roots;
  };

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return treeData;
    const query = searchQuery.toLowerCase();
    
    const matchingIds = new Set<string>();
    
    const findMatchingItems = (items: FileItem[]): string[] => {
      const matched: string[] = [];
      items.forEach(item => {
        const nameMatch = item.name.toLowerCase().includes(query);
        const pathMatch = item.path.toLowerCase().includes(query);
        if (nameMatch || pathMatch) {
          matched.push(item.id);
          matchingIds.add(item.id);
        }
        if (item.isFolder && item.children) {
          const childrenMatched = findMatchingItems(item.children);
          if (childrenMatched.length > 0) {
            matched.push(item.id);
            matchingIds.add(item.id);
          }
        }
      });
      return matched;
    };

    findMatchingItems(treeData);

    const filterRecursive = (items: FileItem[]): FileItem[] => {
      return items.filter(item => {
        const isDirectMatch = matchingIds.has(item.id);
        const isAncestor = matchingIds.has(item.id) || 
          (item.parentId && matchingIds.has(item.parentId));
        
        if (isDirectMatch) return true;
        if (isAncestor && item.isFolder && item.children) {
          const filteredChildren = filterRecursive(item.children);
          if (filteredChildren.length > 0) return true;
        }
        return false;
      }).map(item => {
        if (item.isFolder && item.children) {
          return { ...item, children: filterRecursive(item.children) };
        }
        return item;
      });
    };

    return filterRecursive(treeData);
  }, [treeData, searchQuery]);

  const handleScan = async () => {
    if (!selectedDrive) return;
    setIsScanning(true);
    try {
      const results = await searchFiles('', { 
        rootPath: selectedDrive.path, 
        showHidden: showHiddenFiles 
      });
      setTreeData(buildTree(results));
      setLastScanTime(new Date().toISOString());
    } catch (e) {
      console.error('Scan failed:', e);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFullScan = async () => {
    if (!selectedDrive) return;
    setIsScanning(true);
    try {
      const results = await scanDirectory(selectedDrive.path, { showHidden: showHiddenFiles });
      setTreeData(buildTree(results));
      setLastScanTime(new Date().toISOString());
      onScanComplete(results);
    } catch (e) {
      console.error('Full scan failed:', e);
    } finally {
      setIsScanning(false);
    }
  };

  /** Quick clean: uncapped search for temp/cache/log files, then trash them. */
  const handleQuickClean = async () => {
    if (!selectedDrive) return;
    setIsScanning(true);
    try {
      const results = await searchFiles('', { 
        rootPath: selectedDrive.path, 
        showHidden: showHiddenFiles 
      });
      
      const tempFiles = results.filter(f => 
        f.deletionSafety === 'safe' && 
        (f.category === 'temp' || f.category === 'cache' || f.category === 'log')
      );

      if (tempFiles.length > 0) {
        await deleteItems(tempFiles.map(f => f.path), false);
      }

      // Refresh the view with a fresh full scan
      const freshResults = await scanDirectory(selectedDrive.path, {
        showHidden: showHiddenFiles
      });
      const tree = buildTree(freshResults);
      setTreeData(tree);
      setScanStats({
        totalSize: freshResults.reduce((sum, f) => sum + f.sizeBytes, 0),
        totalCount: freshResults.length,
        safeCount: freshResults.filter(f => f.deletionSafety === 'safe').length,
        unsafeCount: freshResults.filter(f => f.deletionSafety === 'unsafe').length
      });
      onScanComplete(freshResults);
    } catch (e) {
      console.error('Quick clean failed:', e);
    } finally {
      setIsScanning(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderTree = (items: FileItem[], depth = 0): React.ReactNode => {
    return items.map((item) => {
      const isExpanded = expandedFolders.has(item.id);
      const hasChildren = item.isFolder && item.children && item.children.length > 0;
      const isHidden = item.isHidden;

      return (
        <div key={item.id} style={{ paddingLeft: depth * 20 }}>
          <div
            className={cn(
              'tree-item flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer',
              isHidden && 'opacity-60',
              isExpanded && 'bg-zinc-100 dark:bg-zinc-800'
            )}
            onClick={() => onFileSelect(item)}
          >
            {hasChildren && (
              <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
            )}
            {!hasChildren && <span className="w-4" />}
            <span className={cn('icon', item.isFolder ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-500 dark:text-zinc-400')}>
              {item.isFolder ? <Folder className="h-4 w-4" /> : <File className="h-4 w-4" />}
            </span>
            <span className={cn('flex-1 truncate font-medium text-zinc-900 dark:text-zinc-100', isHidden && 'opacity-60')}>
              {item.name}
            </span>
            {isHidden && <span className="hidden-badge">HIDDEN</span>}
            <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
              {item.isFolder && item.itemCount ? `${item.itemCount} items` : formatBytes(item.sizeBytes)}
            </span>
            <div className="indicators">
              <IndicatorBadge type="deletion-safety" value={item.deletionSafety} size="sm" showLabel={false} />
              <IndicatorBadge type="system-health" value={item.systemHealth} size="sm" showLabel={false} />
            </div>
          </div>
          {isExpanded && hasChildren && item.children && renderTree(item.children, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-zinc-950">
      {/* Stats Bar */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 flex-shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">Total Size</p>
            <p className="text-lg font-bold font-mono text-zinc-900 dark:text-zinc-100">{formatBytes(scanStats.totalSize)}</p>
          </div>
          <div className="p-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">Items</p>
            <p className="text-lg font-bold font-mono text-zinc-900 dark:text-zinc-100">{scanStats.totalCount}</p>
          </div>
          <div className="p-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">Safe</p>
            <p className="text-lg font-bold font-mono text-green-600 dark:text-green-400">{scanStats.safeCount}</p>
          </div>
          <div className="p-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">Unsafe</p>
            <p className="text-lg font-bold font-mono text-red-600 dark:text-red-400">{scanStats.unsafeCount}</p>
          </div>
        </div>
      </div>

      {/* Drive Selector & Search */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 flex-shrink-0">
        <div className="relative" data-drive-button>
          <button
            onClick={handleDriveClick}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-mono text-zinc-900 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors'
            )}
          >
            <HardDrive className="h-4 w-4" />
            <span className="truncate max-w-[250px]">{selectedDrive?.label || 'Select Drive'}</span>
          </button>
          {showDriveSelector && (
            <div 
              className="drive-dropdown absolute right-0 top-full mt-2 w-72 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg overflow-visible z-50"
              style={{ left: dropdownPos.left, top: dropdownPos.top }}
            >
              {drives.map(drive => (
                <button
                  key={drive.id}
                  onClick={() => {
                    setSelectedDrive(drive);
                    setShowDriveSelector(false);
                    setTreeData([]);
                    setSearchQuery('');
                  }}
                  className={cn(
                    'w-full px-4 py-3 text-left text-sm font-mono transition-colors',
                    selectedDrive?.id === drive.id && 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-l-2 border-blue-500'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 dark:text-zinc-400">{drive.driveType === 'removable' ? '💾' : drive.driveType === 'sdcard' ? '📷' : '💿'}</span>
                    <span>{drive.label}</span>
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex justify-between">
                    <span>{formatBytes(drive.freeSpace)} free</span>
                    <span>{formatBytes(drive.totalSpace)} total</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleFullScan}
          disabled={isScanning || !selectedDrive}
          className={cn(
            'scan-button flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
            isScanning 
              ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 animate-pulse cursor-wait'
              : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800'
          )}
        >
          <RefreshCw className={cn('h-4 w-4', isScanning && 'animate-spin')} />
          <span>{isScanning ? 'Scanning...' : 'Scan Drive'}</span>
        </button>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          <input
            type="text"
            placeholder="Filter scanned results..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-8 py-1.5 text-sm font-mono bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg placeholder-zinc-500 dark:placeholder-zinc-400 focus:border-blue-500 focus:outline-none text-zinc-900 dark:text-zinc-100"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {treeData.length > 0 && (
          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
            {filteredTree.length} top-level item{filteredTree.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Results: tab-specific search + scrollable tree */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Scrollable tree area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 bg-white dark:bg-zinc-950">
          {treeData.length === 0 && !isScanning && selectedDrive ? (
            <div className="h-full flex items-center justify-center">
              <div className="empty-state flex flex-col items-center">
                <HardDrive className="icon h-12 w-12 text-zinc-700 dark:text-zinc-500 mb-2" />
                <p className="title text-base font-semibold text-zinc-500 dark:text-zinc-400">Drive not scanned</p>
                <p className="desc text-xs font-mono text-zinc-600 dark:text-zinc-400">Click "Scan Drive" to analyze {selectedDrive.label}</p>
              </div>
            </div>
          ) : filteredTree.length === 0 && searchQuery ? (
            <div className="h-full flex items-center justify-center">
              <div className="empty-state flex flex-col items-center">
                <Search className="icon h-10 w-10 text-zinc-700 dark:text-zinc-500 mb-2" />
                <p className="title text-base font-semibold text-zinc-500 dark:text-zinc-400">No matches for "{searchQuery}"</p>
                <p className="desc text-xs font-mono text-zinc-600 dark:text-zinc-400">Try a different search term</p>
              </div>
            </div>
          ) : (
            renderTree(filteredTree)
          )}
        </div>
      </div>

      <FileDetailModal
        file={selectedFile}
        onClose={onCloseModal}
        onDelete={(permanent) => {
          if (permanent && selectedFile) {
            // Directly invoke permanent_delete Tauri command for permanent deletion
            permanent_delete(selectedFile.path).then(() => {
              // Immediately remove the deleted path from the React tree state
              setTreeData(prev => prev.filter(f => {
                const itemPath = f.path.replace(/\\/g, '/');
                const deletedPath = selectedFile.path.replace(/\\/g, '/');
                // Drop the item itself and anything nested inside it
                return itemPath !== deletedPath && !itemPath.startsWith(deletedPath + '/');
              }));
              onCloseModal();
            }).catch(err => {
              console.error('Permanent delete failed:', err);
            });
          } else if (selectedFile) {
            onFileDelete(selectedFile, permanent);
          }
        }}
        onOpenFolder={() => selectedFile && onOpenFolder(selectedFile)}
      />
    </div>
  );
}
