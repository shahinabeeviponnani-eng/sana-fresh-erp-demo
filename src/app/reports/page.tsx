'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart as PieIcon,
  Download,
  Calendar,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Award,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reports');
      const d = await res.json();
      setData(d);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  if (loading || !data) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className="text-xs font-medium text-slate-500">Aggregating PostgreSQL Business Intelligence...</span>
        </div>
      </div>
    );
  }

  const { channels, categories, topProducts, salesTrend, receivables } = data;

  const totalRevenue = channels.reduce((sum: number, c: any) => sum + Number(c.total_revenue), 0);
  const totalCogs = channels.reduce((sum: number, c: any) => sum + Number(c.total_cogs), 0);
  const grossProfit = totalRevenue - totalCogs;
  const overallMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0';

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Financial & Omnichannel Reporting
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time Profit & Loss breakdown, wholesale margins, and inventory velocities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Export Report Summary
          </button>
        </div>
      </div>

      {/* Top Level Financial Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Gross Sales Revenue</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Combined POS & Wholesale</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Cost of Goods Sold (COGS)</div>
          <div className="text-2xl font-black text-slate-700 mt-1">
            ${totalCogs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Direct product inventory acquisition cost</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-emerald-600 uppercase">Gross Profit</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            ${grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">
            Net Margin: {overallMargin}%
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-indigo-600 uppercase">Wholesale Credit Utilization</div>
          <div className="text-2xl font-black text-indigo-900 mt-1">
            ${Number(receivables?.total_outstanding || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {receivables?.credit_utilization_percent || 0}% of ${Number(receivables?.total_credit_limit || 0).toLocaleString()} limit
          </div>
        </div>
      </div>

      {/* Channel Performance Comparison: Retail vs Wholesale */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-1">
          Channel Profitability Matrix
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Comparative breakdown between retail store registers and wholesale corporate accounts
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Sales Channel</th>
                <th className="py-2.5 px-4">Orders Count</th>
                <th className="py-2.5 px-4">Total Revenue</th>
                <th className="py-2.5 px-4">COGS (Cost)</th>
                <th className="py-2.5 px-4">Gross Profit</th>
                <th className="py-2.5 px-4">Profit Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {channels.map((ch: any) => (
                <tr key={ch.type} className="hover:bg-slate-50/70 font-medium">
                  <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        ch.type === 'WHOLESALE' ? 'bg-indigo-600' : 'bg-emerald-500'
                      }`}
                    />
                    {ch.type === 'WHOLESALE' ? 'Wholesale B2B Division' : 'Retail Direct POS'}
                  </td>
                  <td className="py-3 px-4">{ch.order_count} Orders</td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    ${Number(ch.total_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    ${Number(ch.total_cogs).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-600">
                    ${Number(ch.gross_profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
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

      {/* Category Performance Chart & Best Sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Revenue Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1">Revenue by Category</h2>
          <p className="text-xs text-slate-500 mb-4">Top grossing product lines</p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categories} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={(v) => `$${v}`} />
                <YAxis dataKey="category_name" type="category" stroke="#64748b" fontSize={10} width={90} />
                <Tooltip
                  formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'Revenue']}
                  contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="total_revenue" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 10 Best Sellers Table */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Top Selling Products</h2>
              <p className="text-xs text-slate-500">Ranked by revenue contribution</p>
            </div>
            <Award className="w-5 h-5 text-amber-500" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Units Sold</th>
                  <th className="py-2.5 px-3">Revenue</th>
                  <th className="py-2.5 px-3">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topProducts.map((p: any, idx: number) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900 truncate max-w-[160px]">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700">
                      {p.total_quantity_sold}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      ${Number(p.total_revenue_generated).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-emerald-600">
                      ${Number(p.gross_profit).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
