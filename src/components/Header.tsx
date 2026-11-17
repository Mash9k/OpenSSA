'use client';

import React from 'react';
import { ChevronLeft, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onBack?: () => void;
  canGoBack: boolean;
  driveLabel?: string;
  onDriveClick?: () => void;
}

export function Header({ 
  onBack, 
  canGoBack, 
  driveLabel,
  onDriveClick
}: HeaderProps) {
  return (
    <header className="app-header flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/50 flex-shrink-0">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack} 
          disabled={!canGoBack}
          className={cn(
            'back-button flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors', 
            !canGoBack && 'opacity-0 pointer-events-none'
          )}
          aria-label="Go back"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Back</span>
        </button>

        {driveLabel && (
          <button 
            onClick={onDriveClick}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-mono text-zinc-400 hover:text-white transition-colors bg-zinc-900 border border-zinc-800 rounded-lg"
          >
            <Database className="h-4 w-4 text-zinc-400" />
            <span className="truncate max-w-[220px]">{driveLabel}</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs font-mono text-zinc-500">
        <span className="hidden sm:inline">OpenSSA • System Cleaner & Storage Analyzer</span>
      </div>
    </header>
  );
}
