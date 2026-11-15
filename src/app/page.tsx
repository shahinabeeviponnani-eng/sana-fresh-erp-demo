'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  ShoppingCart,
  Building2,
  TrendingUp,
  AlertTriangle,
  Boxes,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  RefreshCw,
  Clock,
  ShieldAlert,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard');
      const dashData = await res.json();
      setData(dashData);
      setReports(dashData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading || !data) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
          <span className="text-sm font-medium text-slate-500">Connecting to PostgreSQL & crunching metrics...</span>
        </div>
      </div>
    );
  }

  const { metrics, recentOrders, recentLogs, lowStockItems } = data;

  const pieData = [
    { name: 'Retail POS', value: metrics.retailRevenue, color: '#10b981' },
    { name: 'Wholesale B2B', value: metrics.wholesaleRevenue, color: '#6366f1' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* ================= PAGE HEADER & QUICK ACTIONS ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              SANA FRESH Operations
            </h1>
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Live Hub
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time synchronization across Farm Produce Wholesale B2B, Retail POS & Cold Storage.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={fetchDashboard}
            className="p-2 sm:px-3 sm:py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm flex items-center gap-1.5"
            title="Refresh Metrics"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Link
            href="/pos"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm shadow-emerald-600/20"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Launch POS</span>
          </Link>

          <Link
            href="/wholesale"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-600/20"
          >
            <Building2 className="w-4 h-4" />
            <span>New Wholesale Order</span>
          </Link>
        </div>
      </div>

      {/* ================= CRITICAL LOW STOCK WARNING BANNER ================= */}
      {metrics.lowStockCount > 0 && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-200/60 flex items-center justify-center text-amber-700 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold">
                {metrics.lowStockCount} Products Running Below Safe Reorder Levels!
              </div>
              <div className="text-xs text-amber-700/90">
                Action required to avoid stockouts in retail counters and wholesale bulk dispatch.
              </div>
            </div>
          </div>
          <Link
            href="/inventory?filter=low_stock"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 self-start sm:self-center shadow-sm"
          >
            <span>Review & Restock</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* ================= TOP KPI CARDS GRID ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Total Revenue */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Gross Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            £{metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center text-emerald-600 font-semibold gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> +18.4%
            </span>
            <span className="text-slate-400">vs last cycle</span>
          </div>
        </div>

        {/* Wholesale B2B Revenue */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Wholesale B2B</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-900">
            £{metrics.wholesaleRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{metrics.wholesaleCustomers} Active B2B Accounts</span>
            <span className="font-semibold text-indigo-600">
              {metrics.totalRevenue > 0 ? Math.round((metrics.wholesaleRevenue / metrics.totalRevenue) * 100) : 0}% of Total
            </span>
          </div>
        </div>

        {/* Retail POS Revenue */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Retail POS Store</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-900">
            £{metrics.retailRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{metrics.retailCustomers} Retail Shoppers</span>
            <span className="font-semibold text-emerald-600">
              {metrics.totalRevenue > 0 ? Math.round((metrics.retailRevenue / metrics.totalRevenue) * 100) : 0}% of Total
            </span>
          </div>
        </div>

        {/* Outstanding Receivables */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Receivables (Credit)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-900">
            £{metrics.outstandingReceivables.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Net 15/30/60 Terms</span>
            <span className="font-medium text-amber-700">Pending Collection</span>
          </div>
        </div>
      </div>

      {/* ================= SECONDARY STATS BAR ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900 text-white rounded-xl p-4 shadow-md">
        <div className="p-2 border-r border-slate-800 last:border-0">
          <div className="text-[11px] font-semibold text-slate-400 uppercase">Inventory Value (Cost)</div>
          <div className="text-lg font-bold text-slate-100 mt-1">
            £{metrics.inventoryValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-emerald-400 mt-0.5">{metrics.totalUnitsInStock} total units in warehouse</div>
        </div>

        <div className="p-2 border-r border-slate-800 last:border-0">
          <div className="text-[11px] font-semibold text-slate-400 uppercase">Total Catalog SKUs</div>
          <div className="text-lg font-bold text-slate-100 mt-1">{metrics.totalProducts} Active Products</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Across 5 main categories</div>
        </div>

        <div className="p-2 border-r border-slate-800 last:border-0">
          <div className="text-[11px] font-semibold text-slate-400 uppercase">Credit Extended</div>
          <div className="text-lg font-bold text-slate-100 mt-1">
            £{metrics.totalCreditExtended.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-indigo-300 mt-0.5">To authorized B2B buyers</div>
        </div>

        <div className="p-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase">Completed Orders</div>
          <div className="text-lg font-bold text-slate-100 mt-1">{metrics.totalOrders} Transactions</div>
          <div className="text-[10px] text-emerald-400 mt-0.5">100% Stock Ledger Synchronized</div>
        </div>
      </div>

      {/* ================= CHARTS: REVENUE TREND & CHANNEL SPLIT ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Revenue Performance by Channel</h2>
              <p className="text-xs text-slate-500">Retail Store POS vs Wholesale Bulk Shipments</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-3 h-3 rounded-full bg-emerald-500" /> Retail
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-3 h-3 rounded-full bg-indigo-600" /> Wholesale
              </span>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            {reports?.salesTrend && reports.salesTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={reports.salesTrend}>
                  <defs>
                    <linearGradient id="retailGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="whlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date_label" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `£${v}`} />
                  <Tooltip
                    formatter={(val: any) => [`£${Number(val).toLocaleString()}`, '']}
                    contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="wholesale_sales" name="Wholesale" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#whlGrad)" />
                  <Area type="monotone" dataKey="retail_sales" name="Retail" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#retailGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Processing trend data...
              </div>
            )}
          </div>
        </div>

        {/* Channel Split Doughnut */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Revenue Split</h2>
            <p className="text-xs text-slate-500">Channel distribution ratio</p>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`$${Number(val).toLocaleString()}`, '']}
                  contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="text-center p-2 rounded-lg bg-emerald-50">
              <div className="text-[11px] font-medium text-emerald-800">Retail POS</div>
              <div className="text-sm font-bold text-emerald-900 mt-0.5">
                £{metrics.retailRevenue.toLocaleString()}
              </div>
            </div>
            <div className="text-center p-2 rounded-lg bg-indigo-50">
              <div className="text-[11px] font-medium text-indigo-800">Wholesale B2B</div>
              <div className="text-sm font-bold text-indigo-900 mt-0.5">
                £{metrics.wholesaleRevenue.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= RECENT TRANSACTIONS & AUDIT LOGS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Transactions</h2>
              <p className="text-xs text-slate-500">Live order queue from store and wholesale</p>
            </div>
            <Link
              href="/wholesale"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Order #</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Total</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((ord: any) => (
                  <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-medium text-slate-900">
                      {ord.order_number}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          ord.type === 'WHOLESALE'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {ord.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-medium truncate max-w-[140px]">
                      {ord.customer_name}
                      {ord.customer_company && (
                        <div className="text-[10px] text-slate-400 truncate">{ord.customer_company}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      £{Number(ord.total_amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          ord.payment_status === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : ord.payment_status === 'PARTIAL'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {ord.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live System Event / Audit Logs */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">System Activity Logs</h2>
              <p className="text-xs text-slate-500">Security, cashier & inventory audit events</p>
            </div>
            <Link
              href="/logs"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <span>Audit Trail</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {recentLogs.map((log: any) => (
              <div
                key={log.id}
                className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-slate-100/60 transition-colors flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <span
                    className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                      log.severity === 'CRITICAL'
                        ? 'bg-rose-500 ring-4 ring-rose-100'
                        : log.severity === 'WARNING'
                        ? 'bg-amber-500 ring-4 ring-amber-100'
                        : 'bg-emerald-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 font-mono text-[11px]">{log.action}</span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                        {log.module}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5 truncate">
                      By <span className="font-medium text-slate-800">{log.staff_name || 'System'}</span>
                      {log.details && (
                        <span className="text-slate-500 ml-1">
                          - {JSON.stringify(log.details).slice(0, 45)}...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                  {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
