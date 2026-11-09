import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Employee, PersonaRole, SalaryStructure } from '../../types';
import { 
  X, UserPlus, CheckCircle2, Building2, CreditCard, 
  Laptop, ShieldCheck, ArrowRight, ArrowLeft, Sparkles 
} from 'lucide-react';

interface OnboardEmployeeModalProps {
  onClose: () => void;
}

export const OnboardEmployeeModal: React.FC<OnboardEmployeeModalProps> = ({ onClose }) => {
  const { addEmployee } = useApp();
  const [step, setStep] = useState<number>(1);

  // Form State
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [nid, setNid] = useState<string>('');
  const [designation, setDesignation] = useState<string>('Full-Stack Software Engineer');
  const [department, setDepartment] = useState<string>('Engineering');
  const [role, setRole] = useState<PersonaRole>('employee');
  const [supervisorName, setSupervisorName] = useState<string>('Tanvir Hossain');
  const [employmentType, setEmploymentType] = useState<'Full-Time' | 'Contractor' | 'Intern'>('Full-Time');
  const [joiningDate, setJoiningDate] = useState<string>('2026-11-15');

  // Salary
  const [grossSalary, setGrossSalary] = useState<number>(100000);
  const [bankName, setBankName] = useState<string>('City Bank Ltd');
  const [accountNumber, setAccountNumber] = useState<string>('1102938475612');

  // Assets
  const [assets, setAssets] = useState<string[]>(['MacBook Pro M3 14"', 'Slack Access', 'GitHub Organization Access']);

  const computedBasic = Math.round(grossSalary * 0.5);
  const computedHRA = Math.round(grossSalary * 0.25);
  const computedMedical = Math.round(grossSalary * 0.1);
  const computedConveyance = Math.round(grossSalary * 0.05);
  const computedPF = Math.round(grossSalary * 0.05);
  const computedTax = Math.round(grossSalary * 0.05);
  const hourlyRate = Math.round(grossSalary / 176);

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addEmployee({
      name,
      email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@vivacom.com`,
      phone: phone || '+880 1700-112233',
      nid: nid || '19951234567890123',
      designation,
      department,
      role,
      supervisorName,
      employmentType,
      joiningDate,
      salary: {
        grossMonthly: grossSalary,
        basic: computedBasic,
        houseRent: computedHRA,
        medical: computedMedical,
        conveyance: computedConveyance,
        providentFund: computedPF,
        taxDeduction: computedTax,
        hourlyRate,
      },
      bankDetails: {
        bankName,
        accountName: name,
        accountNumber,
        routingNumber: '090273819',
        branch: 'Gulshan Branch'
      },
      assets,
      assignedProjects: ['Vivacom Pulse Core'],
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-auto">
        
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Onboard New Vivacom Employee</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Step {step} of 3: {
                step === 1 ? 'Personal & Identification' :
                step === 2 ? 'Role & Organization' : 'Compensation, Salary & Bank'
              }</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 my-5">
          {[1, 2, 3].map((s) => (
            <div 
              key={s} 
              className={`h-1.5 flex-1 rounded-full transition-all ${
                s <= step ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* STEP 1: Personal Info */}
        {step === 1 && (
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Full Legal Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Shakil Mahmud"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Company Email</label>
                <input
                  type="email"
                  placeholder="name@vivacom.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Contact Phone</label>
                <input
                  type="text"
                  placeholder="+880 1711-000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">National ID (NID) / Passport No</label>
              <input
                type="text"
                placeholder="19952692837102949"
                value={nid}
                onChange={(e) => setNid(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!name) setName('Shakil Mahmud');
                  setStep(2);
                }}
                className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm"
              >
                <span>Continue to Role Setup</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Role & Department */}
        {step === 2 && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Quality Assurance">Quality Assurance</option>
                  <option value="Product & Design">Product & Design</option>
                  <option value="Infrastructure">Infrastructure / DevOps</option>
                  <option value="Human Resources">Human Resources</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Designation</label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Supervisor / Team Lead</label>
                <select
                  value={supervisorName}
                  onChange={(e) => setSupervisorName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="Tanvir Hossain">Tanvir Hossain (Engineering Lead)</option>
                  <option value="Tariqul Islam">Tariqul Islam (CTO)</option>
                  <option value="Nasrin Akter">Nasrin Akter (HR Head)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Employment Type</label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="Full-Time">Full-Time (Permanent)</option>
                  <option value="Contractor">Contractor (Hourly / Billable)</option>
                  <option value="Intern">Intern (Paid)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Joining Date</label>
              <input
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm"
              >
                <span>Continue to Salary & Bank</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Compensation & Bank Details */}
        {step === 3 && (
          <form onSubmit={handleFinish} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Monthly Gross Salary (BDT)
              </label>
              <input
                type="number"
                required
                value={grossSalary}
                onChange={(e) => setGrossSalary(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold text-sm focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Automated Salary Breakdown Grid */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 block tracking-wider">
                Automated Salary Component Breakdown (BDT)
              </span>
              <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-slate-500 text-[10px] block">Basic (50%)</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold">৳ {computedBasic.toLocaleString()}</span>
                </div>
                <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-slate-500 text-[10px] block">House Rent (25%)</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold">৳ {computedHRA.toLocaleString()}</span>
                </div>
                <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-slate-500 text-[10px] block">Medical (10%)</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold">৳ {computedMedical.toLocaleString()}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] font-mono pt-1">
                <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-slate-500 text-[10px] block">Conveyance (5%)</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold">৳ {computedConveyance.toLocaleString()}</span>
                </div>
                <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-slate-500 text-[10px] block">Provident Fund (5%)</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold">৳ {computedPF.toLocaleString()}</span>
                </div>
                <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/30">
                  <span className="text-emerald-700 dark:text-emerald-400 text-[10px] block font-bold">Hourly Rate ($)</span>
                  <span className="text-emerald-800 dark:text-emerald-300 font-black">${hourlyRate}/hr</span>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Disbursement Bank</label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="City Bank Ltd">City Bank Ltd</option>
                  <option value="BRAC Bank PLC">BRAC Bank PLC</option>
                  <option value="Dutch-Bangla Bank">Dutch-Bangla Bank</option>
                  <option value="Eastern Bank Ltd">Eastern Bank Ltd</option>
                  <option value="Standard Chartered">Standard Chartered</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Bank Account Number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
              >
                Back
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-xl shadow-emerald-500/25 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Complete Onboarding & Provision Staff</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
