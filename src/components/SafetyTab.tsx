'use client';

import React from 'react';
import { FileExplorer } from './FileExplorer';
import { FileDetailModal } from './FileDetailModal';
import { FileItem } from '@/lib/types';

export function SafetyTab({ 
  selectedFile, 
  onFileSelect, 
  onCloseModal,
  onFileDelete,
  onOpenFolder,
  scanResults,
  showHiddenFiles
}: { 
  selectedFile: FileItem | null;
  onFileSelect: (file: FileItem) => void;
  onCloseModal: () => void;
  onFileDelete: (file: FileItem, permanent: boolean) => void;
  onOpenFolder: (file: FileItem) => void;
  scanResults?: FileItem[];
  showHiddenFiles?: boolean;
}) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <FileExplorer
        activeTab="safety"
        onFileSelect={onFileSelect}
        onFileDelete={onFileDelete}
        onOpenFolder={onOpenFolder}
        scanResults={scanResults}
        showHiddenFiles={showHiddenFiles}
      />
      <FileDetailModal
        file={selectedFile}
        onClose={onCloseModal}
        onDelete={(permanent) => selectedFile && onFileDelete(selectedFile, permanent)}
        onOpenFolder={() => selectedFile && onOpenFolder(selectedFile)}
      />
    </div>
  );
}
