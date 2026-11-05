'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  DollarSign,
  ChevronRight,
  X,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function WholesalePage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // New Wholesale Order Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [orderItems, setOrderItems] = useState<
    Array<{ productId: number; quantity: number; unitPrice: number }>
  >([]);
  const [paymentTerms, setPaymentTerms] = useState('NET_30');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ordRes, custRes, prodRes] = await Promise.all([
        fetch('/api/wholesale/orders'),
        fetch('/api/customers?type=WHOLESALE'),
        fetch('/api/products'),
      ]);
      const ordData = await ordRes.json();
      const custData = await custRes.json();
      const prodData = await prodRes.json();

      setOrders(ordData.orders || []);
      setCustomers(custData.customers || []);
      setProducts(prodData.products || []);
    } catch (err) {
      console.error('Error fetching wholesale data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Add line item
  const handleAddItem = () => {
    if (products.length === 0) return;
    const defaultProd = products[0];
    setOrderItems((prev) => [
      ...prev,
      {
        productId: defaultProd.id,
        quantity: defaultProd.min_wholesale_qty || 10,
        unitPrice: Number(defaultProd.wholesale_price),
      },
    ]);
  };

  // Update item
  const handleUpdateItem = (index: number, field: string, value: any) => {
    setOrderItems((prev) => {
      const copy = [...prev];
      if (field === 'productId') {
        const prod = products.find((p) => p.id === parseInt(value));
        if (prod) {
          copy[index] = {
            productId: prod.id,
            quantity: prod.min_wholesale_qty || 10,
            unitPrice: Number(prod.wholesale_price),
          };
        }
      } else if (field === 'quantity') {
        copy[index].quantity = Math.max(1, parseInt(value) || 1);
      } else if (field === 'unitPrice') {
        copy[index].unitPrice = Math.max(0, parseFloat(value) || 0);
      }
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = orderItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
  const tax = Number((subtotal * 0.05).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));

  // Check credit
  const currentDebt = Number(selectedCustomer?.current_balance || 0);
  const creditLimit = Number(selectedCustomer?.credit_limit || 0);
  const projectedBalance = currentDebt + total;
  const isOverCredit = creditLimit > 0 && projectedBalance > creditLimit;

  // Submit wholesale order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert('Please select a wholesale client');
      return;
    }
    if (orderItems.length === 0) {
      alert('Please add at least one line item');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/wholesale/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          items: orderItems,
          paymentMethod,
          paymentTerms,
          paymentStatus: paymentMethod === 'CREDIT' ? 'UNPAID' : 'PAID',
          amountPaid: paymentMethod === 'CREDIT' ? 0 : total,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place wholesale order');
      }

      alert(`Wholesale Order ${data.order.orderNumber} created successfully!`);
      setCreateModalOpen(false);
      setOrderItems([]);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Mark order paid
  const handleMarkPaid = async (orderId: number) => {
    if (!confirm('Mark this wholesale invoice as fully PAID?')) return;
    try {
      const ord = orders.find((o) => o.id === orderId);
      const res = await fetch('/api/wholesale/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          paymentStatus: 'PAID',
          amountPaid: ord?.total_amount,
        }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'PAID') return o.payment_status === 'PAID';
    if (statusFilter === 'UNPAID') return o.payment_status === 'UNPAID';
    if (statusFilter === 'PARTIAL') return o.payment_status === 'PARTIAL';
    return true;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Wholesale B2B Operations
            </h1>
            <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
              Bulk Sales
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Contract orders, tiered volume pricing, credit limits, and invoicing terms.
          </p>
        </div>

        <button
          onClick={() => {
            setOrderItems([]);
            if (customers.length > 0) setSelectedCustomerId(customers[0].id);
            setCreateModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-indigo-600/20 active:scale-98 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Wholesale Contract Order</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 bg-slate-200/60 p-1 rounded-xl text-xs font-semibold">
          {['ALL', 'UNPAID', 'PARTIAL', 'PAID'].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                statusFilter === f
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f === 'ALL' ? 'All Invoices' : f}
            </button>
          ))}
        </div>

        <button
          onClick={fetchData}
          className="p-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
            Loading wholesale contracts & invoices...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            No wholesale orders found under this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">B2B Account</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Items / Volume</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {ord.order_number}
                      <div className="text-[10px] text-slate-400 font-sans">
                        {new Date(ord.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{ord.company_name || ord.customer_name}</div>
                      <div className="text-[10px] text-slate-500">Contact: {ord.customer_name}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-700">
                        {ord.due_date ? new Date(ord.due_date).toLocaleDateString() : 'Net 30'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold text-[11px]">
                        {ord.items?.length || 0} Products
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-sm text-slate-900">
                        ${Number(ord.total_amount).toFixed(2)}
                      </div>
                      {ord.payment_status === 'PARTIAL' && (
                        <div className="text-[10px] text-emerald-600 font-semibold">
                          Paid: ${Number(ord.amount_paid).toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ord.payment_status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ord.payment_status === 'PARTIAL'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {ord.payment_status}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">{ord.payment_method}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {ord.payment_status !== 'PAID' ? (
                        <button
                          onClick={() => handleMarkPaid(ord.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-sm"
                        >
                          Record Payment
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px] flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Settled
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= CREATE WHOLESALE ORDER MODAL ================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">Create B2B Wholesale Contract</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateOrder} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Customer Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Select Wholesale Customer *
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(parseInt(e.target.value))}
                  required
                  className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Corporate / Wholesale Account --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name || c.name} (Credit: ${c.credit_limit} | Debt: ${c.current_balance})
                    </option>
                  ))}
                </select>

                {/* Credit Limit Safeguard Alert */}
                {selectedCustomer && (
                  <div
                    className={`mt-2 p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                      isOverCredit
                        ? 'bg-rose-50 border-rose-300 text-rose-800'
                        : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                    }`}
                  >
                    <div>
                      <span className="font-bold">Approved Credit Limit:</span> ${creditLimit.toLocaleString()} |{' '}
                      <span className="font-bold">Outstanding Balance:</span> ${currentDebt.toLocaleString()}
                    </div>
                    {isOverCredit && (
                      <span className="font-extrabold text-rose-600 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> Limit Exceeded!
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Order Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">Bulk Line Items</label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Product
                  </button>
                </div>

                {orderItems.length === 0 ? (
                  <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                    No products added yet. Click &ldquo;Add Product&rdquo; to begin quoting.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orderItems.map((item, index) => {
                      const prod = products.find((p) => p.id === item.productId);
                      return (
                        <div
                          key={index}
                          className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2 text-xs"
                        >
                          <div className="flex-1 min-w-0">
                            <select
                              value={item.productId}
                              onChange={(e) => handleUpdateItem(index, 'productId', e.target.value)}
                              className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded font-medium"
                            >
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (Stock: {p.stock_quantity})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="w-20">
                            <input
                              type="number"
                              min="1"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)}
                              className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded text-center font-bold"
                            />
                          </div>

                          <div className="w-24">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Wholesale $"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateItem(index, 'unitPrice', e.target.value)}
                              className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded text-right font-bold"
                            />
                          </div>

                          <div className="w-20 text-right font-extrabold text-slate-900">
                            ${(item.quantity * item.unitPrice).toFixed(2)}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Payment Terms & Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="NET_15">Net 15 Days</option>
                    <option value="NET_30">Net 30 Days (Standard)</option>
                    <option value="NET_60">Net 60 Days</option>
                    <option value="IMMEDIATE">Immediate Due</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Payment Type
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="CREDIT">Charge to Account Credit (Net terms)</option>
                    <option value="BANK_TRANSFER">Bank Wire / ACH</option>
                    <option value="CASH">Cash / Cheque</option>
                  </select>
                </div>
              </div>

              {/* Order Total Breakdown */}
              <div className="p-3 bg-slate-100 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Wholesale Commercial Tax (5%):</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total Order Value:</span>
                  <span className="text-indigo-600">${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-xs text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || orderItems.length === 0}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 disabled:bg-slate-300"
                >
                  {submitting ? 'Generating Contract & Inbound Ledger...' : 'Confirm Wholesale Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
