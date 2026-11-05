'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Store,
  Lock,
  Mail,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, switchUser } = useAuth();
  const [mode, setMode] = useState<'PASSWORD' | 'PIN'>('PASSWORD');
  const [email, setEmail] = useState('admin@apexerp.com');
  const [password, setPassword] = useState('admin123');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(email, password);
    setLoading(false);
    if (success) {
      router.push('/');
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 4) {
        submitPin(nextPin);
      }
    }
  };

  const handlePinClear = () => {
    setPin('');
  };

  const submitPin = async (code: string) => {
    setLoading(true);
    const success = await login('', undefined, code);
    setLoading(false);
    if (success) {
      router.push('/pos');
    } else {
      setPin('');
    }
  };

  const handleQuickDemoRole = async (role: string) => {
    setLoading(true);
    const success = await switchUser(role);
    setLoading(false);
    if (success) {
      if (role === 'CASHIER') router.push('/pos');
      else if (role === 'SALES_REP') router.push('/wholesale');
      else if (role === 'INVENTORY_CLERK') router.push('/inventory');
      else router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4 sm:p-6 antialiased">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 w-80 h-80 bg-indigo-500/10 blur-[100px] rounded-full" />
      </div>

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-white font-black text-2xl mx-auto shadow-xl shadow-emerald-500/20">
            A
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Apex ERP</h1>
          <p className="text-xs text-slate-400">
            Omnichannel Wholesale & Retail POS Enterprise Platform
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
          {/* Mode Switcher */}
          <div className="flex bg-slate-800/80 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => { setMode('PASSWORD'); setPin(''); }}
              className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                mode === 'PASSWORD' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-400'
              }`}
            >
              <Mail className="w-3.5 h-3.5" /> Staff Email
            </button>
            <button
              onClick={() => { setMode('PIN'); }}
              className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                mode === 'PIN' ? 'bg-slate-950 text-emerald-400 shadow-sm' : 'text-slate-400'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" /> Cashier POS PIN
            </button>
          </div>

          {mode === 'PASSWORD' ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Staff Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 font-bold text-sm text-white rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In to Workspace'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* Fast 4-Digit PIN Pad for Cashiers */
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-xs text-slate-400 mb-2">Enter 4-Digit Cashier PIN</div>
                <div className="flex justify-center gap-3">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full border-2 transition-all ${
                        pin.length > idx
                          ? 'bg-emerald-400 border-emerald-400 shadow-md shadow-emerald-400/50 scale-110'
                          : 'border-slate-700 bg-slate-950'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Number Pad Grid */}
              <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto pt-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      if (item === 'C') handlePinClear();
                      else if (item === '⌫') setPin(pin.slice(0, -1));
                      else handlePinDigit(item);
                    }}
                    className="h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 text-white font-bold text-base transition-colors flex items-center justify-center shadow"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Demo Switcher */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Instant Demo Role Switcher (1-Click)</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => handleQuickDemoRole('ADMIN')}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-left text-slate-200 border border-slate-700"
              >
                <div className="font-bold">Super Admin</div>
                <div className="text-[10px] text-purple-400">Full Access</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoRole('CASHIER')}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-left text-slate-200 border border-slate-700"
              >
                <div className="font-bold">Front Cashier</div>
                <div className="text-[10px] text-emerald-400">Retail POS</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoRole('SALES_REP')}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-left text-slate-200 border border-slate-700"
              >
                <div className="font-bold">Wholesale Rep</div>
                <div className="text-[10px] text-amber-400">B2B Contracts</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoRole('INVENTORY_CLERK')}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-left text-slate-200 border border-slate-700"
              >
                <div className="font-bold">Inventory Lead</div>
                <div className="text-[10px] text-orange-400">Stock & Audits</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
