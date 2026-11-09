import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { LeaveType } from '../../types';
import { 
  CalendarDays, Plus, CheckCircle2, Clock, AlertTriangle, 
  XCircle, User, ShieldCheck, Check, X 
} from 'lucide-react';

export const LeaveManagementView: React.FC = () => {
  const { 
    leaves, 
    currentRole, 
    currentUser, 
    submitLeaveRequest, 
    approveLeaveTL, 
    approveLeaveHR, 
    rejectLeave 
  } = useApp();

  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('Casual Leave');
  const [startDate, setStartDate] = useState<string>('2026-11-20');
  const [endDate, setEndDate] = useState<string>('2026-11-21');
  const [reason, setReason] = useState<string>('');

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    submitLeaveRequest(leaveType, startDate, endDate, reason);
    setReason('');
    setShowApplyModal(false);
  };

  const balances = [
    { type: 'Casual Leave (CL)', available: 10, total: 12, color: 'text-brand-400' },
    { type: 'Sick Leave (SL)', available: 13, total: 14, color: 'text-emerald-400' },
    { type: 'Annual Leave (AL)', available: 15, total: 20, color: 'text-amber-400' },
    { type: 'Leave Without Pay', available: 'Unlimited', total: '--', color: 'text-rose-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Leave & Vacation Management
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Two-tier approval workflow (Team Lead capacity check $\rightarrow$ HR attendance certification)
          </p>
        </div>

        <button
          onClick={() => setShowApplyModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-500/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Leave</span>
        </button>
      </div>

      {/* Leave Balances Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {balances.map((b) => (
          <div key={b.type} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
            <div className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold">{b.type}</div>
            <div className={`text-2xl font-mono font-black mt-2 ${b.color}`}>
              {b.available} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">/ {b.total}</span>
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Yearly quota balance</div>
          </div>
        ))}
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Leave Requests & Multi-Tier Approvals</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Team Lead checks sprint delivery; HR logs compliance</p>
          </div>
          <span className="text-xs text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/10 px-2.5 py-1 rounded-lg border border-brand-200 dark:border-brand-500/20 font-mono font-bold">Total {leaves.length} Applications</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3.5">Applicant</th>
                <th className="p-3.5">Leave Type</th>
                <th className="p-3.5">Date Span</th>
                <th className="p-3.5">Days</th>
                <th className="p-3.5">Reason</th>
                <th className="p-3.5">Workflow Status</th>
                <th className="p-3.5 text-right">Approval Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/60">
              {leaves.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="p-3.5">
                    <div className="flex items-center gap-2.5">
                      <img src={l.userAvatar} alt="" className="w-7 h-7 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">{l.userName}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{l.department}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 font-semibold text-slate-700 dark:text-slate-300">{l.type}</td>
                  <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300">
                    {l.startDate} <span className="text-slate-400 dark:text-slate-500">→</span> {l.endDate}
                  </td>
                  <td className="p-3.5 font-bold font-mono text-slate-800 dark:text-slate-200">{l.daysCount}d</td>
                  <td className="p-3.5 text-slate-600 dark:text-slate-400 max-w-xs truncate">{l.reason}</td>
                  <td className="p-3.5">
                    {l.status === 'pending_tl' && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 flex items-center gap-1 w-fit">
                        <Clock className="w-2.5 h-2.5" />
                        Stage 1: Pending TL
                      </span>
                    )}
                    {l.status === 'pending_hr' && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 flex items-center gap-1 w-fit">
                        <Clock className="w-2.5 h-2.5" />
                        Stage 2: Pending HR
                      </span>
                    )}
                    {l.status === 'approved' && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Fully Approved
                      </span>
                    )}
                    {l.status === 'rejected' && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 flex items-center gap-1 w-fit">
                        <XCircle className="w-2.5 h-2.5" />
                        Rejected
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-right">
                    {l.status === 'pending_tl' && (currentRole === 'team_lead' || currentRole === 'management') && (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => approveLeaveTL(l.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm"
                        >
                          <Check className="w-3 h-3" /> TL Recommend
                        </button>
                        <button
                          onClick={() => rejectLeave(l.id, 'Sprint deadline conflict')}
                          className="p-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-600/30 dark:hover:bg-rose-600/50 dark:text-rose-300"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {l.status === 'pending_hr' && (currentRole === 'hr' || currentRole === 'management') && (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => approveLeaveHR(l.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm"
                        >
                          <ShieldCheck className="w-3 h-3" /> Final Sign-off
                        </button>
                        <button
                          onClick={() => rejectLeave(l.id, 'Exceeds quota balance')}
                          className="p-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-600/30 dark:hover:bg-rose-600/50 dark:text-rose-300"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {l.status === 'approved' && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">Cal Synced</span>
                    )}

                    {l.status === 'rejected' && (
                      <span className="text-[11px] text-rose-600 dark:text-rose-400 font-mono font-medium">Declined</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Submit Leave Application</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Request will be routed to your Team Lead first</p>

            <form onSubmit={handleApply} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Leave Type</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="Casual Leave">Casual Leave (CL)</option>
                  <option value="Sick Leave">Sick Leave (SL)</option>
                  <option value="Annual Leave">Annual Leave (AL)</option>
                  <option value="Unpaid Leave">Unpaid Leave (LWP)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Reason for Absence</label>
                <textarea
                  value={reason}
                  required
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide context or handover arrangements..."
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold shadow-lg shadow-brand-500/25"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
