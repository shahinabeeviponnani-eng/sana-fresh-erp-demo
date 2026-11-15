'use client';

import React, { useState, useEffect } from 'react';
import {
  History,
  ShieldCheck,
  AlertTriangle,
  Info,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Terminal,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Pagination from '@/components/ui/Pagination';

export default function LogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 50;

  const fetchLogs = async (p = page) => {
    try {
      setLoading(true);
      const url = `/api/logs?module=${moduleFilter}&severity=${severityFilter}&search=${encodeURIComponent(search)}&page=${p}&limit=${LIMIT}`;
      const res = await fetch(url);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchLogs(1);
  }, [moduleFilter, severityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs(1);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    fetchLogs(p);
  };

  const toggleExpand = (id: number) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              SANA FRESH Security & Audit Logs
            </h1>
            <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full">
              PostgreSQL Ledger
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Complete compliance trail capturing user logins, POS checkouts, cold chain movements, and wholesale contracts.
          </p>
        </div>

        <button
          onClick={() => fetchLogs(page)}
          className="p-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm flex items-center gap-1.5 self-start sm:self-center"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Live Sync
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search event action, user, or details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold"
          >
            Filter
          </button>
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="py-2 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-medium"
          >
            <option value="ALL">All Modules</option>
            <option value="AUTH">AUTH (Logins & Tokens)</option>
            <option value="RETAIL">RETAIL (POS Checkouts)</option>
            <option value="WHOLESALE">WHOLESALE (B2B Orders)</option>
            <option value="INVENTORY">INVENTORY (Stock Ledger)</option>
            <option value="CUSTOMERS">CUSTOMERS (Credit)</option>
            <option value="VENDORS">VENDORS (POs)</option>
            <option value="STAFF">STAFF (Privileges)</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="py-2 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-medium"
          >
            <option value="ALL">All Severities</option>
            <option value="INFO">INFO Only</option>
            <option value="WARNING">WARNING Only</option>
            <option value="CRITICAL">CRITICAL Only</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
            Loading security logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Terminal className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            No audit logs found matching criteria.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const isWarning = log.severity === 'WARNING';
              const isCritical = log.severity === 'CRITICAL';

              return (
                <div key={log.id} className="p-4 hover:bg-slate-50/70 transition-colors">
                  <div
                    onClick={() => toggleExpand(log.id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer select-none"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <span
                        className={`mt-0.5 sm:mt-0 w-2.5 h-2.5 rounded-full shrink-0 ${
                          isCritical
                            ? 'bg-rose-500 ring-4 ring-rose-100'
                            : isWarning
                            ? 'bg-amber-500 ring-4 ring-amber-100'
                            : 'bg-emerald-500'
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs text-slate-900">
                            {log.action}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {log.module}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isCritical
                                ? 'bg-rose-100 text-rose-800'
                                : isWarning
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {log.severity}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mt-1 flex items-center gap-2">
                          <span>
                            Actor: <strong className="text-slate-800">{log.staff_name || 'System'}</strong>
                          </span>
                          <span>•</span>
                          <span className="font-mono text-[11px] text-slate-400">{log.ip_address}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Collapsible JSON payload details */}
                  {isExpanded && log.details && (
                    <div className="mt-3 p-3 bg-slate-900 rounded-lg text-emerald-400 font-mono text-[11px] overflow-x-auto">
                      <div className="text-slate-400 text-[10px] uppercase font-bold mb-1">
                        Payload Details (JSONB)
                      </div>
                      <pre>{JSON.stringify(log.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={handlePageChange} />
      </div>
    </div>
  );
}
