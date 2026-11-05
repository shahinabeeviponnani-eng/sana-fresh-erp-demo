'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Building2,
  User,
  CreditCard,
  Mail,
  Phone,
  DollarSign,
  RefreshCw,
  X,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function CustomersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'WHOLESALE' | 'RETAIL'>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    type: 'WHOLESALE',
    email: '',
    phone: '',
    tax_id: '',
    address: '',
    city: '',
    credit_limit: '10000',
    payment_terms: 'NET_30',
    discount_percent: '0',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const url = `/api/customers?${typeFilter !== 'ALL' ? `type=${typeFilter}&` : ''}search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers();
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create customer');

      alert(`Customer ${data.customer.name} created successfully!`);
      setModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            SANA FRESH Customer Accounts & CRM
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Corporate Wholesale Supermarket Accounts, Hospitality B2B, and Retail Shopper Club.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({
              name: '',
              company_name: '',
              type: 'WHOLESALE',
              email: '',
              phone: '',
              tax_id: '',
              address: '',
              city: '',
              credit_limit: '10000',
              payment_terms: 'NET_30',
              discount_percent: '0',
              notes: '',
            });
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md active:scale-98"
        >
          <Plus className="w-4 h-4" /> Add New Customer
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold w-fit">
          <button
            onClick={() => setTypeFilter('ALL')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              typeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            All Accounts ({customers.length})
          </button>
          <button
            onClick={() => setTypeFilter('WHOLESALE')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              typeFilter === 'WHOLESALE' ? 'bg-white text-indigo-700 shadow-sm font-extrabold' : 'text-slate-600'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" /> Wholesale B2B
          </button>
          <button
            onClick={() => setTypeFilter('RETAIL')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              typeFilter === 'RETAIL' ? 'bg-white text-emerald-700 shadow-sm font-extrabold' : 'text-slate-600'
            }`}
          >
            <User className="w-3.5 h-3.5" /> Retail Consumers
          </button>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, company, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold"
          >
            Search
          </button>
        </form>
      </div>

      {/* Customers Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
          Loading accounts...
        </div>
      ) : customers.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
          <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
          No customers found matching this criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c) => {
            const isWholesale = c.type === 'WHOLESALE';
            return (
              <div
                key={c.id}
                className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm hover:shadow transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isWholesale
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {c.type}
                    </span>

                    {isWholesale && (
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">
                        {c.payment_terms}
                      </span>
                    )}
                  </div>

                  <h3 className="font-extrabold text-base text-slate-900">
                    {c.company_name || c.name}
                  </h3>
                  {c.company_name && (
                    <div className="text-xs text-slate-500 font-medium mt-0.5">Contact: {c.name}</div>
                  )}

                  <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                    {c.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{c.phone}</span>
                      </div>
                    )}
                    {c.tax_id && (
                      <div className="text-[11px] text-slate-400 font-mono">Tax ID: {c.tax_id}</div>
                    )}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  {isWholesale ? (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-slate-50">
                        <div className="text-[10px] text-slate-400 font-semibold">Credit Limit</div>
                        <div className="font-extrabold text-slate-900 text-sm mt-0.5">
                          ${Number(c.credit_limit).toLocaleString()}
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-amber-50">
                        <div className="text-[10px] text-amber-700 font-semibold">Current Balance</div>
                        <div className="font-extrabold text-amber-900 text-sm mt-0.5">
                          ${Number(c.current_balance).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>Total Spent:</span>
                      <span className="font-bold text-slate-900">
                        ${Number(c.total_spent || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= ADD CUSTOMER MODAL ================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Create Customer Account</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Customer Segment *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="WHOLESALE">Wholesale B2B Client</option>
                    <option value="RETAIL">Retail Consumer</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Contact Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {formData.type === 'WHOLESALE' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Company / Entity Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Metro Logistics Corp"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg font-bold"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {formData.type === 'WHOLESALE' && (
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-2">
                  <span className="font-bold text-indigo-950 uppercase text-[10px]">
                    Wholesale Credit & Terms
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Credit Limit ($)
                      </label>
                      <input
                        type="number"
                        value={formData.credit_limit}
                        onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                        className="w-full py-1.5 px-2 border border-slate-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Terms
                      </label>
                      <select
                        value={formData.payment_terms}
                        onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                        className="w-full py-1.5 px-2 border border-slate-300 rounded bg-white"
                      >
                        <option value="IMMEDIATE">Immediate</option>
                        <option value="NET_15">Net 15</option>
                        <option value="NET_30">Net 30</option>
                        <option value="NET_60">Net 60</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Tax ID / VAT
                      </label>
                      <input
                        type="text"
                        value={formData.tax_id}
                        onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                        className="w-full py-1.5 px-2 border border-slate-300 rounded"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-md"
                >
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
