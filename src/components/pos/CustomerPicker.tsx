'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  User,
  Building2,
  Search,
  Plus,
  Phone,
  Mail,
  Check,
  X,
  CreditCard,
  UserPlus,
  ChevronDown,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export interface Customer {
  id: number;
  name: string;
  company_name?: string | null;
  type: 'RETAIL' | 'WHOLESALE';
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  credit_limit?: number | string | null;
  current_balance?: number | string | null;
  payment_terms?: string | null;
  discount_percent?: number | string | null;
  notes?: string | null;
}

interface CustomerPickerProps {
  type: 'RETAIL' | 'WHOLESALE';
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer) => void;
  customers: Customer[];
  onCustomerCreated?: (newCustomer: Customer) => void;
  compact?: boolean;
}

export default function CustomerPicker({
  type,
  selectedCustomer,
  onSelectCustomer,
  customers,
  onCustomerCreated,
  compact = false,
}: CustomerPickerProps) {
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Quick Add form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState(type === 'WHOLESALE' ? '5000' : '0');
  const [newTerms, setNewTerms] = useState(type === 'WHOLESALE' ? 'NET_30' : 'Due on Receipt');
  const [savingCustomer, setSavingCustomer] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search when picker opens
  useEffect(() => {
    if (pickerOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [pickerOpen]);

  // Filter customers by name, phone, company, email
  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      const matchName = c.name?.toLowerCase().includes(q);
      const matchPhone = c.phone?.toLowerCase().includes(q);
      const matchCompany = c.company_name?.toLowerCase().includes(q);
      const matchEmail = c.email?.toLowerCase().includes(q);
      return matchName || matchPhone || matchCompany || matchEmail;
    });
  }, [customers, search]);

  const handleOpenQuickAdd = () => {
    // If search looks like a phone number, prefill phone; otherwise prefill name
    const isDigits = /^[\d\s\+\-\(\)]+$/.test(search.trim());
    if (isDigits && search.trim().length >= 5) {
      setNewPhone(search.trim());
      setNewName('');
    } else {
      setNewName(search.trim());
      setNewPhone('');
    }
    setNewCompany('');
    setNewEmail('');
    setNewCreditLimit(type === 'WHOLESALE' ? '5000' : '0');
    setNewTerms(type === 'WHOLESALE' ? 'NET_30' : 'Due on Receipt');
    setAddModalOpen(true);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast('Customer Name is required', 'warning');
      return;
    }

    try {
      setSavingCustomer(true);
      const payload = {
        name: newName.trim(),
        company_name: newCompany.trim() || null,
        type,
        phone: newPhone.trim() || null,
        email: newEmail.trim() || null,
        credit_limit: parseFloat(newCreditLimit) || 0,
        payment_terms: newTerms,
        notes: `Created from ${type === 'WHOLESALE' ? 'Wholesale POS' : 'Retail POS'} checkout`,
      };

      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create customer');

      const created: Customer = data.customer;
      toast(`Customer "${created.name}" created and selected!`, 'success');

      if (onCustomerCreated) {
        onCustomerCreated(created);
      }
      onSelectCustomer(created);
      setAddModalOpen(false);
      setPickerOpen(false);
      setSearch('');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSavingCustomer(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className={`flex items-center justify-between gap-2 border rounded-xl hover:border-indigo-500 hover:shadow-sm transition-all text-left group ${
            !selectedCustomer && type === 'WHOLESALE'
              ? 'border-amber-300 bg-amber-50/50 hover:border-amber-400'
              : 'border-slate-200/90 bg-white hover:border-emerald-500'
          } ${
            compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs sm:text-sm'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {type === 'WHOLESALE' ? (
              <Building2 className={`w-4 h-4 shrink-0 ${!selectedCustomer ? 'text-amber-600' : 'text-indigo-600'}`} />
            ) : (
              <User className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <div className="min-w-0 truncate">
              {selectedCustomer ? (
                <div className="flex items-baseline gap-1.5 truncate">
                  <span className="font-extrabold text-slate-900 truncate">
                    {selectedCustomer.company_name || selectedCustomer.name}
                  </span>
                  {selectedCustomer.phone && (
                    <span className="text-[11px] font-mono text-slate-500 shrink-0">
                      ({selectedCustomer.phone})
                    </span>
                  )}
                  {Number(selectedCustomer.discount_percent || 0) > 0 && (
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 rounded shrink-0">
                      {selectedCustomer.discount_percent}% VIP
                    </span>
                  )}
                </div>
              ) : (
                <span className={type === 'WHOLESALE' ? 'text-amber-800 font-semibold text-xs' : 'text-slate-400 font-medium'}>
                  {type === 'WHOLESALE' ? 'Select wholesale client...' : 'Select or search customer...'}
                </span>
              )}
            </div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
        </button>
      </div>

      {/* ================= SEARCH & SELECT MODAL / DROPDOWN ================= */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-14 sm:pt-20 px-3"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPickerOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in">
            {/* Header with Search & Quick Add Button */}
            <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {type === 'WHOLESALE' ? (
                  <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                ) : (
                  <User className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <span className="font-bold text-xs sm:text-sm truncate">
                  {type === 'WHOLESALE' ? 'Select Wholesale Client' : 'Select Retail Customer'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenQuickAdd}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Customer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search Input Box */}
            <div className="p-3 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by customer name or phone number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Customer List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-700">No customer found</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      No matching records for &ldquo;{search}&rdquo;
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenQuickAdd}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow hover:bg-emerald-500 transition-all active:scale-95"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Quick Add &ldquo;{search}&rdquo;</span>
                  </button>
                </div>
              ) : (
                filteredCustomers.map((c) => {
                  const isSelected = selectedCustomer?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onSelectCustomer(c);
                        setPickerOpen(false);
                      }}
                      className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between gap-3 transition-colors ${
                        isSelected
                          ? 'bg-emerald-50 border border-emerald-300 text-emerald-950 font-bold'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                            {c.company_name || c.name}
                          </span>
                          {c.company_name && c.name && (
                            <span className="text-[10px] text-slate-500 font-medium truncate">
                              ({c.name})
                            </span>
                          )}
                          {Number(c.discount_percent || 0) > 0 && (
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 rounded">
                              {c.discount_percent}% VIP
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                          {c.phone && (
                            <span className="flex items-center gap-1 font-mono text-slate-600 font-semibold">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {c.phone}
                            </span>
                          )}
                          {c.email && (
                            <span className="flex items-center gap-1 truncate max-w-[180px]">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {c.email}
                            </span>
                          )}
                        </div>

                        {type === 'WHOLESALE' && (
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                            <span>
                              Credit Limit: <b className="font-mono text-slate-700">£{Number(c.credit_limit || 0).toLocaleString()}</b>
                            </span>
                            <span>
                              Balance: <b className="font-mono text-amber-700">£{Number(c.current_balance || 0).toLocaleString()}</b>
                            </span>
                            {c.payment_terms && (
                              <span className="bg-slate-100 px-1.5 rounded font-mono font-bold">
                                {c.payment_terms}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-400 group-hover:text-emerald-600">
                          Select
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= QUICK ADD CUSTOMER MODAL ================= */}
      {addModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm">
                  {type === 'WHOLESALE' ? 'Quick Add Wholesale Client' : 'Quick Add Retail Customer'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-4 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Customer / Contact Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Smith"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Phone Number *</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 07123 456789"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl font-mono font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {type === 'WHOLESALE' && (
                <>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Company / Entity Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Croydon Fresh Market Ltd"
                      value={newCompany}
                      onChange={(e) => setNewCompany(e.target.value)}
                      className="w-full py-2 px-3 border border-slate-300 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Credit Limit (£)</label>
                      <input
                        type="number"
                        value={newCreditLimit}
                        onChange={(e) => setNewCreditLimit(e.target.value)}
                        className="w-full py-2 px-3 border border-slate-300 rounded-xl font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Payment Terms</label>
                      <select
                        value={newTerms}
                        onChange={(e) => setNewTerms(e.target.value)}
                        className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Due on Receipt">Due on Receipt</option>
                        <option value="NET_15">Net 15 Days</option>
                        <option value="NET_30">Net 30 Days</option>
                        <option value="NET_60">Net 60 Days</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Email Address (Optional)</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    placeholder="e.g. contact@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCustomer}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingCustomer ? 'Registering...' : 'Save & Select for Billing'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
