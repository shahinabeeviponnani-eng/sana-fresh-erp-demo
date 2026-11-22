'use client';

import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Boxes,
  Barcode,
  Layers,
  RefreshCw,
  X,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ImagePlus,
  Camera,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';

export default function ProductsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatCode, setNewCatCode] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    description: '',
    category_id: '',
    cost_price: '0.00',
    retail_price: '0.00',
    wholesale_price: '0.00',
    retail_margin_percent: '30',
    wholesale_margin_percent: '15',
    min_wholesale_qty: '10',
    stock_quantity: '0',
    reorder_level: '15',
    unit: 'pcs',
  });
  const [submitting, setSubmitting] = useState(false);
  const [productImage, setProductImage] = useState<string>('');
  const [imageCompressing, setImageCompressing] = useState(false);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);

  // Compress to max 400x400 JPEG quality 0.5 — keeps output under ~20KB
  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 400;
        let { width, height } = img;
        if (width > height) {
          if (width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
        } else {
          if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.5));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setImageCompressing(true);
      const compressed = await compressImage(file);
      setProductImage(compressed);
    } catch {
      toast('Failed to process image', 'error');
    } finally {
      setImageCompressing(false);
    }
  };

  // Dynamic calculation helpers
  const handleCostPriceChange = (val: string) => {
    const cost = parseFloat(val);
    const retMargin = parseFloat(formData.retail_margin_percent);
    const wsMargin = parseFloat(formData.wholesale_margin_percent);

    let newRetail = formData.retail_price;
    let newWs = formData.wholesale_price;

    if (!isNaN(cost) && cost > 0) {
      if (!isNaN(retMargin) && retMargin > 0) {
        newRetail = (cost * (1 + retMargin / 100)).toFixed(2);
      }
      if (!isNaN(wsMargin) && wsMargin > 0) {
        newWs = (cost * (1 + wsMargin / 100)).toFixed(2);
      }
    }

    setFormData((prev) => ({
      ...prev,
      cost_price: val,
      retail_price: newRetail,
      wholesale_price: newWs,
    }));
  };

  const handleRetailMarginChange = (val: string) => {
    const margin = parseFloat(val);
    const cost = parseFloat(formData.cost_price);
    let newRetail = formData.retail_price;

    if (!isNaN(cost) && cost > 0 && !isNaN(margin)) {
      newRetail = (cost * (1 + margin / 100)).toFixed(2);
    }

    setFormData((prev) => ({
      ...prev,
      retail_margin_percent: val,
      retail_price: newRetail,
    }));
  };

  const handleRetailPriceChange = (val: string) => {
    const retail = parseFloat(val);
    const cost = parseFloat(formData.cost_price);
    let newMargin = formData.retail_margin_percent;

    if (!isNaN(cost) && cost > 0 && !isNaN(retail) && retail >= cost) {
      newMargin = (((retail - cost) / cost) * 100).toFixed(1);
    }

    setFormData((prev) => ({
      ...prev,
      retail_price: val,
      retail_margin_percent: newMargin,
    }));
  };

  const handleWholesaleMarginChange = (val: string) => {
    const margin = parseFloat(val);
    const cost = parseFloat(formData.cost_price);
    let newWs = formData.wholesale_price;

    if (!isNaN(cost) && cost > 0 && !isNaN(margin)) {
      newWs = (cost * (1 + margin / 100)).toFixed(2);
    }

    setFormData((prev) => ({
      ...prev,
      wholesale_margin_percent: val,
      wholesale_price: newWs,
    }));
  };

  const handleWholesalePriceChange = (val: string) => {
    const ws = parseFloat(val);
    const cost = parseFloat(formData.cost_price);
    let newMargin = formData.wholesale_margin_percent;

    if (!isNaN(cost) && cost > 0 && !isNaN(ws) && ws >= cost) {
      newMargin = (((ws - cost) / cost) * 100).toFixed(1);
    }

    setFormData((prev) => ({
      ...prev,
      wholesale_price: val,
      wholesale_margin_percent: newMargin,
    }));
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes] = await Promise.all([
        fetch(`/api/products?search=${encodeURIComponent(search)}&category=${categoryFilter}`),
        fetch('/api/categories'),
      ]);
      const prodData = await prodRes.json();
      const catData = await catRes.json();
      setProducts(prodData.products || []);
      setCategories(catData.categories || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [categoryFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, search]);

  const totalProducts = products.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedProducts = products.slice(startIndex, startIndex + pageSize);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast('Image must be under 2MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProductImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setProductImage('');
    setFormData({
      sku: '',
      barcode: '',
      name: '',
      description: '',
      category_id: categories.length > 0 ? categories[0].id.toString() : '',
      cost_price: '',
      retail_price: '',
      wholesale_price: '',
      retail_margin_percent: '30',
      wholesale_margin_percent: '15',
      min_wholesale_qty: '1',
      stock_quantity: '0',
      reorder_level: '10',
      unit: 'pcs',
    });
    setModalOpen(true);
  };

  const openEditModal = (p: any) => {
    setEditingProduct(p);
    setProductImage(p.image_url || '');
    const cost = parseFloat(p.cost_price) || 0;
    const ret = parseFloat(p.retail_price) || 0;
    const ws = parseFloat(p.wholesale_price) || 0;
    let retMargin = p.retail_margin_percent !== undefined && p.retail_margin_percent !== null ? p.retail_margin_percent.toString() : '';
    if ((!retMargin || retMargin === '0') && cost > 0 && ret > 0) {
      retMargin = (((ret - cost) / cost) * 100).toFixed(1);
    }
    let wsMargin = p.wholesale_margin_percent !== undefined && p.wholesale_margin_percent !== null ? p.wholesale_margin_percent.toString() : '';
    if ((!wsMargin || wsMargin === '0') && cost > 0 && ws > 0) {
      wsMargin = (((ws - cost) / cost) * 100).toFixed(1);
    }

    setFormData({
      sku: p.sku,
      barcode: p.barcode || '',
      name: p.name,
      description: p.description || '',
      category_id: p.category_id?.toString() || '',
      cost_price: p.cost_price.toString(),
      retail_price: p.retail_price.toString(),
      wholesale_price: p.wholesale_price.toString(),
      retail_margin_percent: retMargin || '0',
      wholesale_margin_percent: wsMargin || '0',
      min_wholesale_qty: p.min_wholesale_qty.toString(),
      stock_quantity: p.stock_quantity.toString(),
      reorder_level: p.reorder_level.toString(),
      unit: p.unit || 'pcs',
    });
    setModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const method = editingProduct ? 'PUT' : 'POST';
      const body = editingProduct
        ? { ...formData, id: editingProduct.id, image_url: productImage || null }
        : { ...formData, image_url: productImage || null };

      const res = await fetch('/api/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Operation failed');

      toast(editingProduct ? 'Product updated successfully' : 'Product created successfully', 'success');
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName, code: newCatCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create category');

      setNewCatName('');
      setNewCatCode('');
      setCategoryModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            SANA FRESH Products
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Maintain organic produce, dairy, fruits, SKU barcodes, and dual Wholesale & Retail pricing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCategoryModalOpen(true)}
            className="px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5"
          >
            <Layers className="w-4 h-4 text-slate-500" /> New Category
          </button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search product name, SKU or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="py-2 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-medium"
          >
            <option value="">All Categories ({products.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            onClick={fetchData}
            className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            Loading catalog...
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Package className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            No products match your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">SKU / Barcode</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Cost Price</th>
                  <th className="py-3 px-4">Retail Price</th>
                  <th className="py-3 px-4">Wholesale Tier</th>
                  <th className="py-3 px-4">Stock on Hand</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-slate-900">{p.sku}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Barcode className="w-3 h-3" /> {p.barcode || 'None'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-xs">
                      <div className="flex items-center gap-2.5">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-slate-300" />
                          </div>
                        )}
                        <span>{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                        {p.category_name || 'General'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                      £{Number(p.cost_price).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">
                      £{Number(p.retail_price).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <div className="text-indigo-600 font-bold">
                        £{Number(p.wholesale_price).toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        Min: {p.min_wholesale_qty} {p.unit}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {p.stock_quantity}{' '}
                      <span className="text-slate-400 text-xs font-normal">{p.unit}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => openEditModal(p)}
                        className="p-1.5 text-slate-500 hover:text-emerald-600 rounded hover:bg-slate-100"
                        title="Edit Product"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && totalProducts > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong className="text-slate-900 font-bold">{startIndex + 1}</strong> to{' '}
                <strong className="text-slate-900 font-bold">{Math.min(startIndex + pageSize, totalProducts)}</strong> of{' '}
                <strong className="text-slate-900 font-bold">{totalProducts}</strong> products
              </span>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1.5">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="py-1 px-2 bg-white border border-slate-300 rounded text-xs font-semibold focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                title="First Page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm flex items-center gap-1 font-semibold"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <div className="px-3 py-1 font-bold text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm">
                Page {safePage} of {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm flex items-center gap-1 font-semibold"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                title="Last Page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================= ADD / EDIT PRODUCT MODAL ================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingProduct ? 'Edit Product Details' : 'Add New Product to Catalog'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter SKU (e.g. SF-COLA or 1001)"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Barcode <span className="text-slate-400 font-normal text-[11px]">(Scan or type)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Scan product barcode with scanner or type..."
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg font-bold"
                />
              </div>

              {/* Product Image — Camera / Gallery with canvas compression */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Product Photo
                  <span className="ml-1.5 text-slate-400 font-normal text-[11px]">auto-compressed to ~20KB</span>
                </label>

                {/* Hidden inputs — one for camera, one for gallery */}
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
                  className="hidden" onChange={handleImageFile} />
                <input ref={galleryInputRef} type="file" accept="image/*"
                  className="hidden" onChange={handleImageFile} />

                {productImage ? (
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden border-2 border-emerald-400 shadow-sm">
                      <img src={productImage} alt="Product" className="w-full h-40 object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-between p-2.5">
                        <span className="text-[10px] text-white font-semibold bg-black/40 px-2 py-0.5 rounded-full">
                          ✓ Compressed &amp; Ready
                        </span>
                        <button type="button" onClick={() => setProductImage('')}
                          className="text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-2.5 py-1 rounded-lg">
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => cameraInputRef.current?.click()}
                        className="flex items-center justify-center gap-1.5 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">
                        <Camera className="w-3.5 h-3.5 text-emerald-600" /> Retake Photo
                      </button>
                      <button type="button" onClick={() => galleryInputRef.current?.click()}
                        className="flex items-center justify-center gap-1.5 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">
                        <ImagePlus className="w-3.5 h-3.5 text-indigo-600" /> Change from Gallery
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {imageCompressing ? (
                      <div className="w-full h-28 border-2 border-dashed border-emerald-400 rounded-xl flex flex-col items-center justify-center gap-2 bg-emerald-50">
                        <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
                        <span className="text-xs font-semibold text-emerald-700">Compressing image...</span>
                      </div>
                    ) : (
                      <div className="w-full h-28 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1 bg-slate-50">
                        <ImagePlus className="w-6 h-6 text-slate-300" />
                        <span className="text-[11px] text-slate-400">No photo added</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => cameraInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/30 active:scale-95 transition-all">
                        <Camera className="w-4 h-4" /> Take Photo
                      </button>
                      <button type="button" onClick={() => galleryInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all">
                        <ImagePlus className="w-4 h-4" /> From Gallery
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Unit of Measure</label>
                  <input
                    type="text"
                    placeholder="pcs, box, kg, pack"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Pricing Tiers Section */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="font-extrabold text-slate-900 uppercase text-[10px] tracking-wider block">
                  Dual Pricing Tiers & Margins
                </span>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Cost Price (£)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.cost_price}
                      onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                      className="w-full py-1.5 px-2 border border-slate-300 rounded text-right font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-emerald-700 block mb-1">Retail Price (£)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.retail_price}
                      onChange={(e) => setFormData({ ...formData, retail_price: e.target.value })}
                      className="w-full py-1.5 px-2 border border-emerald-300 rounded text-right font-mono font-bold text-emerald-700"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-indigo-700 block mb-1">Wholesale (£)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.wholesale_price}
                      onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })}
                      className="w-full py-1.5 px-2 border border-indigo-300 rounded text-right font-mono font-bold text-indigo-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Min Wholesale Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.min_wholesale_qty}
                      onChange={(e) => setFormData({ ...formData, min_wholesale_qty: e.target.value })}
                      className="w-full py-1.5 px-2 border border-slate-300 rounded text-center"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Opening Stock</label>
                    <input
                      type="number"
                      disabled={!!editingProduct}
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                      className="w-full py-1.5 px-2 border border-slate-300 rounded text-center disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Reorder Threshold</label>
                    <input
                      type="number"
                      value={formData.reorder_level}
                      onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                      className="w-full py-1.5 px-2 border border-slate-300 rounded text-center"
                    />
                  </div>
                </div>
              </div>

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
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20"
                >
                  {submitting ? 'Saving to Database...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= ADD CATEGORY MODAL ================= */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Create New Category</h3>
              <button onClick={() => setCategoryModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCategory} className="p-5 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Healthcare & Medical"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Code / Slug *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MED"
                  value={newCatCode}
                  onChange={(e) => setNewCatCode(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg uppercase font-mono"
                />
              </div>
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-slate-900 text-white rounded-lg font-bold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
