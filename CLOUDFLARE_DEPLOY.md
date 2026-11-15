# SANA FRESH ERP — Cloudflare Deployment Guide

## Prerequisites
- Cloudflare account (paid plan)
- Node.js installed
- Wrangler CLI: `npm install -g wrangler`

---

## Step 1 — Login to Cloudflare
```bash
wrangler login
```

---

## Step 2 — Create D1 Database
```bash
wrangler d1 create sana-fresh-erp-db
```
Copy the `database_id` from output and paste into `wrangler.toml`:
```toml
database_id = "PASTE_YOUR_ID_HERE"
```

---

## Step 3 — Create R2 Bucket (product images)
```bash
wrangler r2 bucket create sana-fresh-erp-storage
```

---

## Step 4 — Set JWT Secret
In Cloudflare Dashboard → Pages → sana-fresh-erp → Settings → Environment Variables:
```
JWT_SECRET = your-strong-secret-min-32-chars-here
R2_PUBLIC_URL = https://pub-XXXX.r2.dev  (after enabling public access on R2 bucket)
```

Or via wrangler for local dev:
```bash
wrangler secret put JWT_SECRET
```

---

## Step 5 — Run D1 Schema
```bash
npm run cf:d1:schema
# or:
wrangler d1 execute sana-fresh-erp-db --file=scripts/schema-d1.sql
```

---

## Step 6 — Seed Demo Data
```bash
wrangler d1 execute sana-fresh-erp-db --file=scripts/seed-d1.sql
```

---

## Step 7 — Build & Deploy
```bash
# Build for Cloudflare Pages Edge runtime
npm run cf:build
# Deploy the output directory (.vercel/output/static)
npm run cf:deploy
```

---

## Step 8 — Default Staff Logins
`scripts/seed-d1.sql` automatically configures Edge WebCrypto PBKDF2 hashes. The seeded logins are:
- `admin@sanafresh.co.uk` : `admin123` (Super Admin, PIN: `1122`)
- `sarah.manager@sanafresh.co.uk` : `manager123` (Operations Mgr, PIN: `3344`)
- `alex.cashier@sanafresh.co.uk` : `cashier123` (Front Cashier, PIN: `1234`)
- `sales@sanafresh.co.uk` : `sales123` (Wholesale Lead, PIN: `5566`)
- `elena.stock@sanafresh.co.uk` : `stock123` (Cold Chain Lead, PIN: `7788`)

---

## Local Development with D1
```bash
# Build first
npm run cf:build

# Preview locally with Wrangler Pages Dev
npm run cf:dev
```

---

## R2 Public Access Setup
1. Cloudflare Dashboard → R2 → sana-fresh-erp-storage
2. Settings → Public Access → Allow Access
3. Copy the public URL (e.g. `https://pub-abc123.r2.dev`)
4. Set `R2_PUBLIC_URL` environment variable

---

## Environment Variables Summary
| Variable | Where | Value |
|----------|-------|-------|
| `JWT_SECRET` | CF Pages Env | Strong random string (32+ chars) |
| `R2_PUBLIC_URL` | CF Pages Env | `https://pub-XXXX.r2.dev` |
| `NODE_ENV` | wrangler.toml | `production` |

---

## D1 Limits (Paid Plan — Workers Paid)
- Reads: 25 billion/month
- Writes: 50 million/month  
- Storage: 5GB
- More than enough for ERP usage
