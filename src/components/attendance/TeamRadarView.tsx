import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Radio, Users, CheckCircle2, AlertCircle, Coffee, Clock, 
  Calendar, Check, X, ShieldAlert, ArrowUpRight, Search, 
  Sparkles, Filter, ChevronRight 
} from 'lucide-react';

export const TeamRadarView: React.FC = () => {
  const { teamAttendance, regularizeAttendance, currentRole, addToast } = useApp();
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'radar' | 'history'>('radar');
  const [selectedRecordForReg, setSelectedRecordForReg] = useState<any | null>(null);
  const [regReason, setRegReason] = useState<string>('Biometric terminal network timeout; verified on Slack');

  const formatSeconds = (sec: number = 0) => {
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  };

  const filteredTeam = teamAttendance.filter(item => {
    const matchesSearch = item.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.department.toLowerCase().includes(searchTerm.toLowerCase());
    if (filter === 'all') return matchesSearch;
    if (filter === 'active') return matchesSearch && item.status === 'active';
    if (filter === 'on_break') return matchesSearch && item.status === 'on_break';
    if (filter === 'absent') return matchesSearch && item.status === 'absent';
    return matchesSearch;
  });

  const activeCount = teamAttendance.filter(t => t.status === 'active').length;
  const breakCount = teamAttendance.filter(t => t.status === 'on_break').length;
  const absentCount = teamAttendance.filter(t => t.status === 'absent').length;
  const totalProductionSec = teamAttendance.reduce((acc, curr) => acc + curr.productionSeconds, 0);

  const handleApproveReg = () => {
    if (selectedRecordForReg) {
      regularizeAttendance(selectedRecordForReg.id, regReason);
      setSelectedRecordForReg(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Summary Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-brand-600 dark:text-brand-400 animate-pulse" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Team Lead Command Center & Live Radar
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time floor presence, live break tracking, shift history, and attendance regularization
          </p>
        </div>

        {/* View Switcher: Live Radar vs Shift History */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setActiveTab('radar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'radar'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Live Floor Radar
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Attendance Logs & Regularization
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>🟢 Working Active</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          </div>
          <div className="text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400 mt-2">{activeCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Contributing production</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>🟡 On Break</span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          </div>
          <div className="text-2xl font-mono font-black text-amber-600 dark:text-amber-400 mt-2">{breakCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Off-time lapse counting</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>🔴 Absent (Auto)</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
          </div>
          <div className="text-2xl font-mono font-black text-rose-600 dark:text-rose-400 mt-2">{absentCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Cutoff passed (11:00 AM)</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Total Team Production</span>
            <Clock className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
          </div>
          <div className="text-2xl font-mono font-black text-slate-900 dark:text-white mt-2">
            {formatSeconds(totalProductionSec)}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">58% of daily target</div>
        </div>
      </div>

      {activeTab === 'radar' ? (
        /* LIVE RADAR VIEW */
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-sm">
            {/* Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  filter === 'all'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                All Team ({teamAttendance.length})
              </button>
              <button
                onClick={() => setFilter('active')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  filter === 'active'
                    ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Active ({activeCount})
              </button>
              <button
                onClick={() => setFilter('on_break')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  filter === 'on_break'
                    ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                On Break ({breakCount})
              </button>
              <button
                onClick={() => setFilter('absent')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  filter === 'absent'
                    ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Absent ({absentCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search engineer or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Radar Member Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeam.map((member) => (
              <div
                key={member.id}
                className="bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top: Avatar, Name, Status Pill */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 relative shadow-sm">
                        <img src={member.userAvatar} alt={member.userName} className="w-full h-full object-cover" />
                        {member.status === 'active' && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                        )}
                        {member.status === 'on_break' && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-amber-500 rounded-full border-2 border-white dark:border-slate-900 animate-ping"></span>
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{member.userName}</h4>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">{member.department}</span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {member.status === 'active' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Active
                      </span>
                    )}
                    {member.status === 'on_break' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 flex items-center gap-1">
                        <Coffee className="w-2.5 h-2.5" />
                        Break: {Math.floor((member.currentBreakDurationSeconds || 0) / 60)}m
                      </span>
                    )}
                    {member.status === 'absent' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                        Absent
                      </span>
                    )}
                  </div>

                  {/* Active Task Tag */}
                  {member.currentTaskTitle && (
                    <div className="mt-3.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-[11px]">
                      <div className="text-[10px] text-slate-500 font-medium">Currently Working On:</div>
                      <div className="text-slate-800 dark:text-slate-200 font-semibold truncate mt-0.5">
                        {member.currentTaskTitle}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom: Production & Break Duration */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">First In:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{member.firstLoginTime || '--:--'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-medium">Total Breaks:</span>
                    <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold">{formatSeconds(member.breakSeconds)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">Net Production:</span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm">{formatSeconds(member.productionSeconds)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ATTENDANCE HISTORY & REGULARIZATION LOG */
        <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Attendance Audit & Dispute Regularization</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Shift timestamps, break deductions, and Team Lead regularization</p>
            </div>
            <span className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400">Date: 2026-11-10</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Employee</th>
                  <th className="p-3.5">First Login</th>
                  <th className="p-3.5">Gross Elapsed</th>
                  <th className="p-3.5">Total Breaks</th>
                  <th className="p-3.5">Net Production</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/60">
                {teamAttendance.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <img src={rec.userAvatar} alt="" className="w-7 h-7 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">{rec.userName}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{rec.department}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300">{rec.firstLoginTime || 'No Record'}</td>
                    <td className="p-3.5 font-mono text-slate-500 dark:text-slate-400">{formatSeconds(rec.grossSeconds)}</td>
                    <td className="p-3.5 font-mono text-amber-600 dark:text-amber-400 font-semibold">{formatSeconds(rec.breakSeconds)}</td>
                    <td className="p-3.5 font-mono text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                      {formatSeconds(rec.productionSeconds)}
                    </td>
                    <td className="p-3.5">
                      {rec.isRegularized ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30">
                          Regularized (TL)
                        </span>
                      ) : rec.status === 'absent' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
                          Absent (Auto)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                          Verified
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      {rec.status === 'absent' && !rec.isRegularized ? (
                        <button
                          onClick={() => setSelectedRecordForReg(rec)}
                          className="px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-[11px] transition-all shadow-sm"
                        >
                          Regularize
                        </button>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 text-[11px]">In Order</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Regularization Modal */}
      {selectedRecordForReg && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Approve Regularization</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Override absent penalty for {selectedRecordForReg.userName}</p>
              </div>
            </div>

            <div className="space-y-3 my-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Reason for Adjustment</label>
                <textarea
                  value={regReason}
                  onChange={(e) => setRegReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-brand-500"
                  rows={3}
                />
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                Approving this sets net production to standard 8h and removes absenteeism deduction from this month's payroll.
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setSelectedRecordForReg(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveReg}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-500/25"
              >
                Certify & Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
