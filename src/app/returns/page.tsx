'use client';

import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Plus,
  X,
  Trash2,
  RefreshCw,
  ArrowLeftRight,
  Search,
  CheckCircle,
  AlertTriangle,
  Edit,
  Clock,
  Building2,
  Calendar,
  DollarSign,
  User,
  Package,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Pagination from '@/components/ui/Pagination';

export default function ReturnsPage() {
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'SALES' | 'PURCHASE'>('SALES');
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} });

  // Permissions
  const canEdit = hasPermission('edit_invoices') || hasPermission('manage_pos_intake') || user?.role === 'ADMIN';
  const canDelete = hasPermission('delete_invoices') || hasPermission('manage_pos_intake') || user?.role === 'ADMIN';

  // Sales returns state
  const [salesReturns, setSalesReturns] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [srSearchQuery, setSrSearchQuery] = useState('');
  const [srSearchResults, setSrSearchResults] = useState<any[]>([]);
  const [srSearching, setSrSearching] = useState(false);
  const [srModalOpen, setSrModalOpen] = useState(false);
  const [srSelectedOrder, setSrSelectedOrder] = useState<any>(null);
  const [srItems, setSrItems] = useState<any[]>([]);
  const [srReason, setSrReason] = useState('');
  const [srNotes, setSrNotes] = useState('');
  const [srSubmitting, setSrSubmitting] = useState(false);

  // Edit Sales Return State
  const [editingSR, setEditingSR] = useState<any>(null);
  const [editSrModalOpen, setEditSrModalOpen] = useState(false);
  const [editSrItems, setEditSrItems] = useState<any[]>([]);
  const [editSrReason, setEditSrReason] = useState('');
  const [editSrNotes, setEditSrNotes] = useState('');
  const [savingEditSR, setSavingEditSR] = useState(false);

  // Purchase returns state
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([]);
  const [receivedPOs, setReceivedPOs] = useState<any[]>([]);
  const [prSearchQuery, setPrSearchQuery] = useState('');
  const [prSearchResults, setPrSearchResults] = useState<any[]>([]);
  const [prSearching, setPrSearching] = useState(false);
  const [prModalOpen, setPrModalOpen] = useState(false);
  const [prSelectedPO, setPrSelectedPO] = useState<any>(null);
  const [prItems, setPrItems] = useState<any[]>([]);
  const [prReason, setPrReason] = useState('');
  const [prNotes, setPrNotes] = useState('');
  const [prSubmitting, setPrSubmitting] = useState(false);

  // Edit Purchase Return State
  const [editingPR, setEditingPR] = useState<any>(null);
  const [editPrModalOpen, setEditPrModalOpen] = useState(false);
  const [editPrItems, setEditPrItems] = useState<any[]>([]);
  const [editPrReason, setEditPrReason] = useState('');
  const [editPrNotes, setEditPrNotes] = useState('');
  const [savingEditPR, setSavingEditPR] = useState(false);

  const [loading, setLoading] = useState(true);
  const [srPage, setSrPage] = useState(1);
  const [prPage, setPrPage] = useState(1);
  const [srTotal, setSrTotal] = useState(0);
  const [prTotal, setPrTotal] = useState(0);
  const [srTotalPages, setSrTotalPages] = useState(1);
  const [prTotalPages, setPrTotalPages] = useState(1);
  const LIMIT = 25;

  const fetchData = async (sp = srPage, pp = prPage) => {
    setLoading(true);
    try {
      const [srRes, prRes] = await Promise.all([
        fetch(`/api/returns/sales?page=${sp}&limit=${LIMIT}`),
        fetch(`/api/returns/purchases?page=${pp}&limit=${LIMIT}`),
      ]);
      const srData = await srRes.json();
      const prData = await prRes.json();
      setSalesReturns(srData.returns || []);
      setSrTotal(srData.total || 0);
      setSrTotalPages(srData.totalPages || 1);
      setRecentOrders(srData.recentOrders || []);
      setSrSearchResults(srData.recentOrders || []);
      setPurchaseReturns(prData.returns || []);
      setPrTotal(prData.total || 0);
      setPrTotalPages(prData.totalPages || 1);
      setReceivedPOs(prData.receivedPOs || []);
      setPrSearchResults(prData.receivedPOs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Debounced server-side search for sales orders
  useEffect(() => {
    if (!srModalOpen) return;
    const t = setTimeout(async () => {
      setSrSearching(true);
      try {
        const url = srSearchQuery.trim() ? `/api/returns/sales?search=${encodeURIComponent(srSearchQuery)}` : '/api/returns/sales';
        const res = await fetch(url);
        const data = await res.json();
        setSrSearchResults(data.recentOrders || []);
      } catch {}
      finally { setSrSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [srSearchQuery, srModalOpen]);

  // Debounced server-side search for received POs
  useEffect(() => {
    if (!prModalOpen) return;
    const t = setTimeout(async () => {
      setPrSearching(true);
      try {
        const url = prSearchQuery.trim() ? `/api/returns/purchases?search=${encodeURIComponent(prSearchQuery)}` : '/api/returns/purchases';
        const res = await fetch(url);
        const data = await res.json();
        setPrSearchResults(data.receivedPOs || []);
      } catch {}
      finally { setPrSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [prSearchQuery, prModalOpen]);

  // Filtered sales orders for searchable picker
  const filteredSalesOrders = srSearchResults;

  // Filtered POs for searchable picker
  const filteredPOs = prSearchResults;

  // ---- Sales Return helpers ----
  const openSRModal = () => {
    setSrSelectedOrder(null);
    setSrSearchQuery('');
    setSrItems([]);
    setSrReason('');
    setSrNotes('');
    setSrModalOpen(true);
  };

  const handleSelectOrder = (order: any) => {
    setSrSelectedOrder(order);
    if (order) {
      setSrItems(
        (order.items || [])
          .filter((i: any) => i.productId)
          .map((i: any) => ({
            productId: i.productId,
            productName: i.productName,
            sku: i.sku,
            maxQty: Number(i.quantity),
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice),
            disposition: 'RESTOCK',
            batchId: null,
            damageNotes: '',
          }))
      );
    }
  };

  const handleSRSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srSelectedOrder) return toast('Select an order', 'warning');
    if (srItems.length === 0) return toast('Select at least one item to return', 'warning');
    setSrSubmitting(true);
    try {
      const res = await fetch('/api/returns/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: srSelectedOrder.id,
          orderNumber: srSelectedOrder.order_number,
          customerId: srSelectedOrder.customer_id,
          items: srItems,
          reason: srReason,
          notes: srNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`Sales Return ${data.returnNumber} processed. Refund: £${Number(data.totalRefund).toFixed(2)}`, 'success');
      setSrModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSrSubmitting(false);
    }
  };

  // Open Edit Sales Return Modal
  const handleOpenEditSR = (r: any) => {
    setEditingSR(r);
    setEditSrReason(r.reason || '');
    setEditSrNotes(r.notes || '');
    const mappedItems = (r.items || [])
      .filter((i: any) => i.id)
      .map((i: any) => ({
        productId: i.productId || i.product_id,
        productName: i.productName || i.product_name,
        sku: i.sku,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice || i.unit_price),
        disposition: i.disposition || 'RESTOCK',
        damageNotes: i.damageNotes || i.damage_notes || '',
        batchId: i.batchId || i.batch_id || null,
      }));
    setEditSrItems(mappedItems);
    setEditSrModalOpen(true);
  };

  const handleSaveEditSR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSR) return;
    if (editSrItems.length === 0) return toast('Return must have at least one item', 'warning');
    setSavingEditSR(true);
    try {
      const res = await fetch('/api/returns/sales', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnId: editingSR.id,
          items: editSrItems,
          reason: editSrReason,
          notes: editSrNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(data.message || 'Sales Return updated successfully', 'success');
      setEditSrModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSavingEditSR(false);
    }
  };

  const handleDeleteSR = async (r: any) => {
    setConfirmModal({
      open: true,
      title: 'Delete Sales Return',
      message: `Delete Sales Return "${r.return_number}"?\n\n• Any restocked inventory will be deducted from warehouse.\n• Customer balance will be restored.\n\nThis cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal((p) => ({ ...p, open: false }));
        try {
          const res = await fetch(`/api/returns/sales?returnId=${r.id}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          toast(data.message || `Sales Return ${r.return_number} deleted.`, 'success');
          fetchData();
        } catch (err: any) { toast(err.message, 'error'); }
      },
    });
  };

  // ---- Purchase Return helpers ----
  const openPRModal = () => {
    setPrSelectedPO(null);
    setPrSearchQuery('');
    setPrItems([]);
    setPrReason('');
    setPrNotes('');
    setPrModalOpen(true);
  };

  const handleSelectPO = (po: any) => {
    setPrSelectedPO(po);
    if (po) {
      setPrItems(
        (po.items || [])
          .filter((i: any) => i.productId)
          .map((i: any) => ({
            productId: i.productId,
            productName: i.productName,
            sku: i.sku,
            maxQty: Number(i.quantityReceived || 1),
            quantity: 1,
            unitCost: Number(i.unitCost),
            batchId: i.batchId || null,
            reason: '',
          }))
      );
    }
  };

  const handlePRSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prSelectedPO) return toast('Select a Purchase Order', 'warning');
    if (prItems.length === 0) return toast('Select at least one item to return', 'warning');
    setPrSubmitting(true);
    try {
      const res = await fetch('/api/returns/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poId: prSelectedPO.id,
          poNumber: prSelectedPO.po_number,
          vendorId: prSelectedPO.vendor_id,
          items: prItems,
          reason: prReason,
          notes: prNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`Purchase Return ${data.returnNumber} processed. Credit: £${Number(data.totalCredit).toFixed(2)}`, 'success');
      setPrModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setPrSubmitting(false);
    }
  };

  // Open Edit Purchase Return Modal
  const handleOpenEditPR = (r: any) => {
    setEditingPR(r);
    setEditPrReason(r.reason || '');
    setEditPrNotes(r.notes || '');
    const mappedItems = (r.items || [])
      .filter((i: any) => i.id)
      .map((i: any) => ({
        productId: i.productId || i.product_id,
        productName: i.productName || i.product_name,
        sku: i.sku,
        quantity: Number(i.quantity),
        unitCost: Number(i.unitCost || i.unit_cost),
        batchId: i.batchId || i.batch_id || null,
        reason: i.reason || '',
      }));
    setEditPrItems(mappedItems);
    setEditPrModalOpen(true);
  };

  const handleSaveEditPR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPR) return;
    if (editPrItems.length === 0) return toast('Return must have at least one item', 'warning');
    setSavingEditPR(true);
    try {
      const res = await fetch('/api/returns/purchases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnId: editingPR.id,
          items: editPrItems,
          reason: editPrReason,
          notes: editPrNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(data.message || 'Purchase Return updated successfully', 'success');
      setEditPrModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSavingEditPR(false);
    }
  };

  const handleDeletePR = async (r: any) => {
    setConfirmModal({
      open: true,
      title: 'Delete Purchase Return',
      message: `Delete Purchase Return "${r.return_number}"?\n\n• The returned stock will be restored back into warehouse.\n• Vendor credit note will be reversed.\n\nThis cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal((p) => ({ ...p, open: false }));
        try {
          const res = await fetch(`/api/returns/purchases?returnId=${r.id}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          toast(data.message || `Purchase Return ${r.return_number} deleted.`, 'success');
          fetchData();
        } catch (err: any) { toast(err.message, 'error'); }
      },
    });
  };

  return (
    <>
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Returns Management</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Searchable sales returns (restock or damage write-off) and purchase returns to farm suppliers with live stock sync.
          </p>
        </div>
        <button
          onClick={activeTab === 'SALES' ? openSRModal : openPRModal}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {activeTab === 'SALES' ? 'New Sales Return' : 'New Purchase Return'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold w-fit">
        <button
          onClick={() => setActiveTab('SALES')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'SALES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <RotateCcw className="w-4 h-4" /> Sales Returns ({srTotal})
        </button>
        <button
          onClick={() => setActiveTab('PURCHASE')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'PURCHASE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" /> Purchase Returns ({prTotal})
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading returns...
          </div>
        ) : activeTab === 'SALES' ? (
          salesReturns.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <RotateCcw className="w-10 h-10 mx-auto mb-2 text-slate-300" /> No sales returns recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Return #</th>
                    <th className="py-3 px-4">Original Order</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Items Returned</th>
                    <th className="py-3 px-4">Refund (£)</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesReturns.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{r.return_number}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-700">{r.original_order_number || '—'}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{r.company_name || r.customer_name || 'Walk-in'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <span className="font-bold">{(r.items || []).filter((i: any) => i.id).length} items</span>
                        <div className="text-[10px] text-slate-500 flex flex-wrap gap-1 mt-0.5">
                          {(r.items || [])
                            .filter((i: any) => i.id)
                            .map((i: any) => (
                              <span
                                key={i.id}
                                className={`px-1.5 py-0.5 rounded font-mono font-bold text-[9px] ${
                                  i.disposition === 'DAMAGE'
                                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {i.sku} ({i.disposition} ×{i.quantity})
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-black text-rose-700 text-sm">£{Number(r.total_refund).toFixed(2)}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{r.reason}</td>
                      <td className="py-3 px-4 text-slate-500">{new Date(r.return_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit && (
                            <button
                              onClick={() => handleOpenEditSR(r)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-sm"
                            >
                              <Edit className="w-3 h-3" /> Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteSR(r)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-sm"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : purchaseReturns.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <ArrowLeftRight className="w-10 h-10 mx-auto mb-2 text-slate-300" /> No purchase returns recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Return #</th>
                  <th className="py-3 px-4">Original PO</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Items Returned</th>
                  <th className="py-3 px-4">Credit (£)</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseReturns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{r.return_number}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-indigo-700">{r.original_po_number || '—'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{r.vendor_company || r.vendor_name}</td>
                    <td className="py-3 px-4 text-slate-700">
                      <span className="font-bold">{(r.items || []).filter((i: any) => i.id).length} items</span>
                      <div className="text-[10px] text-slate-500 flex flex-wrap gap-1 mt-0.5">
                        {(r.items || [])
                          .filter((i: any) => i.id)
                          .map((i: any) => (
                            <span
                              key={i.id}
                              className="px-1.5 py-0.5 rounded font-mono font-bold text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200"
                            >
                              {i.sku} (×{i.quantity})
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-black text-indigo-700 text-sm">£{Number(r.total_credit).toFixed(2)}</td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{r.reason}</td>
                    <td className="py-3 px-4 text-slate-500">{new Date(r.return_date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canEdit && (
                          <button
                            onClick={() => handleOpenEditPR(r)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-sm"
                          >
                            <Edit className="w-3 h-3" /> Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDeletePR(r)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-sm"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {activeTab === 'SALES'
          ? <Pagination page={srPage} totalPages={srTotalPages} total={srTotal} limit={LIMIT} onPageChange={(p) => { setSrPage(p); fetchData(p, prPage); }} />
          : <Pagination page={prPage} totalPages={prTotalPages} total={prTotal} limit={LIMIT} onPageChange={(p) => { setPrPage(p); fetchData(srPage, p); }} />
        }
      </div>

      {/* ================= NEW SALES RETURN MODAL (WITH SEARCHABLE SALES) ================= */}
      {srModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-emerald-400" /> New Sales Return (Restock &amp; Refund)
              </h3>
              <button onClick={() => setSrModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSRSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {/* SEARCHABLE SALES SELECTOR */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Select Original Sale / Invoice *
                </label>

                {srSelectedOrder ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-emerald-800 text-sm">{srSelectedOrder.order_number}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-900">
                          {srSelectedOrder.type || 'SALE'}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {srSelectedOrder.company_name || srSelectedOrder.customer_name || 'Walk-in Retail Customer'}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Date: {new Date(srSelectedOrder.created_at).toLocaleDateString()} • Total: £{Number(srSelectedOrder.total_amount).toFixed(2)} • {srSelectedOrder.items?.length || 0} line items
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSrSelectedOrder(null);
                        setSrItems([]);
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-sm"
                    >
                      Change Sale
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        autoFocus
                        value={srSearchQuery}
                        onChange={(e) => setSrSearchQuery(e.target.value)}
                        placeholder="Search by Invoice # (e.g. INV-39584, POS-...), Customer name, Date..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-xs"
                      />
                      {srSearching && <RefreshCw className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400 animate-spin" />}
                    </div>

                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white shadow-inner">
                      {filteredSalesOrders.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-xs">
                          No matching sales orders found. Try a different search.
                        </div>
                      ) : (
                        filteredSalesOrders.map((o) => (
                          <div
                            key={o.id}
                            onClick={() => handleSelectOrder(o)}
                            className="p-2.5 hover:bg-emerald-50/60 cursor-pointer flex items-center justify-between transition-colors group"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900 group-hover:text-emerald-700">
                                  {o.order_number}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 rounded text-slate-600 font-semibold">
                                  {o.type}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-600 font-medium">
                                {o.company_name || o.customer_name || 'Walk-in Customer'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-extrabold text-slate-900 text-xs">
                                £{Number(o.total_amount).toFixed(2)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {new Date(o.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* RETURN ITEMS TABLE */}
              {srItems.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-700">Select Items &amp; Disposition</label>
                    <span className="text-[11px] text-slate-400">{srItems.length} items available</span>
                  </div>

                  {srItems.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{item.productName}</span>
                        <span className="font-mono text-[11px] text-slate-500">{item.sku}</span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500 text-[11px]">Qty (max {item.maxQty}):</span>
                          <input
                            type="number"
                            min="1"
                            max={item.maxQty}
                            value={item.quantity}
                            onChange={(e) => {
                              const copy = [...srItems];
                              copy[idx].quantity = Math.min(item.maxQty, Math.max(1, parseInt(e.target.value) || 1));
                              setSrItems(copy);
                            }}
                            className="w-16 py-1 px-2 border border-slate-300 rounded text-center font-bold"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-slate-500 text-[11px]">Disposition:</span>
                          <select
                            value={item.disposition}
                            onChange={(e) => {
                              const copy = [...srItems];
                              copy[idx].disposition = e.target.value;
                              setSrItems(copy);
                            }}
                            className={`py-1 px-2 border rounded font-bold text-xs ${
                              item.disposition === 'DAMAGE'
                                ? 'border-rose-300 bg-rose-50 text-rose-700'
                                : 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            <option value="RESTOCK">Restock into Inventory</option>
                            <option value="DAMAGE">Write Off (Damaged / Spoiled)</option>
                          </select>
                        </div>

                        <span className="font-extrabold text-slate-900 ml-auto font-mono text-sm">
                          £{(item.quantity * item.unitPrice).toFixed(2)}
                        </span>

                        <button
                          type="button"
                          onClick={() => setSrItems(srItems.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {item.disposition === 'DAMAGE' && (
                        <input
                          type="text"
                          placeholder="Damage justification note (required for inventory write-off)"
                          value={item.damageNotes}
                          onChange={(e) => {
                            const copy = [...srItems];
                            copy[idx].damageNotes = e.target.value;
                            setSrItems(copy);
                          }}
                          className="w-full py-1.5 px-2.5 border border-rose-300 rounded-lg bg-rose-50 placeholder-rose-400 text-rose-800 text-xs"
                        />
                      )}
                    </div>
                  ))}

                  <div className="p-3 bg-slate-100 rounded-xl flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">Total Calculated Refund:</span>
                    <span className="font-mono font-black text-base text-slate-900">
                      £{srItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Return Reason *</label>
                <input
                  type="text"
                  required
                  value={srReason}
                  onChange={(e) => setSrReason(e.target.value)}
                  placeholder="e.g. Overripe produce, damaged box, customer exchange"
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Staff Notes</label>
                <textarea
                  rows={2}
                  value={srNotes}
                  onChange={(e) => setSrNotes(e.target.value)}
                  placeholder="Internal audit notes..."
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSrModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={srSubmitting || !srSelectedOrder || srItems.length === 0}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {srSubmitting ? 'Processing Return...' : 'Confirm Return & Sync Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT SALES RETURN MODAL ================= */}
      {editSrModalOpen && editingSR && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Edit className="w-4 h-4 text-amber-400" /> Edit Sales Return: {editingSR.return_number}
              </h3>
              <button onClick={() => setEditSrModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSR} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
                <div>
                  <span className="font-mono font-bold text-slate-900">{editingSR.return_number}</span>
                  <div className="text-[11px] text-slate-600">
                    Original Order: {editingSR.original_order_number || '—'} • Customer: {editingSR.company_name || editingSR.customer_name || 'Walk-in'}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">Edit Return Items &amp; Quantities</label>
                {editSrItems.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{item.productName}</span>
                      <span className="font-mono text-[11px] text-slate-500">{item.sku}</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 text-[11px]">Qty:</span>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const copy = [...editSrItems];
                            copy[idx].quantity = Math.max(1, parseInt(e.target.value) || 1);
                            setEditSrItems(copy);
                          }}
                          className="w-16 py-1 px-2 border border-slate-300 rounded text-center font-bold"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 text-[11px]">Disposition:</span>
                        <select
                          value={item.disposition}
                          onChange={(e) => {
                            const copy = [...editSrItems];
                            copy[idx].disposition = e.target.value;
                            setEditSrItems(copy);
                          }}
                          className="py-1 px-2 border rounded font-bold text-xs"
                        >
                          <option value="RESTOCK">Restock into Inventory</option>
                          <option value="DAMAGE">Write Off (Damaged / Spoiled)</option>
                        </select>
                      </div>

                      <span className="font-extrabold text-slate-900 ml-auto font-mono text-sm">
                        £{(item.quantity * item.unitPrice).toFixed(2)}
                      </span>

                      <button
                        type="button"
                        onClick={() => setEditSrItems(editSrItems.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {item.disposition === 'DAMAGE' && (
                      <input
                        type="text"
                        placeholder="Damage notes..."
                        value={item.damageNotes}
                        onChange={(e) => {
                          const copy = [...editSrItems];
                          copy[idx].damageNotes = e.target.value;
                          setEditSrItems(copy);
                        }}
                        className="w-full py-1.5 px-2 border border-rose-300 rounded bg-rose-50 text-rose-800 text-xs"
                      />
                    )}
                  </div>
                ))}

                <div className="p-3 bg-slate-100 rounded-xl flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">Recalculated Refund:</span>
                  <span className="font-mono font-black text-base text-slate-900">
                    £{editSrItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Return Reason</label>
                <input
                  type="text"
                  required
                  value={editSrReason}
                  onChange={(e) => setEditSrReason(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editSrNotes}
                  onChange={(e) => setEditSrNotes(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditSrModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEditSR || editSrItems.length === 0}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md shadow-amber-600/20"
                >
                  {savingEditSR ? 'Saving Changes...' : 'Save & Sync Stock/Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= NEW PURCHASE RETURN MODAL (WITH SEARCHABLE POS) ================= */}
      {prModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-indigo-400" /> New Purchase Return to Vendor
              </h3>
              <button onClick={() => setPrModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePRSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {/* SEARCHABLE PO SELECTOR */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Select Received Purchase Order *
                </label>

                {prSelectedPO ? (
                  <div className="p-3 bg-indigo-50 border border-indigo-300 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-indigo-900 text-sm">{prSelectedPO.po_number}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-200 text-indigo-900">
                          RECEIVED
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {prSelectedPO.vendor_company || prSelectedPO.vendor_name}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Received: {new Date(prSelectedPO.received_at || prSelectedPO.created_at).toLocaleDateString()} • Total: £{Number(prSelectedPO.total_amount).toFixed(2)} • {prSelectedPO.items?.length || 0} line items
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPrSelectedPO(null);
                        setPrItems([]);
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-sm"
                    >
                      Change PO
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        autoFocus
                        value={prSearchQuery}
                        onChange={(e) => setPrSearchQuery(e.target.value)}
                        placeholder="Search by PO # (e.g. PO-2026-...), Vendor name, Date..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-xs"
                      />
                      {prSearching && <RefreshCw className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400 animate-spin" />}
                    </div>

                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white shadow-inner">
                      {filteredPOs.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-xs">
                          No received purchase orders match your search.
                        </div>
                      ) : (
                        filteredPOs.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => handleSelectPO(p)}
                            className="p-2.5 hover:bg-indigo-50/60 cursor-pointer flex items-center justify-between transition-colors group"
                          >
                            <div>
                              <span className="font-mono font-bold text-slate-900 group-hover:text-indigo-700">
                                {p.po_number}
                              </span>
                              <div className="text-[11px] text-slate-600 font-medium">
                                {p.vendor_company || p.vendor_name}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-extrabold text-slate-900 text-xs">
                                £{Number(p.total_amount).toFixed(2)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {new Date(p.received_at || p.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* PR ITEMS TABLE */}
              {prItems.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-700">Select Items to Return to Vendor</label>
                    <span className="text-[11px] text-slate-400">{prItems.length} items available</span>
                  </div>

                  {prItems.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{item.productName}</span>
                        <span className="font-mono text-[11px] text-slate-500">{item.sku}</span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500 text-[11px]">Qty (max {item.maxQty}):</span>
                          <input
                            type="number"
                            min="1"
                            max={item.maxQty}
                            value={item.quantity}
                            onChange={(e) => {
                              const copy = [...prItems];
                              copy[idx].quantity = Math.min(item.maxQty, Math.max(1, parseInt(e.target.value) || 1));
                              setPrItems(copy);
                            }}
                            className="w-16 py-1 px-2 border border-slate-300 rounded text-center font-bold"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-slate-500 text-[11px]">Unit Cost:</span>
                          <span className="font-mono font-bold text-slate-700">£{item.unitCost.toFixed(2)}</span>
                        </div>

                        <span className="font-extrabold text-indigo-700 ml-auto font-mono text-sm">
                          £{(item.quantity * item.unitCost).toFixed(2)}
                        </span>

                        <button
                          type="button"
                          onClick={() => setPrItems(prItems.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <input
                        type="text"
                        placeholder="Rejection reason for this item (e.g. mould detected, wrong grade)..."
                        value={item.reason}
                        onChange={(e) => {
                          const copy = [...prItems];
                          copy[idx].reason = e.target.value;
                          setPrItems(copy);
                        }}
                        className="w-full py-1.5 px-2.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  ))}

                  <div className="p-3 bg-slate-100 rounded-xl flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">Total Credit Note from Vendor:</span>
                    <span className="font-mono font-black text-base text-slate-900">
                      £{prItems.reduce((s, i) => s + i.quantity * i.unitCost, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Return Reason *</label>
                <input
                  type="text"
                  required
                  value={prReason}
                  onChange={(e) => setPrReason(e.target.value)}
                  placeholder="e.g. Failed cold chain temperature intake check, spoilage on arrival"
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={prNotes}
                  onChange={(e) => setPrNotes(e.target.value)}
                  placeholder="Additional vendor communication notes..."
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPrModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={prSubmitting || !prSelectedPO || prItems.length === 0}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {prSubmitting ? 'Processing Purchase Return...' : 'Issue Vendor Return & Deduct Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT PURCHASE RETURN MODAL ================= */}
      {editPrModalOpen && editingPR && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Edit className="w-4 h-4 text-amber-400" /> Edit Purchase Return: {editingPR.return_number}
              </h3>
              <button onClick={() => setEditPrModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPR} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
                <div>
                  <span className="font-mono font-bold text-slate-900">{editingPR.return_number}</span>
                  <div className="text-[11px] text-slate-600">
                    Original PO: {editingPR.original_po_number || '—'} • Vendor: {editingPR.vendor_company || editingPR.vendor_name}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">Edit Return Items &amp; Quantities</label>
                {editPrItems.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{item.productName}</span>
                      <span className="font-mono text-[11px] text-slate-500">{item.sku}</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 text-[11px]">Qty:</span>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const copy = [...editPrItems];
                            copy[idx].quantity = Math.max(1, parseInt(e.target.value) || 1);
                            setEditPrItems(copy);
                          }}
                          className="w-16 py-1 px-2 border border-slate-300 rounded text-center font-bold"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 text-[11px]">Unit Cost:</span>
                        <span className="font-mono font-bold text-slate-700">£{item.unitCost.toFixed(2)}</span>
                      </div>

                      <span className="font-extrabold text-indigo-700 ml-auto font-mono text-sm">
                        £{(item.quantity * item.unitCost).toFixed(2)}
                      </span>

                      <button
                        type="button"
                        onClick={() => setEditPrItems(editPrItems.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Reason note..."
                      value={item.reason}
                      onChange={(e) => {
                        const copy = [...editPrItems];
                        copy[idx].reason = e.target.value;
                        setEditPrItems(copy);
                      }}
                      className="w-full py-1.5 px-2 border border-slate-300 rounded text-xs"
                    />
                  </div>
                ))}

                <div className="p-3 bg-slate-100 rounded-xl flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">Recalculated Vendor Credit:</span>
                  <span className="font-mono font-black text-base text-slate-900">
                    £{editPrItems.reduce((s, i) => s + i.quantity * i.unitCost, 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Return Reason</label>
                <input
                  type="text"
                  required
                  value={editPrReason}
                  onChange={(e) => setEditPrReason(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editPrNotes}
                  onChange={(e) => setEditPrNotes(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditPrModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEditPR || editPrItems.length === 0}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md shadow-amber-600/20"
                >
                  {savingEditPR ? 'Saving Changes...' : 'Save & Sync Stock/Vendor Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    <ConfirmModal
      open={confirmModal.open}
      title={confirmModal.title}
      message={confirmModal.message}
      confirmLabel="Delete"
      danger
      onConfirm={confirmModal.onConfirm}
      onCancel={() => setConfirmModal((p) => ({ ...p, open: false }))}
    />
    </>
  );
}
