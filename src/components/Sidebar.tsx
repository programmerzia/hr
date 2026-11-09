import React from 'react';
import { useApp } from '../context/AppContext';
import { LeaveRequest, AttendanceDay } from '../types';
import { 
  Timer, Radio, KanbanSquare, CalendarDays, 
  CreditCard, FileText, CheckCircle, Flame, 
  Users, AlertCircle, Receipt 
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    currentRole, 
    tasks, 
    leaves, 
    teamAttendance,
    employees,
    invoices 
  } = useApp();

  const pendingLeavesCount = leaves.filter((l: LeaveRequest) => 
    currentRole === 'team_lead' ? l.status === 'pending_tl' : 
    currentRole === 'hr' || currentRole === 'management' ? l.status === 'pending_hr' : false
  ).length;

  const activeEmployeesCount = teamAttendance.filter((t: AttendanceDay) => t.status === 'active').length;
  const onBreakCount = teamAttendance.filter((t: AttendanceDay) => t.status === 'on_break').length;

  const navItems = [
    {
      id: 'attendance',
      label: 'My Workbench',
      badge: 'Live',
      badgeColor: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30',
      icon: Timer,
      desc: 'Punch In, Break & Production Clock'
    },
    {
      id: 'radar',
      label: 'Live Team Radar',
      badge: `${activeEmployeesCount} Active`,
      badgeColor: 'bg-brand-500/10 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-500/30',
      icon: Radio,
      desc: 'Real-time Status & Shift History'
    },
    {
      id: 'kanban',
      label: 'Projects & Tasks',
      badge: `${tasks.length}`,
      badgeColor: 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30',
      icon: KanbanSquare,
      desc: 'Agile Kanban with SC Attach Dock'
    },
    {
      id: 'employees',
      label: 'Staff & Onboarding',
      badge: `${employees.length} Staff`,
      badgeColor: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30',
      icon: Users,
      desc: 'Directory, Salaries & New Hire Wizard'
    },
    {
      id: 'leaves',
      label: 'Leave Management',
      badge: pendingLeavesCount > 0 ? `${pendingLeavesCount} Req` : undefined,
      badgeColor: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30',
      icon: CalendarDays,
      desc: '2-Tier Approvals & Quota Ledger'
    },
    {
      id: 'payroll',
      label: 'Payroll Processing',
      badge: 'Nov 2026',
      badgeColor: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30',
      icon: CreditCard,
      desc: 'Hours-to-Pay, Deductions & Payslips'
    },
    {
      id: 'invoicing',
      label: 'Billing & Vouchers',
      badge: `${invoices.length}`,
      badgeColor: 'bg-teal-500/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30',
      icon: Receipt,
      desc: 'Client Invoicing & Internal Claims'
    }
  ];

  return (
    <aside className="w-64 lg:w-72 border-r border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/60 flex flex-col justify-between p-3 shrink-0 hidden md:flex transition-colors">
      {/* Top Nav List */}
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>Enterprise Modules</span>
          <span className="text-[10px] text-brand-600 dark:text-brand-400 font-bold">Vivacom OS</span>
        </div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all group ${
                isActive
                  ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-lg shadow-brand-500/20 font-semibold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-1.5 rounded-lg transition-colors ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{item.label}</div>
                  <div className={`text-[10px] truncate ${isActive ? 'text-brand-100' : 'text-slate-500 dark:text-slate-500'}`}>
                    {item.desc}
                  </div>
                </div>
              </div>

              {item.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-white/20 text-white border border-white/30' : item.badgeColor
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Live Floor Radar */}
      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 shadow-sm">
        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-300 mb-2">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            <span>Floor Radar</span>
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Live Sync</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="bg-white dark:bg-slate-900/80 p-2 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">{activeEmployeesCount}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Active Working</div>
          </div>
          <div className="bg-white dark:bg-slate-900/80 p-2 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
            <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">{onBreakCount}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">On Break</div>
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between font-medium">
          <span>Auto-Break Grace:</span>
          <span className="font-mono text-slate-700 dark:text-slate-300">10m Inactivity</span>
        </div>
      </div>
    </aside>
  );
};
