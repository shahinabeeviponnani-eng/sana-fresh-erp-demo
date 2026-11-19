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
  ChevronRight,
  X,
  RefreshCw,
  Trash2,
  Printer,
  Eye,
  Calendar,
  Share2,
  Edit2,
  ShieldAlert,
  ShoppingCart,
  Minus,
  ShoppingBag,
  AlertCircle,
  User,
  CreditCard,
  Banknote,
  Check,
  Phone,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import SanaInvoiceModal, { InvoiceData } from '@/components/invoice/SanaInvoiceModal';
import { useToast } from '@/components/ui/Toast';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Pagination from '@/components/ui/Pagination';
import CustomerPicker from '@/components/pos/CustomerPicker';

export default function WholesalePage() {
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} });
  const [viewMode, setViewMode] = useState<'pos' | 'history'>('pos');
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [posSearchQuery, setPosSearchQuery] = useState('');
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 25;

  // Permission Flags
  const canCreate = hasPermission('create_invoices');
  const canEdit = hasPermission('edit_invoices');
  const canDelete = hasPermission('delete_invoices');
  const canSettle = hasPermission('settle_invoices');

  // Invoice Preview Modal State
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);

  // Create Wholesale Order Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [customInvoiceNumber, setCustomInvoiceNumber] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [orderItems, setOrderItems] = useState<
    Array<{
      productId: number;
      productName?: string;
      sku?: string;
      quantity: number | string;
      unitPrice: number | string;
      unit: string;
    }>
  >([]);
  const [paymentTerms, setPaymentTerms] = useState('Due on Receipt');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [taxRate, setTaxRate] = useState<number>(0);
  const [notes, setNotes] = useState('Thanks for your business.');
  const [partialAmountPaid, setPartialAmountPaid] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Edit Wholesale Order Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [editItems, setEditItems] = useState<
    Array<{
      productId: number;
      productName?: string;
      sku?: string;
      quantity: number | string;
      unitPrice: number | string;
      unit: string;
    }>
  >([]);
  const [editTerms, setEditTerms] = useState('Due on Receipt');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchData = async (p = page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      const [ordRes, custRes, prodRes, catRes] = await Promise.all([
        fetch(`/api/wholesale/orders?${params}`),
        fetch('/api/customers?type=WHOLESALE'),
        fetch('/api/products'),
        fetch('/api/categories'),
      ]);
      const ordData = await ordRes.json();
      const custData = await custRes.json();
      const prodData = await prodRes.json();
      const catData = await catRes.json();

      const loadedOrders = ordData.orders || [];
      setOrders(loadedOrders);
      setTotal(ordData.total || 0);
      setTotalPages(ordData.totalPages || 1);
      const loadedCusts = custData.customers || [];
      setCustomers(loadedCusts);
      // In wholesale, do NOT auto-select the first customer; user should explicitly select or search their B2B client
      setProducts(prodData.products || []);
      setCategories(catData.categories || []);
      if (!customInvoiceNumber) {
        setCustomInvoiceNumber(`INV-${Math.floor(39000 + Math.random() * 9000)}`);
      }

      // Check if URL has ?invoice=INV-XXXXX query
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const invParam = params.get('invoice');
        if (invParam) {
          const match = loadedOrders.find((o: any) => o.order_number === invParam);
          if (match) {
            openInvoice(match);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching wholesale data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
  }, []);

  const openInvoice = (ord: any) => {
    const invoicePayload: InvoiceData = {
      id: ord.id,
      orderNumber: ord.order_number || ord.orderNumber,
      invoiceDate: ord.created_at || new Date().toISOString(),
      dueDate: ord.due_date || ord.dueDate,
      terms: ord.terms || ord.payment_terms || 'Due on Receipt',
      customerName: ord.customer_name || ord.customerName,
      companyName: ord.company_name || ord.companyName,
      customerAddress: ord.customer_address || ord.customerAddress,
      customerCity: ord.customer_city || ord.customerCity,
      customerPostalCode: ord.customer_postal_code || ord.customerPostalCode,
      customerCountry: ord.customer_country || ord.customerCountry || 'United Kingdom',
      shippingAddress: ord.shipping_address || ord.shippingAddress,
      subtotal: ord.subtotal,
      taxAmount: ord.tax_amount ?? ord.taxAmount ?? 0,
      totalAmount: ord.total_amount ?? ord.totalAmount,
      amountPaid: ord.amount_paid ?? ord.amountPaid ?? 0,
      paymentMethod: ord.payment_method || ord.paymentMethod,
      paymentStatus: ord.payment_status || ord.paymentStatus,
      notes: ord.notes,
      items: (ord.items || []).map((it: any) => ({
        id: it.id,
        productName: it.productName || it.product_name,
        sku: it.sku,
        unit: it.unit || 'BX',
        quantity: it.quantity,
        unitPrice: it.unitPrice || it.unit_price,
        discount: it.discount,
        total: it.total,
      })),
    };

    setSelectedInvoice(invoicePayload);
    setInvoiceModalOpen(true);
  };

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Products filtering for Wholesale POS Terminal
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === 'ALL' || p.category_code === selectedCategory;
    const matchesSearch =
      !posSearchQuery ||
      p.name.toLowerCase().includes(posSearchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(posSearchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(posSearchQuery));
    return matchesCategory && matchesSearch;
  });

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && posSearchQuery.trim()) {
      const match = products.find(
        (p) =>
          p.barcode === posSearchQuery.trim() ||
          p.sku.toLowerCase() === posSearchQuery.trim().toLowerCase()
      );
      if (match) {
        addToCart(match);
        setPosSearchQuery('');
      }
    }
  };

  const addToCart = (prod: any) => {
    setOrderItems((prev) => {
      const existing = prev.find((it) => it.productId === prod.id);
      if (existing) {
        const currentQty = parseFloat(String(existing.quantity)) || 0;
        return prev.map((it) =>
          it.productId === prod.id ? { ...it, quantity: currentQty + 1 } : it
        );
      }
      const initialQty = Math.max(1, Number(prod.min_wholesale_qty) || 1);
      return [
        ...prev,
        {
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          quantity: initialQty,
          unitPrice: Number(prod.wholesale_price) || 0,
          unit: prod.unit || 'BX',
        },
      ];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setOrderItems((prev) =>
      prev
        .map((it) => {
          if (it.productId === productId) {
            const currentQty = parseFloat(String(it.quantity)) || 0;
            const newQty = Math.max(0, currentQty + delta);
            return newQty > 0 ? { ...it, quantity: newQty } : null;
          }
          return it;
        })
        .filter(Boolean) as any[]
    );
  };

  const setExplicitQuantity = (productId: number, qtyStr: string) => {
    const val = parseFloat(qtyStr);
    if (isNaN(val) || val <= 0) return;
    setOrderItems((prev) =>
      prev.map((it) => (it.productId === productId ? { ...it, quantity: val } : it))
    );
  };

  const setExplicitUnitPrice = (productId: number, priceStr: string) => {
    const val = parseFloat(priceStr);
    if (isNaN(val) || val < 0) return;
    setOrderItems((prev) =>
      prev.map((it) => (it.productId === productId ? { ...it, unitPrice: val } : it))
    );
  };

  const removeFromCart = (productId: number) => {
    setOrderItems((prev) => prev.filter((it) => it.productId !== productId));
  };

  const clearCart = () => {
    setOrderItems([]);
  };

  // Line item handlers for Create Modal
  const handleAddItem = () => {
    if (products.length === 0) return;
    const defaultProd = products[0];
    setOrderItems((prev) => [
      ...prev,
      {
        productId: defaultProd.id,
        productName: defaultProd.name,
        sku: defaultProd.sku,
        quantity: 1,
        unitPrice: Number(defaultProd.wholesale_price),
        unit: defaultProd.unit || 'BX',
      },
    ]);
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    setOrderItems((prev) => {
      const copy = [...prev];
      if (field === 'productId') {
        const prod = products.find((p) => p.id === parseInt(value));
        if (prod) {
          copy[index] = {
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            quantity: 1,
            unitPrice: Number(prod.wholesale_price),
            unit: prod.unit || 'BX',
          };
        }
      } else if (field === 'quantity') {
        copy[index].quantity = value;
      } else if (field === 'unitPrice') {
        copy[index].unitPrice = value;
      } else if (field === 'unit') {
        copy[index].unit = value;
      }
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations for Create Modal & POS Register
  const subtotal = orderItems.reduce((acc, it) => {
    const qty = parseFloat(String(it.quantity)) || 0;
    const rate = parseFloat(String(it.unitPrice)) || 0;
    return acc + qty * rate;
  }, 0);
  const tax = Number((subtotal * (taxRate / 100)).toFixed(2));
  const orderTotal = Number((subtotal + tax).toFixed(2));

  // Check credit for Create Modal & POS Register
  const currentDebt = Number(selectedCustomer?.current_balance || 0);
  const creditLimit = Number(selectedCustomer?.credit_limit || 0);
  const additionalDebt = paymentMethod === 'CREDIT' ? orderTotal : paymentMethod === 'PARTIAL_CASH' ? Math.max(0, orderTotal - (parseFloat(partialAmountPaid) || 0)) : 0;
  const projectedBalance = currentDebt + additionalDebt;
  const isOverCredit = creditLimit > 0 && projectedBalance > creditLimit;

  // Submit wholesale order
  const handleCreateOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canCreate) {
      toast('Access Denied: You do not have permission to create invoices.', 'error');
      return;
    }
    if (!selectedCustomerId) {
      toast('Please select a wholesale customer', 'warning');
      return;
    }
    if (orderItems.length === 0) {
      toast('Please add at least one line item', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/wholesale/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: customInvoiceNumber.trim() || undefined,
          customerId: selectedCustomerId,
          items: orderItems.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            sku: it.sku,
            quantity: parseFloat(String(it.quantity)) || 1,
            unitPrice: parseFloat(String(it.unitPrice)) || 0,
            unit: it.unit,
          })),
          paymentMethod,
          paymentTerms,
          taxRate,
          paymentStatus: paymentMethod === 'CREDIT' ? 'UNPAID' : paymentMethod === 'PARTIAL_CASH' ? 'PARTIAL' : 'PAID',
          amountPaid: paymentMethod === 'CREDIT' ? 0 : paymentMethod === 'PARTIAL_CASH' ? (parseFloat(partialAmountPaid) || 0) : orderTotal,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place wholesale order');
      }

      toast(`Wholesale invoice ${data.order?.orderNumber || customInvoiceNumber} created successfully!`, 'success');
      setCreateModalOpen(false);
      setOrderItems([]);
      setSelectedCustomerId('');
      const nextNum = `INV-${Math.floor(39000 + Math.random() * 9000)}`;
      setCustomInvoiceNumber(nextNum);
      setPartialAmountPaid('');
      await fetchData();

      if (data.order) {
        openInvoice({
          id: data.order.id,
          order_number: data.order.orderNumber,
          created_at: new Date().toISOString(),
          due_date: data.order.dueDate,
          terms: paymentTerms,
          customer_name: data.order.customerName,
          company_name: data.order.companyName,
          customer_address: selectedCustomer?.address,
          customer_city: selectedCustomer?.city,
          customer_postal_code: selectedCustomer?.postal_code,
          customer_country: selectedCustomer?.country || 'United Kingdom',
          shipping_address: selectedCustomer?.address,
          subtotal: subtotal,
          tax_amount: tax,
          total_amount: orderTotal,
          amount_paid: paymentMethod === 'CREDIT' ? 0 : paymentMethod === 'PARTIAL_CASH' ? (parseFloat(partialAmountPaid) || 0) : orderTotal,
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'CREDIT' ? 'UNPAID' : paymentMethod === 'PARTIAL_CASH' ? 'PARTIAL' : 'PAID',
          notes,
          items: data.order.items || orderItems,
        });
      }
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ================= EDIT INVOICE LOGIC =================
  const handleOpenEdit = (ord: any) => {
    if (!canEdit) {
      toast('Access Denied: You do not have permission to edit invoices.', 'error');
      return;
    }

    setEditingOrder(ord);
    setEditTerms(ord.terms || ord.payment_terms || 'Due on Receipt');
    setEditNotes(ord.notes || 'Thanks for your business.');

    const initialItems = (ord.items || []).map((it: any) => ({
      productId: it.productId || it.product_id,
      productName: it.productName || it.product_name,
      sku: it.sku,
      quantity: it.quantity,
      unitPrice: it.unitPrice || it.unit_price,
      unit: it.unit || 'BX',
    }));
    setEditItems(initialItems);
    setEditModalOpen(true);
  };

  const handleAddEditItem = () => {
    if (products.length === 0) return;
    const defaultProd = products[0];
    setEditItems((prev) => [
      ...prev,
      {
        productId: defaultProd.id,
        productName: defaultProd.name,
        sku: defaultProd.sku,
        quantity: 1,
        unitPrice: Number(defaultProd.wholesale_price),
        unit: defaultProd.unit || 'BX',
      },
    ]);
  };

  const handleUpdateEditItem = (index: number, field: string, value: any) => {
    setEditItems((prev) => {
      const copy = [...prev];
      if (field === 'productId') {
        const prod = products.find((p) => p.id === parseInt(value));
        if (prod) {
          copy[index] = {
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            quantity: 1,
            unitPrice: Number(prod.wholesale_price),
            unit: prod.unit || 'BX',
          };
        }
      } else if (field === 'quantity') {
        copy[index].quantity = value;
      } else if (field === 'unitPrice') {
        copy[index].unitPrice = value;
      } else if (field === 'unit') {
        copy[index].unit = value;
      }
      return copy;
    });
  };

  const handleRemoveEditItem = (index: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  };

  const editSubtotal = editItems.reduce((acc, it) => {
    const qty = parseFloat(String(it.quantity)) || 0;
    const rate = parseFloat(String(it.unitPrice)) || 0;
    return acc + qty * rate;
  }, 0);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    if (editItems.length === 0) {
      toast('Invoice must have at least one line item', 'warning');
      return;
    }

    try {
      setSavingEdit(true);
      const res = await fetch('/api/wholesale/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: editingOrder.id,
          items: editItems,
          terms: editTerms,
          notes: editNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update invoice');
      toast(`Invoice ${editingOrder.order_number} updated successfully!`, 'success');
      setEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // ================= DELETE / VOID INVOICE LOGIC =================
  const handleDeleteInvoice = async (orderId: number, orderNumber: string) => {
    if (!canDelete) {
      toast('Access Denied: You do not have permission to delete invoices.', 'error');
      return;
    }
    setConfirmModal({
      open: true,
      title: 'Delete Invoice',
      message: `Delete Invoice "${orderNumber}"?\n\n• Stock will be automatically restored to warehouse.\n• Any unpaid customer balance will be reversed.\n\nThis cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal((p) => ({ ...p, open: false }));
        try {
          const res = await fetch(`/api/wholesale/orders?orderId=${orderId}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to delete invoice');
          toast(data.message || `Invoice ${orderNumber} deleted successfully.`, 'success');
          if (invoiceModalOpen) setInvoiceModalOpen(false);
          fetchData();
        } catch (err: any) { toast(err.message, 'error'); }
      },
    });
  };

  // Settlement modal state
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settlingOrder, setSettlingOrder] = useState<any>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('BANK_TRANSFER');
  const [settleNotes, setSettleNotes] = useState('');
  const [settleCardRef, setSettleCardRef] = useState('');
  const [settleSubmitting, setSettleSubmitting] = useState(false);

  const openSettleModal = (ord: any) => {
    if (!canSettle) { toast('Access Denied: You do not have permission to record invoice payments.', 'error'); return; }
    const outstanding = Number(ord.total_amount) - Number(ord.amount_paid);
    setSettlingOrder(ord);
    setSettleAmount(outstanding.toFixed(2));
    setSettleMethod('BANK_TRANSFER');
    setSettleNotes('');
    setSettleCardRef('');
    setSettleModalOpen(true);
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingOrder) return;
    const paying = parseFloat(settleAmount);
    if (isNaN(paying) || paying <= 0) { toast('Enter a valid amount', 'warning'); return; }
    const outstanding = Number(settlingOrder.total_amount) - Number(settlingOrder.amount_paid);
    if (paying > outstanding + 0.01) { toast(`Amount exceeds outstanding balance of £${outstanding.toFixed(2)}`, 'warning'); return; }
    try {
      setSettleSubmitting(true);
      const newPaid = Number(settlingOrder.amount_paid) + paying;
      const newStatus = newPaid >= Number(settlingOrder.total_amount) - 0.01 ? 'PAID' : 'PARTIAL';
      const res = await fetch('/api/wholesale/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: settlingOrder.id, paymentStatus: newStatus, amountPaid: newPaid, cardReference: settleMethod === 'CARD' ? settleCardRef : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettleModalOpen(false);
      fetchData();
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setSettleSubmitting(false); }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesFilter =
      statusFilter === 'ALL' || o.payment_status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      o.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
      {/* Top Header / View Switcher Bar */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-5 py-2.5 flex items-center justify-between shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight">
                SANA FRESH Wholesale B2B
              </span>
              <span className="hidden sm:inline-block bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 uppercase">
                UK Supply &amp; Invoicing
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium hidden sm:block">
              Supermarket contracts, commercial catering produce, and credit accounting.
            </div>
          </div>
        </div>

        {/* View Mode Switcher Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-bold border border-slate-200/80">
            <button
              onClick={() => setViewMode('pos')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'pos'
                  ? 'bg-emerald-600 text-white shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Wholesale POS</span>
              {orderItems.length > 0 && (
                <span className="bg-emerald-800 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black">
                  {orderItems.reduce((s, it) => s + (parseFloat(String(it.quantity)) || 0), 0)}
                </span>
              )}
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'history'
                  ? 'bg-slate-900 text-white shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Invoices History</span>
              <span className="bg-slate-700 text-slate-200 text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                {total}
              </span>
            </button>
          </div>

          <button
            onClick={() => fetchData(page)}
            title="Refresh Invoices"
            className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 active:scale-95 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* POS TERMINAL VIEW */}
      {viewMode === 'pos' ? (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          {/* ================= LEFT SECTION: CATALOG & SEARCH ================= */}
          <div className="flex-1 flex flex-col min-w-0 p-3 sm:p-4 lg:p-5 overflow-hidden">
            {/* Top Search & Customer Selector */}
            <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row gap-2.5 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search produce name, SKU or scan barcode..."
                  value={posSearchQuery}
                  onChange={(e) => setPosSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
                {posSearchQuery && (
                  <button
                    onClick={() => setPosSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Wholesale Customer Quick Selector & Search */}
              <div className="shrink-0 min-w-[240px]">
                <CustomerPicker
                  type="WHOLESALE"
                  selectedCustomer={selectedCustomer}
                  onSelectCustomer={(c) => setSelectedCustomerId(c.id)}
                  customers={customers}
                  onCustomerCreated={(newCust) => {
                    setCustomers((prev) => [newCust, ...prev]);
                    setSelectedCustomerId(newCust.id);
                  }}
                />
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
                All Produce ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.code)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedCategory === cat.code
                      ? 'bg-emerald-600 text-white shadow-sm font-bold'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Produce Grid */}
            <div className="flex-1 overflow-y-auto pr-1">
              {loading ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2 text-emerald-600" />
                  Loading wholesale catalogue...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                  <AlertCircle className="w-8 h-8 mb-2 text-slate-300" />
                  <span>No produce found matching &ldquo;{posSearchQuery}&rdquo;</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 pb-20 lg:pb-6">
                  {filteredProducts.map((p) => {
                    const inCart = orderItems.find((it) => it.productId === p.id);
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
                          <span className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-emerald-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow">
                            {inCart.quantity}
                          </span>
                        )}

                        <div>
                          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            <span>{p.unit || 'BX'}</span>
                            {p.min_wholesale_qty > 1 && (
                              <span className="bg-indigo-50 text-indigo-700 px-1 rounded text-[9px]">
                                Min: {p.min_wholesale_qty}
                              </span>
                            )}
                          </div>
                          <div className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-2 mt-0.5 leading-snug">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            SKU: {p.sku}
                          </div>
                        </div>

                        <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-2">
                          <div className="font-mono font-black text-sm text-emerald-700">
                            £{Number(p.wholesale_price).toFixed(2)}
                            <span className="text-[10px] font-normal text-slate-500">/{p.unit || 'BX'}</span>
                          </div>
                          <span
                            className={`text-[10px] font-semibold ${
                              p.stock_quantity <= 0
                                ? 'text-rose-600 font-bold bg-rose-50 px-1 py-0.2 rounded border border-rose-200'
                                : p.stock_quantity <= 10
                                ? 'text-amber-600 font-bold'
                                : 'text-slate-400'
                            }`}
                          >
                            {p.stock_quantity <= 0 ? `${p.stock_quantity} in stock` : `${p.stock_quantity} left`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ================= RIGHT SECTION: WHOLESALE CART REGISTER ================= */}
          <div
            className={`lg:w-96 xl:w-[420px] bg-white border-l border-slate-200 flex flex-col shadow-xl z-30 transition-transform duration-200 ${
              mobileCartOpen
                ? 'fixed inset-0 z-50 flex'
                : 'hidden lg:flex'
            }`}
          >
            {/* Cart Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-sm text-slate-900">Wholesale Register</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  {orderItems.reduce((sum, it) => sum + (parseFloat(String(it.quantity)) || 0), 0)} units
                </span>
              </div>

              <div className="flex items-center gap-2">
                {orderItems.length > 0 && (
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

            {/* Selected B2B Customer Info Card */}
            <div className="p-3 bg-gradient-to-br from-indigo-50/70 to-slate-50 border-b border-indigo-100 shrink-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                  B2B Client Account
                </span>
                <CustomerPicker
                  type="WHOLESALE"
                  selectedCustomer={selectedCustomer}
                  onSelectCustomer={(c) => setSelectedCustomerId(c.id)}
                  customers={customers}
                  onCustomerCreated={(newCust) => {
                    setCustomers((prev) => [newCust, ...prev]);
                    setSelectedCustomerId(newCust.id);
                  }}
                  compact
                />
              </div>
              {selectedCustomer && (
                <>
                  <div className="flex items-center justify-between gap-1">
                    <div className="font-black text-xs sm:text-sm text-slate-900 truncate">
                      {selectedCustomer.company_name || selectedCustomer.name}
                    </div>
                    <span className="text-[10px] bg-white text-slate-700 px-2 py-0.5 rounded font-mono font-bold border border-slate-200 shrink-0">
                      {selectedCustomer.payment_terms || paymentTerms}
                    </span>
                  </div>
                  {selectedCustomer.phone && (
                    <div className="text-[11px] font-mono text-slate-600 flex items-center gap-1 font-semibold">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{selectedCustomer.phone}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1">
                    <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Credit Limit</span>
                      <span className="font-mono font-bold text-slate-900">
                        £{creditLimit.toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Current Debt</span>
                      <span className="font-mono font-bold text-amber-700">
                        £{currentDebt.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {isOverCredit && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-bold p-1.5 rounded-lg flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Order pushes debt (£{projectedBalance.toFixed(2)}) above £{creditLimit.toLocaleString()} limit</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-slate-100">
              {orderItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-12">
                  <ShoppingBag className="w-10 h-10 mb-2 text-slate-300 stroke-[1.5]" />
                  <span className="font-bold text-slate-600">Register is empty</span>
                  <span className="text-[11px] text-slate-400 mt-0.5 text-center px-4">
                    Click produce cards or scan barcodes to add wholesale crates and boxes
                  </span>
                </div>
              ) : (
                orderItems.map((item) => {
                  const qty = parseFloat(String(item.quantity)) || 0;
                  const rate = parseFloat(String(item.unitPrice)) || 0;
                  const lineTotal = (qty * rate).toFixed(2);

                  return (
                    <div key={item.productId} className="pt-2 first:pt-0">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs text-slate-900 truncate">
                            {item.productName}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {item.sku} • {item.unit}
                          </div>
                        </div>
                        <div className="font-mono font-bold text-xs text-slate-900">
                          £{lineTotal}
                        </div>
                      </div>

                      {/* Controls: Stepper + Price editor + Trash */}
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                          <button
                            onClick={() => updateQuantity(item.productId, -1)}
                            className="w-6 h-6 rounded bg-white text-slate-700 flex items-center justify-center font-bold text-xs shadow-sm hover:bg-slate-50 active:scale-95"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            step="any"
                            min="0.1"
                            value={item.quantity}
                            onChange={(e) => setExplicitQuantity(item.productId, e.target.value)}
                            className="w-12 text-center bg-transparent font-bold text-xs focus:outline-none"
                          />
                          <button
                            onClick={() => updateQuantity(item.productId, 1)}
                            className="w-6 h-6 rounded bg-white text-slate-700 flex items-center justify-center font-bold text-xs shadow-sm hover:bg-slate-50 active:scale-95"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Editable Rate */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400 font-semibold">Rate: £</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => setExplicitUnitPrice(item.productId, e.target.value)}
                            className="w-16 py-1 px-1.5 text-right font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>

                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* B2B Terms & Settlement Settings (Compact) */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 space-y-2.5 shrink-0 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Due on Receipt">Due on Receipt</option>
                    <option value="NET_15">Net 15 Days</option>
                    <option value="NET_30">Net 30 Days</option>
                    <option value="NET_60">Net 60 Days</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                    Settlement Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="CREDIT">On Credit (UNPAID)</option>
                    <option value="BANK_TRANSFER">Bank Transfer (PAID)</option>
                    <option value="CASH">Cash on Dispatch (PAID)</option>
                    <option value="CARD">Card Payment (PAID)</option>
                    <option value="PARTIAL_CASH">Partial Deposit</option>
                  </select>
                </div>
              </div>

              {paymentMethod === 'PARTIAL_CASH' && (
                <div className="bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-900">Deposit Amount (£):</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Deposit amount"
                    value={partialAmountPaid}
                    onChange={(e) => setPartialAmountPaid(e.target.value)}
                    className="w-24 py-1 px-2 text-right font-mono font-bold text-xs bg-white border border-amber-300 rounded"
                  />
                </div>
              )}

              {/* Invoice Number & Notes */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                    Invoice #
                  </label>
                  <input
                    type="text"
                    value={customInvoiceNumber}
                    onChange={(e) => setCustomInvoiceNumber(e.target.value)}
                    className="w-full py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                    PO / Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Bay 4 Delivery"
                    className="w-full py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="pt-2 border-t border-slate-200 space-y-1 text-slate-600">
                <div className="flex justify-between text-xs">
                  <span>Subtotal:</span>
                  <span className="font-mono font-bold text-slate-900">£{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>VAT (0% UK Produce):</span>
                  <span className="font-mono font-bold text-slate-900">£{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                  <span>Invoice Total:</span>
                  <span className="font-mono text-emerald-700 text-base">£{orderTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Checkout / Generate Invoice Button */}
              <button
                type="button"
                onClick={() => handleCreateOrder()}
                disabled={submitting || orderItems.length === 0 || !selectedCustomerId}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:from-slate-300 disabled:to-slate-300 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-600/30 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Wholesale Invoice...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>Issue Wholesale Invoice (£{orderTotal.toFixed(2)})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Floating Mobile Cart Bar */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-slate-200 shadow-2xl flex items-center justify-between z-30">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">Wholesale Cart</div>
              <div className="font-mono font-black text-sm text-emerald-700">
                £{orderTotal.toFixed(2)}{' '}
                <span className="text-[11px] font-normal text-slate-500">
                  ({orderItems.reduce((s, it) => s + (parseFloat(String(it.quantity)) || 0), 0)} items)
                </span>
              </div>
            </div>
            <button
              onClick={() => setMobileCartOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Review Register</span>
            </button>
          </div>
        </div>
      ) : (
        /* ================= HISTORY & INVOICES VIEW ================= */
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto w-full">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                  Wholesale Invoices &amp; Ledger Orders
                </h1>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {total} Invoices
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Contract supply &amp; invoices for supermarkets, catering, and wholesale accounts.
              </p>
            </div>

            {canCreate ? (
              <button
                onClick={() => setViewMode('pos')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-600/25 active:scale-95 transition-all"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Open Wholesale POS</span>
              </button>
            ) : (
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1 bg-slate-100 px-3 py-2 rounded-xl">
                <ShieldAlert className="w-4 h-4" /> View-only access
              </span>
            )}
          </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by invoice (e.g. INV-39584) or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <div className="flex gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold shrink-0">
            {['ALL', 'UNPAID', 'PARTIAL', 'PAID'].map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-lg transition-colors text-xs ${
                  statusFilter === f
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f === 'ALL' ? 'All Invoices' : f}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchData(page)}
            title="Refresh Invoices"
            className="p-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center gap-1 shadow-sm shrink-0 active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Orders List: Dual View (Mobile Cards + Desktop Table) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{['Invoice #','B2B Account','Terms','Items','Amount','Status','Actions'].map(h => (
                  <th key={h} className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from({length:6}).map((_,i) => (
                  <tr key={i}>
                    {Array.from({length:7}).map((_,j) => (
                      <td key={j} className="py-3.5 px-4">
                        <div className="h-3.5 bg-slate-200 rounded animate-pulse" />
                        {j===0 && <div className="h-2.5 bg-slate-100 rounded animate-pulse w-2/3 mt-1.5" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            No wholesale invoices found.
          </div>
        ) : (
          <>
            {/* ================= MOBILE CARD VIEW (< md screens) ================= */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredOrders.map((ord) => (
                <div key={ord.id} className="p-4 space-y-3 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono font-bold text-sm text-slate-900 flex items-center gap-1.5">
                        <span>{ord.order_number}</span>
                        {ord.order_number === 'INV-39584' && (
                          <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-200">
                            Real Bill
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-800 mt-0.5">
                        {ord.company_name || ord.customer_name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(ord.created_at).toLocaleDateString('en-GB')} • Terms: {ord.terms || 'Due on Receipt'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-black text-base text-slate-900">
                        £{Number(ord.total_amount).toFixed(2)}
                      </div>
                      <span
                        className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                          ord.payment_status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : ord.payment_status === 'PARTIAL'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {ord.payment_status}
                      </span>
                    </div>
                  </div>

                  {/* Mobile Actions: Touch Targets */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => openInvoice(ord)}
                      className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Invoice</span>
                    </button>

                    {canEdit && (
                      <button
                        onClick={() => handleOpenEdit(ord)}
                        className="py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs rounded-xl flex items-center gap-1 active:scale-95"
                        title="Edit Invoice Items / Rates"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                        <span>Edit</span>
                      </button>
                    )}

                    {canDelete && (
                      <button
                        onClick={() => handleDeleteInvoice(ord.id, ord.order_number)}
                        className="py-2 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl active:scale-95"
                        title="Void / Delete Invoice"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      </button>
                    )}

                    {canSettle && ord.payment_status !== 'PAID' && (
                      <button
                        onClick={() => openSettleModal(ord)}
                        className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-xl flex items-center gap-1 shadow-sm active:scale-95"
                      >
                        <span>Settle</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ================= DESKTOP TABLE VIEW (>= md screens) ================= */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">B2B Account</th>
                    <th className="py-3 px-4">Terms / Due Date</th>
                    <th className="py-3 px-4">Items / Volume</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{ord.order_number}</span>
                          {ord.order_number === 'INV-39584' && (
                            <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.2 rounded border border-amber-200">
                              Real Bill
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          {new Date(ord.created_at).toLocaleDateString('en-GB')}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {ord.company_name || ord.customer_name}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {ord.customer_city || 'United Kingdom'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">
                          {ord.terms || 'Due on Receipt'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Due: {ord.due_date ? new Date(ord.due_date).toLocaleDateString('en-GB') : 'Immediate'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold text-[11px]">
                          {ord.items?.length || 0} Products
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-black text-sm text-slate-900">
                          £{Number(ord.total_amount).toFixed(2)}
                        </div>
                        {ord.payment_status !== 'PAID' && (
                          <div className="text-[10px] text-rose-600 font-semibold">
                            Owed: £{(Number(ord.total_amount) - Number(ord.amount_paid)).toFixed(2)}
                          </div>
                        )}
                        {ord.payment_status === 'PARTIAL' && (
                          <div className="text-[10px] text-emerald-600 font-semibold">
                            Paid: £{Number(ord.amount_paid).toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            ord.payment_status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : ord.payment_status === 'PARTIAL'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {ord.payment_status}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">{ord.payment_method}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => openInvoice(ord)}
                          className="px-2.5 py-1 text-[11px] font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg shadow-sm inline-flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span>View Bill</span>
                        </button>

                        {canEdit && (
                          <button
                            onClick={() => handleOpenEdit(ord)}
                            className="px-2 py-1 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg shadow-sm inline-flex items-center gap-1 active:scale-95"
                            title="Edit Bill"
                          >
                            <Edit2 className="w-3 h-3 text-amber-600" />
                            <span>Edit</span>
                          </button>
                        )}

                        {canDelete && (
                          <button
                            onClick={() => handleDeleteInvoice(ord.id, ord.order_number)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 border border-transparent hover:border-rose-200 active:scale-95 inline-flex items-center"
                            title="Void / Delete Bill"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {canSettle && ord.payment_status !== 'PAID' && (
                          <button
                            onClick={() => openSettleModal(ord)}
                            className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-sm active:scale-95 transition-all"
                          >
                            Settle
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={(p) => { setPage(p); fetchData(p); }} />
      </div>
    </div>
  )}

      {/* ================= EDIT WHOLESALE INVOICE MODAL ================= */}
      {editModalOpen && editingOrder && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in">
            {/* Modal Header */}
            <div className="p-4 bg-amber-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    Edit Invoice: {editingOrder.order_number}
                  </h3>
                  <div className="text-[11px] text-amber-300">
                    Client: {editingOrder.company_name || editingOrder.customer_name}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-amber-200 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px]">
                <span className="font-bold">Inventory Notice:</span> Modifying quantities will automatically adjust your warehouse stock levels and update the client account debt.
              </div>

              {/* Terms & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Payment Terms</label>
                  <select
                    value={editTerms}
                    onChange={(e) => setEditTerms(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"
                  >
                    <option value="Due on Receipt">Due on Receipt</option>
                    <option value="NET_15">Net 15 Days</option>
                    <option value="NET_30">Net 30 Days</option>
                    <option value="NET_60">Net 60 Days</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Invoice Notes</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Line Items List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-slate-700">Invoice Line Items</label>
                  <button
                    type="button"
                    onClick={handleAddEditItem}
                    className="font-bold text-amber-800 flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Product
                  </button>
                </div>

                <div className="space-y-2">
                  {editItems.map((item, index) => {
                    const qty = parseFloat(String(item.quantity)) || 0;
                    const rate = parseFloat(String(item.unitPrice)) || 0;
                    const lineTotal = (qty * rate).toFixed(2);

                    return (
                      <div
                        key={index}
                        className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <select
                            value={item.productId}
                            onChange={(e) => handleUpdateEditItem(index, 'productId', e.target.value)}
                            className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded font-medium text-xs"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <div className="w-16">
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(e) => handleUpdateEditItem(index, 'quantity', e.target.value)}
                              className="w-full py-1.5 px-1 bg-white border border-slate-300 rounded text-center font-bold text-xs"
                            />
                          </div>

                          <div className="w-16">
                            <select
                              value={item.unit}
                              onChange={(e) => handleUpdateEditItem(index, 'unit', e.target.value)}
                              className="w-full py-1.5 px-1 bg-white border border-slate-300 rounded text-center font-bold text-xs"
                            >
                              <option value="BX">BX</option>
                              <option value="KG">KG</option>
                              <option value="EA">EA</option>
                              <option value="BG">BG</option>
                              <option value="PK">PK</option>
                              <option value="CS">CS</option>
                            </select>
                          </div>

                          <div className="w-20">
                            <input
                              type="number"
                              step="0.001"
                              placeholder="Rate"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateEditItem(index, 'unitPrice', e.target.value)}
                              className="w-full py-1.5 px-1 bg-white border border-slate-300 rounded text-right font-mono font-bold text-xs"
                            />
                          </div>

                          <div className="w-16 text-right font-mono font-black text-slate-900 text-xs">
                            £{lineTotal}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveEditItem(index)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-3 bg-slate-100 rounded-xl flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700">Recalculated Total:</span>
                <span className="font-mono font-black text-base text-slate-900">
                  £{editSubtotal.toFixed(2)}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || editItems.length === 0}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md shadow-amber-600/20 active:scale-95"
                >
                  {savingEdit ? 'Updating Bill...' : 'Save Changes & Sync Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= CREATE WHOLESALE INVOICE MODAL ================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm sm:text-base">New SANA Wholesale Invoice</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={customInvoiceNumber}
                    onChange={(e) => setCustomInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-39584"
                    className="w-full py-2 px-3 font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                  >
                    <option value="Due on Receipt">Due on Receipt (Standard Bill)</option>
                    <option value="NET_15">Net 15 Days</option>
                    <option value="NET_30">Net 30 Days</option>
                    <option value="NET_60">Net 60 Days</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Bill To Customer *</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(parseInt(e.target.value))}
                  required
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Choose Wholesale Account --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name || c.name} (Credit: £{c.credit_limit} | Debt: £{c.current_balance})
                    </option>
                  ))}
                </select>

                {selectedCustomer && (
                  <div
                    className={`mt-2 p-2.5 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1 ${
                      isOverCredit
                        ? 'bg-rose-50 border-rose-300 text-rose-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    <div>
                      <span className="font-bold">Approved Credit Line:</span> £{creditLimit.toLocaleString()} |{' '}
                      <span className="font-bold">Current Debt:</span> £{currentDebt.toLocaleString()}
                    </div>
                    {isOverCredit && (
                      <span className="font-extrabold text-rose-600 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> Credit Limit Exceeded!
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-slate-700">Line Items &amp; Produce</label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Product
                  </button>
                </div>

                {orderItems.length === 0 ? (
                  <div className="p-5 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400">
                    No items yet. Click &ldquo;Add Product&rdquo; to add produce lines.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orderItems.map((item, index) => {
                      const qty = parseFloat(String(item.quantity)) || 0;
                      const rate = parseFloat(String(item.unitPrice)) || 0;
                      const itemTotal = (qty * rate).toFixed(2);

                      return (
                        <div
                          key={index}
                          className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <select
                              value={item.productId}
                              onChange={(e) => handleUpdateItem(index, 'productId', e.target.value)}
                              className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded font-medium text-xs"
                            >
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.unit || 'BX'})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <div className="w-16">
                              <input
                                type="number"
                                step="any"
                                min="0.01"
                                inputMode="decimal"
                                placeholder="Qty"
                                value={item.quantity}
                                onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)}
                                className="w-full py-1.5 px-1.5 bg-white border border-slate-300 rounded text-center font-bold text-xs"
                              />
                            </div>

                            <div className="w-16">
                              <select
                                value={item.unit}
                                onChange={(e) => handleUpdateItem(index, 'unit', e.target.value)}
                                className="w-full py-1.5 px-1 bg-white border border-slate-300 rounded text-center font-bold text-xs uppercase"
                              >
                                <option value="BX">BX</option>
                                <option value="KG">KG</option>
                                <option value="EA">EA</option>
                                <option value="BG">BG</option>
                                <option value="PK">PK</option>
                                <option value="CS">CS</option>
                              </select>
                            </div>

                            <div className="w-20">
                              <input
                                type="number"
                                step="0.001"
                                inputMode="decimal"
                                placeholder="Rate"
                                value={item.unitPrice}
                                onChange={(e) => handleUpdateItem(index, 'unitPrice', e.target.value)}
                                className="w-full py-1.5 px-1.5 bg-white border border-slate-300 rounded text-right font-mono font-bold text-xs"
                              />
                            </div>

                            <div className="w-16 text-right font-mono font-black text-slate-900 text-xs">
                              £{itemTotal}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    VAT Rate (UK Produce is 0%)
                  </label>
                  <select
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value={0}>0% VAT (Zero-Rated Produce/Grocery)</option>
                    <option value={20}>20% Standard UK VAT</option>
                    <option value={5}>5% Reduced Rate</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => { setPaymentMethod(e.target.value); setPartialAmountPaid(''); }}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="BANK_TRANSFER">Bank Wire / Transfer</option>
                    <option value="CREDIT">Charge to Account Credit (Net terms)</option>
                    <option value="PARTIAL_CASH">Partial Cash Payment</option>
                    <option value="CASH">Cash / Cheque (Full)</option>
                    <option value="CARD">Debit / Credit Card</option>
                  </select>
                  {paymentMethod === 'PARTIAL_CASH' && (
                    <div className="mt-2">
                      <label className="font-semibold text-slate-600 block mb-1">Amount Paid Now (£)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={partialAmountPaid}
                        onChange={(e) => setPartialAmountPaid(e.target.value)}
                        className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                      />
                      {partialAmountPaid && (
                        <div className="mt-1 text-[11px] text-amber-700 font-semibold">
                          Balance owed: £{Math.max(0, orderTotal - (parseFloat(partialAmountPaid) || 0)).toFixed(2)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Invoice Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Thanks for your business."
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="p-3 bg-slate-100 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Sub Total:</span>
                  <span className="font-mono font-semibold">£{subtotal.toFixed(2)}</span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>VAT ({taxRate}%):</span>
                    <span className="font-mono font-semibold">£{tax.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total Order Value:</span>
                  <span className="font-mono text-emerald-700">£{orderTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || orderItems.length === 0}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20 disabled:bg-slate-300 transition-all active:scale-95"
                >
                  {submitting ? 'Generating Invoice...' : 'Create Invoice & Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= SETTLEMENT MODAL ================= */}
      {settleModalOpen && settlingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-emerald-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Record Payment — {settlingOrder.order_number}</h3>
                <p className="text-[11px] text-emerald-300">{settlingOrder.company_name || settlingOrder.customer_name}</p>
              </div>
              <button onClick={() => setSettleModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSettleSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <div className="text-[10px] text-slate-500 font-semibold">Invoice Total</div>
                  <div className="font-extrabold text-slate-900">£{Number(settlingOrder.total_amount).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-600 font-semibold">Already Paid</div>
                  <div className="font-extrabold text-emerald-700">£{Number(settlingOrder.amount_paid).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-rose-600 font-semibold">Outstanding</div>
                  <div className="font-extrabold text-rose-700">£{(Number(settlingOrder.total_amount) - Number(settlingOrder.amount_paid)).toFixed(2)}</div>
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
                <select value={settleMethod} onChange={(e) => { setSettleMethod(e.target.value); setSettleCardRef(''); }}
                  className="w-full py-2 px-3 border border-slate-300 rounded-xl bg-white font-semibold">
                  <option value="BANK_TRANSFER">Bank Transfer / Wire</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card / Online</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
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
                  placeholder="e.g. BACS ref 2847382" className="w-full py-2 px-3 border border-slate-300 rounded-xl" />
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

      {/* ================= SANA OFFICIAL INVOICE PREVIEW MODAL ================= */}
      <SanaInvoiceModal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        invoice={selectedInvoice}
        onEdit={canEdit ? handleOpenEdit : undefined}
        onDelete={
          canDelete && selectedInvoice?.id
            ? (inv) => handleDeleteInvoice(Number(inv.id), inv.orderNumber)
            : undefined
        }
      />
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel="Delete"
        danger
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((p) => ({ ...p, open: false }))}
      />
    </div>
  );
}
