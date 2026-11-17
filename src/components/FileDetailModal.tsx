'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FolderOpen, Trash2, AlertTriangle, CheckCircle, Info, HardDrive, Clock, Shield, AlertCircle, FileText, User, Lock } from 'lucide-react';
import { IndicatorBadge } from './ui/IndicatorBadge';
import { FileItem } from '@/lib/types';
import { formatBytes, cn, truncatePath } from '@/lib/utils';

interface FileDetailModalProps {
  file: FileItem | null;
  onClose: () => void;
  onDelete: (permanent: boolean) => void;
  onOpenFolder?: () => void;
}

export function FileDetailModal({ file, onClose, onDelete, onOpenFolder }: FileDetailModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  if (!file) return null;

  const isDangerous = file.deletionSafety === 'unsafe' || file.systemHealth === 'issue';

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 dark:bg-black/70"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl animate-scale-in">
          {/* Header - Fixed at top */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex-shrink-0">
                {file.isFolder ? <FolderOpen className="h-6 w-6 text-gray-300" /> : <FileText className="h-6 w-6 text-gray-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{file.name}</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate">{truncatePath(file.path)}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 flex-shrink-0 ml-2" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body - Scrollable */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4 bg-white dark:bg-zinc-950">
            {/* Indicators */}
            <div className="flex flex-wrap items-center gap-3">
              <IndicatorBadge type="deletion-safety" value={file.deletionSafety} size="md" />
              <IndicatorBadge type="system-health" value={file.systemHealth} size="md" />
              {file.isHidden && (
                <span className="hidden-badge">HIDDEN</span>
              )}
            </div>

            {/* Threat Signature */}
            {file.threatSignature && (
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
                <div className="flex items-center gap-2 text-gray-400 mb-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span className="font-medium">Threat Signature Detected</span>
                </div>
                <code className="text-amber-300 font-mono text-sm break-all">{file.threatSignature}</code>
              </div>
            )}

            {/* Plain English Summary */}
            <div className="space-y-3">
              <h3 className="text-gray-400 data-sm font-medium uppercase tracking-wider">File Intelligence</h3>
              <div className="space-y-3">
                <DetailCard icon={Info} title="What is this?" content={file.summary.whatIsIt} />
                <DetailCard icon={HardDrive} title="Created by" content={file.summary.creatorApp} />
                <DetailCard icon={Clock} title="Why does it exist?" content={file.summary.whyItExists} />
                <DetailCard
                  icon={AlertCircle}
                  title="What happens if deleted?"
                  content={file.summary.consequenceOfRemoval}
                  isWarning={isDangerous}
                />
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div>
            <h3 className="text-gray-400 data-sm font-medium uppercase tracking-wider mb-3">Metadata</h3>
            <div className="grid grid-cols-2 gap-3">
              <MetaItem label="Size on Disk" value={formatBytes(file.sizeBytes)} icon={HardDrive} />
              <MetaItem label="Type" value={file.isFolder ? 'Directory' : 'File'} icon={FileText} />
              <MetaItem label="Category" value={file.category.replace('_', ' ')} icon={Shield} />
              <MetaItem label="Modified" value={file.lastModified || 'Unknown'} icon={Clock} />
              <MetaItem label="Risk Score" value={`${file.summary.riskScore}/100`} icon={AlertTriangle} />
              <MetaItem label="Recommendation" value={file.summary.recommendation} icon={CheckCircle} />
              <MetaItem label="Hidden" value={file.isHidden ? 'Yes' : 'No'} icon={Lock} />
              <MetaItem label="Full Path" value={file.path} icon={FolderOpen} />
            </div>
          </div>

          {/* Health Reason */}
          <div>
            <h3 className="text-gray-400 data-sm font-medium uppercase tracking-wider mb-2">Health Assessment</h3>
            <p className="text-gray-300 text-sm">{file.healthReason}</p>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function DetailCard({ icon: Icon, title, content, isWarning }: {
  icon: React.ElementType;
  title: string;
  content: string;
  isWarning?: boolean;
}) {
  return (
    <div className={cn(
      'p-3 rounded-lg bg-gray-900 border',
      isWarning ? 'border-red-500/30' : 'border-gray-800'
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'p-2 rounded-lg flex-shrink-0',
          isWarning ? 'bg-red-500/10 text-red-400' : 'bg-gray-800 text-gray-400'
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{title}</h4>
          <p className="text-gray-300 text-sm leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  );
}

function MetaItem({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="p-3 rounded-lg bg-gray-900 border border-gray-800">
      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-zinc-900 dark:text-zinc-100 text-sm font-mono truncate">{value}</p>
    </div>
  );
}