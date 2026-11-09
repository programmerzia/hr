import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PayrollRecord } from '../../types';
import { PayslipModal } from './PayslipModal';
import { 
  CreditCard, CheckCircle2, Clock, FileText, ArrowUpRight, 
  Download, ShieldCheck, Sparkles, Building2, AlertCircle, 
  Send, Check, Banknote 
} from 'lucide-react';

export const PayrollManagementView: React.FC = () => {
  const { 
    payroll, 
    currentRole, 
    approvePayroll, 
    disburseAllPayroll,
    activePayslipModal, 
    setActivePayslipModal,
    addToast 
  } = useApp();

  const [selectedMonth, setSelectedMonth] = useState<string>('November 2026');

  const totalPayrollBudget = payroll.reduce((acc, curr) => acc + curr.netPayable, 0);
  const totalProductionHours = payroll.reduce((acc, curr) => acc + curr.actualProductionHours, 0);
  const totalOvertimeHours = payroll.reduce((acc, curr) => acc + curr.overtimeHours, 0);
  const totalTaxDeductions = payroll.reduce((acc, curr) => acc + curr.taxDeduction, 0);

  const formatBDT = (amount: number) => {
    return '৳ ' + amount.toLocaleString('en-US');
  };

  const handleExportCSV = () => {
    addToast('BEFTN Bank Statement Exported', 'Downloaded bank disbursal routing CSV for City Bank & BRAC Bank.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-brand-500 dark:text-brand-400" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              HR Payroll & Salary Disbursal Engine
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Production hour-driven salary reconciliation, overtime allowances, deductions, and automated BEFTN bank batch
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-semibold transition-all"
          >
            <Download className="w-4 h-4 text-brand-500 dark:text-brand-400" />
            <span>Bank CSV</span>
          </button>

          {(currentRole === 'hr' || currentRole === 'management') && (
            <button
              onClick={disburseAllPayroll}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Banknote className="w-4 h-4" />
              <span>Disburse Batch</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Total Disbursable Net</div>
          <div className="text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {formatBDT(totalPayrollBudget)}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Across {payroll.length} verified staff</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Verified Production Hours</div>
          <div className="text-2xl font-mono font-black text-slate-900 dark:text-white mt-2">
            {totalProductionHours} hrs
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Direct attendance sync</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Total Tracked Overtime</div>
          <div className="text-2xl font-mono font-black text-purple-600 dark:text-purple-400 mt-2">
            +{totalOvertimeHours} hrs
          </div>
          <div className="text-[10px] text-purple-600 dark:text-purple-300 mt-0.5">1.5x hourly multiplier applied</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Total TDS Tax Withheld</div>
          <div className="text-2xl font-mono font-black text-rose-600 dark:text-rose-400 mt-2">
            {formatBDT(totalTaxDeductions)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">National Board of Revenue (NBR)</div>
        </div>
      </div>

      {/* Payroll Records Ledger */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Monthly Salary Reconciliation Sheet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Net hours = Gross shift minus break lapses. Shortfall deducted.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Cycle:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-white font-bold focus:outline-none"
            >
              <option value="November 2026">November 2026</option>
              <option value="October 2026">October 2026</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3.5">Staff Member</th>
                <th className="p-3.5">Base Gross</th>
                <th className="p-3.5">Production Hrs</th>
                <th className="p-3.5">Breaks Deducted</th>
                <th className="p-3.5">Overtime Pay</th>
                <th className="p-3.5">Deductions</th>
                <th className="p-3.5">Net Payable</th>
                <th className="p-3.5">Disbursal</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {payroll.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="p-3.5">
                    <div className="flex items-center gap-2.5">
                      <img src={rec.userAvatar} alt="" className="w-8 h-8 rounded-lg object-cover" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">{rec.userName}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{rec.designation}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300">{formatBDT(rec.baseSalary)}</td>
                  <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {rec.actualProductionHours}h <span className="text-slate-400 dark:text-slate-500 font-normal">/ {rec.standardHours}h</span>
                  </td>
                  <td className="p-3.5 font-mono text-amber-600 dark:text-amber-400 font-semibold">{rec.totalBreakHours}h</td>
                  <td className="p-3.5 font-mono text-purple-600 dark:text-purple-400 font-semibold">
                    {rec.overtimeHours > 0 ? `+${formatBDT(rec.overtimePay)}` : '--'}
                  </td>
                  <td className="p-3.5 font-mono text-rose-600 dark:text-rose-400">
                    {rec.totalDeductions > 0 ? `-${formatBDT(rec.totalDeductions)}` : '৳ 0'}
                  </td>
                  <td className="p-3.5 font-mono font-black text-slate-900 dark:text-white text-sm">
                    {formatBDT(rec.netPayable)}
                  </td>
                  <td className="p-3.5">
                    {rec.paymentStatus === 'paid' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30 flex items-center gap-1 w-fit">
                        <Check className="w-2.5 h-2.5" /> Paid (Wire)
                      </span>
                    ) : rec.paymentStatus === 'approved' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30">
                        Certified
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30">
                        Draft Audit
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {rec.paymentStatus === 'draft' && (currentRole === 'hr' || currentRole === 'management') && (
                        <button
                          onClick={() => approvePayroll(rec.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] transition-all shadow-sm"
                        >
                          Certify
                        </button>
                      )}
                      <button
                        onClick={() => setActivePayslipModal(rec)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-transparent font-semibold text-[10px] flex items-center gap-1 transition-all"
                      >
                        <FileText className="w-3 h-3 text-brand-500 dark:text-brand-400" />
                        <span>Payslip</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Payslip Modal */}
      {activePayslipModal && (
        <PayslipModal
          record={activePayslipModal}
          onClose={() => setActivePayslipModal(null)}
        />
      )}
    </div>
  );
};
