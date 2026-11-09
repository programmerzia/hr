import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { PersonaRole } from '../types';
import { LogoutModal } from './auth/LogoutModal';
import { 
  Clock, Shield, UserCheck, Bell, Smartphone, 
  ChevronDown, Activity, Sparkles, Laptop, CheckCircle2, 
  Sun, Moon, LogOut, CreditCard, User, RotateCcw 
} from 'lucide-react';

export const Header: React.FC = () => {
  const { 
    currentRole, 
    currentUser, 
    switchRole, 
    myAttendance, 
    addToast,
    theme,
    toggleTheme,
    setShowLogoutModal,
    setActiveTab
  } = useApp();

  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [showPersonaDropdown, setShowPersonaDropdown] = useState<boolean>(false);
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const [pwaInstalled, setPwaInstalled] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const roles: { role: PersonaRole; label: string; desc: string; icon: string }[] = [
    { role: 'employee', label: 'Rafiq Ahmed', desc: 'Senior Software Engineer (Employee View)', icon: '👨‍💻' },
    { role: 'team_lead', label: 'Tanvir Hossain', desc: 'Engineering Lead / PM (Team Radar & Kanban)', icon: '👨‍💼' },
    { role: 'hr', label: 'Nasrin Akter', desc: 'Head of People & HR (Payroll & Directory)', icon: '👩‍💼' },
    { role: 'management', label: 'Tariqul Islam', desc: 'CTO / Management (Executive Overview)', icon: '🏢' },
  ];

  const handlePwaInstall = () => {
    setPwaInstalled(true);
    addToast('PWA Installed Successfully', 'Vivacom Pulse is now installed to your desktop/homescreen. Offline sync enabled.', 'success');
  };

  const formatSeconds = (sec: number = 0) => {
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = () => {
    switch (myAttendance.status) {
      case 'active':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Active Shift ({formatSeconds(myAttendance.productionSeconds)})
          </span>
        );
      case 'on_break':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            On Break ({formatSeconds(myAttendance.currentBreakDurationSeconds)})
          </span>
        );
      case 'shift_ended':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-200 dark:bg-slate-500/15 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-500/30">
            Shift Ended
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
            Not Logged In
          </span>
        );
    }
  };

  return (
    <>
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-6 flex items-center justify-between transition-colors">
        {/* Brand & System Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/25">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">
                VIVACOM PULSE
              </span>
              <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-500/30">
                PWA Active
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
              Workforce Operations, Attendance, Kanban & Payroll
            </p>
          </div>
        </div>

        {/* Middle: Live Clock & Shift Status */}
        <div className="hidden md:flex items-center gap-4 bg-slate-100/80 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-xl px-3.5 py-1.5">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 text-xs font-mono font-medium">
            <Clock className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            <span className="text-slate-900 dark:text-white font-bold">{currentTime}</span>
            <span className="text-slate-400 dark:text-slate-500">|</span>
            <span className="text-slate-500 dark:text-slate-400">{currentDate}</span>
          </div>
          <div className="h-4 w-px bg-slate-300 dark:bg-slate-800"></div>
          {getStatusBadge()}
        </div>

        {/* Right Controls: Theme, PWA, Persona & Profile Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
            title="Toggle Dark / Light Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-brand-600" />}
          </button>

          {/* PWA Install Button */}
          <button
            onClick={handlePwaInstall}
            disabled={pwaInstalled}
            className={`hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-xl border transition-all ${
              pwaInstalled 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 cursor-default'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title="Install as Progressive Web App"
          >
            {pwaInstalled ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>PWA Ready</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                <span>Install PWA</span>
              </>
            )}
          </button>

          {/* Persona Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowPersonaDropdown(!showPersonaDropdown);
                setShowProfileMenu(false);
              }}
              className="hidden lg:flex items-center gap-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-500/60 rounded-xl px-2.5 py-1.5 transition-all text-left"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">
                {currentRole.replace('_', ' ')}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            </button>

            {showPersonaDropdown && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Interactive Persona Simulator
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Switch role view to test permissions</p>
                </div>

                <div className="mt-1 space-y-1">
                  {roles.map((r) => {
                    const isActive = r.role === currentRole;
                    return (
                      <button
                        key={r.role}
                        onClick={() => {
                          switchRole(r.role);
                          setShowPersonaDropdown(false);
                        }}
                        className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition-all ${
                          isActive 
                            ? 'bg-brand-50 dark:bg-brand-600/20 border border-brand-200 dark:border-brand-500/40 text-brand-900 dark:text-white font-semibold' 
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-xl">{r.icon}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">{r.label}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">{r.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar & Menu */}
          <div className="relative">
            <button
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowPersonaDropdown(false);
              }}
              className="flex items-center gap-2 bg-slate-100 dark:bg-gradient-to-r dark:from-brand-900/60 dark:to-slate-900 border border-slate-200 dark:border-brand-500/40 hover:border-brand-500/80 rounded-xl p-1 sm:px-2 sm:py-1.5 transition-all text-left shadow-sm"
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-brand-400/50 shrink-0">
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
              </div>
              <div className="hidden sm:block text-xs leading-tight">
                <span className="font-bold text-slate-900 dark:text-white block truncate max-w-[100px]">{currentUser.name.split(' ')[0]}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">{currentUser.employeeId}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 hidden sm:block" />
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <img src={currentUser.avatar} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700" />
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 dark:text-white text-xs block truncate">{currentUser.name}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">{currentUser.email}</span>
                    <span className="text-[10px] text-brand-600 dark:text-brand-400 font-mono font-bold mt-0.5 block">{currentUser.employeeId}</span>
                  </div>
                </div>

                {/* Salary Package overview */}
                <div className="p-2.5 mx-1 my-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400 text-[11px]">
                    <span>Monthly Gross:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">৳ {currentUser.salary.grossMonthly.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400 text-[11px] mt-1">
                    <span>Billable Rate:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">${currentUser.salary.hourlyRate} / hr</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setActiveTab('employees');
                      setShowProfileMenu(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-xl text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                  >
                    <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    <span>My Profile & Salary Details</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('attendance');
                      setShowProfileMenu(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-xl text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                  >
                    <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Attendance & Breaks</span>
                  </button>

                  <div className="pt-1 border-t border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowLogoutModal(true);
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl text-left text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 font-semibold transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out / Punch Out</span>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Shift control</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Logout / Departure Modal */}
      <LogoutModal />
    </>
  );
};
