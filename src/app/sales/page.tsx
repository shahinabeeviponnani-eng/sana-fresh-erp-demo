'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, Eye, X, ChevronDown, ChevronUp,
  Banknote, CreditCard, QrCode, Calendar, Receipt, Edit2, Trash2, Plus, SplitSquareHorizontal,
} from 'lucide-react';
import Pagination from '@/components/ui/Pagination';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';

type SplitEntry = { method: 'CASH' | 'CARD' | 'UPI'; amount: string; cardReference: string };

const LIMIT = 25;

const methodIcon = (m: string) => {
  if (m === 'CARD') return <CreditCard className="w-3 h-3" />;
  if (m === 'UPI') return <QrCode className="w-3 h-3" />;
  return <Banknote className="w-3 h-3" />;
};

export default function SalesPage() {
  const { toast } = useToast();
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [summary, setSummary] = useState({ totalRevenue: 0, totalOrders: 0, cashTotal: 0, cardTotal: 0, upiTotal: 0 });

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<any>(null);
  const [editItems, setEditItems] = useState<Array<{ productId: number; productName?: string; sku?: string; quantity: number | string; unitPrice: number | string; unit: string }>>([]);
  const [editNotes, setEditNotes] = useState('');
  const [editProductSearch, setEditProductSearch] = useState('');
  const [editPaymentMode, setEditPaymentMode] = useState<'SINGLE' | 'SPLIT'>('SINGLE');
  const [editSingleMethod, setEditSingleMethod] = useState<'CASH' | 'CARD' | 'UPI'>('CASH');
  const [editSingleCardRef, setEditSingleCardRef] = useState('');
  const [editSplits, setEditSplits] = useState<SplitEntry[]>([
    { method: 'CASH', amount: '', cardReference: '' },
    { method: 'CARD', amount: '', cardReference: '' },
  ]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} });

  // Settle modal state
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settlingSale, setSettlingSale] = useState<any>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState<'CASH' | 'CARD' | 'UPI'>('CASH');
  const [settleCardRef, setSettleCardRef] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [settleSubmitting, setSettleSubmitting] = useState(false);

  const openSettleModal = (sale: any) => {
    const outstanding = Number(sale.total_amount) - Number(sale.amount_paid);
    setSettlingSale(sale);
    setSettleAmount(outstanding.toFixed(2));
    setSettleMethod('CASH');
    setSettleCardRef('');
    setSettleNotes('');
    setSettleModalOpen(true);
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingSale) return;
    const paying = parseFloat(settleAmount);
    if (isNaN(paying) || paying <= 0) { toast('Enter a valid amount', 'warning'); return; }
    try {
      setSettleSubmitting(true);
      const res = await fetch('/api/retail/checkout', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: settlingSale.id, amountPaid: paying, paymentMethod: settleMethod, cardReference: settleMethod === 'CARD' ? settleCardRef : undefined, notes: settleNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`Payment recorded. Sale is now ${data.newStatus}.`, 'success');
      setSettleModalOpen(false);
      fetchData(page);
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setSettleSubmitting(false); }
  };

  const fetchData = useCallback(async (p = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (search) params.set('search', search);
      if (paymentMethod) params.set('paymentMethod', paymentMethod);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const [salesRes, prodRes] = await Promise.all([
        fetch(`/api/retail/sales?${params}`),
        fetch('/api/products'),
      ]);
      const data = await salesRes.json();
      const prodData = await prodRes.json();
      setSales(data.sales || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setProducts(prodData.products || []);

      const rows = data.sales || [];
      const cash = rows.filter((r: any) => r.payment_method === 'CASH').reduce((s: number, r: any) => s + Number(r.total_amount), 0);
      const card = rows.filter((r: any) => r.payment_method === 'CARD').reduce((s: number, r: any) => s + Number(r.total_amount), 0);
      const upi = rows.filter((r: any) => r.payment_method === 'UPI').reduce((s: number, r: any) => s + Number(r.total_amount), 0);
      setSummary({ totalRevenue: 0, totalOrders: data.total, cashTotal: cash, cardTotal: card, upiTotal: upi });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, paymentMethod, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
    fetchData(1);
  }, [search, paymentMethod, dateFrom, dateTo]);

  const handleOpenEdit = (sale: any) => {
    setEditingSale(sale);
    setEditNotes(sale.notes || '');
    setEditProductSearch('');
    setEditItems((sale.items || []).map((it: any) => ({
      productId: it.productId || 0,
      productName: it.productName,
      sku: it.sku,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      unit: it.unit || 'pcs',
    })));
    // Restore payment state
    const sp = sale.split_payments;
    if (sp && Array.isArray(sp) && sp.length > 1) {
      setEditPaymentMode('SPLIT');
      setEditSplits(sp.map((s: any) => ({ method: s.method, amount: String(s.amount), cardReference: s.cardReference || '' })));
      setEditSingleMethod('CASH');
      setEditSingleCardRef('');
    } else {
      setEditPaymentMode('SINGLE');
      setEditSingleMethod(sale.payment_method === 'SPLIT' ? 'CASH' : (sale.payment_method || 'CASH'));
      setEditSingleCardRef(sale.card_reference || '');
      setEditSplits([{ method: 'CASH', amount: '', cardReference: '' }, { method: 'CARD', amount: '', cardReference: '' }]);
    }
    setEditModalOpen(true);
  };

  const handleUpdateEditItem = (index: number, field: string, value: any) => {
    setEditItems((prev) => {
      const copy = [...prev];
      if (field === 'productId') {
        const prod = products.find((p) => p.id === parseInt(value));
        if (prod) copy[index] = { productId: prod.id, productName: prod.name, sku: prod.sku, quantity: 1, unitPrice: Number(prod.retail_price), unit: prod.unit || 'pcs' };
      } else if (field === 'quantity') copy[index].quantity = value;
      else if (field === 'unitPrice') copy[index].unitPrice = value;
      return copy;
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale || editItems.length === 0) return;
    try {
      setSavingEdit(true);
      let paymentMethod: string | undefined;
      let splitPayments: any[] | undefined;
      let cardReference: string | undefined;
      if (editPaymentMode === 'SPLIT') {
        const filled = editSplits.filter(s => parseFloat(s.amount) > 0);
        if (filled.length < 2) { toast('Enter amounts for at least 2 payment methods', 'warning'); setSavingEdit(false); return; }
        splitPayments = filled.map(s => ({ method: s.method, amount: parseFloat(s.amount), cardReference: s.cardReference || undefined }));
      } else {
        paymentMethod = editSingleMethod;
        if (editSingleMethod === 'CARD') cardReference = editSingleCardRef;
      }
      const res = await fetch('/api/retail/checkout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: editingSale.id,
          items: editItems.map(it => ({ productId: it.productId, quantity: parseFloat(String(it.quantity)) || 1, unitPrice: parseFloat(String(it.unitPrice)) || 0, discount: 0 })),
          notes: editNotes,
          paymentMethod,
          splitPayments,
          cardReference,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update sale');
      toast(`Sale ${editingSale.order_number} updated.`, 'success');
      setEditModalOpen(false);
      fetchData(page);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = (sale: any) => {
    setConfirmModal({
      open: true,
      title: 'Void Sale',
      message: `Void sale "${sale.order_number}"?\n\n• All stock will be restored to warehouse.\n\nThis cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal((p) => ({ ...p, open: false }));
        try {
          const res = await fetch(`/api/retail/checkout?orderId=${sale.id}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to void sale');
          toast(data.message || `Sale ${sale.order_number} voided. Stock restored.`, 'success');
          fetchData(page);
        } catch (err: any) { toast(err.message, 'error'); }
      },
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              Retail Sales History
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
              POS Transactions
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            All counter sales processed through SANA FRESH POS.
          </p>
        </div>
        <button
          onClick={() => fetchData(page)}
          className="p-2 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Orders', value: summary.totalOrders, prefix: '', color: 'slate' },
          { label: 'Cash Sales', value: summary.cashTotal, prefix: '£', color: 'emerald' },
          { label: 'Card Sales', value: summary.cardTotal, prefix: '£', color: 'indigo' },
          { label: 'Contactless', value: summary.upiTotal, prefix: '£', color: 'cyan' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</div>
            <div className={`text-xl font-black mt-1 text-${s.color}-700 font-mono`}>
              {s.prefix}{typeof s.value === 'number' && s.prefix ? s.value.toFixed(2) : s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by order number or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
        >
          <option value="">All Methods</option>
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
          <option value="UPI">Contactless</option>
        </select>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm" />
          <span className="text-slate-400 text-xs">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{['Order #', 'Customer', 'Items', 'Total', 'Method', 'Cashier', 'Date'].map(h => (
                  <th key={h} className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase text-left">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="py-3.5 px-4">
                        <div className="h-3.5 bg-slate-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : sales.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            No sales found.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Paid / Owed</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sales.map((sale) => (
                    <React.Fragment key={sale.id}>
                      <tr className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{sale.order_number}</td>
                        <td className="py-3.5 px-4 text-slate-700">{sale.customer_name || 'Walk-in'}</td>
                        <td className="py-3.5 px-4">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold text-[11px]">
                            {sale.items?.length || 0} items
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-black text-slate-900">
                          £{Number(sale.total_amount).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            sale.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                            sale.payment_status === 'PARTIAL' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {sale.payment_status}
                          </span>
                          {sale.payment_status !== 'PAID' && (
                            <div className="text-[10px] font-mono text-rose-600 font-bold mt-0.5">
                              Owed: £{(Number(sale.total_amount) - Number(sale.amount_paid)).toFixed(2)}
                            </div>
                          )}
                          {sale.payment_status === 'PARTIAL' && (
                            <div className="text-[10px] font-mono text-emerald-600 mt-0.5">
                              Paid: £{Number(sale.amount_paid).toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            sale.payment_method === 'CARD' ? 'bg-indigo-100 text-indigo-800' :
                            sale.payment_method === 'UPI' ? 'bg-cyan-100 text-cyan-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>
                            {methodIcon(sale.payment_method)}
                            {sale.payment_method}
                          </span>
                          {sale.card_reference && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">Ref: {sale.card_reference}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {new Date(sale.created_at).toLocaleDateString('en-GB')}
                          <div className="text-[10px] text-slate-400">
                            {new Date(sale.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1">
                          <button
                            onClick={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5 text-emerald-600" />
                            {expandedId === sale.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          {sale.payment_status !== 'PAID' && (
                            <button
                              onClick={() => openSettleModal(sale)}
                              className="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg inline-flex items-center gap-1"
                            >
                              Settle
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEdit(sale)}
                            className="px-2 py-1 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg inline-flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                          <button
                            onClick={() => handleDelete(sale)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 border border-transparent hover:border-rose-200 inline-flex items-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                      {expandedId === sale.id && (
                        <tr>
                          <td colSpan={8} className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                            <div className="text-[11px] font-bold text-slate-500 uppercase mb-2">Line Items</div>
                            <div className="space-y-1">
                              {(sale.items || []).map((it: any, i: number) => (
                                <div key={i} className="flex justify-between items-center text-xs text-slate-700">
                                  <span>{it.productName} <span className="text-slate-400 font-mono text-[10px]">({it.sku})</span></span>
                                  <span className="font-mono">{it.quantity} × £{Number(it.unitPrice).toFixed(2)} = <span className="font-bold">£{Number(it.total).toFixed(2)}</span></span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 pt-2 border-t border-slate-200 flex flex-wrap justify-end gap-4 text-xs text-slate-600">
                              <span>Subtotal: <span className="font-mono font-bold">£{Number(sale.subtotal).toFixed(2)}</span></span>
                              <span>VAT: <span className="font-mono font-bold">£{Number(sale.tax_amount).toFixed(2)}</span></span>
                              <span className="text-slate-900 font-black">Total: <span className="font-mono">£{Number(sale.total_amount).toFixed(2)}</span></span>
                              <span className="text-emerald-700 font-bold">Paid: <span className="font-mono">£{Number(sale.amount_paid).toFixed(2)}</span></span>
                              {sale.payment_status !== 'PAID' && (
                                <span className="text-rose-600 font-bold">Owed: <span className="font-mono">£{(Number(sale.total_amount) - Number(sale.amount_paid)).toFixed(2)}</span></span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="block md:hidden divide-y divide-slate-100">
              {sales.map((sale) => (
                <div key={sale.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-mono font-bold text-sm text-slate-900">{sale.order_number}</div>
                      <div className="text-xs text-slate-500">{sale.customer_name || 'Walk-in'} • {sale.staff_name || '—'}</div>
                      <div className="text-[11px] text-slate-400">{new Date(sale.created_at).toLocaleString('en-GB')}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-black text-base text-slate-900">£{Number(sale.total_amount).toFixed(2)}</div>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        sale.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                        sale.payment_status === 'PARTIAL' ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {sale.payment_status}
                      </span>
                      {sale.payment_status !== 'PAID' && (
                        <div className="text-[10px] font-mono text-rose-600 font-bold mt-0.5">
                          Owed: £{(Number(sale.total_amount) - Number(sale.amount_paid)).toFixed(2)}
                        </div>
                      )}
                      {sale.card_reference && <div className="text-[10px] text-slate-400 font-mono">Ref: {sale.card_reference}</div>}
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                    className="w-full py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg flex items-center justify-center gap-1"
                  >
                    {expandedId === sale.id ? 'Hide Items' : `View ${sale.items?.length || 0} Items`}
                    {expandedId === sale.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <div className="flex gap-2">
                    {sale.payment_status !== 'PAID' && (
                      <button onClick={() => openSettleModal(sale)}
                        className="flex-1 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-center gap-1">
                        Settle
                      </button>
                    )}
                    <button onClick={() => handleOpenEdit(sale)}
                      className="flex-1 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-center gap-1">
                      <Edit2 className="w-3 h-3" /> Edit
                    </button>
                    <button onClick={() => handleDelete(sale)}
                      className="py-1.5 px-3 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Void
                    </button>
                  </div>
                  {expandedId === sale.id && (
                    <div className="space-y-1 pt-1">
                      {(sale.items || []).map((it: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs text-slate-700">
                          <span>{it.productName}</span>
                          <span className="font-mono">{it.quantity} × £{Number(it.unitPrice).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={(p) => { setPage(p); fetchData(p); }} />
      </div>

      {/* ===== EDIT SALE MODAL ===== */}
      {editModalOpen && editingSale && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[95vh] flex flex-col overflow-hidden">
            <div className="p-4 bg-amber-950 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-sm">Edit Sale — {editingSale.order_number}</h3>
                <p className="text-[11px] text-amber-300">{new Date(editingSale.created_at).toLocaleString('en-GB')} • {editingSale.customer_name || 'Walk-in'}</p>
              </div>
              <button onClick={() => setEditModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">

              {/* PRODUCT SEARCH + LINE ITEMS */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800 text-sm">Line Items</span>
                </div>
                {/* Product search to add */}
                <div className="relative mb-3">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input type="text" placeholder="Search product to add..."
                    value={editProductSearch}
                    onChange={(e) => setEditProductSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  {editProductSearch && (
                    <div className="absolute top-full left-0 right-0 z-10 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto">
                      {products.filter(p => p.name.toLowerCase().includes(editProductSearch.toLowerCase()) || p.sku.toLowerCase().includes(editProductSearch.toLowerCase())).slice(0, 8).map(p => (
                        <button key={p.id} type="button"
                          onClick={() => { setEditItems(prev => [...prev, { productId: p.id, productName: p.name, sku: p.sku, quantity: 1, unitPrice: Number(p.retail_price), unit: p.unit || 'pcs' }]); setEditProductSearch(''); }}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-amber-50 text-left">
                          <div>
                            <div className="font-semibold text-slate-900">{p.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{p.sku} • {p.stock_quantity} in stock</div>
                          </div>
                          <span className="font-mono font-bold text-emerald-700">£{Number(p.retail_price).toFixed(2)}</span>
                        </button>
                      ))}
                      {products.filter(p => p.name.toLowerCase().includes(editProductSearch.toLowerCase()) || p.sku.toLowerCase().includes(editProductSearch.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-slate-400">No products found</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Column headers */}
                <div className="hidden sm:grid grid-cols-[1fr_80px_90px_60px_28px] gap-2 px-1 mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Product</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase text-center">Qty</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase text-right">Unit Price (£)</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase text-right">Total</span>
                  <span />
                </div>
                <div className="space-y-2">
                  {editItems.map((item, index) => {
                    const qty = parseFloat(String(item.quantity)) || 0;
                    const rate = parseFloat(String(item.unitPrice)) || 0;
                    return (
                      <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_90px_60px_28px] gap-2 items-center p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                        <div>
                          <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase mb-0.5 block">Product</label>
                          <select value={item.productId} onChange={(e) => handleUpdateEditItem(index, 'productId', e.target.value)}
                            className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg font-medium text-xs focus:outline-none focus:ring-2 focus:ring-amber-400">
                            {products.map(p => <option key={p.id} value={p.id}>{p.name} — £{Number(p.retail_price).toFixed(2)}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase mb-0.5 block">Qty</label>
                          <input type="number" step="any" min="0.01" placeholder="Qty" value={item.quantity}
                            onChange={(e) => handleUpdateEditItem(index, 'quantity', e.target.value)}
                            className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-center font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                        <div>
                          <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase mb-0.5 block">Unit Price (£)</label>
                          <input type="number" step="0.01" min="0" placeholder="Price" value={item.unitPrice}
                            onChange={(e) => handleUpdateEditItem(index, 'unitPrice', e.target.value)}
                            className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-right font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                        <div className="text-right font-mono font-black text-slate-900 text-xs">
                          <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase mb-0.5 block">Total</label>
                          £{(qty * rate).toFixed(2)}
                        </div>
                        <button type="button" onClick={() => setEditItems(editItems.filter((_, i) => i !== index))}
                          className="text-slate-400 hover:text-rose-600 p-1 justify-self-end"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ORDER TOTAL */}
              <div className="p-3 bg-slate-100 rounded-xl flex justify-between items-center">
                <span className="font-bold text-slate-700">Order Total:</span>
                <span className="font-mono font-black text-base text-slate-900">
                  £{editItems.reduce((s, it) => s + (parseFloat(String(it.quantity)) || 0) * (parseFloat(String(it.unitPrice)) || 0), 0).toFixed(2)}
                </span>
              </div>

              {/* PAYMENT */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-sm">Payment</span>
                  <div className="flex bg-slate-100 p-0.5 rounded-lg">
                    <button type="button" onClick={() => setEditPaymentMode('SINGLE')}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors ${ editPaymentMode === 'SINGLE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500' }`}>
                      Single
                    </button>
                    <button type="button" onClick={() => setEditPaymentMode('SPLIT')}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors flex items-center gap-1 ${ editPaymentMode === 'SPLIT' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500' }`}>
                      <SplitSquareHorizontal className="w-3 h-3" /> Split
                    </button>
                  </div>
                </div>

                {editPaymentMode === 'SINGLE' ? (
                  <div className="space-y-2">
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Payment Method</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['CASH', 'CARD', 'UPI'] as const).map(m => (
                          <button key={m} type="button" onClick={() => setEditSingleMethod(m)}
                            className={`py-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 ${
                              editSingleMethod === m ? 'border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-400/20' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}>
                            {m === 'CASH' ? <Banknote className="w-4 h-4" /> : m === 'CARD' ? <CreditCard className="w-4 h-4" /> : <QrCode className="w-4 h-4" />}
                            {m === 'UPI' ? 'Contactless' : m}
                          </button>
                        ))}
                      </div>
                    </div>
                    {editSingleMethod === 'CARD' && (
                      <div>
                        <label className="font-bold text-slate-600 block mb-1">Card Terminal Reference</label>
                        <input type="text" value={editSingleCardRef} onChange={e => setEditSingleCardRef(e.target.value)}
                          placeholder="e.g. TXN-284738 or last 4 digits"
                          className="w-full py-2 px-3 border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-500">Enter the amount paid by each method. Amounts must add up to the order total.</p>
                    {editSplits.map((sp, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center gap-2">
                          <select value={sp.method} onChange={e => { const c = [...editSplits]; c[i].method = e.target.value as any; setEditSplits(c); }}
                            className="py-1.5 px-2 bg-white border border-slate-300 rounded-lg font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-400">
                            <option value="CASH">Cash</option>
                            <option value="CARD">Card</option>
                            <option value="UPI">Contactless</option>
                          </select>
                          <div className="flex-1 relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">£</span>
                            <input type="number" step="0.01" min="0" placeholder="Amount" value={sp.amount}
                              onChange={e => { const c = [...editSplits]; c[i].amount = e.target.value; setEditSplits(c); }}
                              className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
                          </div>
                          {editSplits.length > 2 && (
                            <button type="button" onClick={() => setEditSplits(editSplits.filter((_, j) => j !== i))}
                              className="text-slate-400 hover:text-rose-600 p-1"><X className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                        {sp.method === 'CARD' && (
                          <input type="text" placeholder="Card terminal reference" value={sp.cardReference}
                            onChange={e => { const c = [...editSplits]; c[i].cardReference = e.target.value; setEditSplits(c); }}
                            className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => setEditSplits([...editSplits, { method: 'CASH', amount: '', cardReference: '' }])}
                      className="text-xs font-bold text-amber-700 flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg">
                      <Plus className="w-3 h-3" /> Add Payment Method
                    </button>
                    <div className="flex justify-between text-xs font-bold pt-1">
                      <span className="text-slate-600">Split Total:</span>
                      <span className={`font-mono ${ Math.abs(editSplits.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0) - editItems.reduce((s, it) => s + (parseFloat(String(it.quantity)) || 0) * (parseFloat(String(it.unitPrice)) || 0), 0)) < 0.01 ? 'text-emerald-600' : 'text-rose-600' }`}>
                        £{editSplits.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* NOTES */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Notes</label>
                <input type="text" value={editNotes} onChange={e => setEditNotes(e.target.value)}
                  placeholder="e.g. Customer requested price adjustment"
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={savingEdit || editItems.length === 0}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md disabled:bg-slate-300">
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== SETTLE SALE MODAL ===== */}
      {settleModalOpen && settlingSale && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-emerald-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Record Payment — {settlingSale.order_number}</h3>
                <p className="text-[11px] text-emerald-300">{settlingSale.customer_name || 'Walk-in Customer'}</p>
              </div>
              <button onClick={() => setSettleModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSettleSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <div className="text-[10px] text-slate-500 font-semibold">Sale Total</div>
                  <div className="font-extrabold text-slate-900">£{Number(settlingSale.total_amount).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-600 font-semibold">Already Paid</div>
                  <div className="font-extrabold text-emerald-700">£{Number(settlingSale.amount_paid).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-rose-600 font-semibold">Outstanding</div>
                  <div className="font-extrabold text-rose-700">£{(Number(settlingSale.total_amount) - Number(settlingSale.amount_paid)).toFixed(2)}</div>
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Amount Received (£) *</label>
                <input type="number" step="0.01" min="0.01" required value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full py-2.5 px-3 border-2 border-emerald-400 rounded-xl font-mono font-bold text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['CASH', 'CARD', 'UPI'] as const).map(m => (
                    <button key={m} type="button" onClick={() => { setSettleMethod(m); setSettleCardRef(''); }}
                      className={`py-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 ${
                        settleMethod === m ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-400/20' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}>
                      {m === 'CASH' ? <Banknote className="w-4 h-4" /> : m === 'CARD' ? <CreditCard className="w-4 h-4" /> : <QrCode className="w-4 h-4" />}
                      {m === 'UPI' ? 'Contactless' : m}
                    </button>
                  ))}
                </div>
              </div>
              {settleMethod === 'CARD' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Card Terminal Reference *</label>
                  <input type="text" value={settleCardRef} onChange={(e) => setSettleCardRef(e.target.value)}
                    placeholder="e.g. TXN-284738 or last 4 digits"
                    className="w-full py-2 px-3 border border-slate-300 rounded-xl font-mono text-sm" />
                </div>
              )}
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Notes (optional)</label>
                <input type="text" value={settleNotes} onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="e.g. Customer paid remaining balance"
                  className="w-full py-2 px-3 border border-slate-300 rounded-xl" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setSettleModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700">Cancel</button>
                <button type="submit" disabled={settleSubmitting || (settleMethod === 'CARD' && !settleCardRef.trim())}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md">
                  {settleSubmitting ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel="Void Sale"
        danger
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((p) => ({ ...p, open: false }))}
      />
    </div>
  );
}
