import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Employee, SalaryStructure } from '../../types';
import { 
  X, Mail, Phone, Shield, Building2, CreditCard, 
  Laptop, CheckCircle2, Calendar, Edit3, Save, DollarSign 
} from 'lucide-react';

interface EmployeeDetailDrawerProps {
  employee: Employee;
  onClose: () => void;
}

export const EmployeeDetailDrawer: React.FC<EmployeeDetailDrawerProps> = ({ employee, onClose }) => {
  const { updateEmployeeSalary, currentRole } = useApp();
  const [isEditingSalary, setIsEditingSalary] = useState<boolean>(false);
  const [grossInput, setGrossInput] = useState<number>(employee.salary.grossMonthly);

  const canEditSalary = currentRole === 'hr' || currentRole === 'management';

  const handleSaveSalary = () => {
    const computedBasic = Math.round(grossInput * 0.5);
    const computedHRA = Math.round(grossInput * 0.25);
    const computedMedical = Math.round(grossInput * 0.1);
    const computedConveyance = Math.round(grossInput * 0.05);
    const computedPF = Math.round(grossInput * 0.05);
    const computedTax = Math.round(grossInput * 0.05);
    const hourly = Math.round(grossInput / 176);

    const newSal: SalaryStructure = {
      grossMonthly: grossInput,
      basic: computedBasic,
      houseRent: computedHRA,
      medical: computedMedical,
      conveyance: computedConveyance,
      providentFund: computedPF,
      taxDeduction: computedTax,
      hourlyRate: hourly,
    };

    updateEmployeeSalary(employee.id, newSal);
    setIsEditingSalary(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-end">
      <div className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full max-w-xl h-full overflow-y-auto shadow-2xl p-6 sm:p-8 flex flex-col justify-between animate-in slide-in-from-right duration-200">
        
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <img src={employee.avatar} alt="" className="w-14 h-14 rounded-2xl object-cover border-2 border-brand-500/40 shadow-md" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">{employee.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-transparent">
                    {employee.employeeId}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{employee.designation}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-500/30">
                    {employee.status}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {employee.employmentType}
                  </span>
                </div>
              </div>
            </div>

            <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contact Details */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 text-[10px] block font-semibold">Email</span>
              <span className="text-slate-800 dark:text-slate-200 font-mono truncate block">{employee.email}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block font-semibold">Phone</span>
              <span className="text-slate-800 dark:text-slate-200 font-mono">{employee.phone}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block font-semibold">Department</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium">{employee.department}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block font-semibold">Supervisor</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium">{employee.supervisorName}</span>
            </div>
          </div>

          {/* SALARY & COMPENSATION SECTION */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Salary & Compensation Package
                </h4>
              </div>

              {canEditSalary && !isEditingSalary && (
                <button
                  onClick={() => setIsEditingSalary(true)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Adjust Package</span>
                </button>
              )}
            </div>

            {isEditingSalary ? (
              <div className="space-y-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-brand-400 dark:border-brand-500/40 text-xs shadow-sm">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Gross Monthly Salary (BDT)
                  </label>
                  <input
                    type="number"
                    value={grossInput}
                    onChange={(e) => setGrossInput(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsEditingSalary(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSalary}
                    className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Adjustment</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-baseline justify-between p-3.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Monthly Gross Salary</span>
                  <span className="text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                    ৳ {employee.salary.grossMonthly.toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Hourly Billable Rate</span>
                  <span className="text-lg font-mono font-bold text-slate-900 dark:text-white">
                    ${employee.salary.hourlyRate} / hr
                  </span>
                </div>
              </div>
            )}

            {/* Breakdown Grid */}
            <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-2xs">
                <span className="text-slate-500 text-[10px] block">Basic</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">৳ {employee.salary.basic.toLocaleString()}</span>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-2xs">
                <span className="text-slate-500 text-[10px] block">House Rent</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">৳ {employee.salary.houseRent.toLocaleString()}</span>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-2xs">
                <span className="text-slate-500 text-[10px] block">Medical</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">৳ {employee.salary.medical.toLocaleString()}</span>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-2xs">
                <span className="text-slate-500 text-[10px] block">Conveyance</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">৳ {employee.salary.conveyance.toLocaleString()}</span>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-2xs">
                <span className="text-slate-500 text-[10px] block">Provident Fund</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">৳ {employee.salary.providentFund.toLocaleString()}</span>
              </div>
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/20 text-center">
                <span className="text-rose-600 dark:text-rose-400 text-[10px] block font-bold">Tax (TDS)</span>
                <span className="text-rose-700 dark:text-rose-300 font-bold">৳ {employee.salary.taxDeduction.toLocaleString()}</span>
              </div>
            </div>

            {/* Bank Routing Details */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 text-xs">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Disbursement Bank Account</span>
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-mono">
                <span>{employee.bankDetails.bankName}</span>
                <span className="text-slate-900 dark:text-white font-bold">{employee.bankDetails.accountNumber}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {employee.bankDetails.branch} • Routing: {employee.bankDetails.routingNumber}
              </div>
            </div>
          </div>

          {/* Assigned Hardware & Assets */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <h4 className="font-bold text-slate-900 dark:text-white uppercase text-xs tracking-wider">
                Assigned Company Assets ({employee.assets.length})
              </h4>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {employee.assets.map(asset => (
                <span key={asset} className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-[11px] shadow-2xs">
                  {asset}
                </span>
              ))}
            </div>
          </div>

          {/* Assigned Projects */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Active Projects Allocated</span>
            <div className="flex flex-wrap gap-1.5">
              {employee.assignedProjects.map(proj => (
                <span key={proj} className="px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/20 text-[11px] font-bold">
                  {proj}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
          >
            Close Employee Profile
          </button>
        </div>

      </div>
    </div>
  );
};
