'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PoundSterling, Plus, RefreshCw, CheckCircle2, Clock, Trash2, X, Users, TrendingUp, Wallet, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Pagination from '@/components/ui/Pagination';

const GBP = (v: number) => '£' + Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
  MANAGER: 'bg-blue-100 text-blue-800 border-blue-200',
  CASHIER: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  SALES_REP: 'bg-amber-100 text-amber-800 border-amber-200',
  INVENTORY_CLERK: 'bg-orange-100 text-orange-800 border-orange-200',
};

export default function SalaryPage() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} });
  const canManage = hasPermission('manage_staff');

  const [records, setRecords] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [filterStaff, setFilterStaff] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 25;

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    staffId: '',
    payPeriodStart: '',
    payPeriodEnd: '',
    basicSalary: '',
    bonus: '0',
    deductions: '0',
    paymentMethod: 'BANK_TRANSFER',
    notes: '',
  });

  const fetchData = useCallback(async (p = page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStaff) params.set('staffId', filterStaff);
      if (filterPeriod) params.set('period', filterPeriod);
      params.set('page', String(p));
      params.set('limit', String(LIMIT));
      const res = await fetch(`/api/salary?${params}`);
      const data = await res.json();
      setRecords(data.records || []);
      setStaff(data.staff || []);
      setSummary(data.summary || {});
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filterStaff, filterPeriod]);

  useEffect(() => { setPage(1); fetchData(1); }, [fetchData]);

  const netPay = (Number(form.basicSalary) || 0) + (Number(form.bonus) || 0) - (Number(form.deductions) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await fetch('/api/salary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: Number(form.staffId),
          payPeriodStart: form.payPeriodStart,
          payPeriodEnd: form.payPeriodEnd,
          basicSalary: Number(form.basicSalary),
          bonus: Number(form.bonus),
          deductions: Number(form.deductions),
          paymentMethod: form.paymentMethod,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setModalOpen(false);
      setForm({ staffId: '', payPeriodStart: '', payPeriodEnd: '', basicSalary: '', bonus: '0', deductions: '0', paymentMethod: 'BANK_TRANSFER', notes: '' });
      fetchData();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async (recordId: number) => {
    setConfirmModal({
      open: true, title: 'Mark as Paid', message: 'Mark this salary as PAID?',
      onConfirm: async () => {
        setConfirmModal((p) => ({ ...p, open: false }));
        const res = await fetch('/api/salary', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recordId }),
        });
        if (res.ok) fetchData();
      },
    });
  };

  const handleDelete = async (id: number) => {
    setConfirmModal({
      open: true, title: 'Delete Salary Record', message: 'Delete this salary record? This cannot be undone.',
      onConfirm: async () => {
        setConfirmModal((p) => ({ ...p, open: false }));
        const res = await fetch(`/api/salary?id=${id}`, { method: 'DELETE' });
        if (res.ok) fetchData();
      },
    });
  };

  return (
    <>
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              SANA FRESH Payroll & Salary
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
              GBP £
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Staff pay runs, salary history, bonuses and deductions.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> New Pay Run
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Total Paid Out</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{GBP(Number(summary.total_paid || 0))}</div>
          <div className="text-[11px] text-slate-400 mt-1">{summary.total_records || 0} pay records</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 uppercase flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Pending Payment</div>
          <div className="text-2xl font-black text-amber-700 mt-1">{GBP(Number(summary.total_pending || 0))}</div>
          <div className="text-[11px] text-slate-400 mt-1">Awaiting disbursement</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-indigo-600 uppercase flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Total Bonuses</div>
          <div className="text-2xl font-black text-indigo-700 mt-1">{GBP(Number(summary.total_bonus || 0))}</div>
          <div className="text-[11px] text-slate-400 mt-1">Performance bonuses</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-rose-600 uppercase flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Total Deductions</div>
          <div className="text-2xl font-black text-rose-700 mt-1">{GBP(Number(summary.total_deductions || 0))}</div>
          <div className="text-[11px] text-slate-400 mt-1">NI, tax, advances</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <select
          value={filterStaff}
          onChange={(e) => setFilterStaff(e.target.value)}
          className="py-2 px-3 text-xs bg-white border border-slate-300 rounded-xl font-medium text-slate-700 shadow-sm"
        >
          <option value="">All Staff Members</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
          ))}
        </select>
        <input
          type="month"
          value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value)}
          className="py-2 px-3 text-xs bg-white border border-slate-300 rounded-xl font-medium text-slate-700 shadow-sm"
        />
        <button onClick={() => fetchData(page)} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 shadow-sm">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            Loading payroll records...
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            No salary records found. Click "New Pay Run" to add one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Pay Period</th>
                  <th className="py-3 px-4">Basic Salary</th>
                  <th className="py-3 px-4">Bonus</th>
                  <th className="py-3 px-4">Deductions</th>
                  <th className="py-3 px-4">Net Pay</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Status</th>
                  {canManage && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{r.staff_name}</div>
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mt-0.5 ${ROLE_COLORS[r.role] || 'bg-slate-100 text-slate-700'}`}>
                        {r.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      <div>{new Date(r.pay_period_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      <div className="text-[10px] text-slate-400">to {new Date(r.pay_period_end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">{GBP(Number(r.basic_salary))}</td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-indigo-600">
                      {Number(r.bonus) > 0 ? `+${GBP(Number(r.bonus))}` : '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-rose-600">
                      {Number(r.deductions) > 0 ? `-${GBP(Number(r.deductions))}` : '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-black text-slate-900 text-sm">{GBP(Number(r.net_pay))}</td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">{r.payment_method.replace('_', ' ')}</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        r.payment_status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}>
                        {r.payment_status === 'PAID' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {r.payment_status}
                      </span>
                      {r.paid_at && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(r.paid_at).toLocaleDateString('en-GB')}
                        </div>
                      )}
                    </td>
                    {canManage && (
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {r.payment_status === 'PENDING' && (
                          <button
                            onClick={() => handleMarkPaid(r.id)}
                            className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-sm active:scale-95"
                          >
                            Mark Paid
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 border border-transparent hover:border-rose-200 active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={(p) => { setPage(p); fetchData(p); }} />
      </div>

      {/* New Pay Run Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PoundSterling className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">New Pay Run</h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Staff Member *</label>
                <select
                  required
                  value={form.staffId}
                  onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                >
                  <option value="">— Select Staff —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Period Start *</label>
                  <input
                    type="date" required value={form.payPeriodStart}
                    onChange={(e) => setForm({ ...form, payPeriodStart: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Period End *</label>
                  <input
                    type="date" required value={form.payPeriodEnd}
                    onChange={(e) => setForm({ ...form, payPeriodEnd: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="font-extrabold text-slate-900 uppercase text-[10px] tracking-wider block">Pay Breakdown (£)</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Basic Salary *</label>
                    <input
                      type="number" step="0.01" min="0" required value={form.basicSalary}
                      onChange={(e) => setForm({ ...form, basicSalary: e.target.value })}
                      placeholder="0.00"
                      className="w-full py-1.5 px-2 border border-slate-300 rounded text-right font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-indigo-700 block mb-1">Bonus (+)</label>
                    <input
                      type="number" step="0.01" min="0" value={form.bonus}
                      onChange={(e) => setForm({ ...form, bonus: e.target.value })}
                      className="w-full py-1.5 px-2 border border-indigo-200 rounded text-right font-mono text-indigo-700"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-rose-700 block mb-1">Deductions (-)</label>
                    <input
                      type="number" step="0.01" min="0" value={form.deductions}
                      onChange={(e) => setForm({ ...form, deductions: e.target.value })}
                      className="w-full py-1.5 px-2 border border-rose-200 rounded text-right font-mono text-rose-700"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-700">Net Pay:</span>
                  <span className="font-mono font-black text-lg text-emerald-700">{GBP(netPay)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Payment Method</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Notes</label>
                  <input
                    type="text" value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="e.g. Monthly pay"
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md disabled:bg-slate-300">
                  {submitting ? 'Saving...' : 'Create Pay Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    <ConfirmModal
      open={confirmModal.open}
      title={confirmModal.title}
      message={confirmModal.message}
      confirmLabel="Confirm"
      danger={confirmModal.title === 'Delete Salary Record'}
      onConfirm={confirmModal.onConfirm}
      onCancel={() => setConfirmModal((p) => ({ ...p, open: false }))}
    />
    </>
  );
}
