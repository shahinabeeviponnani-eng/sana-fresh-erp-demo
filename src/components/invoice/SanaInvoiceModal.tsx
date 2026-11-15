'use client';

import React, { useRef } from 'react';
import {
  Printer,
  X,
  Share2,
  Copy,
  Check,
  Download,
  Building2,
  CheckCircle2,
  Calendar,
  Clock,
  ArrowLeft,
  Edit2,
  Trash2,
} from 'lucide-react';

export interface InvoiceItem {
  id?: number;
  productName: string;
  sku?: string;
  unit?: string;
  quantity: number | string;
  unitPrice: number | string;
  discount?: number | string;
  total: number | string;
}

export interface InvoiceData {
  id?: number | string;
  orderNumber: string; // e.g. "INV-39584"
  invoiceDate?: string;
  dueDate?: string;
  terms?: string; // e.g. "Due on Receipt"
  customerName?: string;
  companyName?: string;
  customerAddress?: string;
  customerCity?: string;
  customerPostalCode?: string;
  customerCountry?: string;
  shippingAddress?: string;
  subtotal: number | string;
  taxAmount?: number | string;
  totalAmount: number | string;
  amountPaid?: number | string;
  paymentMethod?: string;
  paymentStatus?: string;
  notes?: string;
  items: InvoiceItem[];
}

interface SanaInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceData | null;
  onEdit?: (invoice: InvoiceData) => void;
  onDelete?: (invoice: InvoiceData) => void;
}

