'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle,
  Printer,
  X,
  User,
  ShoppingBag,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface Product {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  retail_price: number;
  stock_quantity: number;
  unit: string;
  category_name: string;
  category_code: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
}

export default function POSPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Checkout modal state
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'UPI'>('CASH');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  // Receipt modal state
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<any>(null);

  // Barcode input ref for barcode guns
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, custRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/categories'),
        fetch('/api/customers?type=RETAIL'),
      ]);
      const prodData = await prodRes.json();
      const catData = await catRes.json();
      const custData = await custRes.json();

      setProducts(prodData.products || []);
      setCategories(catData.categories || []);
      setCustomers(custData.customers || []);
      if (custData.customers?.length > 0) {
        setSelectedCustomer(custData.customers[0]); // default to walk-in
      }
    } catch (err) {
      console.error('POS fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === 'ALL' || p.category_code === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery));
    return matchesCategory && matchesSearch;
  });

  // Handle Barcode Scan / Enter Key in Search Input
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const match = products.find(
        (p) =>
          p.barcode === searchQuery.trim() ||
          p.sku.toLowerCase() === searchQuery.trim().toLowerCase()
      );
      if (match) {
        addToCart(match);
        setSearchQuery('');
      }
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock_quantity <= 0) {
      alert(`"${product.name}" is currently Out of Stock!`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          alert(`Cannot add more. Available stock limit reached (${product.stock_quantity})`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, discount: 0 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty > item.product.stock_quantity) {
              alert(`Maximum available stock reached (${item.product.stock_quantity})`);
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Calculations
  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.product.retail_price) * item.quantity,
    0
  );
  const totalDiscount = cart.reduce((sum, item) => sum + item.discount, 0);
  const taxableAmount = Math.max(0, subtotal - totalDiscount);
  const tax = Number((taxableAmount * 0.08).toFixed(2));
  const grandTotal = Number((taxableAmount + tax).toFixed(2));

  // Open Checkout
  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setAmountReceived(grandTotal.toString());
    setCheckoutModalOpen(true);
  };

  // Complete Sale
  const handleCompleteSale = async () => {
    try {
      setProcessing(true);
      const payload = {
        customerId: selectedCustomer?.id || null,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: Number(item.product.retail_price),
          discount: item.discount,
        })),
        paymentMethod,
        amountReceived: Number(amountReceived) || grandTotal,
      };

      const res = await fetch('/api/retail/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete transaction');
      }

      setCompletedOrder({
        ...data.order,
        customerName: selectedCustomer?.name || 'Walk-in Customer',
        cashierName: user?.name || 'Cashier',
      });

      // Reset cart and refresh product stock in memory
      setCart([]);
      setCheckoutModalOpen(false);
      setReceiptModalOpen(true);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const changeDue = Math.max(0, (Number(amountReceived) || 0) - grandTotal);

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-slate-100">
      {/* ================= LEFT SECTION: CATALOG & SEARCH ================= */}
      <div className="flex-1 flex flex-col min-w-0 p-3 sm:p-4 lg:p-5 overflow-hidden">
        {/* Top Search & Barcode Bar */}
        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search product name, SKU or scan barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Customer Selector */}
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedCustomer?.id || ''}
              onChange={(e) => {
                const c = customers.find((cust) => cust.id === parseInt(e.target.value));
                setSelectedCustomer(c || null);
              }}
              className="py-2 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.discount_percent > 0 ? `(${c.discount_percent}% VIP)` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 py-3 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.code)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat.code
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mr-2" />
              Loading Product Inventory...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
              <ShoppingBag className="w-10 h-10 mb-2 text-slate-300" />
              No matching products found. Try adjusting search or category filter.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map((p) => {
                const inCart = cart.find((item) => item.product.id === p.id);
                const isOutOfStock = p.stock_quantity <= 0;
                const isLowStock = p.stock_quantity > 0 && p.stock_quantity <= 15;

                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && addToCart(p)}
                    className={`bg-white rounded-xl p-3 border transition-all flex flex-col justify-between select-none relative group ${
                      isOutOfStock
                        ? 'opacity-60 border-slate-200 cursor-not-allowed bg-slate-50'
                        : 'border-slate-200/90 hover:border-emerald-500 hover:shadow-md cursor-pointer active:scale-95'
                    }`}
                  >
                    {inCart && (
                      <span className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-emerald-600 text-white rounded-full text-xs font-bold flex items-center justify-center shadow-md">
                        {inCart.quantity}
                      </span>
                    )}

                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-mono font-medium text-slate-400 truncate">
                          {p.sku}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-700'
                              : isLowStock
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {p.stock_quantity} {p.unit}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                        {p.name}
                      </h3>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-sm font-extrabold text-emerald-600">
                        ${Number(p.retail_price).toFixed(2)}
                      </span>
                      <button
                        disabled={isOutOfStock}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${
                          isOutOfStock ? 'bg-slate-300' : 'bg-slate-900 group-hover:bg-emerald-600'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ================= RIGHT SECTION: LIVE CART & CHECKOUT ================= */}
      <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-slate-200/90 shadow-xl flex flex-col h-auto lg:h-full shrink-0">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-600" />
            <h2 className="font-extrabold text-slate-900 text-sm">Retail Register</h2>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              {cart.reduce((s, i) => s + i.quantity, 0)} items
            </span>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-[11px] text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[35vh] lg:max-h-none">
          {cart.length === 0 ? (
            <div className="h-44 lg:h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
              <ShoppingBag className="w-10 h-10 mb-2 text-slate-300 stroke-[1.5]" />
              <span className="font-medium text-slate-500">Cart is empty</span>
              <span className="text-[11px] text-slate-400 mt-0.5">Click or scan items to add</span>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {item.product.name}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-bold">
                    ${Number(item.product.retail_price).toFixed(2)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => updateQuantity(item.product.id, -1)}
                    className="w-6 h-6 rounded bg-white border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-100 active:scale-95"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-bold text-slate-800 w-5 text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.product.id, 1)}
                    className="w-6 h-6 rounded bg-white border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-100 active:scale-95"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="w-6 h-6 rounded text-slate-400 hover:text-rose-600 flex items-center justify-center ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Order Summary & Pay Button */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/80 space-y-2">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Subtotal</span>
            <span className="font-medium text-slate-900">${subtotal.toFixed(2)}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between text-xs text-emerald-600">
              <span>Customer Loyalty Discount</span>
              <span className="font-semibold">-${totalDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs text-slate-500">
            <span>Sales Tax (8%)</span>
            <span className="font-medium text-slate-900">${tax.toFixed(2)}</span>
          </div>
          <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
            <span className="text-sm font-extrabold text-slate-900">Total Payable</span>
            <span className="text-xl font-black text-emerald-600">${grandTotal.toFixed(2)}</span>
          </div>

          <button
            onClick={handleOpenCheckout}
            disabled={cart.length === 0}
            className={`w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-lg transition-all ${
              cart.length === 0
                ? 'bg-slate-300 cursor-not-allowed shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30 active:scale-98'
            }`}
          >
            <Banknote className="w-5 h-5" />
            <span>Process Payment (${grandTotal.toFixed(2)})</span>
          </button>
        </div>
      </div>

      {/* ================= PAYMENT MODAL ================= */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Tender POS Checkout</h3>
              </div>
              <button
                onClick={() => setCheckoutModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-center py-2 bg-emerald-50 rounded-xl border border-emerald-100">
                <span className="text-xs font-semibold text-emerald-800 uppercase">Amount Due</span>
                <div className="text-3xl font-black text-emerald-600 mt-0.5">
                  ${grandTotal.toFixed(2)}
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setPaymentMethod('CASH')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 ${
                      paymentMethod === 'CASH'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Banknote className="w-5 h-5 text-emerald-600" />
                    <span>Cash</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('CARD')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 ${
                      paymentMethod === 'CARD'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-indigo-600" />
                    <span>Credit Card</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('UPI')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 ${
                      paymentMethod === 'UPI'
                        ? 'border-cyan-600 bg-cyan-50 text-cyan-800 ring-2 ring-cyan-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <QrCode className="w-5 h-5 text-cyan-600" />
                    <span>UPI / Scan</span>
                  </button>
                </div>
              </div>

              {/* Cash Tendering & Quick Denominations */}
              {paymentMethod === 'CASH' && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Amount Received ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    className="w-full py-2 px-3 text-lg font-bold text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />

                  {/* Fast Denomination Pills */}
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    <button
                      onClick={() => setAmountReceived(grandTotal.toString())}
                      className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded font-semibold text-slate-700"
                    >
                      Exact
                    </button>
                    {[10, 20, 50, 100].map((val) => (
                      <button
                        key={val}
                        onClick={() => setAmountReceived(val.toString())}
                        className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded font-semibold text-slate-700"
                      >
                        ${val}
                      </button>
                    ))}
                  </div>

                  {/* Live Change Calculation */}
                  <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-600">Change Due:</span>
                    <span
                      className={`text-base font-extrabold ${
                        (Number(amountReceived) || 0) < grandTotal
                          ? 'text-rose-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      ${changeDue.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={handleCompleteSale}
                disabled={
                  processing ||
                  (paymentMethod === 'CASH' && (Number(amountReceived) || 0) < grandTotal)
                }
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none"
              >
                {processing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Deducting Stock & Syncing Ledger...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Complete & Print Invoice</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= INSTANT THERMAL RECEIPT MODAL ================= */}
      {receiptModalOpen && completedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in">
            <div className="p-4 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-white" />
                <h3 className="font-bold text-sm">Sale Successful</h3>
              </div>
              <button
                onClick={() => setReceiptModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thermal Slip Preview */}
            <div className="p-5 font-mono text-xs text-slate-800 space-y-3 bg-slate-50">
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <div className="font-extrabold text-sm text-slate-900">APEX ENTERPRISE ERP</div>
                <div className="text-[10px] text-slate-500">STORE #01 - MAIN OUTLET</div>
                <div className="text-[10px] text-slate-500">GST/TAX ID: US-992817293</div>
                <div className="text-[10px] text-slate-600 mt-1 font-bold">
                  {completedOrder.orderNumber}
                </div>
              </div>

              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                {completedOrder.items?.map((it: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{it.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {it.quantity} x ${Number(it.unitPrice).toFixed(2)}
                      </div>
                    </div>
                    <div className="font-bold text-slate-900">
                      ${Number(it.total).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 border-b border-dashed border-slate-300 pb-3 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${Number(completedOrder.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (8%):</span>
                  <span>${Number(completedOrder.tax).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-1 text-slate-900">
                  <span>TOTAL:</span>
                  <span>${Number(completedOrder.total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Payment ({completedOrder.paymentMethod}):</span>
                  <span>${Number(completedOrder.amountReceived).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Change Given:</span>
                  <span>${Number(completedOrder.changeDue).toFixed(2)}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-400 pt-1">
                Cashier: {completedOrder.cashierName} • {new Date().toLocaleString()}
                <div className="mt-1 font-sans text-[11px] text-emerald-700 font-semibold">
                  Thank you for shopping with ApexERP!
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button
                onClick={() => setReceiptModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
