import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BreakCategory } from '../../types';
import { 
  Play, Pause, LogOut, Coffee, Utensils, Zap, Clock, 
  CheckCircle, AlertTriangle, ArrowRight, Activity, 
  RotateCcw, ShieldCheck, ChevronRight, Sparkles 
} from 'lucide-react';

export const EmployeeAttendanceWidget: React.FC = () => {
  const { 
    myAttendance, 
    startShift, 
    takeBreak, 
    resumeShift, 
    endShift, 
    currentUser,
    tasks 
  } = useApp();

  const [showBreakModal, setShowBreakModal] = useState<boolean>(false);
  const [selectedBreakType, setSelectedBreakType] = useState<BreakCategory>('Lunch Break');

  const formatSeconds = (sec: number = 0) => {
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDurationText = (sec: number = 0) => {
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${sec % 60}s`;
  };

  const targetShiftSeconds = 8 * 3600; // 8 hours standard
  const productionPercent = Math.min(100, Math.round((myAttendance.productionSeconds / targetShiftSeconds) * 100));

  const handleConfirmBreak = () => {
    takeBreak(selectedBreakType);
    setShowBreakModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gradient-to-r dark:from-slate-900 dark:via-brand-950/40 dark:to-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Employee Attendance & Production Engine
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-500/10 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-500/30">
              State Machine v2.4
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            Logged in as <span className="font-bold text-slate-900 dark:text-white">{currentUser.name}</span> ({currentUser.designation})
          </p>
        </div>

        {/* Shift Date & Punctuality Tag */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-right">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">First Login Today</div>
            <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {myAttendance.firstLoginTime || 'Not Started'}
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-right">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Absence Cutoff</div>
            <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">11:00 AM</div>
          </div>
        </div>
      </div>

      {/* Hero Attendance State Machine Card */}
      <div className="glass-panel-elevated p-6 sm:p-8 rounded-3xl relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
        
        {/* Background Ambient Glow (Dark Mode only) */}
        <div className={`hidden dark:block absolute -right-20 -top-20 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          myAttendance.status === 'active' ? 'bg-emerald-500/10' :
          myAttendance.status === 'on_break' ? 'bg-amber-500/15' : 'bg-brand-500/10'
        }`}></div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          
          {/* Left Column: Big Circular Timer Display */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center text-center p-4">
            <div className="relative flex items-center justify-center">
              {/* Radial Progress Ring */}
              <svg className="w-56 h-56 transform -rotate-90">
                <circle
                  cx="112"
                  cy="112"
                  r="96"
                  stroke="currentColor"
                  strokeWidth="10"
                  className="text-slate-100 dark:text-slate-800/80"
                  fill="transparent"
                />
                <circle
                  cx="112"
                  cy="112"
                  r="96"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeDasharray={2 * Math.PI * 96}
                  strokeDashoffset={2 * Math.PI * 96 * (1 - productionPercent / 100)}
                  strokeLinecap="round"
                  className={`transition-all duration-1000 ${
                    myAttendance.status === 'on_break' ? 'text-amber-500' : 'text-emerald-500'
                  }`}
                  fill="transparent"
                />
              </svg>

              {/* Inside Timer (CRISP CONTRAST IN BOTH LIGHT AND DARK) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 mb-1">
                  {myAttendance.status === 'on_break' ? 'Off-Time (Break)' : 'Net Production'}
                </span>
                <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-950 dark:text-white">
                  {myAttendance.status === 'on_break'
                    ? formatSeconds(myAttendance.currentBreakDurationSeconds)
                    : formatSeconds(myAttendance.productionSeconds)}
                </span>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Target: 08:00:00 ({productionPercent}%)
                </span>
              </div>
            </div>

            {/* Current State Pill */}
            <div className="mt-4">
              {myAttendance.status === 'active' && (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-bold text-xs shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  🟢 Shift Active & Counting Production
                </div>
              )}
              {myAttendance.status === 'on_break' && (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 font-bold text-xs shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                  🟡 On Break (Lapse Interval Ticking)
                </div>
              )}
              {myAttendance.status === 'shift_not_started' && (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs">
                  ⚪ Shift Not Started (Will Mark Absent if &gt; 11:00 AM)
                </div>
              )}
              {myAttendance.status === 'shift_ended' && (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 text-indigo-800 dark:text-indigo-300 font-bold text-xs">
                  🏁 Shift Concluded for Today
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Key Action Controls & Live Formula */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Shift Controls</span>
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  (Automated break detection on logout / re-login)
                </span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Your login marks day start. When stepping away or logging out, your off-time lapse is accumulated into break hours, ensuring exact production pay.
              </p>
            </div>

            {/* Action Buttons based on State */}
            <div className="flex flex-wrap gap-3">
              {myAttendance.status === 'shift_not_started' && (
                <button
                  onClick={startShift}
                  className="flex-1 min-w-[200px] flex items-center justify-center gap-2.5 py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-500/25 transition-all transform active:scale-95"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Punch In / Start Day Shift</span>
                </button>
              )}

              {myAttendance.status === 'active' && (
                <>
                  <button
                    onClick={() => setShowBreakModal(true)}
                    className="flex-1 min-w-[160px] flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 font-bold text-xs sm:text-sm transition-all transform active:scale-95 shadow-sm"
                  >
                    <Coffee className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Take Break / Logout</span>
                  </button>

                  <button
                    onClick={endShift}
                    className="flex-1 min-w-[160px] flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold text-xs sm:text-sm transition-all transform active:scale-95 shadow-sm"
                  >
                    <LogOut className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                    <span>End Shift for Today</span>
                  </button>
                </>
              )}

              {myAttendance.status === 'on_break' && (
                <>
                  <button
                    onClick={resumeShift}
                    className="flex-1 min-w-[240px] flex items-center justify-center gap-2.5 py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm shadow-xl shadow-emerald-500/30 transition-all transform active:scale-95"
                  >
                    <RotateCcw className="w-5 h-5" />
                    <span>Re-Login / Resume Work</span>
                  </button>
                </>
              )}

              {myAttendance.status === 'shift_ended' && (
                <button
                  onClick={startShift}
                  className="flex-1 min-w-[200px] flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs sm:text-sm transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Resume / Start Overtime Shift</span>
                </button>
              )}
            </div>

            {/* Production Formula Visual Card (CRISP LIGHT & DARK CONTRAST) */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Real-Time Production Calculation Formula</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">Net = Gross - Breaks</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-sm">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Total Gross Time</div>
                  <div className="text-sm sm:text-base font-mono font-bold text-slate-900 dark:text-slate-200 mt-0.5">
                    {formatDurationText(myAttendance.grossSeconds)}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-sm">
                  <div className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">Total Breaks ({myAttendance.breaks.length})</div>
                  <div className="text-sm sm:text-base font-mono font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                    {formatDurationText(myAttendance.breakSeconds)}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/30 shadow-sm">
                  <div className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold">Net Production</div>
                  <div className="text-sm sm:text-base font-mono font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {formatDurationText(myAttendance.productionSeconds)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Break History Ledger & Linked Task Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Today's Break Ledger */}
        <div className="lg:col-span-7 glass-panel p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Coffee className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Today's Break & Lapse Ledger</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">All logout off-times counted as production deductions</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
              {formatDurationText(myAttendance.breakSeconds)} Total
            </span>
          </div>

          {myAttendance.breaks.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No breaks taken yet today. Continuous production recorded.
            </div>
          ) : (
            <div className="space-y-2">
              {myAttendance.breaks.map((b, idx) => (
                <div
                  key={b.id || idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 flex items-center justify-center font-bold">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-200">{b.category}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {b.startTime} → {b.endTime || 'Ongoing...'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                      {formatDurationText(b.durationSeconds)}
                    </span>
                    {b.reason && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[140px] truncate">{b.reason}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Currently Linked Task Card */}
        <div className="lg:col-span-5 glass-panel p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                Active Task Link
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/20">
                Billing Sync
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-mono text-brand-600 dark:text-brand-400 font-bold mb-1">
                VIVA-104 // Pulse Core
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                Attendance Break Lapses & Net Production Algorithm
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                Calculate net production seconds = gross time - total breaks. Auto-detect logout events.
              </p>

              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Time Billed to Task:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatDurationText(myAttendance.productionSeconds)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-500/20 text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
            <span>Time tracked here is directly credited into monthly Payroll & Client Invoices.</span>
          </div>
        </div>
      </div>

      {/* Break Selection Modal */}
      {showBreakModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Coffee className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Log Break / Step Out</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Select category for accurate HR compliance</p>
              </div>
            </div>

            <div className="space-y-2 my-4">
              {(['Lunch Break', 'Tea Break', 'Short Break', 'System Inactive', 'Official Step Out'] as BreakCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedBreakType(cat)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left text-xs font-semibold transition-all ${
                    selectedBreakType === cat
                      ? 'bg-amber-50 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/50 text-amber-900 dark:text-amber-300 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {cat === 'Lunch Break' ? <Utensils className="w-4 h-4 text-amber-600 dark:text-amber-400" /> : <Coffee className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                    <span>{cat}</span>
                  </div>
                  {selectedBreakType === cat && <CheckCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowBreakModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBreak}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/25 transition-all"
              >
                Start Break & Pause Timer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
