'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  ChevronDown,
  Building2,
  LogOut,
  Leaf,
  ShieldAlert,
  ArrowLeft,
  Search,
  PoundSterling,
  TrendingUp,
  RotateCcw,
  ClipboardList,
  Receipt,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  permission?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Retail',
    items: [
      { name: 'Retail POS', href: '/pos', icon: ShoppingCart, badge: 'POS', permission: 'access_pos' },
      { name: 'Retail Customers', href: '/customers?type=RETAIL', icon: Users, permission: 'view_customers' },
      { name: 'Sales History', href: '/sales', icon: ClipboardList, permission: 'access_pos' },
      { name: 'Returns', href: '/returns', icon: RotateCcw, permission: 'manage_pos_intake' },
    ],
  },
  {
    label: 'Wholesale',
    items: [
      { name: 'Wholesale B2B POS', href: '/wholesale', icon: Building2, badge: 'POS', permission: 'view_invoices' },
      { name: 'Wholesale Clients', href: '/customers?type=WHOLESALE', icon: Users, permission: 'view_customers' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { name: 'Stock & Warehouse', href: '/inventory', icon: Boxes, permission: 'view_products' },
      { name: 'Products', href: '/products', icon: Package, permission: 'view_products' },
      { name: 'Suppliers & POs', href: '/vendors', icon: Truck, permission: 'view_vendors' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { name: 'Sales & Margins', href: '/reports', icon: BarChart3, permission: 'view_reports' },
      { name: 'Stock Analysis', href: '/stock-analysis', icon: TrendingUp, permission: 'view_reports' },
    ],
  },
  {
    label: 'HR & Admin',
    items: [
      { name: 'Payroll & Salary', href: '/salary', icon: PoundSterling, permission: 'manage_staff' },
      { name: 'Staff & Roles', href: '/staff', icon: ShieldCheck, permission: 'manage_staff' },
      { name: 'Audit & Logs', href: '/logs', icon: History, permission: 'view_logs' },
    ],
  },
];

// Flat list for permission checks elsewhere
const navItems: NavItem[] = navGroups.flatMap((g) => g.items);

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, logout, hasPermission } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) =>
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  const isItemActive = (href: string) => {
    if (href.includes('?')) {
      const [itemPath, itemQuery] = href.split('?');
      if (pathname !== itemPath) return false;
      const targetParams = new URLSearchParams(itemQuery);
      let match = true;
      targetParams.forEach((val, key) => {
        if (searchParams.get(key) !== val) match = false;
      });
      return match;
    }
    if (pathname === href) {
      if (href === '/customers') {
        return !searchParams.get('type');
      }
      return true;
    }
    return false;
  };

  // Build authorized grouped nav
  const authorizedGroups = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => !item.permission || hasPermission(item.permission)),
    }))
    .filter((g) => g.items.length > 0);

  const mainRef = useRef<HTMLElement>(null);
  const sidebarNavRef = useRef<HTMLElement>(null);
  const sidebarScrollPos = useRef<number>(0);

  // Restore sidebar scroll synchronously before paint so it never visually jumps
  useLayoutEffect(() => {
    const nav = sidebarNavRef.current;
    if (!nav) return;
    nav.scrollTop = sidebarScrollPos.current;
  }, [pathname]);

  const handleSidebarScroll = () => {
    sidebarScrollPos.current = sidebarNavRef.current?.scrollTop ?? 0;
  };

  // Scroll main content to top on every navigation
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  // Global Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults(null); return; }
    try {
      setSearchLoading(true);
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.results);
    } catch { /* silent */ } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, doSearch]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
    else { setSearchQuery(''); setSearchResults(null); }
  }, [searchOpen]);

  // Close search on outside click — only when overlay itself is clicked (handled inline above)

  // Keyboard shortcut: Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // If on login page, render full screen without layout
  if (pathname === '/login') {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 animate-pulse flex items-center justify-center">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="text-xs text-slate-400 font-medium tracking-wide">
            Loading SANA FRESH ERP Session...
          </span>
        </div>
      </div>
    );
  }

  // Check if current route requires a permission the user lacks
  const currentNavItem = navItems.find((item) => item.href.split('?')[0] === pathname);
  const isDenied = Boolean(currentNavItem?.permission && !hasPermission(currentNavItem.permission));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row antialiased">
      {/* ================= DESKTOP SIDEBAR ================= */}
      <aside className="hidden lg:flex lg:flex-col w-64 h-screen sticky top-0 bg-dark-blue-pattern text-slate-200 border-r border-slate-800 shrink-0 shadow-xl" style={{ userSelect: 'none' }}>
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
              Produce &amp; FMCG ERP
            </div>
          </div>
        </div>

        {/* User Identity & Role Badge */}
        <div className="px-4 py-3 border-b border-slate-800/60 bg-[#080d1a]/50 flex items-center justify-between">
          <div className="min-w-0">
            <div className="font-bold text-xs text-white truncate">{user?.name || 'Staff Member'}</div>
            <div className="text-[10px] text-slate-400 truncate">{user?.email}</div>
          </div>
          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/50">
            {user?.role || 'USER'}
          </span>
        </div>

        {/* Navigation Links */}
        <nav ref={sidebarNavRef} onScroll={handleSidebarScroll} className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {authorizedGroups.map((group) => {
            const isCollapsed = collapsedGroups[group.label];
            const hasActive = group.items.some((i) => isItemActive(i.href));
            return (
              <div key={group.label}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-2 mb-1 group"
                >
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                    hasActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-400'
                  }`}>{group.label}</span>
                  <ChevronDown className={`w-3 h-3 text-slate-600 transition-transform ${
                    isCollapsed ? '-rotate-90' : ''
                  }`} />
                </button>
                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = isItemActive(item.href);
                      const Icon = item.icon;
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
                            <Icon className={`w-4 h-4 ${
                              isActive ? 'text-white' : 'text-emerald-400/80 group-hover:text-emerald-300'
                            }`} />
                            <span>{item.name}</span>
                          </div>
                          {item.badge && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                              isActive ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-emerald-400'
                            }`}>
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Search Trigger + Sign Out */}
        <div className="p-3 border-t border-slate-800 bg-[#090e1a]/90 space-y-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2 py-2 px-3 text-xs font-semibold text-slate-400 bg-slate-800/60 hover:bg-slate-800 rounded-xl border border-slate-700/50 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search ERP...</span>
            <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded font-mono">Ctrl+K</span>
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-rose-300 bg-rose-950/40 hover:bg-rose-950/80 rounded-xl border border-rose-900/50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ================= GLOBAL SEARCH OVERLAY ================= */}
      {searchOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-16 px-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setSearchOpen(false); }}>
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search invoices, products, customers, staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 text-sm outline-none text-slate-900 placeholder-slate-400"
              />
              {searchLoading && <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />}
              <button onClick={() => setSearchOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {searchResults && (
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 text-xs">
                {/* Invoices */}
                {searchResults.invoices?.length > 0 && (
                  <div className="p-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Invoices & Orders</div>
                    {searchResults.invoices.map((o: any) => (
                      <button key={o.id} onClick={() => { router.push(`/wholesale?invoice=${o.order_number}`); setSearchOpen(false); }}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-left">
                        <div>
                          <span className="font-mono font-bold text-slate-900">{o.order_number}</span>
                          <span className="ml-2 text-slate-500">{o.customer_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">£{Number(o.total_amount).toFixed(2)}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            o.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                            o.payment_status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                          }`}>{o.payment_status}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {/* Products */}
                {searchResults.products?.length > 0 && (
                  <div className="p-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Products</div>
                    {searchResults.products.map((p: any) => (
                      <button key={p.id} onClick={() => { router.push('/products'); setSearchOpen(false); }}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-left">
                        <div>
                          <span className="font-bold text-slate-900">{p.name}</span>
                          <span className="ml-2 font-mono text-slate-400 text-[11px]">{p.sku}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-700">£{Number(p.retail_price).toFixed(2)}</div>
                          <div className="text-[10px] text-slate-400">{p.stock_quantity} {p.unit}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {/* Customers */}
                {searchResults.customers?.length > 0 && (
                  <div className="p-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Customers</div>
                    {searchResults.customers.map((c: any) => (
                      <button key={c.id} onClick={() => { router.push('/customers'); setSearchOpen(false); }}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-left">
                        <div>
                          <span className="font-bold text-slate-900">{c.company_name || c.name}</span>
                          {c.company_name && <span className="ml-2 text-slate-500">{c.name}</span>}
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          c.type === 'WHOLESALE' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>{c.type}</span>
                      </button>
                    ))}
                  </div>
                )}
                {/* Staff */}
                {searchResults.staff?.length > 0 && (
                  <div className="p-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Staff</div>
                    {searchResults.staff.map((s: any) => (
                      <button key={s.id} onClick={() => { router.push('/staff'); setSearchOpen(false); }}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-left">
                        <div>
                          <span className="font-bold text-slate-900">{s.name}</span>
                          <span className="ml-2 text-slate-500">{s.email}</span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">{s.role}</span>
                      </button>
                    ))}
                  </div>
                )}
                {/* No results */}
                {!searchResults.invoices?.length && !searchResults.products?.length &&
                 !searchResults.customers?.length && !searchResults.staff?.length && (
                  <div className="p-6 text-center text-slate-400">No results for &ldquo;{searchQuery}&rdquo;</div>
                )}
              </div>
            )}
            {!searchResults && searchQuery.length < 2 && (
              <div className="p-4 text-xs text-slate-400 text-center">Type at least 2 characters to search across invoices, products, customers and staff.</div>
            )}
          </div>
        </div>
      )}

      {/* ================= MOBILE STICKY HEADER ================= */}
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
            <span>{user?.role || 'USER'}</span>
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
                  <div className="text-[10px] text-emerald-400 font-bold">Produce &amp; FMCG ERP</div>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
              {authorizedGroups.map((group) => {
                const isCollapsed = collapsedGroups[group.label];
                const hasActive = group.items.some((i) => isItemActive(i.href));
                return (
                  <div key={group.label}>
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="w-full flex items-center justify-between px-2 mb-1"
                    >
                      <span className={`text-[10px] font-black uppercase tracking-widest ${
                        hasActive ? 'text-emerald-400' : 'text-slate-500'
                      }`}>{group.label}</span>
                      <ChevronDown className={`w-3 h-3 text-slate-600 transition-transform ${
                        isCollapsed ? '-rotate-90' : ''
                      }`} />
                    </button>
                    {!isCollapsed && (
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const isActive = isItemActive(item.href);
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
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-800 bg-[#090e1a]">
              <div className="text-xs text-slate-400 mb-0.5">Signed in as:</div>
              <div className="font-bold text-sm text-white">{user?.name}</div>
              <div className="text-[11px] text-emerald-400 mb-3">{user?.email} ({user?.role})</div>
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-rose-300 bg-rose-950/40 rounded-xl hover:bg-rose-950/80 border border-rose-900/50"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MAIN CONTENT AREA ================= */}
      <main ref={mainRef} className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0 overflow-y-auto">
        {isDenied ? (
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-950">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center shadow-2xl space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center shadow-lg shadow-rose-950/50">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Access Restricted</h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Your account does not have permission to access{' '}
                  <span className="font-semibold text-slate-200">{currentNavItem?.name}</span>.
                </p>
              </div>

              <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/80 text-left text-xs space-y-1.5">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Signed in as:</span>
                  <span className="font-semibold text-white">
                    {user?.name} ({user?.role})
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Required permission:</span>
                  <span className="font-mono text-[11px] text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-900/50">
                    {currentNavItem?.permission}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Contact your store manager or system administrator to request access in Staff &amp; Roles.
              </p>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Link
                  href="/"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Go to Dashboard
                </Link>
                {hasPermission('access_pos') && (
                  <Link
                    href="/pos"
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-4 h-4" /> Open Retail POS
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
          children
        )}
      </main>

      {/* ================= MOBILE BOTTOM QUICK-BAR ================= */}
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

        {hasPermission('access_pos') && (
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
        )}

        {hasPermission('view_invoices') && (
          <Link
            href="/wholesale"
            className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-semibold transition-colors ${
              pathname === '/wholesale' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-5 h-5 mb-0.5" />
            <span>Wholesale</span>
          </Link>
        )}

        {hasPermission('view_products') && (
          <Link
            href="/inventory"
            className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-semibold transition-colors ${
              pathname === '/inventory' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Boxes className="w-5 h-5 mb-0.5" />
            <span>Stock</span>
          </Link>
        )}

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
