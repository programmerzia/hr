import React from 'react';
import { PayrollRecord } from '../../types';
import { 
  X, Printer, Download, CheckCircle2, Building2, 
  Clock, ShieldCheck, Activity 
} from 'lucide-react';

interface PayslipModalProps {
  record: PayrollRecord;
  onClose: () => void;
}

export const PayslipModal: React.FC<PayslipModalProps> = ({ record, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const formatBDT = (amount: number) => {
    return '৳ ' + amount.toLocaleString('en-US');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-3xl w-full max-h-[95vh] overflow-y-auto shadow-2xl flex flex-col my-auto">
        
        {/* Top Controls (Hidden in Print) */}
        <div className="no-print p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white/95 dark:bg-slate-900/90 sticky top-0 z-10 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 px-2.5 py-1 rounded-lg border border-brand-200 dark:border-brand-500/20">
              PAYSLIP // {record.month}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              Certified for <strong className="text-slate-900 dark:text-white">{record.userName}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE PAYSLIP DOCUMENT BODY */}
        <div className="p-6 sm:p-8 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 print-only">
          
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">VIVACOM TECHNOLOGIES</h1>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Level 12, Vivacom Tower, Gulshan-2, Dhaka-1212, Bangladesh<br />
                Registration No: VIVA-BD-2018-84291 • TIN: 8829-4102-4910
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold block">
                Official Salary Payslip
              </span>
              <span className="text-lg font-mono font-bold text-brand-600 dark:text-brand-400 block mt-0.5">
                {record.month}
              </span>
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30 uppercase">
                Status: {record.paymentStatus}
              </span>
            </div>
          </div>

          {/* Employee Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 border-b border-slate-200 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-semibold">Employee Name</span>
              <strong className="text-slate-900 dark:text-white text-sm">{record.userName}</strong>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-semibold">Designation</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">{record.designation}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-semibold">Department</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">{record.department}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-semibold">Bank Disbursal Ref</span>
              <span className="text-slate-700 dark:text-slate-300 font-mono font-medium">{record.bankAccountRef}</span>
            </div>
          </div>

          {/* ATTENDANCE & PRODUCTION HOURS BREAKDOWN TABLE */}
          <div className="py-5 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-bold text-brand-600 dark:text-brand-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Verified Production & Break Time Audit
            </h3>

            <div className="grid grid-cols-4 gap-3 text-center text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 text-[10px] block">Standard Required</span>
                <strong className="text-slate-800 dark:text-slate-200 text-sm font-mono mt-1 block">{record.standardHours}h 00m</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-amber-600 dark:text-amber-400 text-[10px] block">Total Breaks Deducted</span>
                <strong className="text-amber-600 dark:text-amber-400 text-sm font-mono mt-1 block">{record.totalBreakHours}h 00m</strong>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-500/30">
                <span className="text-emerald-700 dark:text-emerald-400 text-[10px] block font-bold">Net Production Hours</span>
                <strong className="text-emerald-800 dark:text-emerald-300 text-sm font-mono mt-1 block font-black">{record.actualProductionHours}h 00m</strong>
              </div>
              <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 dark:bg-purple-950/40 dark:border-purple-500/30">
                <span className="text-purple-700 dark:text-purple-400 text-[10px] block font-bold">Overtime Hours</span>
                <strong className="text-purple-800 dark:text-purple-300 text-sm font-mono mt-1 block font-black">+{record.overtimeHours}h 00m</strong>
              </div>
            </div>
          </div>

          {/* EARNINGS VS DEDUCTIONS TABLE */}
          <div className="py-5 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs border-b border-slate-200 dark:border-slate-800">
            
            {/* Earnings */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200 dark:border-slate-800 flex justify-between">
                <span>Earnings Component</span>
                <span>Amount (BDT)</span>
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Monthly Base Salary</span>
                  <span className="font-mono font-semibold">{formatBDT(record.baseSalary)}</span>
                </div>
                <div className="flex justify-between text-purple-600 dark:text-purple-400 font-semibold">
                  <span>Overtime Pay ({record.overtimeHours}h @ 1.5x)</span>
                  <span className="font-mono">+{formatBDT(record.overtimePay)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>Production Performance Bonus</span>
                  <span className="font-mono">+{formatBDT(record.performanceBonus)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold">
                  <span>Gross Earnings</span>
                  <span className="font-mono">{formatBDT(record.grossEarnings)}</span>
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200 dark:border-slate-800 flex justify-between">
                <span>Deductions Component</span>
                <span>Amount (BDT)</span>
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Unpaid Leave ({record.unpaidLeaveDays} Days)</span>
                  <span className="font-mono">-{formatBDT(record.unpaidLeaveDeduction)}</span>
                </div>
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Late Arrival Penalty (Lapses)</span>
                  <span className="font-mono">-{formatBDT(record.latePenaltyDeduction)}</span>
                </div>
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Income Tax (TDS Deduction)</span>
                  <span className="font-mono">-{formatBDT(record.taxDeduction)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-400 font-bold">
                  <span>Total Deductions</span>
                  <span className="font-mono">-{formatBDT(record.totalDeductions)}</span>
                </div>
              </div>
            </div>

          </div>

          {/* NET PAYABLE HERO ROW */}
          <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-emerald-50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-emerald-950/40 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 mt-4 shadow-sm">
            <div>
              <span className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-400 tracking-wider block">
                Net Disbursable Salary
              </span>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Direct wire deposit authorized into {record.bankAccountRef}
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-700 dark:text-emerald-300">
                {formatBDT(record.netPayable)}
              </span>
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-8 flex justify-between text-center text-xs text-slate-500 dark:text-slate-400">
            <div className="w-40 pt-4 border-t border-slate-200 dark:border-slate-800">
              <span className="font-semibold text-slate-800 dark:text-slate-300 block">Nasrin Akter</span>
              <span className="text-[10px] text-slate-500">HR & People Operations</span>
            </div>
            <div className="w-40 pt-4 border-t border-slate-200 dark:border-slate-800">
              <span className="font-semibold text-slate-800 dark:text-slate-300 block">Tariqul Islam</span>
              <span className="text-[10px] text-slate-500">Authorized Signatory</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