export default function SanaInvoiceModal({
  isOpen,
  onClose,
  invoice,
  onEdit,
  onDelete,
}: SanaInvoiceModalProps) {
  const [copied, setCopied] = React.useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const shareUrl = `${window.location.origin}/wholesale?invoice=${invoice.orderNumber}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '28/10/2026';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const formatRate = (rate: number | string) => {
    const num = parseFloat(String(rate)) || 0;
    // If it has 3 decimals (like 0.799), show 3, otherwise 2
    const str = num.toString();
    if (str.includes('.') && str.split('.')[1].length > 2) {
      return num.toFixed(3);
    }
    return num.toFixed(2);
  };

  const formatMoney = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return num.toFixed(2);
  };

  const totalAmountNum = parseFloat(String(invoice.totalAmount)) || 0;
  const amountPaidNum = parseFloat(String(invoice.amountPaid)) || 0;
  const balanceDueNum = Math.max(0, totalAmountNum - amountPaidNum);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static">
      {/* Modal Container */}
      <div className="bg-slate-100 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[96vh] print:max-h-none print:shadow-none print:rounded-none print:w-full print:bg-white overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Control Bar - Hidden during Print */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shrink-0 print:hidden border-b border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="sm:hidden p-1.5 -ml-1 text-slate-300 hover:text-white rounded-lg active:bg-slate-800"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="font-bold text-sm sm:text-base tracking-tight truncate">
              Official Invoice — {invoice.orderNumber}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(invoice);
                }}
                title="Edit Invoice items and terms"
                className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit Bill</span>
              </button>
            )}

            {onDelete && (
              <button
                onClick={() => {
                  onDelete(invoice);
                }}
                title="Void and delete invoice"
                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Void Bill</span>
              </button>
            )}

            <button
              onClick={handleCopyLink}
              title="Copy share link"
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy Link'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md shadow-emerald-600/30 active:scale-95 transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Area */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-6 lg:p-8 bg-slate-200/80 print:bg-white print:p-0 print:overflow-visible">
          
          {/* A4 Paper Document Wrapper */}
          <div
            ref={printRef}
            id="sana-invoice-printable"
            className="bg-white mx-auto shadow-lg print:shadow-none w-full max-w-[800px] min-h-[1050px] p-6 sm:p-12 text-slate-900 font-sans flex flex-col justify-between text-xs sm:text-[13px] leading-relaxed relative print:p-8"
          >
            {/* ================= INVOICE PAGE 1 ================= */}
            <div>
              {/* Header Section */}
              <div className="flex justify-between items-start pb-6 gap-4">
                {/* Left: Sana Fresh Logo & Company Information */}
                <div className="space-y-3 max-w-[320px]">
                  {/* SANA SVG Logo reproducing the real brand mark */}
                  <div className="relative inline-block">
                    <svg
                      viewBox="0 0 240 100"
                      className="w-36 sm:w-44 h-auto"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      {/* Leaf motifs above lettering */}
                      <path
                        d="M145 22C130 5 110 8 100 24C108 26 120 22 132 28C140 32 144 38 145 22Z"
                        fill="#22c55e"
                      />
                      <path
                        d="M148 24C162 10 182 12 192 28C184 30 172 26 160 32C152 36 149 42 148 24Z"
                        fill="#16a34a"
                      />
                      <path
                        d="M136 29C142 16 154 12 165 18C156 22 150 28 146 38C142 34 139 31 136 29Z"
                        fill="#86efac"
                      />
                      {/* Stylized curved SANA typography */}
                      <text
                        x="10"
                        y="82"
                        fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial"
                        fontSize="68"
                        fontWeight="800"
                        fontStyle="italic"
                        fill="#f97316"
                        letterSpacing="-1.5px"
                      >
                        Sana
                      </text>
                    </svg>
                  </div>

                  {/* SANA GROUP LTD Details */}
                  <div className="text-[11px] sm:text-xs text-slate-700 space-y-0.5 leading-snug">
                    <div className="font-extrabold text-slate-900 text-xs sm:text-[13px]">
                      SANA GROUP LTD
                    </div>
                    <div>Reg: 16728852</div>
                    <div>94 Bensham Lane</div>
                    <div>CR7 7ES, Croydon</div>
                    <div>United Kingdom</div>
                    <div>
                      <a href="mailto:sales@sanafresh.co.uk" className="text-slate-700 hover:underline">
                        sales@sanafresh.co.uk
                      </a>
                    </div>
                    <div>02035766816</div>
                  </div>
                </div>

                {/* Right: Invoice Title & Metadata */}
                <div className="text-right space-y-4">
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-normal text-slate-800 tracking-tight">
                      Invoice
                    </h1>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 mt-1 font-mono">
                      Invoice# {invoice.orderNumber}
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-slate-700 inline-block text-left pt-2">
                    <div className="flex justify-between gap-6">
                      <span className="text-slate-600">Invoice Date :</span>
                      <span className="font-semibold text-slate-900 font-mono">
                        {formatDate(invoice.invoiceDate)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span className="text-slate-600">Terms :</span>
                      <span className="font-semibold text-slate-900">
                        {invoice.terms || 'Due on Receipt'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span className="text-slate-600">Due Date :</span>
                      <span className="font-semibold text-slate-900 font-mono">
                        {formatDate(invoice.dueDate || invoice.invoiceDate)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bill To Section */}
              <div className="py-5 border-t border-slate-200 mt-2 text-xs sm:text-[13px]">
                <div className="text-slate-500 font-semibold mb-1">Bill To</div>
                <div className="font-bold text-slate-900 text-sm">
                  {invoice.companyName || invoice.customerName || 'Los Arrieros De Pito'}
                </div>
                {invoice.customerAddress && (
                  <div className="text-slate-700 whitespace-pre-line leading-relaxed">
                    {invoice.customerAddress}
                  </div>
                )}
                <div className="text-slate-700 leading-relaxed">
                  {[invoice.customerPostalCode, invoice.customerCity].filter(Boolean).join(' ')}
                </div>
                <div className="text-slate-700">{invoice.customerCountry || 'United Kingdom'}</div>
              </div>

              {/* Items Table matching exact columns */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#1e242b] text-white text-[11px] sm:text-xs">
                      <th className="py-2.5 px-3 font-semibold w-8 text-center">#</th>
                      <th className="py-2.5 px-3 font-semibold">Item &amp; Description</th>
                      <th className="py-2.5 px-3 font-semibold text-right w-24">Qty</th>
                      <th className="py-2.5 px-3 font-semibold text-right w-24">Rate</th>
                      <th className="py-2.5 px-3 font-semibold text-right w-24">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px] sm:text-xs">
                    {invoice.items && invoice.items.length > 0 ? (
                      invoice.items.map((item, idx) => (
                        <tr key={idx} className="align-top hover:bg-slate-50/50">
                          <td className="py-3 px-3 text-center text-slate-500 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 uppercase">
                              {item.productName}
                            </div>
                            {item.sku && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                SKU: {item.sku}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            <div className="font-semibold text-slate-900">
                              {parseFloat(String(item.quantity)).toFixed(2)}
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase font-bold">
                              {item.unit || 'BX'}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-800">
                            {formatRate(item.unitPrice)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            {formatMoney(item.total)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          No items on this invoice.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals Section */}
              <div className="mt-6 flex justify-end">
                <div className="w-full max-w-xs space-y-2 text-xs sm:text-[13px]">
                  <div className="flex justify-between py-1 px-3 text-slate-700">
                    <span className="font-medium">Sub Total</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatMoney(invoice.subtotal)}
                    </span>
                  </div>

                  {invoice.taxAmount && parseFloat(String(invoice.taxAmount)) > 0 ? (
                    <div className="flex justify-between py-1 px-3 text-slate-700">
                      <span className="font-medium">VAT / Tax</span>
                      <span className="font-mono font-bold text-slate-900">
                        £{formatMoney(invoice.taxAmount)}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex justify-between py-1 px-3 text-slate-900 font-bold">
                    <span>Total</span>
                    <span className="font-mono text-sm">
                      £{formatMoney(invoice.totalAmount)}
                    </span>
                  </div>

                  {/* Shaded Balance Due Bar */}
                  <div className="flex justify-between py-2 px-3 bg-slate-100 rounded-md text-slate-900 font-black text-xs sm:text-sm border border-slate-200/80">
                    <span>Balance Due</span>
                    <span className="font-mono text-emerald-800">
                      £{formatMoney(balanceDueNum)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes & Thanks Section */}
              <div className="mt-10 pt-6 border-t border-slate-200">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                  Notes
                </div>
                <div className="text-xs text-slate-600 mt-1 italic">
                  {invoice.notes || 'Thanks for your business.'}
                </div>
              </div>
            </div>

            {/* Bottom Footer Page Indicator */}
            <div className="pt-8 text-right text-[10px] text-slate-400 font-mono border-t border-slate-100 mt-12">
              1
            </div>
          </div>
        </div>

        {/* Bottom Mobile Action Drawer - Hidden during Print */}
        <div className="p-3 bg-white border-t border-slate-200 flex flex-wrap sm:hidden items-center justify-between gap-2 shrink-0 print:hidden">
          {onEdit && (
            <button
              onClick={() => {
                onClose();
                onEdit(invoice);
              }}
              className="py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(invoice)}
              className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Void</span>
            </button>
          )}
          <button
            onClick={handleCopyLink}
            className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            <span>{copied ? 'Copied' : 'Share'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
