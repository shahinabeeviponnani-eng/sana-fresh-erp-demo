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
  DollarSign,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function VendorsPage() {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'POS' | 'VENDORS'>('POS');
  const [loading, setLoading] = useState(true);

  // New PO Modal
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<number | ''>('');
  const [poItems, setPoItems] = useState<
    Array<{ productId: number; quantity: number; unitCost: number }>
  >([]);
  const [expectedDate, setExpectedDate] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [submittingPo, setSubmittingPo] = useState(false);

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
    if (!selectedVendorId) return alert('Select a vendor');
    if (poItems.length === 0) return alert('Add at least one item');

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

      alert(`Purchase Order ${data.poNumber} issued successfully!`);
      setPoModalOpen(false);
      setPoItems([]);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingPo(false);
    }
  };

  // Receive PO Shipment
  const handleReceiveShipment = async (poId: number, poNumber: string) => {
    if (!confirm(`Confirm delivery receipt for ${poNumber}? This will automatically increase physical inventory and update cost ledger.`)) return;

    try {
      const res = await fetch('/api/purchases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to receive shipment');

      alert(data.message);
      fetchData();
    } catch (err: any) {
      alert(err.message);
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

      setVendorModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Vendors & Restocking (POs)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Supplier procurement, replenishment purchase orders, and warehouse intake receipt.
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
              if (vendors.length > 0) setSelectedVendorId(vendors[0].id);
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
          ) : (
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
                  {purchaseOrders.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50/70">
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
                        ${Number(po.total_amount).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            po.status === 'RECEIVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {po.status === 'RECEIVED' ? (
                            <>
                              <CheckCircle className="w-3 h-3 text-emerald-600" /> RECEIVED
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-amber-600" /> ORDERED
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {po.status !== 'RECEIVED' ? (
                          <button
                            onClick={() => handleReceiveShipment(po.id, po.po_number)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-1 ml-auto"
                          >
                            <PackagePlus className="w-3.5 h-3.5" />
                            <span>Receive Shipment</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">Stock Added</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
                  ${Number(v.total_purchases || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= NEW PURCHASE ORDER MODAL ================= */}
      {poModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Issue Inbound Purchase Order</h3>
              <button onClick={() => setPoModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePo} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Vendor *</label>
                <select
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(parseInt(e.target.value))}
                  required
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                >
                  <option value="">-- Choose Approved Supplier --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.company_name} ({v.payment_terms})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-slate-700">Restock Items *</label>
                  <button
                    type="button"
                    onClick={handleAddPoItem}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add SKU
                  </button>
                </div>

                {poItems.length === 0 ? (
                  <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400">
                    No items selected. Click &ldquo;Add SKU&rdquo; to restock.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {poItems.map((item, index) => (
                      <div
                        key={index}
                        className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2"
                      >
                        <select
                          value={item.productId}
                          onChange={(e) => handleUpdatePoItem(index, 'productId', e.target.value)}
                          className="flex-1 py-1.5 px-2 bg-white border border-slate-300 rounded font-medium"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Current: {p.stock_quantity})
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleUpdatePoItem(index, 'quantity', e.target.value)}
                          className="w-20 py-1.5 px-2 bg-white border border-slate-300 rounded text-center font-bold"
                        />

                        <input
                          type="number"
                          step="0.01"
                          placeholder="Unit Cost"
                          value={item.unitCost}
                          onChange={(e) => handleUpdatePoItem(index, 'unitCost', e.target.value)}
                          className="w-24 py-1.5 px-2 bg-white border border-slate-300 rounded text-right font-mono"
                        />

                        <div className="w-20 text-right font-bold text-slate-900">
                          ${(item.quantity * item.unitCost).toFixed(2)}
                        </div>

                        <button
                          type="button"
                          onClick={() => setPoItems(poItems.filter((_, i) => i !== index))}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Expected Delivery Date</label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPoModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPo || poItems.length === 0}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold"
                >
                  {submittingPo ? 'Submitting PO...' : 'Issue Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
  );
}
