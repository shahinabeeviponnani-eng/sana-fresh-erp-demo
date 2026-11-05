'use client';

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  History,
  TrendingUp,
  RefreshCw,
  Sliders,
  DollarSign,
  PackageCheck,
  PackageX,
  X,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function InventoryPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'STOCK' | 'LEDGER'>('STOCK');
  const [stockData, setStockData] = useState<any>(null);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Adjustment Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [adjustType, setAdjustType] = useState('ADJUSTMENT_DAMAGE');
  const [adjustQty, setAdjustQty] = useState<string>('1');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  const fetchStock = async () => {
    try {
      setLoading(true);
      const url = `/api/stock?filter=${filter}&search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      const data = await res.json();
      setStockData(data);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, [filter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStock();
  };

  const openAdjustModal = (product: any) => {
    setSelectedProduct(product);
    setAdjustType('ADJUSTMENT_DAMAGE');
    setAdjustQty('1');
    setAdjustReason('');
    setAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (!adjustReason.trim()) {
      alert('Please provide a reason for the inventory adjustment audit.');
      return;
    }

    try {
      setAdjustSubmitting(true);
      const qtyNumber = parseInt(adjustQty, 10);
      const isNegative =
        adjustType === 'ADJUSTMENT_DAMAGE' || adjustType === 'RETURN_VENDOR';
      const delta = isNegative ? -Math.abs(qtyNumber) : Math.abs(qtyNumber);

      const res = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          adjustmentType: adjustType,
          quantity: delta,
          mode: 'DELTA',
          reason: adjustReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Adjustment failed');
      }

      alert(
        `Inventory for "${selectedProduct.name}" updated! Previous: ${data.product.previousStock}, New: ${data.product.newStock}`
      );
      setAdjustModalOpen(false);
      fetchStock();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const summary = stockData?.summary || {
    total_items: 0,
    total_units: 0,
    total_cost_value: 0,
    total_retail_value: 0,
    low_stock_count: 0,
    out_of_stock_count: 0,
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Inventory & Stock Management
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
              PostgreSQL Ledger
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time warehouse tracking, low-stock alerts, valuation and audit trail movements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (stockData?.items?.length > 0) openAdjustModal(stockData.items[0]);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm"
          >
            <Sliders className="w-4 h-4" />
            <span>Audit / Adjust Stock</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Valuation (At Cost)</div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            ${Number(summary.total_cost_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{summary.total_units} Total Units</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Retail Potential</div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
            ${Number(summary.total_retail_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Estimated gross counter value</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 uppercase flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Low Stock Warning
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-700 mt-1">
            {summary.low_stock_count} SKUs
          </div>
          <div className="text-[11px] text-amber-800/80 mt-0.5">Below safe reorder levels</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-rose-600 uppercase flex items-center gap-1">
            <PackageX className="w-3.5 h-3.5" /> Out of Stock
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-700 mt-1">
            {summary.out_of_stock_count} SKUs
          </div>
          <div className="text-[11px] text-rose-800/80 mt-0.5">Zero availability</div>
        </div>
      </div>

      {/* Tab Switcher & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold w-fit">
          <button
            onClick={() => setActiveTab('STOCK')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'STOCK' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Boxes className="w-4 h-4" /> Live Stock Levels
          </button>
          <button
            onClick={() => setActiveTab('LEDGER')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'LEDGER' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" /> Stock Movements Ledger
          </button>
        </div>

        {activeTab === 'STOCK' && (
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search SKU or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="py-1.5 px-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 font-medium"
            >
              <option value="all">All Products</option>
              <option value="low_stock">Low Stock Only</option>
              <option value="out_of_stock">Out of Stock Only</option>
            </select>
          </form>
        )}
      </div>

      {/* Main Content: Stock Table or Movements Ledger */}
      {activeTab === 'STOCK' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">SKU / Barcode</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Cost Price</th>
                  <th className="py-3 px-4">Retail / Wholesale</th>
                  <th className="py-3 px-4">Stock on Hand</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockData?.items?.map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-slate-900">{item.sku}</div>
                      <div className="text-[10px] text-slate-400">{item.barcode || 'N/A'}</div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {item.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {item.category_name}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                      ${Number(item.cost_price).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <div className="text-emerald-600 font-bold">
                        R: ${Number(item.retail_price).toFixed(2)}
                      </div>
                      <div className="text-indigo-600 font-semibold text-[11px]">
                        W: ${Number(item.wholesale_price).toFixed(2)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-sm">
                      <span className={item.stock_quantity <= item.reorder_level ? 'text-amber-600' : 'text-slate-900'}>
                        {item.stock_quantity}
                      </span>{' '}
                      <span className="text-xs text-slate-400 font-normal">{item.unit}</span>
                      <div className="text-[10px] text-slate-400 font-normal">
                        Reorder at: {item.reorder_level}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.stock_status === 'IN_STOCK'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.stock_status === 'LOW_STOCK'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.stock_status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => openAdjustModal(item)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold shadow-sm"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Stock Movements Ledger */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Audit Movement Ledger</h3>
            <span className="text-xs text-slate-500">Last 20 transactions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Movement Type</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Quantity Change</th>
                  <th className="py-3 px-4">Ledger Stock</th>
                  <th className="py-3 px-4">Ref #</th>
                  <th className="py-3 px-4">Staff & Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockData?.movements?.map((m: any) => (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(m.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 font-mono text-[11px]">
                        {m.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{m.product_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{m.sku}</div>
                    </td>
                    <td className="py-3 px-4 font-bold text-sm">
                      <span className={m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity} {m.unit}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {m.previous_stock} &rarr; <span className="font-bold text-slate-900">{m.new_stock}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 text-[11px]">
                      {m.reference_id || 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{m.staff_name || 'System'}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-xs">{m.reason}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= ADJUST STOCK MODAL ================= */}
      {adjustModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Stock Adjustment & Audit</h3>
              </div>
              <button
                onClick={() => setAdjustModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Product</label>
                <div className="p-2.5 rounded-lg bg-slate-100 font-semibold text-slate-900">
                  {selectedProduct.name} ({selectedProduct.sku})
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                    Current on hand: {selectedProduct.stock_quantity} {selectedProduct.unit}
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Adjustment Reason Type *</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
                >
                  <option value="ADJUSTMENT_DAMAGE">Damaged / Expired Goods (-)</option>
                  <option value="ADJUSTMENT_FOUND">Surplus Found in Audit (+)</option>
                  <option value="COUNT_CORRECTION">Cycle Count Correction (+/-)</option>
                  <option value="RETURN_CUSTOMER">Customer Return / Restock (+)</option>
                  <option value="RETURN_VENDOR">Return to Vendor (-)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Quantity ({selectedProduct.unit}) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg font-bold text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Audit Justification & Notes *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Water damage in Section B aisle 4, verified by stock clerk"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-md"
                >
                  {adjustSubmitting ? 'Recording Movement...' : 'Apply & Log Audit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
