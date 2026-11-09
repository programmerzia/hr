import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Invoice, InvoiceStatus, InvoiceType } from '../../types';
import { 
  FileText, Plus, CheckCircle2, Clock, DollarSign, 
  Printer, X, ArrowUpRight, ShieldCheck, Building2, 
  Activity, Sparkles, Send, Check, Receipt, User, 
  Coins, Filter, Search, ChevronRight 
} from 'lucide-react';

export const InvoicingView: React.FC = () => {
  const { 
    invoices, 
    updateInvoiceStatus, 
    createInvoiceFromProject, 
    createInternalVoucher,
    verifyVoucherTL,
    approveVoucherFinance,
    activeInvoiceModal, 
    setActiveInvoiceModal,
    currentRole,
    currentUser 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'client' | 'internal'>('client');
  const [showCreateClientModal, setShowCreateClientModal] = useState<boolean>(false);
  const [showCreateVoucherModal, setShowCreateVoucherModal] = useState<boolean>(false);

  // Client form
  const [clientName, setClientName] = useState<string>('Apex Telematics Global Ltd');
  const [projectName, setProjectName] = useState<string>('Fleet Telemetry & Real-Time Tracking Engine');
  const [billableHours, setBillableHours] = useState<number>(140);
  const [hourlyRate, setHourlyRate] = useState<number>(45);

  // Voucher form
  const [voucherProject, setVoucherProject] = useState<string>('Vivacom Pulse Core Infrastructure');
  const [voucherCategory, setVoucherCategory] = useState<any>('Hardware/Software');
  const [voucherAmount, setVoucherAmount] = useState<number>(15000);
  const [voucherNotes, setVoucherNotes] = useState<string>('Monthly AWS and Cloudflare production hosting charges.');

  const clientInvoices = invoices.filter(i => i.type === 'client_invoice');
  const internalVouchers = invoices.filter(i => i.type === 'internal_voucher');

  const totalClientBilled = clientInvoices.reduce((acc, curr) => acc + curr.total, 0);
  const totalInternalVouchers = internalVouchers.reduce((acc, curr) => acc + curr.total, 0);

  const handleCreateClientInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    createInvoiceFromProject(projectName, clientName, Number(billableHours), Number(hourlyRate));
    setShowCreateClientModal(false);
  };

  const handleCreateVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    createInternalVoucher({
      projectName: voucherProject,
      voucherCategory,
      subtotal: Number(voucherAmount),
      total: Number(voucherAmount),
      notes: voucherNotes,
    });
    setShowCreateVoucherModal(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-500 dark:text-brand-400" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Invoicing & Internal Expense Vouchers
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Dual purpose engine: Commercial client billing (T&M / Milestones) and internal staff expense reimbursements
          </p>
        </div>

        {/* Action Button based on Tab */}
        <div className="flex items-center gap-2">
          {activeTab === 'client' ? (
            <button
              onClick={() => setShowCreateClientModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Client Invoice</span>
            </button>
          ) : (
            <button
              onClick={() => setShowCreateVoucherModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Receipt className="w-4 h-4" />
              <span>Claim Expense Voucher</span>
            </button>
          )}
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('client')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'client'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Commercial Client Invoices ({clientInvoices.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('internal')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'internal'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Internal Employee Vouchers & Claims ({internalVouchers.length})</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Total Client Invoiced (USD)</div>
          <div className="text-2xl font-mono font-black text-slate-900 dark:text-white mt-2">
            ${totalClientBilled.toLocaleString()}
          </div>
          <div className="text-[10px] text-brand-600 dark:text-brand-400 mt-0.5">Time & Material developer sync</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Internal Vouchers Claimed (BDT)</div>
          <div className="text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400 mt-2">
            ৳ {totalInternalVouchers.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-300 mt-0.5">Cloud hosting & team expenses</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Disbursal Verification Status</div>
          <div className="text-2xl font-mono font-black text-purple-600 dark:text-purple-400 mt-2">
            Audited
          </div>
          <div className="text-[10px] text-purple-600 dark:text-purple-300 mt-0.5">2-Tier verification (TL → Finance)</div>
        </div>
      </div>

      {/* TAB 1: CLIENT INVOICES */}
      {activeTab === 'client' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Commercial Client Invoices (T&M and Milestones)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Directly synchronized with developer production hours</p>
            </div>
            <span className="text-xs text-brand-600 dark:text-brand-300 font-mono font-bold">External Accounts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Invoice #</th>
                  <th className="p-3.5">Client</th>
                  <th className="p-3.5">Project Scope</th>
                  <th className="p-3.5">Due Date</th>
                  <th className="p-3.5">Total Amount</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {clientInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-brand-600 dark:text-brand-400">{inv.invoiceNumber}</td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900 dark:text-white">{inv.clientName}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-xs">{inv.clientEmail}</div>
                    </td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300 font-medium">{inv.projectName}</td>
                    <td className="p-3.5 font-mono text-slate-500 dark:text-slate-400">{inv.dueDate}</td>
                    <td className="p-3.5 font-mono font-black text-slate-900 dark:text-white text-sm">
                      {inv.currency === 'USD' ? '$' : '€'}{inv.total.toLocaleString()}
                    </td>
                    <td className="p-3.5">
                      {inv.status === 'paid' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30">
                          Paid
                        </span>
                      )}
                      {inv.status === 'sent' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30">
                          Sent
                        </span>
                      )}
                      {inv.status === 'draft' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30">
                          Draft
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

      {/* TAB 2: INTERNAL EMPLOYEE VOUCHERS & CLAIMS */}
      {activeTab === 'internal' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Internal Staff Expense Vouchers & Reimbursements</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Reimbursement claims for servers, hardware, client lunches and tools</p>
            </div>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold">Internal Accounts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Voucher #</th>
                  <th className="p-3.5">Claimant Staff</th>
                  <th className="p-3.5">Expense Purpose</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Amount (BDT)</th>
                  <th className="p-3.5">Approval Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {internalVouchers.map((vch) => (
                  <tr key={vch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">{vch.invoiceNumber}</td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <img src={vch.claimantAvatar} alt="" className="w-6 h-6 rounded-md object-cover" />
                        <span className="font-semibold text-slate-900 dark:text-white">{vch.claimantEmployeeName}</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300 max-w-xs truncate">{vch.notes}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent">
                        {vch.voucherCategory}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono font-black text-slate-900 dark:text-white text-sm">
                      ৳ {vch.total.toLocaleString()}
                    </td>
                    <td className="p-3.5">
                      {vch.status === 'submitted' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30">
                          Pending TL Verification
                        </span>
                      )}
                      {vch.status === 'verified_tl' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30">
                          Pending Finance Approval
                        </span>
                      )}
                      {vch.status === 'approved' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30">
                          Approved for Payout
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {vch.status === 'submitted' && (currentRole === 'team_lead' || currentRole === 'management') && (
                          <button
                            onClick={() => verifyVoucherTL(vch.id)}
                            className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] shadow-sm"
                          >
                            TL Verify
                          </button>
                        )}
                        {vch.status === 'verified_tl' && (currentRole === 'hr' || currentRole === 'management') && (
                          <button
                            onClick={() => approveVoucherFinance(vch.id)}
                            className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow-sm"
                          >
                            Approve
                          </button>
                        )}
                        <button
                          onClick={() => setActiveInvoiceModal(vch)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-transparent font-semibold text-[11px] transition-all"
                        >
                          Voucher
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

      {/* CREATE CLIENT INVOICE MODAL */}
      {showCreateClientModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Generate Client Invoice</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Pull verified developer production hours into billable invoice</p>

            <form onSubmit={handleCreateClientInvoice} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Client Name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Project Scope</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Billable Hours</label>
                  <input
                    type="number"
                    value={billableHours}
                    onChange={(e) => setBillableHours(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Rate ($/hr)</label>
                  <input
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
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
                  className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold shadow-lg shadow-brand-500/25"
                >
                  Generate Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE INTERNAL VOUCHER MODAL */}
      {showCreateVoucherModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Submit Expense Voucher / Claim</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Claim reimbursement for cloud hosting, hardware, or project expenses</p>

            <form onSubmit={handleCreateVoucher} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Associated Project</label>
                <input
                  type="text"
                  value={voucherProject}
                  onChange={(e) => setVoucherProject(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Expense Category</label>
                  <select
                    value={voucherCategory}
                    onChange={(e) => setVoucherCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="Hardware/Software">Hardware / Cloud Hosting</option>
                    <option value="Reimbursement">General Reimbursement</option>
                    <option value="Contractor Payout">Contractor Milestone</option>
                    <option value="Client Entertainment">Team Working Refreshment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Amount (BDT)</label>
                  <input
                    type="number"
                    value={voucherAmount}
                    onChange={(e) => setVoucherAmount(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Description & Receipt Note</label>
                <textarea
                  value={voucherNotes}
                  onChange={(e) => setVoucherNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateVoucherModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/25"
                >
                  Submit for Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL & PRINT MODAL */}
      {activeInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-3xl w-full max-h-[95vh] overflow-y-auto shadow-2xl flex flex-col my-auto">
            
            <div className="no-print p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white/95 dark:bg-slate-900/90 sticky top-0 z-10 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 px-2.5 py-1 rounded-lg border border-brand-200 dark:border-brand-500/20">
                  {activeInvoiceModal.invoiceNumber}
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  Type: <strong className="text-slate-900 dark:text-white uppercase">{activeInvoiceModal.type.replace('_', ' ')}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md"
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

            {/* PRINTABLE BODY */}
            <div className="p-6 sm:p-8 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 print-only">
              <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-xl font-black text-slate-900 dark:text-white">VIVACOM TECHNOLOGIES LTD</h1>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Gulshan-2, Dhaka-1212, Bangladesh • accounts@vivacom.com
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold block">
                    {activeInvoiceModal.type === 'client_invoice' ? 'Commercial Invoice' : 'Internal Expense Voucher'}
                  </span>
                  <span className="text-lg font-mono font-bold text-brand-600 dark:text-brand-400 block mt-0.5">
                    {activeInvoiceModal.invoiceNumber}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5 font-mono">
                    Issue Date: {activeInvoiceModal.issueDate}
                  </span>
                </div>
              </div>

              {/* Entity info */}
              <div className="py-5 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                    {activeInvoiceModal.type === 'client_invoice' ? 'Billed To Client' : 'Claimant Employee'}
                  </span>
                  <strong className="text-slate-900 dark:text-white text-sm block mt-1">
                    {activeInvoiceModal.type === 'client_invoice' ? activeInvoiceModal.clientName : activeInvoiceModal.claimantEmployeeName}
                  </strong>
                  <span className="text-slate-500 dark:text-slate-400 block mt-0.5 font-mono">
                    {activeInvoiceModal.type === 'client_invoice' ? activeInvoiceModal.clientEmail : `Purpose: ${activeInvoiceModal.voucherCategory}`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Project Reference</span>
                  <strong className="text-slate-800 dark:text-slate-200 text-xs block mt-1">{activeInvoiceModal.projectName}</strong>
                  <span className="text-slate-500 dark:text-slate-400 block mt-1 font-mono">Status: {activeInvoiceModal.status.toUpperCase()}</span>
                </div>
              </div>

              {/* Items */}
              <div className="py-5 border-b border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Item Description</th>
                      <th className="p-3 text-right">Units / Qty</th>
                      <th className="p-3 text-right">Rate</th>
                      <th className="p-3 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                    {activeInvoiceModal.items.map((item) => (
                      <tr key={item.id}>
                        <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{item.description}</td>
                        <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">{item.quantityHours}</td>
                        <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">
                          {activeInvoiceModal.currency === 'USD' ? '$' : '৳ '}{item.unitRate.toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {activeInvoiceModal.currency === 'USD' ? '$' : '৳ '}{item.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total */}
              <div className="py-5 flex justify-end text-xs">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-base font-black text-emerald-600 dark:text-emerald-400">
                    <span>Total Payable:</span>
                    <span className="font-mono">
                      {activeInvoiceModal.currency === 'USD' ? '$' : '৳ '}{activeInvoiceModal.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 flex justify-between text-center text-xs text-slate-500 dark:text-slate-400">
                <div className="w-40 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <span className="font-semibold text-slate-800 dark:text-slate-300 block">Verified Signatory</span>
                  <span className="text-[10px] text-slate-500">Project / Team Lead</span>
                </div>
                <div className="w-40 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <span className="font-semibold text-slate-800 dark:text-slate-300 block">Finance Approval</span>
                  <span className="text-[10px] text-slate-500">Authorized Comptroller</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
