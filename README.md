# ApexERP - Omnichannel Enterprise Platform (Web & Mobile)

A high-performance, fully responsive Enterprise Resource Planning (ERP) platform built with **Node.js**, **Next.js (App Router)**, **PostgreSQL 16**, and **Tailwind CSS**. Designed for synchronized operation across desktop, tablet, and mobile browsers (with PWA capabilities and mobile-optimized thumb navigation).

---

## 🌟 Key Architecture & Features

### 1. 🛒 Dual Sales Division: Wholesale B2B & Retail POS
- **Retail Point of Sale (POS)**:
  - Touch-optimized checkout register for counter cashiers on tablets and smartphones.
  - Barcode scanner input support (instant product lookup via enter key or gun scan).
  - Live cart with quantity stepping, percentage/item discounts, and 8% tax calculation.
  - Multi-tender payment options: **Cash** (with quick denomination buttons and live change calculator), **Card**, and **UPI / QR Scan**.
  - Instant thermal receipt slip generator with `window.print()` support.
- **Wholesale B2B Operations**:
  - Bulk order contracting with automatically loaded wholesale tiered pricing.
  - Credit limit validation safeguard: prevents sales reps from dispatching orders exceeding the customer's approved credit limit.
  - Commercial payment terms support (**Immediate**, **Net 15**, **Net 30**, **Net 60**).
  - Status management: Partial, Unpaid, and Paid invoice tracking.

### 2. 👥 Segmented Customer Base
- **Wholesale Corporate Accounts**:
  - Entity/Company profile, VAT/Tax ID, approved credit line, current outstanding debt balance, and negotiated terms.
- **Retail Shoppers**:
  - Guest walk-in counter checkout and VIP loyalty members with discount tier tracking.

### 3. 📦 Stock & Inventory Manager
- **Live Stock Levels**:
  - Real-time stock counts on hand across all units (pcs, roll, box, carton, kg).
  - Visual status badges (**In Stock**, **Low Stock Warning**, **Out of Stock**).
  - Dynamic reorder thresholds and automated low-stock banners.
- **Immutable Stock Movements Ledger**:
  - Every single transaction (POS sale, Wholesale shipment, Vendor intake, Damage adjustment) is recorded with previous quantity, new quantity, reference ID, and staff attribution.
- **Stock Audit & Adjustments**:
  - Reason tracking: Damaged / Expired goods (-), Surplus Found in Audit (+), Cycle Count Correction (+/-), Customer Return (+), Return to Vendor (-).

### 4. 🏷️ Products & Categories
- Dual pricing matrix: **Cost Price**, **Retail Price**, and **Wholesale Bulk Price**.
- Minimum wholesale order quantities (`min_wholesale_qty`).
- SKU and Barcode indexing for sub-millisecond queries.
- Category classification and unit of measure definitions.

### 5. 🚚 Vendors & Purchase Orders (POs)
- Approved supplier directory with payment terms and cumulative purchase volume.
- Purchase Order drafting and submission.
- **1-Click Shipment Intake**: Receiving a PO automatically restocks products in the warehouse, updates latest cost prices, and logs inventory movements.

### 6. 📊 Financial Intelligence & Reporting
- Real-time **Gross Profit** and **Profit Margin %** calculations.
- Comparative channel profitability matrix (**Wholesale B2B vs Retail POS**).
- Interactive **Sales Trend Area Chart** and **Category Breakdown Bar Chart** (Recharts).
- Top 10 Best Selling Products ranked by revenue and volume.
- Wholesale Accounts Receivable & Debt Aging analysis.

### 7. 🛡️ Staff & Role-Based Access Control (RBAC)
- 5 Pre-configured role profiles:
  - **ADMIN (Super Admin)**: Full administrative authority, staff configuration, and audit logs.
  - **MANAGER (Operations Mgr)**: Stock audits, PO approval, and financial reports.
  - **CASHIER (Front Register)**: Rapid POS terminal checkouts and receipts.
  - **SALES_REP (Wholesale Rep)**: B2B quotations and contract order issuance.
  - **INVENTORY_CLERK (Stock Lead)**: Physical inventory counts, audits, and receiving.
- **Fast 4-Digit PIN Pad Login** for high-speed POS register shifts.

### 8. 📜 System Event & Audit Logs
- PostgreSQL-backed audit trail logging:
  - User Logins (Password vs PIN)
  - POS Checkouts
  - Wholesale Invoices
  - Stock Adjustments & Damage Reports
  - Price Tier Changes
  - Customer Credit Limit approvals
- Severity filter (**INFO**, **WARNING**, **CRITICAL**) with expandable JSON payload inspector.

### 9. 📱 Mobile & Responsive UI
- **Desktop**: Collapsible navigation sidebar, detailed multi-column data grids, and floating role switcher.
- **Mobile / Tablet**:
  - Off-canvas slide-out drawer menu.
  - **Fixed Thumb-Friendly Bottom Bar** for 1-tap switching between **POS**, **Wholesale**, **Stock**, and **Orders**.
  - PWA manifest (`public/manifest.json`) ready for "Add to Home Screen".

---

## 🚀 Quickstart Guide

### 1. Database Setup
PostgreSQL 16 is configured and running on `localhost:5432` with database `erp_db`:
```bash
# Initialize schema tables
npm run db:init

# Seed rich enterprise demo data (products, customers, vendors, historical sales)
npm run db:seed
```

### 2. Run Application
```bash
# Development mode
npm run dev

# Or production build & start
npm run build
npm start
```
The application is accessible at **`http://localhost:3000`**.

---

## 🔑 Demo Staff Logins

| Role | Email | Password | POS PIN |
|---|---|---|---|
| **Super Admin** | `admin@apexerp.com` | `admin123` | `1122` |
| **Operations Manager** | `sarah.manager@apexerp.com` | `manager123` | `3344` |
| **Front Cashier** | `alex.cashier@apexerp.com` | `cashier123` | `1234` |
| **Wholesale Sales Rep** | `marcus.sales@apexerp.com` | `sales123` | `5566` |
| **Inventory Clerk** | `elena.stock@apexerp.com` | `stock123` | `7788` |

*(Note: On both the `/login` page and the navigation sidebar, there is an **Instant 1-Click Role Switcher** to quickly toggle roles during evaluation.)*
