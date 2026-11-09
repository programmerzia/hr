import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto p-3.5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex items-start justify-between gap-3 animate-in slide-in-from-bottom-5 duration-200"
        >
          <div className="flex items-start gap-2.5">
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />}
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />}
            {t.type === 'error' && <XCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />}

            <div>
              <h5 className="text-xs font-bold text-white leading-tight">{t.title}</h5>
              {t.description && (
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{t.description}</p>
              )}
            </div>
          </div>

          <button
            onClick={() => dismissToast(t.id)}
            className="text-slate-500 hover:text-white p-0.5 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
