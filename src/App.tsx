import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LoginView } from './components/auth/LoginView';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { EmployeeAttendanceWidget } from './components/attendance/EmployeeAttendanceWidget';
import { TeamRadarView } from './components/attendance/TeamRadarView';
import { KanbanBoardView } from './components/kanban/KanbanBoardView';
import { EmployeeManagementView } from './components/employees/EmployeeManagementView';
import { LeaveManagementView } from './components/leaves/LeaveManagementView';
import { PayrollManagementView } from './components/payroll/PayrollManagementView';
import { InvoicingView } from './components/invoicing/InvoicingView';
import { ToastContainer } from './components/common/ToastContainer';
import { Timer, Radio, KanbanSquare, CalendarDays, CreditCard, FileText, Users, Receipt } from 'lucide-react';

const MainContent: React.FC = () => {
  const { isAuthenticated, activeTab, setActiveTab } = useApp();

  if (!isAuthenticated) {
    return (
      <>
        <LoginView />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 transition-colors">
      <Header />

      <div className="flex flex-1 min-h-[calc(100vh-4rem)]">
        <Sidebar />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full pb-20 md:pb-8">
          {activeTab === 'attendance' && <EmployeeAttendanceWidget />}
          {activeTab === 'radar' && <TeamRadarView />}
          {activeTab === 'kanban' && <KanbanBoardView />}
          {activeTab === 'employees' && <EmployeeManagementView />}
          {activeTab === 'leaves' && <LeaveManagementView />}
          {activeTab === 'payroll' && <PayrollManagementView />}
          {activeTab === 'invoicing' && <InvoicingView />}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (PWA Experience) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 z-40 shadow-lg">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex flex-col items-center justify-center py-1 px-2 text-[10px] font-bold ${
            activeTab === 'attendance' ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Timer className="w-5 h-5 mb-0.5" />
          <span>Clock</span>
        </button>

        <button
          onClick={() => setActiveTab('radar')}
          className={`flex flex-col items-center justify-center py-1 px-2 text-[10px] font-bold ${
            activeTab === 'radar' ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Radio className="w-5 h-5 mb-0.5" />
          <span>Radar</span>
        </button>

        <button
          onClick={() => setActiveTab('kanban')}
          className={`flex flex-col items-center justify-center py-1 px-2 text-[10px] font-bold ${
            activeTab === 'kanban' ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <KanbanSquare className="w-5 h-5 mb-0.5" />
          <span>Tasks</span>
        </button>

        <button
          onClick={() => setActiveTab('employees')}
          className={`flex flex-col items-center justify-center py-1 px-2 text-[10px] font-bold ${
            activeTab === 'employees' ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span>Staff</span>
        </button>

        <button
          onClick={() => setActiveTab('payroll')}
          className={`flex flex-col items-center justify-center py-1 px-2 text-[10px] font-bold ${
            activeTab === 'payroll' ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <CreditCard className="w-5 h-5 mb-0.5" />
          <span>Pay</span>
        </button>

        <button
          onClick={() => setActiveTab('invoicing')}
          className={`flex flex-col items-center justify-center py-1 px-2 text-[10px] font-bold ${
            activeTab === 'invoicing' ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Receipt className="w-5 h-5 mb-0.5" />
          <span>Billing</span>
        </button>
      </nav>

      <ToastContainer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
};

export default App;
