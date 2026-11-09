import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Employee } from '../../types';
import { 
  Activity, Shield, Lock, Mail, ArrowRight, 
  Sparkles, Users, CheckCircle2, Moon, Sun, Smartphone 
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { employees, login, theme, toggleTheme, addToast } = useApp();
  const [email, setEmail] = useState<string>('rafiq@vivacom.com');
  const [password, setPassword] = useState<string>('••••••••••••');
  const [rememberMe, setRememberMe] = useState<boolean>(true);

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = employees.find(emp => emp.email.toLowerCase() === email.toLowerCase()) || employees[0];
    login(matched);
  };

  const demoAccounts = employees.slice(0, 5);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-brand-500 selection:text-white relative overflow-hidden transition-colors">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-500/10 dark:bg-brand-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-20 right-10 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Top Header */}
      <div className="p-4 sm:p-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/25">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
              VIVACOM PULSE
            </span>
            <span className="ml-2 px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-500/20 dark:text-brand-300 dark:border-brand-500/30">
              Enterprise v2.4
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors"
            title="Toggle Dark/Light Mode"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-brand-600" />}
          </button>
        </div>
      </div>

      {/* Main Login Form Container */}
      <div className="max-w-4xl w-full mx-auto px-4 py-8 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Brand Context & Value Proposition */}
          <div className="lg:col-span-5 space-y-5 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-500/15 dark:border-brand-500/30 dark:text-brand-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <span>Unified Internal Operations Suite</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
              Sign In to Start Your Work Day
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Your attendance clock-in begins automatically upon authentication. Off-time lapses on logout are recorded as breaks to certify exact production hours.
            </p>

            <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 shadow-sm space-y-2 text-xs text-left">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Attendance Starts Instantly on Login</span>
              </div>
              <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300 font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Off-Time Lapses Counted as Break Hours</span>
              </div>
              <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Kanban Screenshot Dock (`Ctrl+V`)</span>
              </div>
            </div>
          </div>

          {/* Right Column: Login Card & Demo Accounts */}
          <div className="lg:col-span-7 bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-2xl backdrop-blur-xl">
            
            {/* Standard Login Form */}
            <form onSubmit={handleCustomLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Corporate Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    placeholder="name@vivacom.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Password
                  </label>
                  <a href="#forgot" onClick={(e) => { e.preventDefault(); addToast('Reset Link Sent', 'Password reset instructions sent to company email.', 'info'); }} className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-brand-600 focus:ring-0"
                  />
                  <span>Keep session active</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-95"
              >
                <span>Sign In & Clock In for Shift</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Quick Demo Login Personas */}
            <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  1-Click Staff Access (Demo Personas)
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">Pick any role to test</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {demoAccounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => login(account)}
                    className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/70 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 hover:border-brand-500/40 dark:hover:border-brand-500/40 text-left transition-all group"
                  >
                    <img src={account.avatar} alt="" className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 group-hover:text-slate-950 dark:text-slate-200 dark:group-hover:text-white truncate">
                          {account.name.split(' ')[0]}
                        </span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 font-bold uppercase">
                          {account.role.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {account.designation}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-900 text-center text-xs text-slate-500 dark:text-slate-600 z-10">
        © 2026 Vivacom Technologies Ltd. Internal Operating System • Dhaka, Bangladesh
      </div>
    </div>
  );
};
