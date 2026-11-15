'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Lock, Mail, KeyRound, ArrowRight, Leaf } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [mode, setMode] = useState<'PASSWORD' | 'PIN'>('PASSWORD');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(email, password);
    setLoading(false);
    if (success) router.push('/');
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length < 4) {
      const next = pin + digit;
      setPin(next);
      if (next.length === 4) submitPin(next);
    }
  };

  const submitPin = async (code: string) => {
    setLoading(true);
    const success = await login('', undefined, code);
    setLoading(false);
    if (success) router.push('/pos');
    else setPin('');
  };

  return (
    <div className="min-h-screen bg-dark-blue-pattern text-white flex flex-col justify-center items-center p-4 sm:p-6 antialiased relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/15 blur-[130px] rounded-full" />
        <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 w-80 h-80 bg-green-500/10 blur-[110px] rounded-full" />
      </div>

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-green-400 flex items-center justify-center text-white mx-auto shadow-2xl shadow-emerald-500/30 border border-emerald-400/30">
            <Leaf className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">SANA FRESH</h1>
          <p className="text-xs text-emerald-400 font-semibold tracking-wide uppercase">
            Produce &amp; FMCG Omnichannel ERP — United Kingdom
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          {/* Mode Switcher */}
          <div className="flex bg-[#090e1a] p-1.5 rounded-2xl text-xs font-bold border border-slate-800">
            <button
              onClick={() => { setMode('PASSWORD'); setPin(''); }}
              className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${mode === 'PASSWORD' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Mail className="w-3.5 h-3.5" /> Staff Email
            </button>
            <button
              onClick={() => setMode('PIN')}
              className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${mode === 'PIN' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <KeyRound className="w-3.5 h-3.5" /> POS Fast PIN
            </button>
          </div>

          {mode === 'PASSWORD' ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Work Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@sanafresh.co.uk"
                    className="w-full pl-10 pr-3 py-2.5 bg-[#090e1a] border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password" required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-[#090e1a] border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
                  />
                </div>
              </div>
              <button
                type="submit" disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 font-bold text-sm text-white rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <span>{loading ? 'Signing in...' : 'Sign In to Workspace'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-xs text-slate-400 mb-2 font-medium">Enter your 4-digit POS PIN</div>
                <div className="flex justify-center gap-3">
                  {[0, 1, 2, 3].map((idx) => (
                    <div key={idx} className={`w-4 h-4 rounded-full border-2 transition-all ${pin.length > idx ? 'bg-emerald-400 border-emerald-400 scale-110' : 'border-slate-700 bg-[#090e1a]'}`} />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto pt-2">
                {['1','2','3','4','5','6','7','8','9','C','0','⌫'].map((item) => (
                  <button
                    key={item} type="button"
                    onClick={() => {
                      if (item === 'C') setPin('');
                      else if (item === '⌫') setPin(p => p.slice(0, -1));
                      else handlePinDigit(item);
                    }}
                    className="h-12 rounded-xl bg-[#090e1a] hover:bg-slate-800 active:bg-emerald-600 text-white font-bold text-base transition-colors flex items-center justify-center border border-slate-800 shadow"
                  >
                    {item}
                  </button>
                ))}
              </div>
              {loading && <p className="text-center text-xs text-emerald-400 animate-pulse">Verifying PIN...</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
