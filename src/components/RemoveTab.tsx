'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { FileExplorer } from './FileExplorer';
import { FileDetailModal } from './FileDetailModal';
import { FileItem } from '@/lib/types';
import { formatBytes, cn } from '@/lib/utils';
import { Trash2, Loader2, X, Check, ChevronRight, Folder, File } from 'lucide-react';

interface RemoveTabProps {
  selectedFile: FileItem | null;
  onFileSelect: (file: FileItem) => void;
  onCloseModal: () => void;
  onFileDelete: (file: FileItem, permanent: boolean) => void;
  onOpenFolder: (file: FileItem) => void;
  scanResults: FileItem[];
  showHiddenFiles?: boolean;
}

export function RemoveTab({ 
  selectedFile, 
  onFileSelect, 
  onCloseModal,
  onFileDelete,
  onOpenFolder,
  scanResults,
  showHiddenFiles
}: RemoveTabProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter results for removal - only show items with removal status
  const removalCandidates = useMemo(() => {
    return scanResults.filter(file => 
      file.removalStatus === 'no-issue' || 
      file.removalStatus === 'mixed' || 
      file.removalStatus === 'issue'
    );
  }, [scanResults]);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    if (selectedItems.size === removalCandidates.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(removalCandidates.map(f => f.id)));
    }
  };

  const clearSelection = () => setSelectedItems(new Set());

  const totalSelectedSize = useMemo(() => {
    return removalCandidates
      .filter(f => selectedItems.has(f.id))
      .reduce((sum, f) => sum + f.sizeBytes, 0);
  }, [removalCandidates, selectedItems]);

  const handleBatchDelete = async () => {
    const filesToDelete = removalCandidates.filter(f => selectedItems.has(f.id));
    if (filesToDelete.length === 0) return;
    
    setIsDeleting(true);
    for (const file of filesToDelete) {
      await onFileDelete(file, false);
    }
    clearSelection();
    setIsDeleting(false);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header with batch actions */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-950/50">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">Remove</h2>
          <span className="px-2 py-0.5 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-400">
            {removalCandidates.length} candidates
          </span>
        </div>

        {selectedItems.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400 font-mono">
              Selected: {selectedItems.size} items ({formatBytes(totalSelectedSize)})
            </span>
            <button onClick={clearSelection} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors">
              Clear
            </button>
            <button 
              onClick={handleBatchDelete}
              disabled={isDeleting}
              className="px-4 py-1.5 text-sm font-medium rounded-lg dark:bg-zinc-900 dark:text-zinc-100 hover:bg-zinc-800 disabled:opacity-50 flex items-center gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Move to Trash
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* File Explorer with removal focus */}
      <FileExplorer
        activeTab="remove"
        onFileSelect={onFileSelect}
        onFileDelete={onFileDelete}
        onOpenFolder={onOpenFolder}
        scanResults={scanResults}
        showHiddenFiles={showHiddenFiles}
      />

      {/* Batch action bar at bottom when items selected */}
      {selectedItems.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950 border-t border-zinc-800 p-3 animate-slide-up">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-white font-medium">Selected: {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''}</p>
                <p className="text-zinc-500 text-sm font-mono">{formatBytes(totalSelectedSize)} reclaimable</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={clearSelection} className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors">
                Clear Selection
              </button>
              <button 
                onClick={handleBatchDelete}
                disabled={isDeleting}
                className="px-6 py-2.5 text-sm font-medium rounded-lg dark:bg-zinc-900 dark:text-zinc-100 hover:bg-zinc-800 disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Moving to Trash...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Move Selected to Trash
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <FileDetailModal
        file={selectedFile}
        onClose={onCloseModal}
        onDelete={(permanent) => selectedFile && onFileDelete(selectedFile, permanent)}
        onOpenFolder={() => selectedFile && onOpenFolder(selectedFile)}
      />
    </div>
  );
}