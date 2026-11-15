'use client';

import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  CheckCircle,
  Clock,
  PackagePlus,
  RefreshCw,
  X,
  Trash2,
  FileText,
  BookOpen,
  Edit2,
  Building2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import ConfirmModal from '@/components/ui/ConfirmModal';

export default function VendorsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} });
  const [vendors, setVendors] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'POS' | 'VENDORS'>('POS');
  const [loading, setLoading] = useState(true);

  // PO List Search & Quick Filter
  const [poSearch, setPoSearch] = useState('');
  const [poStatusFilter, setPoStatusFilter] = useState<'ALL' | 'ORDERED' | 'RECEIVED'>('ALL');

  // New PO Modal Search
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<number | ''>('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [poItems, setPoItems] = useState<
    Array<{ productId: number; quantity: number; unitCost: number }>
  >([]);
  const [expectedDate, setExpectedDate] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [submittingPo, setSubmittingPo] = useState(false);

  // Edit PO modal
  const [editPoModalOpen, setEditPoModalOpen] = useState(false);
  const [editingPo, setEditingPo] = useState<any>(null);
  const [editPoItems, setEditPoItems] = useState<Array<{ productId: number; quantity: number; unitCost: number }>>([]);
  const [editPoNotes, setEditPoNotes] = useState('');
  const [editItemSearch, setEditItemSearch] = useState('');
  const [savingEditPo, setSavingEditPo] = useState(false);

  // Stock Intake Delivery & Payment Modal
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receivingPO, setReceivingPO] = useState<any>(null);
  const [receivingItems, setReceivingItems] = useState<
    Array<{
      id: number;
      productId: number;
      productName: string;
      sku: string;
      quantityOrdered: number;
      quantityAlreadyReceived: number;
      quantityReceiving: number;
      unitCost: number;
    }>
  >([]);
  const [receivePaymentOption, setReceivePaymentOption] = useState<'UNPAID' | 'PAID' | 'PARTIAL'>('UNPAID');
  const [receiveAmountPaid, setReceiveAmountPaid] = useState('');
  const [receivePaymentMethod, setReceivePaymentMethod] = useState('BANK_TRANSFER');
  const [receiveCardRef, setReceiveCardRef] = useState('');
  const [submittingReceive, setSubmittingReceive] = useState(false);

  const handleOpenEditPo = (po: any) => {
    setEditingPo(po);
    setEditPoNotes(po.notes || '');
    setEditPoItems((po.items || []).filter((i: any) => i.productId).map((i: any) => ({
      productId: i.productId,
      quantity: Number(i.quantityOrdered),
      unitCost: Number(i.unitCost),
    })));
    setEditPoModalOpen(true);
  };

  const handleSaveEditPo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPo || editPoItems.length === 0) return;
    setSavingEditPo(true);
    try {
      const res = await fetch('/api/purchases', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poId: editingPo.id, items: editPoItems, notes: editPoNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(data.message || `PO ${editingPo.po_number} updated`, 'success');
      setEditPoModalOpen(false);
      fetchData();
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setSavingEditPo(false); }
  };

  const handleDeletePo = async (po: any) => {
    setConfirmModal({
      open: true,
      title: 'Delete Purchase Order',
      message: `Delete PO "${po.po_number}"?${po.status === 'RECEIVED' ? '\n\n• Stock will be REVERSED from warehouse.' : ''}\n\nThis cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal((p) => ({ ...p, open: false }));
        try {
          const res = await fetch(`/api/purchases?poId=${po.id}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          toast(data.message, 'success');
          fetchData();
        } catch (err: any) { toast(err.message, 'error'); }
      },
    });
  };

  // Vendor ledger drawer
  const [ledgerVendor, setLedgerVendor] = useState<any>(null);
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerTab, setLedgerTab] = useState<'POS' | 'RETURNS' | 'LEDGER'>('POS');

  // Vendor PO payment modal
  const [vendorPayModalOpen, setVendorPayModalOpen] = useState(false);
  const [vendorPayPO, setVendorPayPO] = useState<any>(null);
  const [vendorPayAmount, setVendorPayAmount] = useState('');
  const [vendorPayMethod, setVendorPayMethod] = useState('BANK_TRANSFER');
  const [vendorPayNotes, setVendorPayNotes] = useState('');
  const [vendorPayCardRef, setVendorPayCardRef] = useState('');
  const [vendorPaySubmitting, setVendorPaySubmitting] = useState(false);

  const openVendorPayModal = (po: any) => {
    const outstanding = Number(po.total_amount) - Number(po.amount_paid || 0);
    setVendorPayPO(po);
    setVendorPayAmount(outstanding.toFixed(2));
    setVendorPayMethod('BANK_TRANSFER');
    setVendorPayNotes('');
    setVendorPayCardRef('');
    setVendorPayModalOpen(true);
  };

  const handleVendorPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorPayPO) return;
    const paying = parseFloat(vendorPayAmount);
    if (isNaN(paying) || paying <= 0) { toast('Enter a valid amount', 'warning'); return; }
    const outstanding = Number(vendorPayPO.total_amount) - Number(vendorPayPO.amount_paid || 0);
    if (paying > outstanding + 0.01) { toast(`Exceeds outstanding £${outstanding.toFixed(2)}`, 'warning'); return; }
    try {
      setVendorPaySubmitting(true);
      const res = await fetch('/api/purchases', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poId: vendorPayPO.id, amountPaid: paying, paymentMethod: vendorPayMethod, notes: vendorPayNotes, cardReference: vendorPayMethod === 'CARD' ? vendorPayCardRef : undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setVendorPayModalOpen(false);
      await fetchData();
      if (ledgerVendor) openVendorLedger(ledgerVendor);
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setVendorPaySubmitting(false); }
  };

  const openVendorLedger = async (vendor: any) => {
    setLedgerVendor(vendor);
    setLedgerData(null);
    setLedgerTab('POS');
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/ledger/vendor/${vendor.id}`);
      const data = await res.json();
      setLedgerData(data);
    } catch (err) { console.error(err); }
    finally { setLedgerLoading(false); }
  };

  // New Vendor Modal
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [vendorFormData, setVendorFormData] = useState({
    name: '',
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    payment_terms: 'NET_30',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [vendRes, poRes, prodRes] = await Promise.all([
        fetch('/api/vendors'),
        fetch('/api/purchases'),
        fetch('/api/products'),
      ]);
      const vendData = await vendRes.json();
      const poData = await poRes.json();
      const prodData = await prodRes.json();

      setVendors(vendData.vendors || []);
      setPurchaseOrders(poData.purchaseOrders || []);
      setProducts(prodData.products || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Add line to PO
  const handleAddPoItem = () => {
    if (products.length === 0) return;
    const defaultProd = products[0];
    setPoItems((prev) => [
      ...prev,
      {
        productId: defaultProd.id,
        quantity: 25,
        unitCost: Number(defaultProd.cost_price),
      },
    ]);
  };

  const handleUpdatePoItem = (index: number, field: string, val: any) => {
    setPoItems((prev) => {
      const copy = [...prev];
      if (field === 'productId') {
        const p = products.find((prod) => prod.id === parseInt(val));
        if (p) {
          copy[index] = {
            productId: p.id,
            quantity: 25,
            unitCost: Number(p.cost_price),
          };
        }
      } else if (field === 'quantity') {
        copy[index].quantity = Math.max(1, parseInt(val) || 1);
      } else if (field === 'unitCost') {
        copy[index].unitCost = Math.max(0, parseFloat(val) || 0);
      }
      return copy;
    });
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorId) return toast('Select a vendor', 'warning');
    if (poItems.length === 0) return toast('Add at least one item', 'warning');

    try {
      setSubmittingPo(true);
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: selectedVendorId,
          items: poItems,
          expectedDeliveryDate: expectedDate || null,
          notes: poNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create PO');
      toast(`Purchase Order ${data.poNumber} issued successfully!`, 'success');
      setPoModalOpen(false);
      setPoItems([]);
      fetchData();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSubmittingPo(false);
    }
  };

  // Open Stock Intake & Payment Modal
  const openReceiveModal = (po: any) => {
    setReceivingPO(po);
    const items = (po.items || []).map((it: any) => {
      const remaining = Math.max(0, Number(it.quantityOrdered) - Number(it.quantityReceived || 0));
      return {
        id: it.id,
        productId: it.productId,
        productName: it.productName,
        sku: it.sku,
        quantityOrdered: Number(it.quantityOrdered),
        quantityAlreadyReceived: Number(it.quantityReceived || 0),
        quantityReceiving: remaining,
        unitCost: Number(it.unitCost),
      };
    });
    setReceivingItems(items);
    setReceivePaymentOption(po.payment_status === 'PAID' ? 'PAID' : 'UNPAID');
    const remainingToPay = Math.max(0, Number(po.total_amount) - Number(po.amount_paid || 0));
    setReceiveAmountPaid(remainingToPay.toFixed(2));
    setReceivePaymentMethod('BANK_TRANSFER');
    setReceiveCardRef('');
    setReceiveModalOpen(true);
  };

  const handleConfirmReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingPO) return;
    const totalReceivingNow = receivingItems.reduce((s, i) => s + (Number(i.quantityReceiving) || 0), 0);
    if (totalReceivingNow <= 0) {
      toast('Please enter a quantity greater than 0 to receive into stock', 'warning');
      return;
    }
    setSubmittingReceive(true);
    try {
      const res = await fetch('/api/purchases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poId: receivingPO.id,
          receivedItems: receivingItems.map((i) => ({
            id: i.id,
            quantityReceiving: Number(i.quantityReceiving) || 0,
          })),
          paymentOption: receivePaymentOption,
          amountPaid: receivePaymentOption === 'PARTIAL' ? parseFloat(receiveAmountPaid) || 0 : undefined,
          paymentMethod: receivePaymentMethod,
          cardReference: receivePaymentMethod === 'CARD' ? receiveCardRef : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to intake stock');
      toast(data.message, 'success');
      setReceiveModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSubmittingReceive(false);
    }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendorFormData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create vendor');
      toast(`Supplier "${data.vendor?.company_name || vendorFormData.company_name}" registered!`, 'success');
      setVendorModalOpen(false);
      setVendorFormData({
        name: '',
        company_name: '',
        contact_person: '',
        email: '',
        phone: '',
        payment_terms: 'NET_30',
      });
      fetchData();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            SANA FRESH Farm Suppliers & POs
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Organic farm procurement, cold chain intake orders, and supplier directory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setVendorModalOpen(true)}
            className="px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-xs shadow-sm"
          >
            New Vendor
          </button>
          <button
            onClick={() => {
              setPoItems([]);
              setSelectedVendorId('');
              setVendorSearch('');
              setItemSearch('');
              setExpectedDate('');
              setPoNotes('');
              setPoModalOpen(true);
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Issue Purchase Order
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold w-fit">
        <button
          onClick={() => setActiveTab('POS')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'POS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <FileText className="w-4 h-4" /> Purchase Orders ({purchaseOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('VENDORS')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'VENDORS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <Truck className="w-4 h-4" /> Vendor Directory ({vendors.length})
        </button>
      </div>

      {/* PO Table or Vendors List */}
      {activeTab === 'POS' ? (
        <div className="space-y-3">
          {/* Easy Search & Filter for POs to Issue to Stock */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search PO number (e.g. PO-2026), supplier name, notes..."
                value={poSearch}
                onChange={(e) => setPoSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
              {poSearch && (
                <button
                  type="button"
                  onClick={() => setPoSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Status Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
              <button
                type="button"
                onClick={() => setPoStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  poStatusFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Orders ({purchaseOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setPoStatusFilter('ORDERED')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  poStatusFilter === 'ORDERED'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>To Issue to Stock ({purchaseOrders.filter((p) => p.status === 'ORDERED').length})</span>
              </button>
              <button
                type="button"
                onClick={() => setPoStatusFilter('RECEIVED')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  poStatusFilter === 'RECEIVED'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Received ({purchaseOrders.filter((p) => p.status === 'RECEIVED').length})</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
                Loading purchase orders...
              </div>
            ) : purchaseOrders.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <Truck className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                No purchase orders found. Click &ldquo;Issue Purchase Order&rdquo; to restock.
              </div>
            ) : (() => {
              const filteredList = purchaseOrders.filter((po) => {
                const q = poSearch.toLowerCase().trim();
                const matchesSearch =
                  !q ||
                  po.po_number?.toLowerCase().includes(q) ||
                  po.vendor_company?.toLowerCase().includes(q) ||
                  po.vendor_name?.toLowerCase().includes(q) ||
                  po.notes?.toLowerCase().includes(q);
                const matchesStatus =
                  poStatusFilter === 'ALL' || po.status === poStatusFilter;
                return matchesSearch && matchesStatus;
              });

              if (filteredList.length === 0) {
                return (
                  <div className="p-12 text-center text-slate-400 text-xs">
                    <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No purchase orders match &ldquo;{poSearch}&rdquo; in {poStatusFilter === 'ALL' ? 'all' : poStatusFilter.toLowerCase()} orders.
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">PO Number</th>
                        <th className="py-3 px-4">Supplier</th>
                        <th className="py-3 px-4">Expected Date</th>
                        <th className="py-3 px-4">Items Ordered</th>
                        <th className="py-3 px-4">Total Cost</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Shipment Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredList.map((po) => (
                        <tr
                          key={po.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            po.status === 'ORDERED' ? 'bg-amber-50/20' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {po.po_number}
                            <div className="text-[10px] text-slate-400 font-sans">
                              {new Date(po.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{po.vendor_company}</div>
                            <div className="text-[10px] text-slate-500">{po.vendor_name}</div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            {po.expected_delivery_date
                              ? new Date(po.expected_delivery_date).toLocaleDateString()
                              : 'Standard Delivery'}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-800">
                            {po.items?.length || 0} line items
                          </td>
                          <td className="py-3.5 px-4 font-extrabold text-slate-900 text-sm">
                            £{Number(po.total_amount).toFixed(2)}
                            {po.payment_status === 'PARTIAL' && (
                              <div className="text-[10px] font-mono text-rose-600 font-bold mt-0.5">
                                Owed: £{(Number(po.total_amount) - Number(po.amount_paid || 0)).toFixed(2)}
                              </div>
                            )}
                            {po.payment_status === 'PARTIAL' && (
                              <div className="text-[10px] font-mono text-emerald-600 mt-0.5">
                                Paid: £{Number(po.amount_paid || 0).toFixed(2)}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                po.status === 'RECEIVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : po.status === 'PARTIAL'
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {po.status === 'RECEIVED' ? (
                                <>
                                  <CheckCircle className="w-3 h-3 text-emerald-600" /> RECEIVED
                                </>
                              ) : po.status === 'PARTIAL' ? (
                                <>
                                  <Clock className="w-3 h-3 text-indigo-600" /> PARTIAL INTAKE
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-amber-600" /> ORDERED (Pending)
                                </>
                              )}
                            </span>
                            <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              po.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                              po.payment_status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                              'bg-rose-100 text-rose-700'
                            }`}>{po.payment_status}</span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {po.status !== 'RECEIVED' ? (
                                <button
                                  onClick={() => openReceiveModal(po)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-1.5 ring-2 ring-emerald-500/20"
                                  title="Receive delivery and issue stock into warehouse"
                                >
                                  <PackagePlus className="w-3.5 h-3.5" />
                                  <span>Issue to Stock</span>
                                </button>
                              ) : (
                                po.payment_status !== 'PAID' && (
                                  <button onClick={() => openVendorPayModal(po)}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-1">
                                    {po.payment_status === 'PARTIAL' ? 'Pay Balance' : 'Pay Vendor'}
                                  </button>
                                )
                              )}
                              <button
                                onClick={() => handleOpenEditPo(po)}
                                className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg font-bold text-xs flex items-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" /> Edit
                              </button>
                              <button
                                onClick={() => handleDeletePo(po)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        /* Vendors Directory */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((v) => (
            <div
              key={v.id}
              className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                  {v.payment_terms}
                </span>
                <h3 className="font-extrabold text-base text-slate-900 mt-2">{v.company_name}</h3>
                <div className="text-xs text-slate-500 font-medium">Rep: {v.contact_person || v.name}</div>

                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  {v.email && <div>{v.email}</div>}
                  {v.phone && <div>{v.phone}</div>}
                  {v.tax_id && <div className="text-[10px] text-slate-400 font-mono">Tax ID: {v.tax_id}</div>}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Total Procured:</span>
                <span className="font-extrabold text-slate-900">
                  £{Number(v.total_purchases || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <button
                onClick={() => openVendorLedger(v)}
                className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-100"
              >
                <BookOpen className="w-3.5 h-3.5" /> View Ledger
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ================= VENDOR LEDGER DRAWER ================= */}
      {ledgerVendor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-end">
          <div className="bg-white w-full max-w-2xl h-full flex flex-col shadow-2xl border-l border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-sm">{ledgerVendor.company_name} — Vendor Ledger</h3>
                <p className="text-[11px] text-slate-400">{ledgerVendor.payment_terms}</p>
              </div>
              <button onClick={() => setLedgerVendor(null)}><X className="w-5 h-5" /></button>
            </div>

            {ledgerLoading ? (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading ledger...
              </div>
            ) : ledgerData ? (
              <>
                <div className="grid grid-cols-3 gap-3 p-4 border-b border-slate-100 shrink-0">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">Total Purchased</div>
                    <div className="font-extrabold text-slate-900 text-base">£{Number(ledgerData.summary?.total_purchased || 0).toFixed(2)}</div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3">
                    <div className="text-[10px] text-amber-700 font-semibold uppercase">Unpaid POs</div>
                    <div className="font-extrabold text-amber-800 text-base">{ledgerData.summary?.unpaid_count || 0}</div>
                  </div>
                  <div className="bg-rose-50 rounded-xl p-3">
                    <div className="text-[10px] text-rose-700 font-semibold uppercase">Outstanding</div>
                    <div className="font-extrabold text-rose-800 text-base">£{Number(ledgerData.summary?.outstanding || 0).toFixed(2)}</div>
                  </div>
                </div>

                <div className="flex bg-slate-100 p-1 mx-4 mt-3 rounded-xl text-xs font-bold shrink-0">
                  {(['POS', 'RETURNS', 'LEDGER'] as const).map((t) => (
                    <button key={t} onClick={() => setLedgerTab(t)}
                      className={`flex-1 py-1.5 rounded-lg transition-colors ${ledgerTab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                      {t === 'POS' ? `Purchase Orders (${ledgerData.purchaseOrders?.length || 0})` : t === 'RETURNS' ? `Returns (${ledgerData.returns?.length || 0})` : `Ledger (${ledgerData.ledger?.length || 0})`}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 text-xs">
                  {ledgerTab === 'POS' && (
                    <table className="w-full text-left">
                      <thead className="text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                        <tr><th className="py-2 pr-3">PO #</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Total</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Payment</th><th className="py-2">Action</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ledgerData.purchaseOrders?.map((po: any) => (
                          <tr key={po.id} className="hover:bg-slate-50">
                            <td className="py-2 pr-3 font-mono font-bold text-slate-900">{po.po_number}</td>
                            <td className="py-2 pr-3 text-slate-500">{new Date(po.created_at).toLocaleDateString()}</td>
                            <td className="py-2 pr-3 font-bold">£{Number(po.total_amount).toFixed(2)}</td>
                            <td className="py-2 pr-3">
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${po.status === 'RECEIVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{po.status}</span>
                            </td>
                            <td className="py-2 pr-3">
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${po.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{po.payment_status}</span>
                            </td>
                            <td className="py-2">
                              {po.payment_status !== 'PAID' && (
                                <button onClick={() => openVendorPayModal(po)}
                                  className="px-2 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg">
                                  Pay
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {ledgerTab === 'RETURNS' && (
                    ledgerData.returns?.length === 0 ? (
                      <div className="text-center text-slate-400 py-8">No purchase returns for this vendor.</div>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                          <tr><th className="py-2 pr-3">Return #</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Credit</th><th className="py-2">Reason</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {ledgerData.returns?.map((r: any) => (
                            <tr key={r.return_number} className="hover:bg-slate-50">
                              <td className="py-2 pr-3 font-mono font-bold text-indigo-700">{r.return_number}</td>
                              <td className="py-2 pr-3 text-slate-500">{new Date(r.return_date).toLocaleDateString()}</td>
                              <td className="py-2 pr-3 font-bold text-indigo-700">£{Number(r.total_credit).toFixed(2)}</td>
                              <td className="py-2 text-slate-600">{r.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  )}
                  {ledgerTab === 'LEDGER' && (
                    ledgerData.ledger?.length === 0 ? (
                      <div className="text-center text-slate-400 py-8">No ledger entries yet.</div>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                          <tr><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Ref</th><th className="py-2 pr-3">Debit</th><th className="py-2 pr-3">Credit</th><th className="py-2">Balance</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {ledgerData.ledger?.map((e: any) => (
                            <tr key={e.id} className="hover:bg-slate-50">
                              <td className="py-2 pr-3 text-slate-500">{new Date(e.entry_date).toLocaleDateString()}</td>
                              <td className="py-2 pr-3 font-mono text-[11px]">{e.type}</td>
                              <td className="py-2 pr-3 font-mono text-slate-600">{e.reference_number}</td>
                              <td className="py-2 pr-3 text-rose-700 font-bold">{Number(e.debit) > 0 ? `£${Number(e.debit).toFixed(2)}` : '—'}</td>
                              <td className="py-2 pr-3 text-emerald-700 font-bold">{Number(e.credit) > 0 ? `£${Number(e.credit).toFixed(2)}` : '—'}</td>
                              <td className="py-2 font-extrabold text-slate-900">£{Number(e.balance).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ================= VENDOR PAYMENT MODAL ================= */}
      {vendorPayModalOpen && vendorPayPO && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-indigo-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Pay Vendor — {vendorPayPO.po_number}</h3>
                <p className="text-[11px] text-indigo-300">{ledgerVendor?.company_name || vendorPayPO.vendor_company}</p>
              </div>
              <button onClick={() => setVendorPayModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleVendorPaySubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl">
                <div><div className="text-[10px] text-slate-500 font-semibold">PO Total</div><div className="font-extrabold text-slate-900">£{Number(vendorPayPO.total_amount).toFixed(2)}</div></div>
                <div><div className="text-[10px] text-emerald-600 font-semibold">Already Paid</div><div className="font-extrabold text-emerald-700">£{Number(vendorPayPO.amount_paid || 0).toFixed(2)}</div></div>
                <div><div className="text-[10px] text-rose-600 font-semibold">Outstanding</div><div className="font-extrabold text-rose-700">£{(Number(vendorPayPO.total_amount) - Number(vendorPayPO.amount_paid || 0)).toFixed(2)}</div></div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Amount Paying (£) *</label>
                <input type="number" step="0.01" min="0.01" required value={vendorPayAmount}
                  onChange={(e) => setVendorPayAmount(e.target.value)}
                  className="w-full py-2.5 px-3 border-2 border-indigo-400 rounded-xl font-mono font-bold text-lg focus:outline-none" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Payment Method</label>
                <select value={vendorPayMethod} onChange={(e) => { setVendorPayMethod(e.target.value); setVendorPayCardRef(''); }}
                  className="w-full py-2 px-3 border border-slate-300 rounded-xl bg-white font-semibold">
                  <option value="BANK_TRANSFER">Bank Transfer / BACS</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CARD">Card / Online</option>
                </select>
              </div>
              {vendorPayMethod === 'CARD' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Card Terminal Reference *</label>
                  <input type="text" value={vendorPayCardRef} onChange={(e) => setVendorPayCardRef(e.target.value)}
                    placeholder="e.g. TXN-284738 or last 4 digits"
                    className="w-full py-2 px-3 border border-slate-300 rounded-xl font-mono text-sm" />
                </div>
              )}
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Reference / Notes</label>
                <input type="text" value={vendorPayNotes} onChange={(e) => setVendorPayNotes(e.target.value)}
                  placeholder="e.g. BACS ref 2847382" className="w-full py-2 px-3 border border-slate-300 rounded-xl" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setVendorPayModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700">Cancel</button>
                <button type="submit" disabled={vendorPaySubmitting || (vendorPayMethod === 'CARD' && !vendorPayCardRef.trim())}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md">
                  {vendorPaySubmitting ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= NEW PURCHASE ORDER MODAL ================= */}
      {poModalOpen && (() => {
        const selectedVendor = vendors.find((v) => v.id === selectedVendorId);
        const filteredVendors = vendors.filter((v) => {
          const q = vendorSearch.toLowerCase().trim();
          return !q ||
            v.company_name?.toLowerCase().includes(q) ||
            v.name?.toLowerCase().includes(q) ||
            v.contact_person?.toLowerCase().includes(q) ||
            v.phone?.includes(q);
        });

        const filteredProds = products.filter((p) => {
          const q = itemSearch.toLowerCase().trim();
          return !q ||
            p.name?.toLowerCase().includes(q) ||
            p.sku?.toLowerCase().includes(q) ||
            p.barcode?.includes(q);
        });

        const totalPoAmount = poItems.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
        const totalPoUnits = poItems.reduce((sum, item) => sum + item.quantity, 0);

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in">
              {/* Fixed Header */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-bold text-base">Issue Inbound Purchase Order</h3>
                  <p className="text-xs text-slate-400">Search vendor and produce items to create PO</p>
                </div>
                <button
                  onClick={() => setPoModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleCreatePo} className="flex-1 flex flex-col overflow-hidden">
                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                  {/* 1. VENDOR SELECTION VIA SEARCH */}
                  <div>
                    <label className="font-bold text-slate-800 block mb-1.5 text-xs">
                      1. Select Supplier / Vendor *
                    </label>

                    {selectedVendor ? (
                      /* Selected Vendor Card */
                      <div className="p-3 bg-emerald-50/80 border border-emerald-300 rounded-xl flex items-center justify-between gap-3 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-emerald-600 text-white rounded-lg flex items-center justify-center font-bold shrink-0">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 text-sm">
                              {selectedVendor.company_name}
                            </div>
                            <div className="text-[11px] text-slate-600 flex items-center gap-2 mt-0.5">
                              <span>Rep: {selectedVendor.contact_person || selectedVendor.name}</span>
                              <span>•</span>
                              <span className="font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">
                                {selectedVendor.payment_terms}
                              </span>
                              {selectedVendor.phone && (
                                <>
                                  <span>•</span>
                                  <span>{selectedVendor.phone}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVendorId('');
                            setVendorSearch('');
                          }}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg font-bold text-xs shadow-sm whitespace-nowrap"
                        >
                          Change Supplier
                        </button>
                      </div>
                    ) : (
                      /* Search Input & Results */
                      <div className="space-y-1.5">
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Type supplier company name, contact person, or phone to search..."
                            value={vendorSearch}
                            onChange={(e) => setVendorSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white shadow-sm">
                          {filteredVendors.length === 0 ? (
                            <div className="p-3 text-center text-slate-400 text-xs">
                              No suppliers match &ldquo;{vendorSearch}&rdquo;
                            </div>
                          ) : (
                            filteredVendors.map((v) => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => {
                                  setSelectedVendorId(v.id);
                                  setVendorSearch('');
                                }}
                                className="w-full text-left p-2.5 hover:bg-emerald-50 flex items-center justify-between transition-colors"
                              >
                                <div>
                                  <div className="font-bold text-slate-900">{v.company_name}</div>
                                  <div className="text-[11px] text-slate-500">
                                    Contact: {v.contact_person || v.name} {v.phone ? `• ${v.phone}` : ''}
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                                  {v.payment_terms}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. ITEM SELECTION VIA SEARCH (NO DROPDOWN) */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 text-xs">
                        2. Search & Add Produce Items *
                      </label>
                      <span className="text-[11px] text-slate-500">
                        {poItems.length} items in order
                      </span>
                    </div>

                    {/* Product Search Bar */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search produce name, SKU or barcode to add line item..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                      />
                      {itemSearch && (
                        <button
                          type="button"
                          onClick={() => setItemSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Live Search Suggestions Dropdown */}
                    {itemSearch.trim() && (
                      <div className="max-h-48 overflow-y-auto border-2 border-emerald-400 bg-white rounded-xl shadow-xl divide-y divide-slate-100 z-10">
                        {filteredProds.length === 0 ? (
                          <div className="p-3 text-center text-slate-400 text-xs">
                            No produce matches &ldquo;{itemSearch}&rdquo;
                          </div>
                        ) : (
                          filteredProds.slice(0, 8).map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setPoItems((prev) => {
                                  const existingIdx = prev.findIndex((it) => it.productId === p.id);
                                  if (existingIdx >= 0) {
                                    const copy = [...prev];
                                    copy[existingIdx].quantity += 10;
                                    return copy;
                                  }
                                  return [
                                    ...prev,
                                    {
                                      productId: p.id,
                                      quantity: 25,
                                      unitCost: Number(p.cost_price) || 0,
                                    },
                                  ];
                                });
                                setItemSearch('');
                              }}
                              className="w-full text-left p-2.5 hover:bg-emerald-50 flex items-center justify-between transition-colors group"
                            >
                              <div>
                                <div className="font-bold text-slate-900 group-hover:text-emerald-700">
                                  {p.name}
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                  <span className="font-mono font-bold text-slate-700">{p.sku}</span>
                                  <span>•</span>
                                  <span>Stock: <strong className="text-slate-800">{p.stock_quantity} {p.unit}</strong></span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono font-bold text-slate-900 text-xs">
                                  £{Number(p.cost_price).toFixed(2)}
                                </div>
                                <span className="text-[10px] text-emerald-600 font-bold group-hover:underline">
                                  + Click to Add
                                </span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {/* Selected Items Table (No Dropdowns!) */}
                    {poItems.length === 0 ? (
                      <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 bg-slate-50/50">
                        <PackagePlus className="w-8 h-8 mx-auto mb-1.5 text-slate-300" />
                        <div className="font-bold text-slate-600">No items in this purchase order yet</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Use the search box above to quickly find and add produce items
                        </div>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">Product Name & SKU</th>
                              <th className="py-2.5 px-3 w-28 text-center">Order Qty</th>
                              <th className="py-2.5 px-3 w-28 text-right">Unit Cost (£)</th>
                              <th className="py-2.5 px-3 w-24 text-right">Subtotal</th>
                              <th className="py-2.5 px-2 w-10 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {poItems.map((item, index) => {
                              const prod = products.find((p) => p.id === item.productId);
                              return (
                                <tr key={index} className="hover:bg-slate-50/80">
                                  <td className="py-2 px-3">
                                    <div className="font-bold text-slate-900 text-xs">
                                      {prod?.name || 'Selected Item'}
                                    </div>
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 font-mono">
                                      <span>{prod?.sku || 'SKU'}</span>
                                      <span>•</span>
                                      <span className="font-sans">Current Stock: {prod?.stock_quantity ?? '—'} {prod?.unit}</span>
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdatePoItem(index, 'quantity', Math.max(1, item.quantity - 1))}
                                        className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs"
                                      >
                                        -
                                      </button>
                                      <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => handleUpdatePoItem(index, 'quantity', e.target.value)}
                                        className="w-14 py-1 text-center font-bold text-slate-900 text-xs focus:outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleUpdatePoItem(index, 'quantity', item.quantity + 1)}
                                        className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={item.unitCost}
                                      onChange={(e) => handleUpdatePoItem(index, 'unitCost', e.target.value)}
                                      className="w-24 py-1 px-2 bg-white border border-slate-300 rounded-lg text-right font-mono font-bold text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                    />
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-extrabold text-slate-900 text-xs">
                                    £{(item.quantity * item.unitCost).toFixed(2)}
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => setPoItems(poItems.filter((_, i) => i !== index))}
                                      className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50"
                                      title="Remove item"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* 3. Expected Delivery Date & Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Expected Delivery Date</label>
                      <input
                        type="date"
                        value={expectedDate}
                        onChange={(e) => setExpectedDate(e.target.value)}
                        className="w-full py-2 px-3 border border-slate-300 rounded-xl bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">PO Instructions / Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. Pallet delivery, Cold chain temp < 4°C"
                        value={poNotes}
                        onChange={(e) => setPoNotes(e.target.value)}
                        className="w-full py-2 px-3 border border-slate-300 rounded-xl bg-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* STICKY DIALOG FOOTER: TOTAL AMOUNT ALWAYS INSIDE AND PROMINENT */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                    <div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        Line Items
                      </div>
                      <div className="text-xs font-bold text-slate-800">
                        {poItems.length} SKUs ({totalPoUnits} units)
                      </div>
                    </div>
                    <div className="h-8 w-px bg-slate-200 hidden sm:block" />
                    <div className="bg-white px-3.5 py-1.5 rounded-xl border border-slate-300 shadow-sm">
                      <div className="text-[10px] text-emerald-700 font-extrabold uppercase tracking-wider">
                        Total PO Amount
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                        £{totalPoAmount.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setPoModalOpen(false)}
                      className="px-4 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 flex-1 sm:flex-initial text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingPo || poItems.length === 0 || !selectedVendorId}
                      className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-bold shadow-md flex-1 sm:flex-initial text-xs flex items-center justify-center gap-2"
                    >
                      {submittingPo ? 'Issuing PO...' : `Issue Purchase Order (£${totalPoAmount.toFixed(2)})`}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ================= STOCK INTAKE DELIVERY & PAYMENT MODAL ================= */}
      {receiveModalOpen && receivingPO && (() => {
        const totalReceivingUnits = receivingItems.reduce((s, i) => s + (Number(i.quantityReceiving) || 0), 0);
        const totalReceivingCost = receivingItems.reduce((s, i) => s + ((Number(i.quantityReceiving) || 0) * Number(i.unitCost)), 0);
        const totalPoAmount = Number(receivingPO.total_amount);
        const alreadyPaid = Number(receivingPO.amount_paid || 0);
        const balanceOwed = Math.max(0, totalPoAmount - alreadyPaid);

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in">
              {/* Header */}
              <div className="p-4 bg-emerald-900 text-white flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <PackagePlus className="w-5 h-5 text-emerald-400" />
                    Issue Inbound Delivery to Warehouse — {receivingPO.po_number}
                  </h3>
                  <p className="text-xs text-emerald-200 mt-0.5">
                    Supplier: <strong className="text-white">{receivingPO.vendor_company}</strong> • Order Total: £{totalPoAmount.toFixed(2)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReceiveModalOpen(false)}
                  className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-emerald-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmReceive} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs">
                  {/* Step 1: Received Quantities Table */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <label className="font-bold text-slate-800 text-xs block">
                          1. Verify Received Quantities into Warehouse *
                        </label>
                        <p className="text-[11px] text-slate-500">
                          If partial delivery (e.g. ordered 20, but received 10), enter the actual quantity received today.
                        </p>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                        {totalReceivingUnits} units entering stock
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Product / SKU</th>
                            <th className="py-2.5 px-3 text-center">Ordered</th>
                            <th className="py-2.5 px-3 text-center">Prior Intake</th>
                            <th className="py-2.5 px-3 w-36 text-center bg-emerald-50/70 text-emerald-900 font-extrabold">
                              Receiving Now
                            </th>
                            <th className="py-2.5 px-3 text-right">Unit Cost</th>
                            <th className="py-2.5 px-3 text-right">Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {receivingItems.map((item, idx) => {
                            const remaining = Math.max(0, item.quantityOrdered - item.quantityAlreadyReceived);
                            return (
                              <tr key={item.id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-slate-900">{item.productName}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{item.sku}</div>
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                                  {item.quantityOrdered}
                                </td>
                                <td className="py-2.5 px-3 text-center font-semibold text-slate-500">
                                  {item.quantityAlreadyReceived > 0 ? (
                                    <span className="text-emerald-700 font-bold">{item.quantityAlreadyReceived}</span>
                                  ) : (
                                    '0'
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center bg-emerald-50/40">
                                  <div className="inline-flex items-center border-2 border-emerald-500 rounded-lg overflow-hidden bg-white shadow-sm">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const copy = [...receivingItems];
                                        copy[idx].quantityReceiving = Math.max(0, copy[idx].quantityReceiving - 1);
                                        setReceivingItems(copy);
                                      }}
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      max={remaining}
                                      value={item.quantityReceiving}
                                      onChange={(e) => {
                                        const copy = [...receivingItems];
                                        copy[idx].quantityReceiving = Math.max(0, parseInt(e.target.value) || 0);
                                        setReceivingItems(copy);
                                      }}
                                      className="w-16 py-1 text-center font-extrabold text-slate-900 text-xs focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const copy = [...receivingItems];
                                        copy[idx].quantityReceiving = copy[idx].quantityReceiving + 1;
                                        setReceivingItems(copy);
                                      }}
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                  £{item.unitCost.toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                  £{(item.quantityReceiving * item.unitCost).toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Step 2: Payment on Delivery Section */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <label className="font-bold text-slate-800 text-xs block">
                      2. Supplier Payment on Delivery
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Option 1: Unpaid */}
                      <label
                        className={`p-3 border rounded-xl cursor-pointer flex flex-col justify-between transition-all ${
                          receivePaymentOption === 'UNPAID'
                            ? 'bg-white border-slate-900 ring-2 ring-slate-900/10 shadow-sm'
                            : 'bg-white/60 border-slate-200 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="receivePayment"
                            value="UNPAID"
                            checked={receivePaymentOption === 'UNPAID'}
                            onChange={() => setReceivePaymentOption('UNPAID')}
                            className="text-slate-900"
                          />
                          <span className="font-bold text-slate-900 text-xs">Unpaid / Pay Later</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 pl-5">
                          Credit terms ({receivingPO.vendor_payment_terms || 'NET 30'}). Pay later via Vendor Ledger.
                        </p>
                      </label>

                      {/* Option 2: Paid in Full */}
                      <label
                        className={`p-3 border rounded-xl cursor-pointer flex flex-col justify-between transition-all ${
                          receivePaymentOption === 'PAID'
                            ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/10 shadow-sm'
                            : 'bg-white/60 border-slate-200 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="receivePayment"
                            value="PAID"
                            checked={receivePaymentOption === 'PAID'}
                            onChange={() => setReceivePaymentOption('PAID')}
                            className="text-emerald-600"
                          />
                          <span className="font-bold text-emerald-900 text-xs">Paid in Full Now</span>
                        </div>
                        <p className="text-[10px] text-emerald-700 font-mono font-bold mt-1 pl-5">
                          £{balanceOwed.toFixed(2)} paid on delivery
                        </p>
                      </label>

                      {/* Option 3: Partial Payment */}
                      <label
                        className={`p-3 border rounded-xl cursor-pointer flex flex-col justify-between transition-all ${
                          receivePaymentOption === 'PARTIAL'
                            ? 'bg-amber-50 border-amber-600 ring-2 ring-amber-500/10 shadow-sm'
                            : 'bg-white/60 border-slate-200 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="receivePayment"
                            value="PARTIAL"
                            checked={receivePaymentOption === 'PARTIAL'}
                            onChange={() => setReceivePaymentOption('PARTIAL')}
                            className="text-amber-600"
                          />
                          <span className="font-bold text-amber-900 text-xs">Partial Deposit</span>
                        </div>
                        <p className="text-[10px] text-amber-700 mt-1 pl-5">
                          Enter custom payment amount below.
                        </p>
                      </label>
                    </div>

                    {/* Payment details if Paid or Partial */}
                    {receivePaymentOption !== 'UNPAID' && (
                      <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in">
                        {receivePaymentOption === 'PARTIAL' && (
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">Deposit Amount (£) *</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max={balanceOwed}
                              required
                              value={receiveAmountPaid}
                              onChange={(e) => setReceiveAmountPaid(e.target.value)}
                              className="w-full py-1.5 px-3 border border-slate-300 rounded-lg font-mono font-bold text-sm bg-white"
                            />
                          </div>
                        )}
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Payment Method</label>
                          <select
                            value={receivePaymentMethod}
                            onChange={(e) => setReceivePaymentMethod(e.target.value)}
                            className="w-full py-1.5 px-3 border border-slate-300 rounded-lg bg-white font-semibold text-xs"
                          >
                            <option value="BANK_TRANSFER">Bank Transfer / BACS</option>
                            <option value="CASH">Cash</option>
                            <option value="CARD">Card / Terminal</option>
                            <option value="CHEQUE">Cheque</option>
                          </select>
                        </div>
                        {receivePaymentMethod === 'CARD' && (
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">Card Reference</label>
                            <input
                              type="text"
                              placeholder="e.g. TXN-83921"
                              value={receiveCardRef}
                              onChange={(e) => setReceiveCardRef(e.target.value)}
                              className="w-full py-1.5 px-3 border border-slate-300 rounded-lg font-mono text-xs bg-white"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Intake Summary</div>
                      <div className="text-xs font-bold text-slate-800">
                        {totalReceivingUnits} units ({receivingItems.filter((i) => i.quantityReceiving > 0).length} SKUs)
                      </div>
                    </div>
                    <div className="h-8 w-px bg-slate-200" />
                    <div>
                      <div className="text-[10px] text-emerald-700 font-bold uppercase">Intake Stock Value</div>
                      <div className="text-xl font-black text-slate-900 font-mono">£{totalReceivingCost.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setReceiveModalOpen(false)}
                      className="px-4 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 flex-1 sm:flex-initial text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingReceive || totalReceivingUnits <= 0}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md flex-1 sm:flex-initial text-xs flex items-center justify-center gap-2"
                    >
                      <PackagePlus className="w-4 h-4" />
                      <span>{submittingReceive ? 'Receiving...' : `Confirm Intake to Stock (${totalReceivingUnits} units)`}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ================= EDIT PURCHASE ORDER MODAL ================= */}
      {editPoModalOpen && editingPo && (() => {
        const editFilteredProds = products.filter((p) => {
          const q = editItemSearch.toLowerCase().trim();
          return !q ||
            p.name?.toLowerCase().includes(q) ||
            p.sku?.toLowerCase().includes(q) ||
            p.barcode?.includes(q);
        });
        const editTotal = editPoItems.reduce((s, i) => s + i.quantity * i.unitCost, 0);

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in">
              <div className="p-4 bg-amber-950 text-white flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-bold text-base">Edit PO: {editingPo.po_number}</h3>
                  <p className="text-xs text-amber-300">
                    {editingPo.vendor_company}{' '}
                    {editingPo.status === 'RECEIVED' ? '— ⚠️ RECEIVED: warehouse stock will be re-synced' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditPoModalOpen(false)}
                  className="text-amber-200 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditPo} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                  {/* Search and add item */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-800 text-xs">Search & Add Items to PO</label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search product name or SKU to add..."
                        value={editItemSearch}
                        onChange={(e) => setEditItemSearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      {editItemSearch && (
                        <button
                          type="button"
                          onClick={() => setEditItemSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {editItemSearch.trim() && (
                      <div className="max-h-44 overflow-y-auto border-2 border-amber-400 bg-white rounded-xl shadow-lg divide-y divide-slate-100">
                        {editFilteredProds.length === 0 ? (
                          <div className="p-3 text-center text-slate-400 text-xs">No products match</div>
                        ) : (
                          editFilteredProds.slice(0, 6).map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setEditPoItems((prev) => {
                                  const existing = prev.find((it) => it.productId === p.id);
                                  if (existing) {
                                    return prev.map((it) =>
                                      it.productId === p.id ? { ...it, quantity: it.quantity + 5 } : it
                                    );
                                  }
                                  return [...prev, { productId: p.id, quantity: 10, unitCost: Number(p.cost_price) || 0 }];
                                });
                                setEditItemSearch('');
                              }}
                              className="w-full text-left p-2.5 hover:bg-amber-50 flex items-center justify-between"
                            >
                              <div>
                                <div className="font-bold text-slate-900">{p.name}</div>
                                <div className="text-[11px] text-slate-500 font-mono">{p.sku} • Stock: {p.stock_quantity}</div>
                              </div>
                              <span className="text-amber-700 font-bold text-xs">+ Add to PO</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Line Items List */}
                  <div className="space-y-2">
                    <label className="font-bold text-slate-800 text-xs block">Order Line Items ({editPoItems.length})</label>
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Product Name & SKU</th>
                            <th className="py-2.5 px-3 w-28 text-center">Qty</th>
                            <th className="py-2.5 px-3 w-28 text-right">Unit Cost (£)</th>
                            <th className="py-2.5 px-3 w-24 text-right">Subtotal</th>
                            <th className="py-2.5 px-2 w-10 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {editPoItems.map((item, idx) => {
                            const prod = products.find((p: any) => p.id === item.productId);
                            return (
                              <tr key={idx} className="hover:bg-slate-50/80">
                                <td className="py-2 px-3">
                                  <div className="font-bold text-slate-900 text-xs">{prod?.name || 'Item'}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{prod?.sku}</div>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const copy = [...editPoItems];
                                      copy[idx].quantity = Math.max(1, parseInt(e.target.value) || 1);
                                      setEditPoItems(copy);
                                    }}
                                    className="w-20 py-1 px-2 bg-white border border-slate-300 rounded-lg text-center font-bold text-xs"
                                  />
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.unitCost}
                                    onChange={(e) => {
                                      const copy = [...editPoItems];
                                      copy[idx].unitCost = Math.max(0, parseFloat(e.target.value) || 0);
                                      setEditPoItems(copy);
                                    }}
                                    className="w-24 py-1 px-2 bg-white border border-slate-300 rounded-lg text-right font-mono font-bold text-xs"
                                  />
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-extrabold text-slate-900 text-xs">
                                  £{(item.quantity * item.unitCost).toFixed(2)}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setEditPoItems(editPoItems.filter((_, i) => i !== idx))}
                                    className="text-slate-400 hover:text-rose-600 p-1"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Notes</label>
                    <input
                      type="text"
                      value={editPoNotes}
                      onChange={(e) => setEditPoNotes(e.target.value)}
                      className="w-full py-2 px-3 border border-slate-300 rounded-xl bg-white text-xs"
                    />
                  </div>
                </div>

                {/* Sticky Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Items</div>
                      <div className="text-xs font-bold text-slate-800">{editPoItems.length} SKUs</div>
                    </div>
                    <div className="h-8 w-px bg-slate-200" />
                    <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-300">
                      <div className="text-[10px] text-amber-700 font-extrabold uppercase">Updated Total</div>
                      <div className="text-xl font-black text-slate-900 font-mono">£{editTotal.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setEditPoModalOpen(false)}
                      className="px-4 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 flex-1 sm:flex-initial text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingEditPo || editPoItems.length === 0}
                      className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md flex-1 sm:flex-initial text-xs"
                    >
                      {savingEditPo ? 'Saving...' : 'Save & Sync Stock'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ================= NEW VENDOR MODAL ================= */}
      {vendorModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Add Vendor / Supplier</h3>
              <button onClick={() => setVendorModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateVendor} className="p-5 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Industrial Supplies"
                  value={vendorFormData.company_name}
                  onChange={(e) => setVendorFormData({ ...vendorFormData, company_name: e.target.value })}
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Contact Person Name *</label>
                <input
                  type="text"
                  required
                  value={vendorFormData.name}
                  onChange={(e) => setVendorFormData({ ...vendorFormData, name: e.target.value })}
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Email</label>
                <input
                  type="email"
                  value={vendorFormData.email}
                  onChange={(e) => setVendorFormData({ ...vendorFormData, email: e.target.value })}
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Phone</label>
                <input
                  type="text"
                  value={vendorFormData.phone}
                  onChange={(e) => setVendorFormData({ ...vendorFormData, phone: e.target.value })}
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setVendorModalOpen(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-slate-900 text-white rounded-lg font-bold"
                >
                  Save Vendor
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
      confirmLabel="Confirm"
      onConfirm={confirmModal.onConfirm}
      onCancel={() => setConfirmModal((p) => ({ ...p, open: false }))}
    />
    </>
  );
}
