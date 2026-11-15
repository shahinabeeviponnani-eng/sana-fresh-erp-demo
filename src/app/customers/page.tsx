'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, Plus, Search, Building2, User, Mail, Phone, RefreshCw, X, BookOpen } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';

function CustomersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const urlTypeParam = searchParams.get('type')?.toUpperCase();
  const initialType: 'ALL' | 'WHOLESALE' | 'RETAIL' =
    urlTypeParam === 'WHOLESALE' ? 'WHOLESALE' : urlTypeParam === 'RETAIL' ? 'RETAIL' : 'ALL';

  const [customers, setCustomers] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'WHOLESALE' | 'RETAIL'>(initialType);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Synchronize typeFilter when query parameter changes (e.g. from sidebar navigation)
  useEffect(() => {
    const current = searchParams.get('type')?.toUpperCase();
    if (current === 'WHOLESALE' || current === 'RETAIL') {
      setTypeFilter(current as 'WHOLESALE' | 'RETAIL');
    } else {
      setTypeFilter('ALL');
    }
  }, [searchParams]);

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '', company_name: '', type: 'WHOLESALE', email: '', phone: '',
    tax_id: '', address: '', city: '', credit_limit: '10000',
    payment_terms: 'NET_30', discount_percent: '0', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Ledger drawer
  const [ledgerCustomer, setLedgerCustomer] = useState<any>(null);
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerTab, setLedgerTab] = useState<'ORDERS' | 'RETURNS' | 'LEDGER'>('ORDERS');

  // Customer payment modal
  const [custPayModalOpen, setCustPayModalOpen] = useState(false);
  const [custPayOrder, setCustPayOrder] = useState<any>(null);
  const [custPayAmount, setCustPayAmount] = useState('');
  const [custPayMethod, setCustPayMethod] = useState('BANK_TRANSFER');
  const [custPayNotes, setCustPayNotes] = useState('');
  const [custPaySubmitting, setCustPaySubmitting] = useState(false);

  const openCustPayModal = (order: any) => {
    const outstanding = Number(order.total_amount) - Number(order.amount_paid);
    setCustPayOrder(order);
    setCustPayAmount(outstanding.toFixed(2));
    setCustPayMethod('BANK_TRANSFER');
    setCustPayNotes('');
    setCustPayModalOpen(true);
  };

  const handleCustPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custPayOrder) return;
    const paying = parseFloat(custPayAmount);
    if (isNaN(paying) || paying <= 0) { toast('Enter a valid amount', 'warning'); return; }
    const outstanding = Number(custPayOrder.total_amount) - Number(custPayOrder.amount_paid);
    if (paying > outstanding + 0.01) { toast(`Exceeds outstanding £${outstanding.toFixed(2)}`, 'warning'); return; }
    try {
      setCustPaySubmitting(true);
      const newPaid = Number(custPayOrder.amount_paid) + paying;
      const newStatus = newPaid >= Number(custPayOrder.total_amount) - 0.01 ? 'PAID' : 'PARTIAL';
      const res = await fetch('/api/wholesale/orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: custPayOrder.id, paymentStatus: newStatus, amountPaid: newPaid }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setCustPayModalOpen(false);
      if (ledgerCustomer) openLedger(ledgerCustomer);
      fetchCustomers();
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setCustPaySubmitting(false); }
  };

  const openLedger = async (customer: any) => {
    setLedgerCustomer(customer);
    setLedgerData(null);
    setLedgerTab('ORDERS');
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/ledger/customer/${customer.id}`);
      const data = await res.json();
      setLedgerData(data);
    } catch (err) { console.error(err); }
    finally { setLedgerLoading(false); }
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const url = `/api/customers?${typeFilter !== 'ALL' ? `type=${typeFilter}&` : ''}search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleTabChange = (newType: 'ALL' | 'WHOLESALE' | 'RETAIL') => {
    setTypeFilter(newType);
    const targetUrl = newType === 'ALL' ? '/customers' : `/customers?type=${newType}`;
    router.push(targetUrl);
  };

  const handleOpenAddModal = () => {
    const defaultType = typeFilter === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
    setFormData({
      name: '',
      company_name: '',
      type: defaultType,
      email: '',
      phone: '',
      tax_id: '',
      address: '',
      city: '',
      credit_limit: defaultType === 'WHOLESALE' ? '10000' : '0',
      payment_terms: defaultType === 'WHOLESALE' ? 'NET_30' : 'Due on Receipt',
      discount_percent: '0',
      notes: '',
    });
    setModalOpen(true);
  };

  useEffect(() => {
    fetchCustomers();
  }, [typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => { e.preventDefault(); fetchCustomers(); };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await fetch('/api/customers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create customer');
      toast(`Customer ${data.customer.name} created successfully!`, 'success');
      setModalOpen(false);
      fetchCustomers();
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {typeFilter === 'WHOLESALE'
                ? 'Wholesale B2B Clients & Accounts'
                : typeFilter === 'RETAIL'
                ? 'Retail Customers & Loyalty Club'
                : 'Customer Directory & Accounts CRM'}
            </h1>
            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
              typeFilter === 'WHOLESALE'
                ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                : typeFilter === 'RETAIL'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : 'bg-slate-100 text-slate-800 border-slate-200'
            }`}>
              {typeFilter === 'WHOLESALE' ? 'Wholesale B2B' : typeFilter === 'RETAIL' ? 'Retail POS' : 'All Accounts'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {typeFilter === 'WHOLESALE'
              ? 'Corporate Supermarket Accounts, Catering Wholesalers, Credit Limits & Statement Ledgers.'
              : typeFilter === 'RETAIL'
              ? 'Storefront Walk-in Shoppers, Loyalty Members, Contact Registry & Counter Orders.'
              : 'Corporate Wholesale Accounts, Hospitality B2B, and Retail Shopper Club.'}
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>
            {typeFilter === 'WHOLESALE'
              ? 'Add Wholesale Client'
              : typeFilter === 'RETAIL'
              ? 'Add Retail Customer'
              : 'Add New Customer'}
          </span>
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold w-fit">
          <button
            onClick={() => handleTabChange('ALL')}
            className={`px-4 py-2 rounded-lg transition-colors ${typeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            All Accounts ({customers.length})
          </button>
          <button
            onClick={() => handleTabChange('WHOLESALE')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${typeFilter === 'WHOLESALE' ? 'bg-white text-indigo-700 shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Building2 className="w-3.5 h-3.5" /> Wholesale B2B
          </button>
          <button
            onClick={() => handleTabChange('RETAIL')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${typeFilter === 'RETAIL' ? 'bg-white text-emerald-700 shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <User className="w-3.5 h-3.5" /> Retail Consumers
          </button>
        </div>
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Search name, company, email..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900" />
          </div>
          <button type="submit" className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold">Search</button>
        </form>
      </div>

      {/* Customers Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" /> Loading accounts...
        </div>
      ) : customers.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
          <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" /> No customers found matching this criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c) => {
            const isWholesale = c.type === 'WHOLESALE';
            return (
              <div key={c.id} className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm hover:shadow transition-shadow flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isWholesale ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                      {c.type}
                    </span>
                    {isWholesale && <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">{c.payment_terms}</span>}
                  </div>
                  <h3 className="font-extrabold text-base text-slate-900">{c.company_name || c.name}</h3>
                  {c.company_name && <div className="text-xs text-slate-500 font-medium mt-0.5">Contact: {c.name}</div>}
                  <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                    {c.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{c.email}</span></div>}
                    {c.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{c.phone}</span></div>}
                    {c.tax_id && <div className="text-[11px] text-slate-400 font-mono">Tax ID: {c.tax_id}</div>}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100">
                  {isWholesale ? (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-slate-50">
                        <div className="text-[10px] text-slate-400 font-semibold">Credit Limit</div>
                        <div className="font-extrabold text-slate-900 text-sm mt-0.5">£{Number(c.credit_limit).toLocaleString()}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-amber-50">
                        <div className="text-[10px] text-amber-700 font-semibold">Current Balance</div>
                        <div className="font-extrabold text-amber-900 text-sm mt-0.5">£{Number(c.current_balance).toLocaleString()}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>Total Spent:</span>
                      <span className="font-bold text-slate-900">£{Number(c.total_spent || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <button onClick={() => openLedger(c)}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-100">
                    <BookOpen className="w-3.5 h-3.5" /> View Ledger
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== CUSTOMER LEDGER DRAWER ===== */}
      {ledgerCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-end">
          <div className="bg-white w-full max-w-2xl h-full flex flex-col shadow-2xl border-l border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-sm">{ledgerCustomer.company_name || ledgerCustomer.name} — Ledger</h3>
                <p className="text-[11px] text-slate-400">{ledgerCustomer.type} account</p>
              </div>
              <button onClick={() => setLedgerCustomer(null)}><X className="w-5 h-5" /></button>
            </div>

            {ledgerLoading ? (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading ledger...
              </div>
            ) : ledgerData ? (
              <>
                <div className="grid grid-cols-3 gap-3 p-4 border-b border-slate-100 shrink-0">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">Total Invoiced</div>
                    <div className="font-extrabold text-slate-900 text-base">£{Number(ledgerData.summary?.total_invoiced || 0).toFixed(2)}</div>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3">
                    <div className="text-[10px] text-emerald-700 font-semibold uppercase">Total Paid</div>
                    <div className="font-extrabold text-emerald-800 text-base">£{Number(ledgerData.summary?.total_paid || 0).toFixed(2)}</div>
                  </div>
                  <div className="bg-rose-50 rounded-xl p-3">
                    <div className="text-[10px] text-rose-700 font-semibold uppercase">Outstanding</div>
                    <div className="font-extrabold text-rose-800 text-base">£{Number(ledgerData.summary?.outstanding || 0).toFixed(2)}</div>
                  </div>
                </div>

                <div className="flex bg-slate-100 p-1 mx-4 mt-3 rounded-xl text-xs font-bold shrink-0">
                  {(['ORDERS', 'RETURNS', 'LEDGER'] as const).map((t) => (
                    <button key={t} onClick={() => setLedgerTab(t)}
                      className={`flex-1 py-1.5 rounded-lg transition-colors ${ledgerTab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                      {t === 'ORDERS' ? `Orders (${ledgerData.orders?.length || 0})` : t === 'RETURNS' ? `Returns (${ledgerData.returns?.length || 0})` : `Ledger (${ledgerData.ledger?.length || 0})`}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 text-xs">
                  {ledgerTab === 'ORDERS' && (
                    <table className="w-full text-left">
                      <thead className="text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                        <tr><th className="py-2 pr-3">Order #</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Total</th><th className="py-2 pr-3">Paid</th><th className="py-2 pr-3">Status</th><th className="py-2">Action</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ledgerData.orders?.map((o: any) => (
                          <tr key={o.id} className="hover:bg-slate-50">
                            <td className="py-2 pr-3 font-mono font-bold text-slate-900">{o.order_number}</td>
                            <td className="py-2 pr-3 text-slate-500">{new Date(o.created_at).toLocaleDateString()}</td>
                            <td className="py-2 pr-3">{o.type}</td>
                            <td className="py-2 pr-3 font-bold">£{Number(o.total_amount).toFixed(2)}</td>
                            <td className="py-2 pr-3 text-emerald-700">£{Number(o.amount_paid).toFixed(2)}</td>
                            <td className="py-2 pr-3">
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${o.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : o.payment_status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                {o.payment_status}
                              </span>
                            </td>
                            <td className="py-2">
                              {o.payment_status !== 'PAID' && (
                                <button onClick={() => openCustPayModal(o)}
                                  className="px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg">
                                  Settle
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
                      <div className="text-center text-slate-400 py-8">No returns for this customer.</div>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                          <tr><th className="py-2 pr-3">Return #</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Refund</th><th className="py-2">Reason</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {ledgerData.returns?.map((r: any) => (
                            <tr key={r.return_number} className="hover:bg-slate-50">
                              <td className="py-2 pr-3 font-mono font-bold text-rose-700">{r.return_number}</td>
                              <td className="py-2 pr-3 text-slate-500">{new Date(r.return_date).toLocaleDateString()}</td>
                              <td className="py-2 pr-3 font-bold text-rose-700">£{Number(r.total_refund).toFixed(2)}</td>
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

      {/* ===== CUSTOMER PAYMENT MODAL ===== */}
      {custPayModalOpen && custPayOrder && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-emerald-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Record Payment — {custPayOrder.order_number}</h3>
                <p className="text-[11px] text-emerald-300">{ledgerCustomer?.company_name || ledgerCustomer?.name}</p>
              </div>
              <button onClick={() => setCustPayModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCustPaySubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl">
                <div><div className="text-[10px] text-slate-500 font-semibold">Invoice Total</div><div className="font-extrabold text-slate-900">£{Number(custPayOrder.total_amount).toFixed(2)}</div></div>
                <div><div className="text-[10px] text-emerald-600 font-semibold">Already Paid</div><div className="font-extrabold text-emerald-700">£{Number(custPayOrder.amount_paid).toFixed(2)}</div></div>
                <div><div className="text-[10px] text-rose-600 font-semibold">Outstanding</div><div className="font-extrabold text-rose-700">£{(Number(custPayOrder.total_amount) - Number(custPayOrder.amount_paid)).toFixed(2)}</div></div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Amount Received (£) *</label>
                <input type="number" step="0.01" min="0.01" required value={custPayAmount}
                  onChange={(e) => setCustPayAmount(e.target.value)}
                  className="w-full py-2.5 px-3 border-2 border-emerald-400 rounded-xl font-mono font-bold text-lg focus:outline-none" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Payment Method</label>
                <select value={custPayMethod} onChange={(e) => setCustPayMethod(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-300 rounded-xl bg-white font-semibold">
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card / Online</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Notes (optional)</label>
                <input type="text" value={custPayNotes} onChange={(e) => setCustPayNotes(e.target.value)}
                  placeholder="e.g. BACS ref 2847382" className="w-full py-2 px-3 border border-slate-300 rounded-xl" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setCustPayModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700">Cancel</button>
                <button type="submit" disabled={custPaySubmitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md">
                  {custPaySubmitting ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== ADD CUSTOMER MODAL ===== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Create Customer Account</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateCustomer} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Customer Segment *</label>
                  <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg font-bold">
                    <option value="WHOLESALE">Wholesale B2B Client</option>
                    <option value="RETAIL">Retail Consumer</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Contact Name *</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg" />
                </div>
              </div>
              {formData.type === 'WHOLESALE' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Company / Entity Name</label>
                  <input type="text" placeholder="e.g. Apex Metro Logistics Corp" value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg font-bold" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone</label>
                  <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg" />
                </div>
              </div>
              {formData.type === 'WHOLESALE' && (
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-2">
                  <span className="font-bold text-indigo-950 uppercase text-[10px]">Wholesale Credit & Terms</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Credit Limit (£)</label>
                      <input type="number" value={formData.credit_limit} onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                        className="w-full py-1.5 px-2 border border-slate-300 rounded" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Terms</label>
                      <select value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                        className="w-full py-1.5 px-2 border border-slate-300 rounded bg-white">
                        <option value="IMMEDIATE">Immediate</option>
                        <option value="NET_15">Net 15</option>
                        <option value="NET_30">Net 30</option>
                        <option value="NET_60">Net 60</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Tax ID / VAT</label>
                      <input type="text" value={formData.tax_id} onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                        className="w-full py-1.5 px-2 border border-slate-300 rounded" />
                    </div>
                  </div>
                </div>
              )}
              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-md">
                  {submitting ? 'Registering Account...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
          Loading customer accounts...
        </div>
      }
    >
      <CustomersContent />
    </Suspense>
  );
}
