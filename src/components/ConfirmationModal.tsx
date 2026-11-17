'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Trash2, CheckCircle, FileText, FolderOpen, Shield } from 'lucide-react';
import { FileItem } from '@/lib/types';

interface ConfirmationModalProps {
  file: FileItem | null;
  onConfirm: () => void;
  onCancel: () => void;
  isOpen: boolean;
  actionType: 'trash' | 'permanent';
}

export function ConfirmationModal({ 
  file, 
  onConfirm, 
  onCancel, 
  isOpen, 
  actionType 
}: ConfirmationModalProps) {
  if (!isOpen || !file) return null;

  const isDangerous = file.deletionSafety === 'unsafe' || file.systemHealth === 'issue' || file.removalStatus !== 'no-issue';

  const getWarningMessage = () => {
    if (file.deletionSafety === 'unsafe') {
      return 'This file is marked as UNSAFE for deletion. Removing it may cause system instability, application crashes, or data loss.';
    }
    if (file.systemHealth === 'issue') {
      return 'This file has SYSTEM HEALTH issues. Deletion could affect system functionality or running services.';
    }
    if (file.removalStatus === 'mixed') {
      return 'This item has MIXED removal status. Some parts may be safe to remove while others could cause issues.';
    }
    if (file.removalStatus === 'issue') {
      return 'This item has REMOVAL ISSUES. Deleting it may break dependencies or leave system in inconsistent state.';
    }
    return 'Are you sure you want to proceed?';
  };

  const getActionText = () => actionType === 'trash' ? 'Move to Trash' : 'Permanently Delete';
  const getActionIcon = () => actionType === 'trash' ? <Trash2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />;

  return createPortal(
    <>
      <div className="modal-backdrop" onClick={onCancel} />
      <div className="modal-content animate-scale-in" style={{ maxHeight: '90vh', width: '520px' }}>
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex-shrink-0">
              {file.isFolder ? <FolderOpen className="h-6 w-6 text-zinc-400 dark:text-zinc-500" /> : <FileText className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />}
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[300px]">Confirm {getActionText()}</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate max-w-[300px]">{file.name}</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[70vh] scrollbar-thin">
          {/* Warning Banner */}
          {isDangerous && (
            <div className="p-4 border-b border-red-500/30 bg-red-50/10 dark:bg-red-900/10">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-red-500/20 dark:bg-red-900/20 flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-red-300 font-medium text-sm mb-1">⚠️ Warning: Potentially Dangerous Deletion</h3>
                  <p className="text-zinc-900 dark:text-zinc-100 text-sm">{getWarningMessage()}</p>
                  <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-2">
                    {actionType === 'permanent'
                      ? 'This action CANNOT BE UNDONE. The file will be permanently deleted.'
                      : 'The file will be moved to the system Recycle Bin/Trash and can be restored if needed.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* File Indicators */}
          <div className="p-4 border-b border-gray-800 flex flex-wrap items-center gap-3">
            <Shield className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            <span className="text-xs font-medium px-2 py-0.5 rounded">
              {file.deletionSafety === 'unsafe' ? 'Unsafe' : 'Safe'}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded">
              {file.systemHealth}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded">
              {file.removalStatus}
            </span>
          </div>

          {/* File Details */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/50">
            <h3 className="text-zinc-600 dark:text-zinc-400 text-sm font-medium uppercase tracking-wider mb-3">File Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Path:</span>
                <span className="text-zinc-900 dark:text-zinc-100 font-mono truncate max-w-[300px]">{file.path}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Size:</span>
                <span className="text-zinc-900 dark:text-zinc-100">{((file.sizeBytes / 1024 / 1024)).toFixed(2)} MB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Type:</span>
                <span className="text-zinc-900 dark:text-zinc-100">{file.isFolder ? 'Directory' : 'File'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Category:</span>
                <span className="text-zinc-900 dark:text-zinc-100">{file.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Risk Score:</span>
                <span className="font-mono">
                  {file.summary.riskScore}/100
                </span>
              </div>
            </div>
          </div>

          {/* Consequence */}
          <div className="p-4">
            <h3 className="text-zinc-600 dark:text-zinc-400 text-sm font-medium uppercase tracking-wider mb-2">What will happen?</h3>
            <p className="text-zinc-900 dark:text-zinc-100 text-sm">{file.summary.consequenceOfRemoval}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="modal-actions border-t border-gray-800">
          <button onClick={onCancel} className="modal-action-btn secondary flex-1">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={actionType === 'permanent' ? 'modal-action-btn flex-1 danger' : 'modal-action-btn flex-1 primary'}
          >
            {getActionIcon()}
            {getActionText()}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}