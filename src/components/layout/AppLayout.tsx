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
  Bell,
  Sliders,
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
  { name: 'Retail POS', href: '/pos', icon: ShoppingCart, badge: 'Point of Sale' },
  { name: 'Wholesale B2B', href: '/wholesale', icon: Building2, badge: 'Bulk' },
  { name: 'Inventory / Stock', href: '/inventory', icon: Boxes },
  { name: 'Products & Catalog', href: '/products', icon: Package },
  { name: 'Customers CRM', href: '/customers', icon: Users },
  { name: 'Vendors & POs', href: '/vendors', icon: Truck },
  { name: 'Analytics & Reports', href: '/reports', icon: BarChart3 },
  { name: 'Staff & Roles', href: '/staff', icon: ShieldCheck, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Event Audit Logs', href: '/logs', icon: History, roles: ['ADMIN', 'MANAGER'] },
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

  const roleColors: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-800 border-purple-300',
    MANAGER: 'bg-blue-100 text-blue-800 border-blue-300',
    CASHIER: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    SALES_REP: 'bg-amber-100 text-amber-800 border-amber-300',
    INVENTORY_CLERK: 'bg-orange-100 text-orange-800 border-orange-300',
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row antialiased">
      {/* ================= DESKTOP SIDEBAR ================= */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-slate-900 text-slate-200 border-r border-slate-800 shrink-0 select-none">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800 bg-slate-950/60">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 font-bold text-lg">
            A
          </div>
          <div>
            <div className="font-bold text-slate-100 text-base leading-tight tracking-tight">Apex ERP</div>
            <div className="text-[10px] uppercase font-semibold text-emerald-400 tracking-wider">Omnichannel Cloud</div>
          </div>
        </div>

        {/* Store / Outlet Indicator */}
        <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/40">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Store className="w-3.5 h-3.5 text-emerald-400" /> Main Hub & Store #01
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="PostgreSQL Online" />
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            // RBAC check
            if (item.roles && user && !item.roles.includes(user.role)) {
              return null;
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-300'
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
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/80 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {user ? user.name[0] : 'U'}
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold text-slate-100 truncate">{user?.name || 'Administrator'}</div>
                  <div className="text-[10px] text-emerald-400 font-mono font-medium">{user?.role || 'ADMIN'}</div>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {/* Quick Role Switcher Dropdown */}
            {userDropdownOpen && (
              <div className="absolute bottom-full left-0 w-full mb-2 bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-2 z-50 text-xs">
                <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Quick Switch Role (Demo)
                </div>
                <button
                  onClick={() => { switchUser('ADMIN'); setUserDropdownOpen(false); }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-800 text-slate-200 flex items-center justify-between"
                >
                  <span>Alexander Vance</span>
                  <span className="text-[10px] bg-purple-900/60 text-purple-300 px-1 rounded">ADMIN</span>
                </button>
                <button
                  onClick={() => { switchUser('CASHIER'); setUserDropdownOpen(false); }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-800 text-slate-200 flex items-center justify-between"
                >
                  <span>Alex Rivera</span>
                  <span className="text-[10px] bg-emerald-900/60 text-emerald-300 px-1 rounded">CASHIER</span>
                </button>
                <button
                  onClick={() => { switchUser('SALES_REP'); setUserDropdownOpen(false); }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-800 text-slate-200 flex items-center justify-between"
                >
                  <span>Marcus Cole</span>
                  <span className="text-[10px] bg-amber-900/60 text-amber-300 px-1 rounded">WHOLESALE</span>
                </button>
                <button
                  onClick={() => { switchUser('INVENTORY_CLERK'); setUserDropdownOpen(false); }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-800 text-slate-200 flex items-center justify-between"
                >
                  <span>Elena Rostova</span>
                  <span className="text-[10px] bg-orange-900/60 text-orange-300 px-1 rounded">STOCK</span>
                </button>
                <div className="my-1 border-t border-slate-800" />
                <button
                  onClick={() => { logout(); setUserDropdownOpen(false); }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-rose-950/60 text-rose-300 flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ================= MOBILE / TABLET TOP HEADER ================= */}
      <header className="lg:hidden sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white focus:outline-none"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-white text-xs">
              A
            </div>
            <span className="font-bold text-sm tracking-tight text-white">Apex ERP</span>
          </div>
        </div>

        {/* User Badge / Role Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-xs border border-slate-700"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-medium text-slate-200">{user?.role || 'ADMIN'}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
        </div>
      </header>

      {/* ================= MOBILE SLIDE-OVER DRAWER ================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 text-slate-100 shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-white text-sm">
                  A
                </div>
                <div>
                  <div className="font-bold text-sm">Apex ERP</div>
                  <div className="text-[10px] text-emerald-400">Omnichannel Edition</div>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium ${
                      isActive ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-800 bg-slate-950/60">
              <div className="text-xs text-slate-400 mb-2">Signed in as:</div>
              <div className="font-semibold text-sm text-slate-100">{user?.name}</div>
              <div className="text-xs text-emerald-400 mb-3">{user?.email}</div>
              <button
                onClick={() => { logout(); setMobileMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-rose-300 bg-rose-950/40 rounded-lg hover:bg-rose-950/80"
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

      {/* ================= MOBILE BOTTOM QUICK-BAR (THUMB FRIENDLY) ================= */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg px-2 py-1 flex items-center justify-around select-none">
        <Link
          href="/"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            pathname === '/' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>Home</span>
        </Link>

        <Link
          href="/pos"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            pathname === '/pos' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <div className="relative">
            <ShoppingCart className="w-5 h-5 mb-0.5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <span>POS</span>
        </Link>

        <Link
          href="/wholesale"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            pathname === '/wholesale' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-5 h-5 mb-0.5" />
          <span>Wholesale</span>
        </Link>

        <Link
          href="/inventory"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            pathname === '/inventory' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Boxes className="w-5 h-5 mb-0.5" />
          <span>Stock</span>
        </Link>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium text-slate-500 hover:text-slate-900"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
