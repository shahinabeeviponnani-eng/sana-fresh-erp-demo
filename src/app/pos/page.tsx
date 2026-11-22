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
  FileText,
  Eye,
  ChevronUp,
  Phone,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import SanaInvoiceModal, { InvoiceData } from '@/components/invoice/SanaInvoiceModal';
import { useToast } from '@/components/ui/Toast';
import CustomerPicker from '@/components/pos/CustomerPicker';
import { useProductCache, CachedProduct } from '@/hooks/useProductCache';

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
  image_url?: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
}

export default function POSPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    products: cachedProducts,
    cacheReady,
    cacheLoading,
    cacheAge,
    searchProducts,
    fetchLiveProduct,
    addProductToCache,
    forceRefresh,
  } = useProductCache(user?.id);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Sync cachedProducts into local products state
  useEffect(() => {
    if (cacheReady) {
      setProducts(cachedProducts as Product[]);
      setLoading(false);
    } else if (!user?.id) {
      // Auth not ready yet — keep waiting
      setLoading(true);
    }
  }, [cacheReady, cachedProducts, user?.id]);

  // Fallback: if user is loaded but cache never becomes ready after 8s, fetch directly
  useEffect(() => {
    if (!user?.id) return;
    const t = setTimeout(async () => {
      if (loading) {
        try {
          const res = await fetch('/api/products');
          const data = await res.json();
          setProducts(data.products || []);
        } catch {}
        setLoading(false);
      }
    }, 8000);
    return () => clearTimeout(t);
  }, [user?.id]);

  // Debounced search against cache (local-first, server fallback)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      const hits = await searchProducts(searchQuery);
      setSearchResults(hits as Product[]);
      setSearchLoading(false);
    }, 150);
    return () => clearTimeout(t);
  }, [searchQuery, searchProducts]);

  // Mobile drawer state
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Checkout modal state
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'UPI'>('CASH');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [cardReference, setCardReference] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [taxRate, setTaxRate] = useState<number>(0); // 0% UK produce VAT

  // Receipt modal state
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<any>(null);

  // A4 Full Invoice modal state
  const [a4InvoiceOpen, setA4InvoiceOpen] = useState(false);
  const [invoicePayload, setInvoicePayload] = useState<InvoiceData | null>(null);

  // Quick Add Product directly from Billing Screen
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);
  const [quickProductSaving, setQuickProductSaving] = useState(false);
  const [quickProductForm, setQuickProductForm] = useState({
    barcode: '',
    name: '',
    category_id: '',
    retail_price: '',
    cost_price: '',
    stock_quantity: '1',
    unit: 'pcs',
    sku: '',
  });

  // Barcode input ref for barcode scanner guns
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
      const [catRes, custRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/customers?type=RETAIL'),
      ]);
      const catData = await catRes.json();
      const custData = await custRes.json();
      setCategories(catData.categories || []);
      setCustomers(custData.customers || []);
      if (custData.customers?.length > 0) setSelectedCustomer(custData.customers[0]);
    } catch (err) {
      console.error('POS fetch error:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter products — use searchResults when query active, else full cached list
  const displayProducts = searchQuery.trim()
    ? searchResults
    : products.filter((p) =>
        selectedCategory === 'ALL' || p.category_code === selectedCategory
      );

  // Open Quick Add Product Modal directly from billing
  const openQuickAddModal = (initialSearchOrBarcode = '') => {
    const term = initialSearchOrBarcode.trim();
    // Check if input looks like numbers or barcode vs a text product name
    const looksLikeBarcode = /^[0-9A-Za-z_-]{3,}$/.test(term) && /\d/.test(term);
    setQuickProductForm({
      barcode: looksLikeBarcode ? term : (term.length >= 4 && !term.includes(' ') ? term : ''),
      name: !looksLikeBarcode && term.includes(' ') ? term : '',
      category_id: categories[0]?.id?.toString() || '',
      retail_price: '',
      cost_price: '',
      stock_quantity: '1',
      unit: 'pcs',
      sku: '',
    });
    setQuickAddModalOpen(true);
  };

  const handleSaveQuickProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickProductForm.name.trim()) {
      toast('Please enter a product name', 'warning');
      return;
    }
    if (!quickProductForm.retail_price || isNaN(parseFloat(quickProductForm.retail_price))) {
      toast('Please enter a valid retail price', 'warning');
      return;
    }

    try {
      setQuickProductSaving(true);
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: quickProductForm.sku.trim() || undefined,
          barcode: quickProductForm.barcode.trim() || undefined,
          name: quickProductForm.name.trim(),
          category_id: quickProductForm.category_id ? parseInt(quickProductForm.category_id, 10) : null,
          retail_price: parseFloat(quickProductForm.retail_price),
          cost_price: quickProductForm.cost_price ? parseFloat(quickProductForm.cost_price) : 0,
          stock_quantity: parseFloat(quickProductForm.stock_quantity) || 1,
          unit: quickProductForm.unit || 'pcs',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create product');
      }

      const newProd: Product = {
        id: data.product.id,
        sku: data.product.sku,
        barcode: data.product.barcode || '',
        name: data.product.name,
        retail_price: Number(data.product.retail_price),
        stock_quantity: Number(data.product.stock_quantity),
        unit: data.product.unit || 'pcs',
        category_name: data.product.category_name || '',
        category_code: data.product.category_code || '',
        image_url: data.product.image_url || null,
      };

      addProductToCache(data.product);
      setProducts((prev) => [newProd, ...prev]);
      addToCart(newProd);
      setSearchQuery('');
      setQuickAddModalOpen(false);
      toast(`"${newProd.name}" added to stock & billing cart!`, 'success');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } catch (err: any) {
      toast(err.message || 'Error saving product', 'error');
    } finally {
      setQuickProductSaving(false);
    }
  };

  // Handle Barcode Scan / Enter Key in Search Input
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const term = searchQuery.trim();
      if (!term) return;

      const match = products.find(
        (p) =>
          (p.barcode && p.barcode.toLowerCase() === term.toLowerCase()) ||
          p.sku.toLowerCase() === term.toLowerCase() ||
          p.name.toLowerCase() === term.toLowerCase()
      );

      if (match) {
        addToCart(match);
        setSearchQuery('');
        toast(`Added "${match.name}" to cart`, 'success');
      } else {
        // If scanned or entered barcode/product doesn't exist, open quick add modal with barcode pre-filled
        openQuickAddModal(term);
        toast(`"${term}" not in system. Quick add to billing below.`, 'info');
      }
    }
  };

  // Add to cart — fetch live price+stock first, then add
  const addToCart = async (product: Product) => {
    // Optimistically add from cache first for instant UI response
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, discount: 0 }];
    });
    // Then silently refresh price+stock in background
    const live = await fetchLiveProduct(product.id);
    if (live) {
      setCart((prev) =>
        prev.map((item) =>
          item.product.id === live.id
            ? { ...item, product: live as Product }
            : item
        )
      );
    }
  };

  // Update quantity - allows unrestricted quantities even exceeding stock
  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const setExplicitQuantity = (productId: number, qtyStr: string) => {
    const val = parseFloat(qtyStr);
    if (isNaN(val) || val <= 0) return;
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity: val } : item
      )
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
  const tax = Number((taxableAmount * (taxRate / 100)).toFixed(2));
  const grandTotal = Number((taxableAmount + tax).toFixed(2));

  // Open Checkout
  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setAmountReceived(grandTotal.toString());
    setCardReference('');
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
        taxRate,
        amountReceived: Number(amountReceived) || grandTotal,
        notes: 'SANA FRESH Counter Storefront Checkout',
        cardReference: paymentMethod === 'CARD' ? cardReference : undefined,
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

      const completed = {
        ...data.order,
        customerName: selectedCustomer?.name || 'Walk-in Customer',
        customerAddress: selectedCustomer?.address || 'Counter Storefront, 94 Bensham Lane, Croydon',
        cashierName: user?.name || 'Alex Rivera (Front Cashier)',
      };

      setCompletedOrder(completed);

      // Prepare full A4 invoice payload as well
      setInvoicePayload({
        orderNumber: completed.orderNumber,
        invoiceDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        terms: 'Due on Receipt',
        customerName: completed.customerName,
        customerAddress: completed.customerAddress,
        customerCountry: 'United Kingdom',
        subtotal: completed.subtotal,
        taxAmount: completed.tax,
        totalAmount: completed.total,
        amountPaid: completed.amountReceived,
        paymentMethod: completed.paymentMethod,
        paymentStatus: 'PAID',
        notes: 'Thanks for your business. Fresh produce daily.',
        items: (completed.items || []).map((it: any) => ({
          productName: it.name,
          sku: it.sku,
          unit: it.unit || 'pcs',
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.total,
        })),
      });

      // Reset cart and refresh product stock in cache
      setCart([]);
      setCheckoutModalOpen(false);
      setMobileCartOpen(false);
      setReceiptModalOpen(true);
      forceRefresh(); // refresh cache after sale to get updated stock
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const changeDue = Math.max(0, (Number(amountReceived) || 0) - grandTotal);

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-slate-100 relative">
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
            {searchLoading && (
              <RefreshCw className="w-3.5 h-3.5 text-emerald-500 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
            )}
            {searchQuery && !searchLoading && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Add Product Button */}
          <button
            onClick={() => openQuickAddModal(searchQuery.trim())}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors whitespace-nowrap active:scale-95 shrink-0"
            title="Add unlisted shelf item directly to billing"
          >
            <Plus className="w-4 h-4" />
            <span>Quick Product</span>
          </button>

          {/* Customer Selector / Search & Quick Add */}
          <div className="shrink-0 min-w-[220px]">
            <CustomerPicker
              type="RETAIL"
              selectedCustomer={selectedCustomer}
              onSelectCustomer={setSelectedCustomer}
              customers={customers}
              onCustomerCreated={(newCust) => setCustomers((prev) => [newCust, ...prev])}
            />
          </div>
        </div>

        {/* Cache status bar */}
        {cacheReady && (
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-[10px] text-slate-400">
              {cacheLoading ? 'Refreshing catalogue...' : `${products.length} products cached${cacheAge ? ` · ${cacheAge.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
            </span>
            <button onClick={forceRefresh} disabled={cacheLoading}
              className="text-[10px] text-emerald-600 hover:text-emerald-700 font-semibold disabled:opacity-40 flex items-center gap-1">
              <RefreshCw className={`w-3 h-3 ${cacheLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        )}

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

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2 text-emerald-600" />
              Loading produce catalogue...
            </div>
          ) : displayProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-12">
              <AlertCircle className="w-8 h-8 mb-2 text-slate-300" />
              <span>No produce found matching &ldquo;{searchQuery}&rdquo;</span>
              {searchQuery && (
                <button
                  onClick={() => openQuickAddModal(searchQuery.trim())}
                  className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>Quick Add &ldquo;{searchQuery}&rdquo; to Cart &amp; Stock</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 pb-20 lg:pb-6">
              {displayProducts.map((p) => {
                const inCart = cart.find((item) => item.product.id === p.id);
                const isOutOfStock = p.stock_quantity <= 0;

                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all duration-150 relative bg-white ${
                      inCart
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                        : isOutOfStock
                        ? 'border-amber-300 bg-amber-50/20 hover:border-amber-400 hover:shadow-md'
                        : 'border-slate-200/80 hover:border-emerald-400 hover:shadow-md'
                    }`}
                  >
                    {inCart && (
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">
                        {inCart.quantity}
                      </span>
                    )}

                    {/* Product image or placeholder */}
                    {(p as any).image_url ? (
                      <img
                        src={(p as any).image_url}
                        alt={p.name}
                        className="w-full h-20 object-cover rounded-lg mb-2 border border-slate-100"
                      />
                    ) : null}

                    <div>
                      <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        <span>{p.unit || 'pcs'}</span>
                        {p.barcode && (
                          <span className="font-mono text-[9px] text-slate-400 truncate max-w-[80px]" title={`Barcode: ${p.barcode}`}>
                            {p.barcode}
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-2 mt-0.5 leading-snug">
                        {p.name}
                      </div>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="font-mono font-black text-sm text-emerald-700">
                        £{Number(p.retail_price).toFixed(2)}
                      </span>
                      <span
                        className={`text-[10px] font-semibold ${
                          p.stock_quantity <= 0
                            ? 'text-rose-600 font-bold bg-rose-50 px-1 py-0.5 rounded border border-rose-200'
                            : p.stock_quantity <= 10
                            ? 'text-amber-600 font-bold'
                            : 'text-slate-400'
                        }`}
                      >
                        {p.stock_quantity <= 0 ? `${p.stock_quantity} (Negative OK)` : `${p.stock_quantity} in stock`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ================= RIGHT SECTION: CART REGISTER ================= */}
      {/* On desktop: sticky sidebar. On mobile: slide-up drawer when mobileCartOpen is true */}
      <div
        className={`lg:w-96 bg-white border-l border-slate-200 flex flex-col shadow-xl z-30 transition-transform duration-200 ${
          mobileCartOpen
            ? 'fixed inset-0 z-50 flex'
            : 'hidden lg:flex'
        }`}
      >
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-sm text-slate-900">Current Register</span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
              {cart.reduce((sum, it) => sum + it.quantity, 0)} items
            </span>
          </div>

          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold p-1"
              >
                Clear
              </button>
            )}
            {mobileCartOpen && (
              <button
                onClick={() => setMobileCartOpen(false)}
                className="lg:hidden p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Selected Customer Billing Profile in Register */}
        <div className="p-3 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
              Billed Customer
            </div>
            <div className="font-extrabold text-xs text-slate-900 truncate">
              {selectedCustomer?.name || 'Walk-in Customer'}
            </div>
            {selectedCustomer?.phone && (
              <div className="text-[11px] font-mono text-slate-600 font-semibold flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>{selectedCustomer.phone}</span>
              </div>
            )}
          </div>
          <div className="shrink-0">
            <CustomerPicker
              type="RETAIL"
              selectedCustomer={selectedCustomer}
              onSelectCustomer={setSelectedCustomer}
              customers={customers}
              onCustomerCreated={(newCust) => setCustomers((prev) => [newCust, ...prev])}
              compact
            />
          </div>
        </div>

        {/* Cart Line Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-slate-100">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-12">
              <ShoppingBag className="w-10 h-10 mb-2 text-slate-300 stroke-[1.5]" />
              <span className="font-medium">Register is empty</span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                Scan barcode or tap produce to add
              </span>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="pt-2.5 first:pt-0">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs text-slate-900 truncate">
                      {item.product.name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5 flex-wrap">
                      <span>£{Number(item.product.retail_price).toFixed(2)} / {item.product.unit || 'pcs'}</span>
                      {item.product.stock_quantity <= 0 && (
                        <span className="text-[9px] font-semibold text-rose-600 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">
                          0 Stock (Negative OK)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-xs text-slate-900">
                    £{(Number(item.product.retail_price) * item.quantity).toFixed(2)}
                  </div>
                </div>

                {/* Stepper Controls */}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-6 h-6 rounded bg-white text-slate-700 flex items-center justify-center font-bold text-xs shadow-sm hover:bg-slate-50 active:scale-95"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      value={item.quantity}
                      onChange={(e) => setExplicitQuantity(item.product.id, e.target.value)}
                      className="w-12 text-center bg-transparent font-bold text-xs focus:outline-none"
                    />
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-6 h-6 rounded bg-white text-slate-700 flex items-center justify-center font-bold text-xs shadow-sm hover:bg-slate-50 active:scale-95"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Financial Summary & Checkout Button */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3 shrink-0">
          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold">£{subtotal.toFixed(2)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount:</span>
                <span className="font-mono font-semibold">-£{totalDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>VAT (0% Produce Standard):</span>
              <span className="font-mono font-semibold">£{tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-200">
              <span>TOTAL DUE:</span>
              <span className="font-mono text-emerald-700 text-base">£{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleOpenCheckout}
            disabled={cart.length === 0}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none active:scale-95 transition-all"
          >
            <span>Charge £{grandTotal.toFixed(2)}</span>
          </button>
        </div>
      </div>

      {/* ================= MOBILE BOTTOM FLOATING CART TRIGGER ================= */}
      {cart.length > 0 && !mobileCartOpen && (
        <div className="lg:hidden fixed bottom-14 left-0 right-0 p-3 z-30">
          <button
            onClick={() => setMobileCartOpen(true)}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-xl flex items-center justify-between active:scale-98 transition-all"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              <span>Cart ({cart.reduce((s, it) => s + it.quantity, 0)})</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-base">
              <span>£{grandTotal.toFixed(2)}</span>
              <ChevronUp className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* ================= CHECKOUT / TENDER MODAL ================= */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Process Payment</h3>
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
                <div className="text-3xl font-black text-emerald-700 mt-0.5 font-mono">
                  £{grandTotal.toFixed(2)}
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
                    <span>Card</span>
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
                    <span>Contactless</span>
                  </button>
                </div>
              </div>

              {/* Card Reference */}
              {paymentMethod === 'CARD' && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Card Terminal Reference *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TXN-284738 or last 4 digits"
                    value={cardReference}
                    onChange={(e) => setCardReference(e.target.value)}
                    className="w-full py-2 px-3 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Cash Tendering & Quick Denominations in GBP (£) */}
              {paymentMethod === 'CASH' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Amount Received (£)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      className="w-full py-2.5 px-3 text-2xl font-black font-mono text-slate-900 border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 text-center tracking-wider"
                      placeholder="0.00"
                    />
                  </div>

                  {/* UK Denomination Pills */}
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setAmountReceived(grandTotal.toString())}
                      className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold"
                    >
                      Exact
                    </button>
                    {[5, 10, 20, 50, 100].map((val) => (
                      <button
                        type="button"
                        key={val}
                        onClick={() => setAmountReceived(val.toString())}
                        className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-700 border border-slate-200"
                      >
                        £{val}
                      </button>
                    ))}
                  </div>

                  {/* Live Change / Balance Display */}
                  {(() => {
                    const received = Number(amountReceived) || 0;
                    const diff = received - grandTotal;
                    if (received === 0) return null;
                    if (diff < 0) {
                      // Underpaid
                      return (
                        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
                          <div className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">Still Owed</div>
                          <div className="text-3xl font-black font-mono text-amber-600 text-center">
                            £{Math.abs(diff).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-amber-600 text-center mt-1 font-semibold">
                            Customer needs to pay £{Math.abs(diff).toFixed(2)} more
                          </div>
                        </div>
                      );
                    }
                    if (diff === 0) {
                      return (
                        <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3 flex items-center justify-center gap-2">
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                          <span className="font-black text-emerald-700 text-sm">Exact Amount — No Change</span>
                        </div>
                      );
                    }
                    // Overpaid — show change to return
                    return (
                      <div className="rounded-xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-500 to-green-600 p-4 shadow-lg shadow-emerald-500/30">
                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-100 mb-1 text-center">Change to Return</div>
                        <div className="text-5xl font-black font-mono text-white text-center drop-shadow-sm">
                          £{diff.toFixed(2)}
                        </div>
                        <div className="flex justify-between text-[11px] text-emerald-100 mt-3 font-semibold border-t border-emerald-400/50 pt-2">
                          <span>Total: £{grandTotal.toFixed(2)}</span>
                          <span>Received: £{received.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <button
                onClick={handleCompleteSale}
                disabled={
                  processing ||
                  (paymentMethod === 'CARD' && !cardReference.trim())
                }
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none active:scale-95 transition-all"
              >
                {processing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Deducting Stock &amp; Syncing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Complete &amp; Print Bill</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= INSTANT RECEIPT / INVOICE MODAL ================= */}
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
                <div className="font-black text-base text-emerald-800 tracking-tight">SANA FRESH</div>
                <div className="text-[10px] text-slate-600 font-bold">SANA GROUP LTD • Reg: 16728852</div>
                <div className="text-[10px] text-slate-500">94 Bensham Lane, CR7 7ES, Croydon</div>
                <div className="text-[10px] text-slate-700 mt-1 font-bold font-mono">
                  RECEIPT: {completedOrder.orderNumber}
                </div>
              </div>

              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                {completedOrder.items?.map((it: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{it.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {it.quantity} x £{Number(it.unitPrice).toFixed(2)}
                      </div>
                    </div>
                    <div className="font-bold text-slate-900">
                      £{Number(it.total).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 border-b border-dashed border-slate-300 pb-3 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>£{Number(completedOrder.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT (0%):</span>
                  <span>£{Number(completedOrder.tax).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-1 text-slate-900">
                  <span>TOTAL:</span>
                  <span>£{Number(completedOrder.total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Payment ({completedOrder.paymentMethod}):</span>
                  <span>£{Number(completedOrder.amountReceived).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Change Given:</span>
                  <span>£{Number(completedOrder.changeDue).toFixed(2)}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-400 pt-1">
                Cashier: {completedOrder.cashierName} • {new Date().toLocaleString('en-GB')}
                <div className="mt-1 font-sans text-[11px] text-emerald-700 font-bold">
                  Thank you for shopping fresh at SANA FRESH!
                </div>
              </div>
            </div>

            {/* Print Options: Thermal or Full A4 Sana Invoice */}
            <div className="p-4 bg-white border-t border-slate-200 flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Printer className="w-4 h-4" /> Print Thermal Slip
                </button>
                <button
                  onClick={() => {
                    setReceiptModalOpen(false);
                    setA4InvoiceOpen(true);
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <FileText className="w-4 h-4" /> Full A4 Invoice
                </button>
              </div>

              <button
                onClick={() => setReceiptModalOpen(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= FULL A4 SANA INVOICE MODAL ================= */}
      <SanaInvoiceModal
        isOpen={a4InvoiceOpen}
        onClose={() => setA4InvoiceOpen(false)}
        invoice={invoicePayload}
      />

      {/* ================= QUICK ADD PRODUCT DIRECTLY FROM BILLING ================= */}
      {quickAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in">
            <div className="p-4 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Barcode className="w-5 h-5 text-emerald-200" />
                <div>
                  <h3 className="font-bold text-sm">Quick Add Shelf Product</h3>
                  <p className="text-[11px] text-emerald-100">Add directly to stock &amp; billing cart</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickAddModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickProduct} className="p-5 space-y-3.5">
              {/* Barcode input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Product Barcode (Scan gun or type manually)
                </label>
                <div className="relative">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. 506012345678 or scan now..."
                    value={quickProductForm.barcode}
                    onChange={(e) => setQuickProductForm({ ...quickProductForm, barcode: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Scan barcode with gun scanner or type the numbers manually.
                </p>
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fresh Mangoes Box"
                  value={quickProductForm.name}
                  onChange={(e) => setQuickProductForm({ ...quickProductForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Category & Unit Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={quickProductForm.category_id}
                    onChange={(e) => setQuickProductForm({ ...quickProductForm, category_id: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="">Produce / General</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Unit
                  </label>
                  <select
                    value={quickProductForm.unit}
                    onChange={(e) => setQuickProductForm({ ...quickProductForm, unit: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="box">Box (box)</option>
                    <option value="pack">Pack (pack)</option>
                    <option value="bunch">Bunch (bunch)</option>
                    <option value="bag">Bag (bag)</option>
                  </select>
                </div>
              </div>

              {/* Pricing Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Retail Price (£) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">£</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={quickProductForm.retail_price}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, retail_price: e.target.value })}
                      className="w-full pl-7 pr-3 py-2 text-xs sm:text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cost Price (£) <span className="font-normal text-slate-400">(Optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">£</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={quickProductForm.cost_price}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, cost_price: e.target.value })}
                      className="w-full pl-7 pr-3 py-2 text-xs sm:text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Initial Shelf Stock */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rack / Shelf Initial Stock
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={quickProductForm.stock_quantity}
                  onChange={(e) => setQuickProductForm({ ...quickProductForm, stock_quantity: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-emerald-700 font-medium mt-1">
                  ✓ Automatically creates a new stock batch and stock movement.
                </p>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickProductSaving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                >
                  {quickProductSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving &amp; Adding...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Save &amp; Add to Cart</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
