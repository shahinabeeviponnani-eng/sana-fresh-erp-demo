'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, Award, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';

const GBP = (v: number) =>
  '£' + Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const RANGES = [
  { label: '7 Days', value: '7days' },
  { label: '30 Days', value: '30days' },
  { label: '90 Days', value: '90days' },
  { label: '12 Months', value: '12months' },
  { label: 'All Time', value: 'all' },
];

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30days');

  const fetchReports = useCallback(async (r: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reports?range=${r}`);
      if (!res.ok) throw new Error('Failed to load reports');
      setData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReports(range); }, [range, fetchReports]);

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ['Channel', 'Orders', 'Revenue (£)', 'COGS (£)', 'Gross Profit (£)', 'Margin %'],
      ...data.channels.map((c: any) => [
        c.type, c.order_count,
        Number(c.total_revenue).toFixed(2),
        Number(c.total_cogs).toFixed(2),
        Number(c.gross_profit).toFixed(2),
        c.margin_percentage,
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sana-fresh-report-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !data) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className="text-xs font-medium text-slate-500">Loading financial data...</span>
        </div>
      </div>
    );
  }

  const { channels, categories, topProducts, salesTrend, receivables, debtAging, staffPerformance } = data;
  const totalRevenue = channels.reduce((s: number, c: any) => s + Number(c.total_revenue), 0);
  const totalCogs = channels.reduce((s: number, c: any) => s + Number(c.total_cogs), 0);
  const grossProfit = totalRevenue - totalCogs;
  const overallMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0';

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            SANA FRESH — Financial & P&L Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gross profit margins, Wholesale B2B vs Retail POS, debt ageing &amp; staff performance. All figures in GBP (£).
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Range Selector */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            {RANGES.map(r => (
              <button key={r.value} onClick={() => setRange(r.value)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${range === r.value ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'}`}>
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={exportCSV}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Gross Revenue</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{GBP(totalRevenue)}</div>
          <div className="text-[11px] text-slate-400 mt-1">POS + Wholesale combined</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">COGS</div>
          <div className="text-2xl font-black text-slate-700 mt-1">{GBP(totalCogs)}</div>
          <div className="text-[11px] text-slate-400 mt-1">Cost of goods sold</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-emerald-600 uppercase">Gross Profit</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{GBP(grossProfit)}</div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">Margin: {overallMargin}%</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-rose-600 uppercase">Outstanding Receivables</div>
          <div className="text-2xl font-black text-rose-700 mt-1">{GBP(Number(receivables?.total_outstanding || 0))}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {receivables?.credit_utilization_percent || 0}% of {GBP(Number(receivables?.total_credit_limit || 0))} limit
          </div>
        </div>
      </div>

      {/* Sales Trend Line Chart */}
      {salesTrend?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1">Daily Sales Trend</h2>
          <p className="text-xs text-slate-500 mb-4">Retail POS vs Wholesale B2B revenue over selected period</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesTrend} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date_label" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `£${v}`} />
                <Tooltip formatter={(val: any) => [`£${Number(val).toFixed(2)}`]}
                  contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '8px', fontSize: '12px' }} />
                <Legend />
                <Line type="monotone" dataKey="retail_sales" name="Retail POS" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="wholesale_sales" name="Wholesale B2B" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Channel Profitability Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-1">Channel Profitability Matrix</h2>
        <p className="text-xs text-slate-500 mb-4">Retail store registers vs wholesale corporate accounts</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Channel</th>
                <th className="py-2.5 px-4">Orders</th>
                <th className="py-2.5 px-4">Revenue</th>
                <th className="py-2.5 px-4">COGS</th>
                <th className="py-2.5 px-4">Gross Profit</th>
                <th className="py-2.5 px-4">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {channels.map((ch: any) => (
                <tr key={ch.type} className="hover:bg-slate-50/70 font-medium">
                  <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${ch.type === 'WHOLESALE' ? 'bg-indigo-600' : 'bg-emerald-500'}`} />
                    {ch.type === 'WHOLESALE' ? 'Wholesale B2B' : 'Retail POS'}
                  </td>
                  <td className="py-3 px-4">{ch.order_count}</td>
                  <td className="py-3 px-4 font-bold">{GBP(Number(ch.total_revenue))}</td>
                  <td className="py-3 px-4 text-slate-600">{GBP(Number(ch.total_cogs))}</td>
                  <td className="py-3 px-4 font-bold text-emerald-600">{GBP(Number(ch.gross_profit))}</td>
                  <td className="py-3 px-4">
                    <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded font-extrabold text-[11px]">
                      {ch.margin_percentage}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Chart + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1">Revenue by Category</h2>
          <p className="text-xs text-slate-500 mb-4">Top grossing product lines</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categories} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={(v) => `£${v}`} />
                <YAxis dataKey="category_name" type="category" stroke="#64748b" fontSize={10} width={90} />
                <Tooltip formatter={(val: any) => [`£${Number(val).toLocaleString('en-GB')}`, 'Revenue']}
                  contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="total_revenue" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Top Selling Products</h2>
              <p className="text-xs text-slate-500">Ranked by revenue</p>
            </div>
            <Award className="w-5 h-5 text-amber-500" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Units</th>
                  <th className="py-2.5 px-3">Revenue</th>
                  <th className="py-2.5 px-3">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topProducts.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900 truncate max-w-[150px]">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold">{Number(p.total_quantity_sold).toFixed(2)}</td>
                    <td className="py-2.5 px-3 font-bold">{GBP(Number(p.total_revenue_generated))}</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-600">{GBP(Number(p.gross_profit))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Debt Ageing + Staff Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* UK Debt Ageing */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Wholesale Debt Ageing</h2>
              <p className="text-xs text-slate-500">Outstanding receivables by age bracket (UK standard)</p>
            </div>
          </div>
          <div className="space-y-3 text-xs">
            {[
              { label: 'Current (0–30 days)', key: 'current_0_30', color: 'bg-emerald-100 text-emerald-800' },
              { label: 'Overdue 31–60 days', key: 'overdue_31_60', color: 'bg-amber-100 text-amber-800' },
              { label: 'Overdue 61–90 days', key: 'overdue_61_90', color: 'bg-orange-100 text-orange-800' },
              { label: 'Overdue 90+ days', key: 'overdue_90_plus', color: 'bg-rose-100 text-rose-800' },
            ].map(({ label, key, color }) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
                <span className="font-semibold text-slate-700">{label}</span>
                <span className={`font-black px-2.5 py-0.5 rounded-full text-xs ${color}`}>
                  {GBP(Number(debtAging?.[key] || 0))}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Staff Sales Performance */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-indigo-500" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Staff Sales Performance</h2>
              <p className="text-xs text-slate-500">Revenue generated per team member</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Staff Member</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Orders</th>
                  <th className="py-2.5 px-3">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffPerformance?.map((s: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{s.staff_name}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {s.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700">{s.total_orders}</td>
                    <td className="py-2.5 px-3 font-bold text-indigo-700">{GBP(Number(s.total_revenue))}</td>
                  </tr>
                ))}
                {(!staffPerformance || staffPerformance.length === 0) && (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-400">No sales data for this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
