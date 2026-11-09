import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Invoice, InvoiceStatus, InvoiceType } from '../../types';
import { 
  FileText, Plus, CheckCircle2, Clock, Printer, X, 
  Building2, Activity, Sparkles, Send, Check, User, 
  Coins, Filter, Search, ChevronRight, ArrowUpRight,
  ShieldCheck, Banknote, Calendar, ArrowRight, AlertCircle,
  Briefcase, CheckSquare, Download
} from 'lucide-react';

export const InvoicingView: React.FC = () => {
  const { 
    invoices, 
    updateInvoiceStatus, 
    submitSalaryInvoice,
    createClientProjectInvoice,
    verifySalaryInvoiceTL,
    approveSalaryInvoiceManagement,
    disburseInvoice,
    activeInvoiceModal, 
    setActiveInvoiceModal,
    currentRole,
    currentUser,
    myAttendance,
    addToast
  } = useApp();

  const [activeTab, setActiveTab] = useState<'salary' | 'client'>('salary');
  const [showCreateClientModal, setShowCreateClientModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Client form state
  const [clientName, setClientName] = useState<string>('Apex Telematics Global Ltd');
  const [clientEmail, setClientEmail] = useState<string>('billing@apextelematics.com');
  const [projectName, setProjectName] = useState<string>('Fleet Telemetry & Real-Time Tracking Engine');
  const [billingPeriod, setBillingPeriod] = useState<string>('November 2026 Retainer');
  const [clientAmount, setClientAmount] = useState<number>(14700);
  const [clientCurrency, setClientCurrency] = useState<'USD' | 'EUR' | 'BDT'>('USD');
  const [clientScope, setClientScope] = useState<string>('Dedicated 4-engineer engineering team sprint retainer: Geo-fence WebSockets, MQTT vehicle telemetry engine.');

  const salaryInvoices = invoices.filter(i => i.type === 'employee_salary');
  const clientInvoices = invoices.filter(i => i.type === 'client_project');

  const filteredSalaryInvoices = salaryInvoices.filter(inv => {
    const matchesSearch = (inv.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           inv.designation?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredClientInvoices = clientInvoices.filter(inv => {
    const matchesSearch = (inv.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           inv.projectName?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalSalaryClaimed = salaryInvoices.reduce((acc, curr) => acc + (curr.netPayable || curr.total), 0);
  const totalClientBilled = clientInvoices.reduce((acc, curr) => acc + curr.total, 0);
  const totalVerifiedHours = salaryInvoices.reduce((acc, curr) => acc + (curr.productionHours || 0), 0);

  const formatBDT = (amount: number) => '৳ ' + amount.toLocaleString('en-US');

  const handleCreateClientInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    createClientProjectInvoice(
      clientName,
      clientEmail,
      projectName,
      billingPeriod,
      Number(clientAmount),
      clientCurrency,
      clientScope
    );
    setShowCreateClientModal(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Invoicing & Compensation Hub
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Staff monthly salary claims & commercial client project retainers. Reconciled directly with verified production hours.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button based on tab */}
        <div className="flex items-center gap-2">
          {activeTab === 'salary' ? (
            <button
              onClick={() => submitSalaryInvoice('November 2026')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Generate My Salary Invoice</span>
            </button>
          ) : (
            <button
              onClick={() => setShowCreateClientModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Client Project Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('salary')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'salary'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Staff Salary Invoices ({salaryInvoices.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('client')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'client'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Commercial Client Invoices ({clientInvoices.length})</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium">Billing Engine:</span>
          <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
            Biometric Production Hours Sync
          </span>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Total Staff Salary Invoiced (BDT)</div>
          <div className="text-2xl font-mono font-black text-slate-900 dark:text-white mt-2">
            {formatBDT(totalSalaryClaimed)}
          </div>
          <div className="text-[10px] text-brand-600 dark:text-brand-400 mt-0.5">Across {salaryInvoices.length} team engineers</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Verified Production Hours Billed</div>
          <div className="text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {totalVerifiedHours} hrs
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-300 mt-0.5">Direct attendance clock synchronization</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Commercial Client Retainers (USD)</div>
          <div className="text-2xl font-mono font-black text-purple-600 dark:text-purple-400 mt-2">
            ${totalClientBilled.toLocaleString()}
          </div>
          <div className="text-[10px] text-purple-600 dark:text-purple-300 mt-0.5">External project milestone accounts</div>
        </div>
      </div>

      {/* EMPLOYEE READY-TO-BILL HERO CARD (For Staff tab) */}
      {activeTab === 'salary' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-brand-50/80 via-white to-brand-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-brand-950/30 border border-brand-200 dark:border-brand-500/30 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-600 text-white uppercase tracking-wider">
                Current Employee
              </span>
              <strong className="text-sm text-slate-900 dark:text-white font-bold">{currentUser.name}</strong>
              <span className="text-xs text-slate-500 dark:text-slate-400">({currentUser.designation})</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Your attendance log shows <strong>184 Verified Production Hours</strong> for November 2026. 
              Base package: <strong>{formatBDT(currentUser.salary?.grossMonthly || 120000)}</strong> + Overtime: <strong>৳ 8,180</strong>.
            </p>
          </div>

          <button
            onClick={() => submitSalaryInvoice('November 2026')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-sm transition-all shrink-0"
          >
            <span>Submit November Salary Invoice</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder={activeTab === 'salary' ? 'Search employee or invoice number...' : 'Search client or project...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 font-bold focus:outline-none shadow-sm"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="verified_tl">TL Verified</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid / Disbursed</option>
          </select>
        </div>
      </div>

      {/* TAB 1: EMPLOYEE SALARY INVOICES */}
      {activeTab === 'salary' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Staff Monthly Salary Invoices</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Engineering compensation claims billed to Vivacom based on attendance production hours</p>
            </div>
            <span className="text-xs text-brand-600 dark:text-brand-300 font-mono font-bold">Internal Compensation</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Invoice #</th>
                  <th className="p-3.5">Employee / Engineer</th>
                  <th className="p-3.5">Billing Month</th>
                  <th className="p-3.5">Verified Hours</th>
                  <th className="p-3.5">Base Package</th>
                  <th className="p-3.5">Overtime / Adj.</th>
                  <th className="p-3.5">Net Claim</th>
                  <th className="p-3.5">Approval Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {filteredSalaryInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-brand-600 dark:text-brand-400">
                      {inv.invoiceNumber}
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <img src={inv.employeeAvatar} alt="" className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">{inv.employeeName}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{inv.designation}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-medium text-slate-700 dark:text-slate-300">
                      {inv.billingMonth}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {inv.productionHours}h <span className="text-slate-400 font-normal">/ {inv.standardHours}h</span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300">
                      {formatBDT(inv.baseSalary || 0)}
                    </td>
                    <td className="p-3.5 font-mono text-purple-600 dark:text-purple-400 font-semibold">
                      {(inv.overtimePay || 0) > 0 ? `+${formatBDT(inv.overtimePay || 0)}` : (inv.deductions || 0) > 0 ? `-${formatBDT(inv.deductions || 0)}` : '--'}
                    </td>
                    <td className="p-3.5 font-mono font-black text-slate-900 dark:text-white text-sm">
                      {formatBDT(inv.netPayable || inv.total)}
                    </td>
                    <td className="p-3.5">
                      {inv.status === 'paid' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30 flex items-center gap-1 w-fit">
                          <Check className="w-2.5 h-2.5" /> Disbursed
                        </span>
                      )}
                      {inv.status === 'approved' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30">
                          Approved for Wire
                        </span>
                      )}
                      {inv.status === 'verified_tl' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30">
                          TL Verified
                        </span>
                      )}
                      {inv.status === 'submitted' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30">
                          Pending TL Check
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {inv.status === 'submitted' && (currentRole === 'team_lead' || currentRole === 'management') && (
                          <button
                            onClick={() => verifySalaryInvoiceTL(inv.id)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] shadow-sm transition-all"
                          >
                            Verify Hours
                          </button>
                        )}
                        {inv.status === 'verified_tl' && (currentRole === 'hr' || currentRole === 'management') && (
                          <button
                            onClick={() => approveSalaryInvoiceManagement(inv.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow-sm transition-all"
                          >
                            Approve
                          </button>
                        )}
                        {inv.status === 'approved' && (currentRole === 'hr' || currentRole === 'management') && (
                          <button
                            onClick={() => disburseInvoice(inv.id)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] shadow-sm transition-all"
                          >
                            Disburse
                          </button>
                        )}
                        <button
                          onClick={() => setActiveInvoiceModal(inv)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-transparent font-semibold text-[11px] transition-all"
                        >
                          View Document
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: COMMERCIAL CLIENT PROJECT INVOICES */}
      {activeTab === 'client' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Commercial Client Invoices (Retainers & Milestones)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">External accounts billed for dedicated Vivacom engineering scopes</p>
            </div>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold">External Accounts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Invoice #</th>
                  <th className="p-3.5">Client Organization</th>
                  <th className="p-3.5">Project Scope / Deliverable</th>
                  <th className="p-3.5">Billing Period</th>
                  <th className="p-3.5">Due Date</th>
                  <th className="p-3.5">Invoice Amount</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {filteredClientInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {inv.invoiceNumber}
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900 dark:text-white">{inv.clientName}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-xs">{inv.clientEmail}</div>
                    </td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300 font-medium max-w-xs truncate">
                      {inv.projectName}
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-400">
                      {inv.billingPeriod}
                    </td>
                    <td className="p-3.5 font-mono text-slate-500 dark:text-slate-400">
                      {inv.dueDate}
                    </td>
                    <td className="p-3.5 font-mono font-black text-slate-900 dark:text-white text-sm">
                      {inv.currency === 'USD' ? '$' : inv.currency === 'EUR' ? '€' : '৳ '}{inv.total.toLocaleString()}
                    </td>
                    <td className="p-3.5">
                      {inv.status === 'paid' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30">
                          Paid in Full
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30">
                          Sent / Awaiting Wire
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setActiveInvoiceModal(inv)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-transparent font-semibold text-[11px] transition-all"
                      >
                        View & Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE CLIENT INVOICE MODAL */}
      {showCreateClientModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Create Commercial Client Invoice</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Invoice external client companies for monthly retainers or project milestones</p>

            <form onSubmit={handleCreateClientInvoice} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Client Company Name</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Client Accounts Email</label>
                <input
                  type="email"
                  required
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Currency</label>
                  <select
                    value={clientCurrency}
                    onChange={(e) => setClientCurrency(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="BDT">BDT (৳)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Total Retainer Amount</label>
                  <input
                    type="number"
                    required
                    value={clientAmount}
                    onChange={(e) => setClientAmount(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Scope & Deliverables Description</label>
                <textarea
                  rows={2}
                  value={clientScope}
                  onChange={(e) => setClientScope(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateClientModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm"
                >
                  Generate Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL & PRINT MODAL (CLEAN EXECUTIVE SERVICE INVOICE WITHOUT CLUMSY ITEMS) */}
      {activeInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-3xl w-full max-h-[95vh] overflow-y-auto shadow-2xl flex flex-col my-auto">
            
            {/* Top Bar Controls */}
            <div className="no-print p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white/95 dark:bg-slate-900/90 sticky top-0 z-10 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 px-2.5 py-1 rounded-lg border border-brand-200 dark:border-brand-500/20">
                  {activeInvoiceModal.invoiceNumber}
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {activeInvoiceModal.type === 'employee_salary' ? (
                    <span>Employee Monthly Salary Claim: <strong className="text-slate-900 dark:text-white">{activeInvoiceModal.employeeName}</strong></span>
                  ) : (
                    <span>Commercial Client Invoice: <strong className="text-slate-900 dark:text-white">{activeInvoiceModal.clientName}</strong></span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md transition-all"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setActiveInvoiceModal(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PRINTABLE DOCUMENT BODY */}
            <div className="p-6 sm:p-8 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 print-only">
              
              {/* Document Header */}
              <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      VIVACOM TECHNOLOGIES LTD
                    </h1>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Level 12, Vivacom Tower, Gulshan-2, Dhaka-1212, Bangladesh<br />
                    TIN: 8829-4102-4910 • BIN: 002910481-0101 • accounts@vivacom.com
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold block">
                    {activeInvoiceModal.type === 'employee_salary' ? 'Monthly Salary Service Invoice' : 'Commercial Client Retainer'}
                  </span>
                  <span className="text-lg font-mono font-bold text-brand-600 dark:text-brand-400 block mt-0.5">
                    {activeInvoiceModal.invoiceNumber}
                  </span>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30 uppercase">
                    Status: {activeInvoiceModal.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Parties Details Grid */}
              <div className="py-5 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-6 text-xs">
                {activeInvoiceModal.type === 'employee_salary' ? (
                  <>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        Service Provider (Staff Member)
                      </span>
                      <strong className="text-slate-900 dark:text-white text-sm block mt-1">
                        {activeInvoiceModal.employeeName}
                      </strong>
                      <span className="text-slate-600 dark:text-slate-300 block mt-0.5 font-medium">
                        {activeInvoiceModal.designation} • {activeInvoiceModal.department}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 block mt-0.5 font-mono">
                        Employee ID: {activeInvoiceModal.employeeId?.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        Billed To
                      </span>
                      <strong className="text-slate-900 dark:text-white text-sm block mt-1">
                        Vivacom Technologies Ltd
                      </strong>
                      <span className="text-slate-600 dark:text-slate-300 block mt-0.5">
                        Attn: People Operations & Payroll Dept
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 block mt-0.5">
                        Gulshan-2, Dhaka-1212
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        Billed To Client
                      </span>
                      <strong className="text-slate-900 dark:text-white text-sm block mt-1">
                        {activeInvoiceModal.clientName}
                      </strong>
                      <span className="text-slate-600 dark:text-slate-300 block mt-0.5">
                        {activeInvoiceModal.clientEmail}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 block mt-0.5">
                        {activeInvoiceModal.clientAddress}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        Project & Retainer Period
                      </span>
                      <strong className="text-slate-900 dark:text-white text-sm block mt-1">
                        {activeInvoiceModal.projectName}
                      </strong>
                      <span className="text-slate-600 dark:text-slate-300 block mt-0.5">
                        {activeInvoiceModal.billingPeriod}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 block mt-0.5 font-mono">
                        Due Date: {activeInvoiceModal.dueDate}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* EXECUTIVE SERVICE SUMMARY (NO RETAIL ITEMS TABLE) */}
              {activeInvoiceModal.type === 'employee_salary' ? (
                <div className="py-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                    Verified Production & Monthly Compensation Breakdown
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] block">Billing Cycle</span>
                      <strong className="text-slate-900 dark:text-white text-xs block mt-1">{activeInvoiceModal.billingMonth}</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] block">Required Standard</span>
                      <strong className="text-slate-900 dark:text-white text-xs font-mono block mt-1">{activeInvoiceModal.standardHours}h 00m</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30">
                      <span className="text-emerald-700 dark:text-emerald-400 text-[10px] block font-bold">Verified Production</span>
                      <strong className="text-emerald-800 dark:text-emerald-300 text-xs font-mono font-black block mt-1">{activeInvoiceModal.productionHours}h 00m</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-500/30">
                      <span className="text-purple-700 dark:text-purple-400 text-[10px] block font-bold">Tracked Overtime</span>
                      <strong className="text-purple-800 dark:text-purple-300 text-xs font-mono font-black block mt-1">+{activeInvoiceModal.overtimeHours || 0}h 00m</strong>
                    </div>
                  </div>

                  {/* Summary Rows */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                    <div className="flex justify-between text-slate-700 dark:text-slate-300">
                      <span>Gross Monthly Base Salary Package:</span>
                      <span className="font-mono font-semibold">{formatBDT(activeInvoiceModal.baseSalary || 0)}</span>
                    </div>
                    {(activeInvoiceModal.overtimePay || 0) > 0 && (
                      <div className="flex justify-between text-purple-700 dark:text-purple-400 font-semibold">
                        <span>Overtime Compensation ({activeInvoiceModal.overtimeHours}h @ 1.5x Multiplier):</span>
                        <span className="font-mono">+{formatBDT(activeInvoiceModal.overtimePay || 0)}</span>
                      </div>
                    )}
                    {(activeInvoiceModal.deductions || 0) > 0 && (
                      <div className="flex justify-between text-rose-600 dark:text-rose-400 font-semibold">
                        <span>Attendance Shortfall / Leave Adjustments:</span>
                        <span className="font-mono">-{formatBDT(activeInvoiceModal.deductions || 0)}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between text-slate-900 dark:text-white font-bold text-sm">
                      <span>Total Net Salary Invoice Claim:</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black">
                        {formatBDT(activeInvoiceModal.netPayable || activeInvoiceModal.total)}
                      </span>
                    </div>
                  </div>

                  {/* Bank Wire Details */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block tracking-wider mb-1">
                      Bank Wire Disbursal Instructions
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-700 dark:text-slate-300">
                      <div>Bank: <strong>{activeInvoiceModal.bankName}</strong></div>
                      <div>A/C: <strong className="font-mono">{activeInvoiceModal.accountNumber}</strong></div>
                      <div>Routing: <strong className="font-mono">{activeInvoiceModal.routingNumber}</strong></div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Client Project Summary */
                <div className="py-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Project Scope & Professional Engineering Deliverables
                  </h3>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    <p className="font-medium text-slate-900 dark:text-white mb-1">Deliverable Scope:</p>
                    <p>{activeInvoiceModal.scopeDescription}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">Total Agreed Project Retainer:</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">Payment terms: Net 20 Days via SWIFT Wire</span>
                    </div>
                    <span className="text-2xl font-mono font-black text-emerald-700 dark:text-emerald-400">
                      {activeInvoiceModal.currency === 'USD' ? '$' : activeInvoiceModal.currency === 'EUR' ? '€' : '৳ '}
                      {activeInvoiceModal.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Two-Tier Verification & Approval Trail */}
              <div className="pt-6 grid grid-cols-2 gap-8 text-xs text-slate-600 dark:text-slate-400">
                <div className="p-3.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase block text-slate-500 dark:text-slate-400 mb-1">
                    1. Team Lead Verification
                  </span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {activeInvoiceModal.tlVerifiedBy || 'Pending TL Hours Verification'}
                  </p>
                  {activeInvoiceModal.tlVerifiedAt && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono block mt-0.5">
                      ✓ Certified at {activeInvoiceModal.tlVerifiedAt}
                    </span>
                  )}
                </div>

                <div className="p-3.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase block text-slate-500 dark:text-slate-400 mb-1">
                    2. Management & Finance Authorization
                  </span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {activeInvoiceModal.managementApprovedBy || (activeInvoiceModal.status === 'paid' ? 'Authorized Comptroller' : 'Pending Finance Approval')}
                  </p>
                  {activeInvoiceModal.paidAt && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono block mt-0.5">
                      ✓ Wire Disbursed on {activeInvoiceModal.paidAt}
                    </span>
                  )}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
