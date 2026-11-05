'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Package,
  Users,
  Truck,
  BarChart3,
  ShieldCheck,
  History,
  Menu,
  X,
  Store,
  ChevronDown,
  Building2,
  LogOut,
  Sparkles,
  Leaf,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Retail POS', href: '/pos', icon: ShoppingCart, badge: 'Counter POS' },
  { name: 'Wholesale B2B', href: '/wholesale', icon: Building2, badge: 'Bulk' },
  { name: 'Stock & Cold Chain', href: '/inventory', icon: Boxes },
  { name: 'Products & Produce', href: '/products', icon: Package },
  { name: 'Customers CRM', href: '/customers', icon: Users },
  { name: 'Suppliers & POs', href: '/vendors', icon: Truck },
  { name: 'Sales & Margins', href: '/reports', icon: BarChart3 },
  { name: 'Staff & Roles', href: '/staff', icon: ShieldCheck, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Audit & Logs', href: '/logs', icon: History, roles: ['ADMIN', 'MANAGER'] },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, switchUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // If on login page, render full screen without layout
  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row antialiased">
      {/* ================= DESKTOP SIDEBAR WITH DARK BLUE PATTERN & FRESH GREEN ================= */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-dark-blue-pattern text-slate-200 border-r border-slate-800 shrink-0 select-none shadow-xl">
        {/* SANA FRESH Brand Header */}
        <div className="h-16 flex items-center px-5 gap-3 border-b border-slate-800/80 bg-[#090e1a]/80 backdrop-blur-sm">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-green-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 border border-emerald-400/30">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-black text-white text-base tracking-tight leading-tight flex items-center gap-1.5">
              <span>SANA FRESH</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
              Produce & FMCG ERP
            </div>
          </div>
        </div>

        {/* Outlet / Hub Indicator */}
        <div className="px-4 py-3 border-b border-slate-800/60 bg-[#080d1a]/50">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Store className="w-3.5 h-3.5 text-emerald-400" /> Central Store & Hub
            </span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/50">
              Live
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            if (item.roles && user && !item.roles.includes(user.role)) {
              return null;
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-white' : 'text-emerald-400/80 group-hover:text-emerald-300'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                      isActive ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-emerald-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Role Switcher */}
        <div className="p-3 border-t border-slate-800 bg-[#090e1a]/90">
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/80 transition-colors text-left border border-slate-800"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-extrabold text-xs shrink-0 shadow-sm">
                  {user ? user.name[0] : 'S'}
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-slate-100 truncate">{user?.name || 'Administrator'}</div>
                  <div className="text-[10px] text-emerald-400 font-mono font-semibold">{user?.role || 'ADMIN'}</div>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {/* Quick Role Switcher Dropdown */}
            {userDropdownOpen && (
              <div className="absolute bottom-full left-0 w-full mb-2 bg-[#0b1329] border border-slate-700 rounded-xl shadow-2xl p-2 z-50 text-xs">
                <div className="px-2 py-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-400" /> SANA FRESH Roles
                </div>
                <button
                  onClick={() => { switchUser('ADMIN'); setUserDropdownOpen(false); }}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 flex items-center justify-between"
                >
                  <span>Alexander Vance</span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1 rounded font-bold">ADMIN</span>
                </button>
                <button
                  onClick={() => { switchUser('CASHIER'); setUserDropdownOpen(false); }}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 flex items-center justify-between"
                >
                  <span>Alex Rivera</span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1 rounded font-bold">CASHIER</span>
                </button>
                <button
                  onClick={() => { switchUser('SALES_REP'); setUserDropdownOpen(false); }}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 flex items-center justify-between"
                >
                  <span>Marcus Cole</span>
                  <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800 px-1 rounded font-bold">WHOLESALE</span>
                </button>
                <button
                  onClick={() => { switchUser('INVENTORY_CLERK'); setUserDropdownOpen(false); }}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 flex items-center justify-between"
                >
                  <span>Elena Rostova</span>
                  <span className="text-[10px] bg-teal-950 text-teal-300 border border-teal-800 px-1 rounded font-bold">COLD CHAIN</span>
                </button>
                <div className="my-1 border-t border-slate-800" />
                <button
                  onClick={() => { logout(); setUserDropdownOpen(false); }}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-rose-950/60 text-rose-300 flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ================= MOBILE / TABLET TOP HEADER ================= */}
      <header className="lg:hidden sticky top-0 z-40 bg-dark-blue-pattern text-white border-b border-slate-800 px-4 h-14 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white focus:outline-none"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-white text-xs">
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-sm tracking-tight text-white">SANA FRESH</span>
          </div>
        </div>

        {/* User Role Pill */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/90 text-xs border border-emerald-500/30 text-emerald-300 font-semibold"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>{user?.role || 'ADMIN'}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
        </div>
      </header>

      {/* ================= MOBILE SLIDE-OVER DRAWER ================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-dark-blue-pattern text-slate-100 shadow-2xl border-r border-slate-800">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#090e1a]/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-400 flex items-center justify-center font-bold text-white text-sm shadow-md">
                  <Leaf className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="font-extrabold text-sm text-white">SANA FRESH</div>
                  <div className="text-[10px] text-emerald-400 font-bold">Produce & FMCG ERP</div>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold ${
                      isActive ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-emerald-400" />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-bold">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-800 bg-[#090e1a]">
              <div className="text-xs text-slate-400 mb-1">Signed in as:</div>
              <div className="font-bold text-sm text-white">{user?.name}</div>
              <div className="text-xs text-emerald-400 mb-3">{user?.email}</div>
              <button
                onClick={() => { logout(); setMobileMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-rose-300 bg-rose-950/40 rounded-xl hover:bg-rose-950/80 border border-rose-900/50"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MAIN CONTENT AREA ================= */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0 overflow-y-auto">
        {children}
      </main>

      {/* ================= MOBILE BOTTOM QUICK-BAR (DARK BLUE & FRESH GREEN) ================= */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-dark-blue-pattern/95 backdrop-blur-md border-t border-slate-800 shadow-2xl px-2 py-1 flex items-center justify-around select-none">
        <Link
          href="/"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-semibold transition-colors ${
            pathname === '/' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>Home</span>
        </Link>

        <Link
          href="/pos"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-semibold transition-colors ${
            pathname === '/pos' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <div className="relative">
            <ShoppingCart className="w-5 h-5 mb-0.5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <span>POS</span>
        </Link>

        <Link
          href="/wholesale"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-semibold transition-colors ${
            pathname === '/wholesale' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Building2 className="w-5 h-5 mb-0.5" />
          <span>Wholesale</span>
        </Link>

        <Link
          href="/inventory"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-semibold transition-colors ${
            pathname === '/inventory' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Boxes className="w-5 h-5 mb-0.5" />
          <span>Stock</span>
        </Link>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-white"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
}
