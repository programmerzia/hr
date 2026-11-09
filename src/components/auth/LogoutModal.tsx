import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Coffee, LogOut, Lock, X, AlertTriangle, 
  Clock, ArrowRight 
} from 'lucide-react';

export const LogoutModal: React.FC = () => {
  const { showLogoutModal, setShowLogoutModal, logout, myAttendance } = useApp();

  if (!showLogoutModal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 flex items-center justify-center">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Sign Out / Shift Control</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Select how to categorize your session departure</p>
            </div>
          </div>
          <button
            onClick={() => setShowLogoutModal(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Shift Summary Pill */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 mb-4 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <Clock className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            <span>Shift Started: {myAttendance.firstLoginTime || '09:00 AM'}</span>
          </div>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {Math.floor(myAttendance.productionSeconds / 3600)}h {Math.floor((myAttendance.productionSeconds % 3600) / 60)}m Net
          </span>
        </div>

        {/* Departure Options */}
        <div className="space-y-2.5 my-4">
          
          {/* Option 1: Break Mode */}
          <button
            onClick={() => logout('break')}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:border-amber-500/30 text-left transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center">
                <Coffee className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-amber-800 group-hover:text-amber-900 dark:text-amber-300 dark:group-hover:text-amber-200">
                  Take a Break / Step Out
                </div>
                <div className="text-[11px] text-amber-700/80 dark:text-slate-400">
                  Off-time lapse is counted as a break until you log back in
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Option 2: End Shift */}
          <button
            onClick={() => logout('end_shift')}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-rose-50/80 hover:bg-rose-100/80 border border-rose-200 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:border-rose-500/30 text-left transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 flex items-center justify-center">
                <LogOut className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-rose-800 group-hover:text-rose-900 dark:text-rose-300 dark:group-hover:text-rose-200">
                  End Shift & Finalize Day
                </div>
                <div className="text-[11px] text-rose-700/80 dark:text-slate-400">
                  Punches out and locks daily production hours for payroll
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-rose-600 dark:text-rose-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Option 3: Quick Sign Out */}
          <button
            onClick={() => logout('sign_out')}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-left transition-all text-xs text-slate-700 dark:text-slate-300"
          >
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span className="font-semibold">Lock Terminal / Quick Sign Out</span>
            </div>
          </button>

        </div>

        <button
          onClick={() => setShowLogoutModal(false)}
          className="w-full py-2 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-semibold transition-colors"
        >
          Cancel & Return to Workspace
        </button>
      </div>
    </div>
  );
};
