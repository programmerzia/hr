import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Employee } from '../../types';
import { OnboardEmployeeModal } from './OnboardEmployeeModal';
import { EmployeeDetailDrawer } from './EmployeeDetailDrawer';
import { 
  Users, UserPlus, Search, Filter, Building2, 
  CreditCard, ShieldCheck, Laptop, ArrowUpRight, 
  CheckCircle2, Clock, Sparkles 
} from 'lucide-react';

export const EmployeeManagementView: React.FC = () => {
  const { employees, selectedEmployeeProfile, setSelectedEmployeeProfile, currentRole } = useApp();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [showOnboardModal, setShowOnboardModal] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.designation.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = deptFilter === 'all' || emp.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  const totalMonthlyPayroll = employees.reduce((acc, curr) => acc + curr.salary.grossMonthly, 0);

  const departments = ['Engineering', 'Quality Assurance', 'Infrastructure', 'Human Resources', 'Executive Board'];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Employee Management & Onboarding Hub
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Staff directory, salary package configurations, bank routing, hardware assets & onboarding pipeline
          </p>
        </div>

        <button
          onClick={() => setShowOnboardModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-500/20 transition-all self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Onboard New Employee</span>
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Total Staff Headcount</div>
          <div className="text-2xl font-mono font-black text-slate-900 dark:text-white mt-2">
            {employees.length} Engineers
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">100% active operational</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Monthly Payroll Exposure</div>
          <div className="text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400 mt-2">
            ৳ {totalMonthlyPayroll.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Base salary commitment</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Average Billable Rate</div>
          <div className="text-2xl font-mono font-black text-purple-600 dark:text-purple-400 mt-2">
            $37 / hr
          </div>
          <div className="text-[10px] text-purple-600 dark:text-purple-300 mt-0.5">For client project invoicing</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Onboarding Pipeline</div>
          <div className="text-2xl font-mono font-black text-brand-600 dark:text-brand-400 mt-2">
            Streamlined
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Automated asset & role sync</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, ID or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-brand-500 font-medium"
          >
            <option value="all">All Departments</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl self-end sm:self-auto text-xs">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all ${
              viewMode === 'grid' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Card Grid
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all ${
              viewMode === 'table' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Table View
          </button>
        </div>
      </div>

      {/* EMPLOYEE CARDS GRID VIEW */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => (
            <div
              key={emp.id}
              className="bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img src={emp.avatar} alt="" className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{emp.name}</h4>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{emp.designation}</div>
                      <span className="text-[10px] font-mono text-brand-600 dark:text-brand-400 font-semibold">{emp.employeeId}</span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                    {emp.status}
                  </span>
                </div>

                {/* Compensation Banner */}
                <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-semibold">Monthly Salary</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      ৳ {emp.salary.grossMonthly.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block font-semibold">Billable Rate</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      ${emp.salary.hourlyRate}/hr
                    </span>
                  </div>
                </div>

                {/* Department & Supervisor */}
                <div className="mt-3 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Department:</span>
                    <span className="text-slate-800 dark:text-slate-300 font-medium">{emp.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Supervisor:</span>
                    <span className="text-slate-800 dark:text-slate-300 font-medium">{emp.supervisorName}</span>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  Joined: {emp.joiningDate}
                </span>

                <button
                  onClick={() => setSelectedEmployeeProfile(emp)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-transparent text-xs font-semibold flex items-center gap-1 transition-all"
                >
                  <span>Profile & Salary</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Employee</th>
                  <th className="p-3.5">ID</th>
                  <th className="p-3.5">Department</th>
                  <th className="p-3.5">Gross Salary (BDT)</th>
                  <th className="p-3.5">Hourly Rate</th>
                  <th className="p-3.5">Supervisor</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/60">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <img src={emp.avatar} alt="" className="w-7 h-7 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white block">{emp.name}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">{emp.designation}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-brand-600 dark:text-brand-400 font-bold">{emp.employeeId}</td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300">{emp.department}</td>
                    <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      ৳ {emp.salary.grossMonthly.toLocaleString()}
                    </td>
                    <td className="p-3.5 font-mono text-slate-900 dark:text-white">${emp.salary.hourlyRate}/h</td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300">{emp.supervisorName}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                        {emp.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setSelectedEmployeeProfile(emp)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-transparent font-semibold text-[11px]"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Onboard Wizard Modal */}
      {showOnboardModal && (
        <OnboardEmployeeModal onClose={() => setShowOnboardModal(false)} />
      )}

      {/* Profile & Salary Drawer */}
      {selectedEmployeeProfile && (
        <EmployeeDetailDrawer
          employee={selectedEmployeeProfile}
          onClose={() => setSelectedEmployeeProfile(null)}
        />
      )}
    </div>
  );
};
