'use client';
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in">
        <div className={`p-4 flex items-center justify-between ${danger ? 'bg-rose-900' : 'bg-slate-900'} text-white`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${danger ? 'text-rose-300' : 'text-amber-400'}`} />
            <h3 className="font-bold text-sm">{title}</h3>
          </div>
          <button onClick={onCancel} className="text-white/60 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 text-xs text-slate-700 leading-relaxed whitespace-pre-line">{message}</div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50 text-xs">
            Cancel
          </button>
          <button onClick={onConfirm} className={`flex-1 py-2.5 rounded-xl font-bold text-white text-xs shadow-md ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
