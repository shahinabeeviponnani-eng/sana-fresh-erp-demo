'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, TrendingDown, PackageX, BarChart2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';

const GBP = (v: number) => '£' + Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DAYS_OPTIONS = [
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
];

export default function StockAnalysisPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState<'turnover' | 'slow' | 'dead'>('turnover');

  const fetchData = useCallback(async (d: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/stock/analysis?days=${d}`);
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(days); }, [days, fetchData]);

  if (loading || !data) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className="text-xs font-medium text-slate-500">Analysing stock data...</span>
        </div>
      </div>
    );
  }

  const { turnover, slowMovers, deadStock, categoryBreakdown, movementTrend } = data;

  const totalDeadValue = deadStock.reduce((s: number, p: any) => s + Number(p.dead_stock_value), 0);
  const totalSlowValue = slowMovers.reduce((s: number, p: any) => s + Number(p.stock_value_at_risk), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Stock Analysis & Intelligence
            </h1>
            <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">
              Warehouse
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Turnover rates, slow movers, dead stock and category performance.
          </p>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          {DAYS_OPTIONS.map((o) => (
            <button key={o.value} onClick={() => setDays(o.value)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${days === o.value ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'}`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3">
          <PackageX className="w-8 h-8 text-rose-500 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-rose-700 uppercase">Dead Stock Value</div>
            <div className="text-xl font-black text-rose-800">{GBP(totalDeadValue)}</div>
            <div className="text-[11px] text-rose-600">{deadStock.length} SKUs — no movement 60+ days</div>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <TrendingDown className="w-8 h-8 text-amber-500 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-amber-700 uppercase">Slow Mover Value</div>
            <div className="text-xl font-black text-amber-800">{GBP(totalSlowValue)}</div>
            <div className="text-[11px] text-amber-600">{slowMovers.length} SKUs — under 5 units sold</div>
          </div>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center gap-3">
          <BarChart2 className="w-8 h-8 text-indigo-500 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-indigo-700 uppercase">Categories Tracked</div>
            <div className="text-xl font-black text-indigo-800">{categoryBreakdown.length}</div>
            <div className="text-[11px] text-indigo-600">Across all product lines</div>
          </div>
        </div>
      </div>

      {/* Movement Trend Chart */}
      {movementTrend?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1">Stock Movement Trend</h2>
          <p className="text-xs text-slate-500 mb-4">Units received (in) vs units dispatched/sold (out)</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={movementTrend} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={10}
                  tickFormatter={(v) => new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip
                  labelFormatter={(v) => new Date(v).toLocaleDateString('en-GB')}
                  contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '8px', fontSize: '12px' }} />
                <Legend />
                <Line type="monotone" dataKey="stock_in" name="Stock In" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="stock_out" name="Stock Out" stroke="#f43f5e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Category Breakdown Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-1">Stock Value by Category</h2>
        <p className="text-xs text-slate-500 mb-4">Cost value of current stock per product line</p>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryBreakdown} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={(v) => `£${v}`} />
              <YAxis dataKey="category_name" type="category" stroke="#64748b" fontSize={10} width={100} />
              <Tooltip
                formatter={(val: any, name: string) => [
                  name === 'total_cost_value' ? GBP(Number(val)) : Number(val).toFixed(0),
                  name === 'total_cost_value' ? 'Cost Value' : 'Units',
                ]}
                contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="total_cost_value" name="Cost Value" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabs: Turnover / Slow Movers / Dead Stock */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex bg-slate-50 border-b border-slate-200 text-xs font-bold">
          {([
            { key: 'turnover', label: 'Stock Turnover', icon: '📦' },
            { key: 'slow', label: `Slow Movers (${slowMovers.length})`, icon: '🐢' },
            { key: 'dead', label: `Dead Stock (${deadStock.length})`, icon: '⚠️' },
          ] as const).map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-5 py-3 transition-colors flex items-center gap-1.5 ${activeTab === t.key ? 'bg-white border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'turnover' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Stock on Hand</th>
                  <th className="py-3 px-4">Units Sold ({days}d)</th>
                  <th className="py-3 px-4">Revenue</th>
                  <th className="py-3 px-4">Turnover Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {turnover.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{p.category_name || '—'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{p.stock_quantity} {p.unit}</td>
                    <td className="py-3 px-4 font-bold text-indigo-700">{Number(p.units_sold).toFixed(1)}</td>
                    <td className="py-3 px-4 font-bold text-emerald-700">{GBP(Number(p.revenue_value))}</td>
                    <td className="py-3 px-4">
                      <span className={`font-black px-2.5 py-0.5 rounded-full text-[11px] ${
                        Number(p.turnover_ratio) >= 2 ? 'bg-emerald-100 text-emerald-800' :
                        Number(p.turnover_ratio) >= 0.5 ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {p.turnover_ratio}x
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'slow' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Stock on Hand</th>
                  <th className="py-3 px-4">Units Sold ({days}d)</th>
                  <th className="py-3 px-4">Value at Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slowMovers.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400">No slow movers in this period 🎉</td></tr>
                ) : slowMovers.map((p: any) => (
                  <tr key={p.id} className="hover:bg-amber-50/50">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{p.category_name || '—'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{p.stock_quantity} {p.unit}</td>
                    <td className="py-3 px-4 font-bold text-amber-700">{Number(p.units_sold_period).toFixed(1)}</td>
                    <td className="py-3 px-4 font-black text-amber-800">{GBP(Number(p.stock_value_at_risk))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'dead' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Stock on Hand</th>
                  <th className="py-3 px-4">Last Movement</th>
                  <th className="py-3 px-4">Dead Stock Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deadStock.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400">No dead stock found 🎉</td></tr>
                ) : deadStock.map((p: any) => (
                  <tr key={p.id} className="hover:bg-rose-50/50">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{p.category_name || '—'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{p.stock_quantity} {p.unit}</td>
                    <td className="py-3 px-4 text-rose-700 font-medium">
                      {p.last_movement ? new Date(p.last_movement).toLocaleDateString('en-GB') : 'Never'}
                    </td>
                    <td className="py-3 px-4 font-black text-rose-800">{GBP(Number(p.dead_stock_value))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
