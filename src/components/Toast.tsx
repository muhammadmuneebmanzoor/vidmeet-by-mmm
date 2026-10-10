import React from 'react';
import { CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { ToastMessage } from '../types';

interface ToastProps {
  toasts: ToastMessage[];
}

export const Toast: React.FC<ToastProps> = ({ toasts }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2.5 pointer-events-none items-center max-w-sm w-full px-4"
    >
      {toasts.map((toast) => {
        const isError = /error|failed|incorrect|denied|blocked/i.test(toast.text);
        const isSuccess = /copied|created|scheduled|unmuted|muted|joined|started|switched/i.test(toast.text);

        return (
          <div
            key={toast.id}
            className="w-full bg-[#0b1020]/95 dark:bg-[#151b30]/95 backdrop-blur-md text-white px-4 py-3 rounded-xl text-xs md:text-sm font-medium shadow-2xl border border-white/10 pointer-events-auto flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200"
          >
            {isError ? (
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            ) : isSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            )}
            <span className="flex-1 leading-snug break-words">{toast.text}</span>
          </div>
        );
      })}
    </div>
  );
};

