'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  User,
  KeyRound,
  Mail,
  Phone,
  Lock,
  RefreshCw,
  X,
  CheckCircle2,
  Ban,
  Shield,
  Sliders,
  Check,
  AlertTriangle,
  ArrowRight,
  Eye,
  Trash2,
  Edit2,
  Search,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ALL_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS, PermissionDefinition } from '@/lib/permissions';
import { useToast } from '@/components/ui/Toast';

export default function StaffPage() {
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Create Staff Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'CASHIER',
    pin_code: '1234',
    phone: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Edit Staff Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Permissions Manager Modal State
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/staff');
      const data = await res.json();
      setStaffList(data.staff || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const defaultPerms = ROLE_DEFAULT_PERMISSIONS[formData.role] || [];
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          permissions: defaultPerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create staff');

      setCreateModalOpen(false);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'CASHIER',
        pin_code: '1234',
        phone: '',
      });
      fetchStaff();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData) return;
    try {
      setEditSubmitting(true);
      const payload: any = { id: editData.id, name: editData.name, role: editData.role, phone: editData.phone, pin_code: editData.pin_code };
      if (editData.newPassword) payload.password = editData.newPassword;
      const res = await fetch('/api/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update staff');
      setEditModalOpen(false);
      setEditData(null);
      fetchStaff();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await fetch('/api/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) fetchStaff();
    } catch (err) {
      console.error(err);
    }
  };

  // Open Permissions Modal
  const openPermissionsModal = (staff: any) => {
    setSelectedStaff(staff);
    const existing = staff.permissions || ROLE_DEFAULT_PERMISSIONS[staff.role] || [];
    setSelectedPerms(existing.includes('*') ? ALL_PERMISSIONS.map((p) => p.key) : [...existing]);
    setPermModalOpen(true);
  };

  // Toggle single permission
  const handleTogglePerm = (key: string) => {
    setSelectedPerms((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Reset to role defaults
  const handleResetDefaults = () => {
    if (!selectedStaff) return;
    const defaults = ROLE_DEFAULT_PERMISSIONS[selectedStaff.role] || [];
    if (defaults.includes('*')) {
      setSelectedPerms(ALL_PERMISSIONS.map((p) => p.key));
    } else {
      setSelectedPerms([...defaults]);
    }
  };

  const handleSelectAll = () => {
    setSelectedPerms(ALL_PERMISSIONS.map((p) => p.key));
  };

  const handleClearAll = () => {
    setSelectedPerms([]);
  };

  // Save permissions
  const handleSavePermissions = async () => {
    if (!selectedStaff) return;
    try {
      setSavingPerms(true);
      const isFullAdmin = selectedPerms.length === ALL_PERMISSIONS.length && selectedStaff.role === 'ADMIN';
      const payloadPermissions = isFullAdmin ? ['*'] : selectedPerms;

      const res = await fetch('/api/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedStaff.id,
          permissions: payloadPermissions,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save permissions');

      setPermModalOpen(false);
      fetchStaff();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSavingPerms(false);
    }
  };

  const roleBadges: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
    MANAGER: 'bg-blue-100 text-blue-800 border-blue-200',
    CASHIER: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    SALES_REP: 'bg-amber-100 text-amber-800 border-amber-200',
    INVENTORY_CLERK: 'bg-orange-100 text-orange-800 border-orange-200',
  };

  const filteredStaff = staffList.filter((s) => {
    const matchesRole = roleFilter === 'ALL' || s.role === roleFilter;
    const matchesSearch =
      !searchQuery ||
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.role?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  // Group permissions by category
  const categories: Array<'Billing & Invoicing' | 'Retail POS' | 'Inventory & Products' | 'Customers & Suppliers' | 'Finance & Admin'> = [
    'Billing & Invoicing',
    'Retail POS',
    'Inventory & Products',
    'Customers & Suppliers',
    'Finance & Admin',
  ];

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              SANA Staff &amp; Access Permissions
            </h1>
            <span className="bg-purple-100 text-purple-800 text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full border border-purple-200">
              RBAC &amp; Security
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure fine-grained staff permissions (Bill Edit/Delete, Counter POS, Stock Ledger, Approvals).
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-600/25 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Search and Role Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <div className="flex gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold shrink-0">
            {['ALL', 'ADMIN', 'MANAGER', 'SALES_REP', 'CASHIER', 'INVENTORY_CLERK'].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-lg transition-colors text-xs ${
                  roleFilter === r
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r === 'ALL' ? 'All Roles' : r}
              </button>
            ))}
          </div>

          <button
            onClick={fetchStaff}
            title="Refresh Staff"
            className="p-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center gap-1 shadow-sm shrink-0 active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Staff Grid: Dual View (Mobile Cards + Desktop Table) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{['Staff Member','Role','PIN','Permissions','Status','Actions'].map(h => (
                  <th key={h} className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from({length:5}).map((_,i) => (
                  <tr key={i}>
                    {Array.from({length:6}).map((_,j) => (
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
        ) : filteredStaff.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <User className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            No staff members found matching criteria.
          </div>
        ) : (
          <>
            {/* ================= MOBILE CARDS (< md screens) ================= */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredStaff.map((s) => {
                const permsCount = s.permissions?.includes('*')
                  ? ALL_PERMISSIONS.length
                  : (s.permissions || []).length;

                return (
                  <div key={s.id} className="p-4 space-y-3 hover:bg-slate-50/70 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-slate-900">{s.name}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{s.email}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              roleBadges[s.role] || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {s.role}
                          </span>
                          <span className="text-[11px] font-mono font-semibold text-slate-600">
                            PIN: {s.pin_code || 'None'}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          s.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : 'bg-rose-100 text-rose-800 border-rose-200'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>

                    {/* Permissions summary */}
                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between">
                      <span className="flex items-center gap-1 font-medium">
                        <Shield className="w-3.5 h-3.5 text-purple-600" /> Permissions:
                      </span>
                      <span className="font-bold text-slate-800">
                        {s.permissions?.includes('*') ? 'Full System Access (*)' : `${permsCount} of ${ALL_PERMISSIONS.length} Granted`}
                      </span>
                    </div>

                    {/* Mobile Actions */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <button
                        onClick={() => openPermissionsModal(s)}
                        className="flex-1 py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                      >
                        <Sliders className="w-3.5 h-3.5 text-purple-600" />
                        <span>Edit Permissions</span>
                      </button>

                      {s.role !== 'ADMIN' && (
                        <button
                          onClick={() => handleToggleStatus(s.id, s.status)}
                          className={`py-2 px-3 font-bold text-xs rounded-xl border flex items-center gap-1 shadow-sm active:scale-95 ${
                            s.status === 'ACTIVE'
                              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {s.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ================= DESKTOP TABLE (>= md screens) ================= */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Role Profile</th>
                    <th className="py-3 px-4">POS 4-Digit PIN</th>
                    <th className="py-3 px-4">Granted Permissions</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStaff.map((s) => {
                    const permsCount = s.permissions?.includes('*')
                      ? ALL_PERMISSIONS.length
                      : (s.permissions || []).length;

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{s.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{s.email}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              roleBadges[s.role] || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {s.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                          {s.pin_code ? '••••' : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => openPermissionsModal(s)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-purple-50 text-slate-800 hover:text-purple-900 border border-slate-200 hover:border-purple-200 rounded-lg font-semibold transition-all active:scale-95"
                          >
                            <Sliders className="w-3.5 h-3.5 text-purple-600" />
                            <span>
                              {s.permissions?.includes('*')
                                ? 'Full Wildcard (*)'
                                : `${permsCount} of ${ALL_PERMISSIONS.length} Permissions`}
                            </span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              s.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border-rose-200'
                            }`}
                          >
                            {s.status === 'ACTIVE' ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Ban className="w-3 h-3 text-rose-600" />
                            )}
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => { setEditData({ ...s, newPassword: '' }); setEditModalOpen(true); }}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg shadow-sm inline-flex items-center gap-1 active:scale-95"
                          >
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                          <button
                            onClick={() => openPermissionsModal(s)}
                            className="px-2.5 py-1 text-[11px] font-bold text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg shadow-sm inline-flex items-center gap-1 active:scale-95"
                          >
                            <Sliders className="w-3 h-3" /> Permissions
                          </button>

                          {s.role !== 'ADMIN' && (
                            <button
                              onClick={() => handleToggleStatus(s.id, s.status)}
                              className={`px-2.5 py-1 text-[11px] font-semibold border rounded-lg shadow-sm active:scale-95 ${
                                s.status === 'ACTIVE'
                                  ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200'
                                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                              }`}
                            >
                              {s.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ================= PERMISSIONS MANAGER MODAL ================= */}
      {permModalOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    Permissions: {selectedStaff.name}
                  </h3>
                  <div className="text-[11px] text-slate-300 font-mono">
                    {selectedStaff.email} • Role: {selectedStaff.role}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setPermModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Action Toolbar */}
            <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
              <div className="font-semibold text-slate-700">
                Active Permissions:{' '}
                <span className="font-bold text-purple-700">
                  {selectedPerms.length} of {ALL_PERMISSIONS.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-300 shadow-sm"
                >
                  Reset Role Defaults
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold rounded-lg border border-purple-200 shadow-sm"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-600 font-semibold rounded-lg border border-slate-300 shadow-sm"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Scrollable Permissions Matrix */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs">
              {categories.map((cat) => {
                const permsInCategory = ALL_PERMISSIONS.filter((p) => p.category === cat);

                return (
                  <div key={cat} className="space-y-2.5">
                    <div className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wide flex items-center gap-1.5 pb-1 border-b border-slate-200">
                      <span>{cat}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {permsInCategory.map((perm) => {
                        const isChecked = selectedPerms.includes(perm.key);
                        const isDangerous = perm.key === 'delete_invoices' || perm.key === 'delete_products';

                        return (
                          <div
                            key={perm.key}
                            onClick={() => handleTogglePerm(perm.key)}
                            className={`p-3 rounded-xl border cursor-pointer select-none transition-all flex items-start gap-2.5 ${
                              isChecked
                                ? isDangerous
                                  ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-400/30'
                                  : 'bg-purple-50/70 border-purple-300 ring-1 ring-purple-400/30'
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // handled by parent div
                              className="mt-0.5 h-4 w-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 text-xs">
                                  {perm.label}
                                </span>
                                {isDangerous && (
                                  <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1 rounded border border-rose-200">
                                    Destructive
                                  </span>
                                )}
                                {perm.key === 'edit_invoices' && (
                                  <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 rounded border border-amber-200">
                                    Bill Edit
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                {perm.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPermModalOpen(false)}
                className="py-2.5 px-4 border border-slate-300 rounded-xl font-bold text-xs text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={savingPerms}
                className="py-2.5 px-6 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-xs shadow-md shadow-purple-700/20 active:scale-95 transition-all flex items-center gap-1.5"
              >
                {savingPerms ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Apply Permissions</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= EDIT STAFF MODAL ================= */}
      {editModalOpen && editData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Edit Staff: {editData.name}</h3>
              </div>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditStaff} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name *</label>
                <input type="text" required value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Role</label>
                  <select value={editData.role}
                    onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg bg-white text-xs">
                    <option value="CASHIER">Front Cashier</option>
                    <option value="SALES_REP">Wholesale Rep</option>
                    <option value="INVENTORY_CLERK">Cold Chain Lead</option>
                    <option value="MANAGER">Operations Manager</option>
                    <option value="ADMIN">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone</label>
                  <input type="text" value={editData.phone || ''}
                    onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">New POS PIN</label>
                  <input type="text" maxLength={6} value={editData.pin_code || ''}
                    onChange={(e) => setEditData({ ...editData, pin_code: e.target.value })}
                    placeholder="Leave blank to keep"
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg text-center font-mono font-bold text-xs" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">New Password</label>
                  <input type="password" value={editData.newPassword || ''}
                    onChange={(e) => setEditData({ ...editData, newPassword: e.target.value })}
                    placeholder="Leave blank to keep"
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs font-mono" />
                </div>
              </div>
              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setEditModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={editSubmitting}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-md disabled:bg-slate-300">
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= ADD STAFF MODAL ================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Add New Staff Member</h3>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Work Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. john@sanafresh.co.uk"
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Initial Password *</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">POS 4-Digit PIN</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={formData.pin_code}
                    onChange={(e) => setFormData({ ...formData, pin_code: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg text-center font-mono font-bold text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Role Profile</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg bg-white text-xs font-medium"
                  >
                    <option value="CASHIER">Front Cashier</option>
                    <option value="SALES_REP">Wholesale Rep</option>
                    <option value="INVENTORY_CLERK">Cold Chain Lead</option>
                    <option value="MANAGER">Operations Manager</option>
                    <option value="ADMIN">Super Admin</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="02035766816"
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-[11px] text-purple-900">
                <span className="font-bold">Permissions Notice:</span> Default role permissions will be automatically applied. You can customize them immediately after creation.
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
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-md disabled:bg-slate-300"
                >
                  {submitting ? 'Registering...' : 'Create Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
