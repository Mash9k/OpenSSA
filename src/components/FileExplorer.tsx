'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { Folder, File, Search, RefreshCw, Eye, EyeOff, X, Database, ChevronDown } from 'lucide-react';
import { IndicatorBadge } from './ui/IndicatorBadge';
import { FileItem, DriveInfo } from '@/lib/types';
import { formatBytes, cn } from '@/lib/utils';
import { searchFiles, getDrives } from '@/lib/api';
import { ConfirmationModal } from './ConfirmationModal';

interface FileExplorerProps {
  activeTab: 'home' | 'safety' | 'remove' | 'monitor' | 'apps';
  onFileSelect: (file: FileItem) => void;
  onFileDelete: (file: FileItem, permanent: boolean) => void;
  onOpenFolder: (file: FileItem) => void;
  scanResults?: FileItem[];
  showHiddenFiles?: boolean;
}

export function FileExplorer({ 
  activeTab, 
  onFileSelect, 
  onFileDelete, 
  onOpenFolder, 
  scanResults, 
  showHiddenFiles = true 
}: FileExplorerProps) {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [selectedDrive, setSelectedDrive] = useState<DriveInfo | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [treeData, setTreeData] = useState<FileItem[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showDriveSelector, setShowDriveSelector] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{file: FileItem, permanent: boolean} | null>(null);

  useEffect(() => {
    if (scanResults) {
      setTreeData(buildTree(scanResults));
    }
  }, [scanResults]);

  useEffect(() => {
    getDrives().then((d) => {
      setDrives(d);
      if (d.length > 0 && !selectedDrive) {
        setSelectedDrive(d[0]);
      }
    });
  }, []);

  useEffect(() => {
    if (!showDriveSelector) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.drive-dropdown') && !target.closest('[data-drive-btn]')) {
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

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderTree = (items: FileItem[], depth = 0): React.ReactNode => {
    return items.map((item) => {
      const isExpanded = expandedIds.has(item.id);
      const hasChildren = item.isFolder && item.children && item.children.length > 0;
      const isHidden = item.isHidden;

      const handleClick = (e: React.MouseEvent) => {
        if (e.currentTarget === e.target || (e.target as HTMLElement).closest('.tree-item')) {
          onFileSelect(item);
        }
      };

      return (
        <div key={item.id} style={{ paddingLeft: depth * 20 }}>
          <div
            className={cn(
              'tree-item flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer',
              isHidden && 'opacity-60',
              isExpanded && 'bg-zinc-100 dark:bg-zinc-800'
            )}
            onClick={handleClick}
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
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-zinc-950">
      <div className="flex items-center gap-3 p-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 flex-shrink-0">
        <div className="relative flex-1 max-w-md" data-drive-btn>
          <button
            onClick={handleDriveClick}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-mono text-zinc-900 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors'
            )}
          >
            <Database className="h-4 w-4" />
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

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          <input
            type="text"
            placeholder="Filter files..."
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

        <button
          onClick={() => setShowDriveSelector(!showDriveSelector)}
          className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400"
          aria-label="Drive options"
        >
          <Eye className="h-4 w-4" />
        </button>
      </div>

      {treeData.length === 0 && !showDriveSelector && selectedDrive ? (
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-zinc-950">
          <div className="empty-state flex flex-col items-center">
            <Database className="icon h-12 w-12 text-zinc-700 dark:text-zinc-500 mb-2" />
            {activeTab === 'home' ? (
              <p className="title text-base font-semibold text-zinc-500 dark:text-zinc-400">Drive not scanned</p>
            ) : (
              <p className="title text-base font-semibold text-zinc-500 dark:text-zinc-400">Scan from Home tab</p>
            )}
            {activeTab === 'home' ? (
              <p className="desc text-xs font-mono text-zinc-600 dark:text-zinc-400">Click "Scan Drive" to analyze {selectedDrive.label}</p>
            ) : (
              <>
                <p className="desc text-xs font-mono text-zinc-600 dark:text-zinc-400 mb-3">No scan results available.</p>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('navigate-home'))}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Go to Home Tab to Scan
                </button>
              </>
            )}
          </div>
        </div>
      ) : filteredTree.length === 0 && searchQuery ? (
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-zinc-950">
          <div className="empty-state flex flex-col items-center">
            <Search className="icon h-10 w-10 text-zinc-700 dark:text-zinc-500 mb-2" />
            <p className="title text-base font-semibold text-zinc-500 dark:text-zinc-400">No matches for "{searchQuery}"</p>
            <p className="desc text-xs font-mono text-zinc-600 dark:text-zinc-400">Try a different search term</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 bg-white dark:bg-zinc-950">
          {renderTree(filteredTree)}
        </div>
      )}
    </div>
  );
}
