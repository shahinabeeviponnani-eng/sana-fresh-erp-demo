const BASE = 'http://localhost:3000';
let cookie = '';
async function api(m, p, b = null) {
  const o = { method: m, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) } };
  if (b) o.body = JSON.stringify(b);
  const r = await fetch(BASE + p, o);
  if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
  let d; try { d = await r.json(); } catch { d = {}; }
  return { status: r.status, data: d };
}
await api('POST', '/api/auth/login', { email: 'admin@sanafresh.co.uk', password: 'admin123' });

// 1. Underpayment
const up = await api('POST', '/api/retail/checkout', {
  items: [{ productId: 8, quantity: 1, unitPrice: 11.50, discount: 0 }],
  paymentMethod: 'CASH', amountReceived: 5,
});
console.log('UNDERPAY:', up.status, JSON.stringify(up.data));

// 2. Vendor PUT (use a real received PO id)
const pos = await api('GET', '/api/purchases');
const receivedPO = (pos.data.purchaseOrders || []).find(p => p.status === 'RECEIVED' && p.payment_status === 'UNPAID');
console.log('Found RECEIVED+UNPAID PO:', receivedPO?.id, receivedPO?.po_number);
if (receivedPO) {
  const vp = await api('PUT', '/api/purchases', { poId: receivedPO.id, amountPaid: 100, paymentMethod: 'BANK_TRANSFER', notes: 'test' });
  console.log('VENDOR PUT:', vp.status, JSON.stringify(vp.data));
}

// 3. Vendor ledger structure
const vl = await api('GET', '/api/ledger/vendor/1');
console.log('VENDOR LEDGER keys:', Object.keys(vl.data));
console.log('orders:', Array.isArray(vl.data.orders), '| purchaseOrders:', Array.isArray(vl.data.purchaseOrders));
if (vl.data.orders) console.log('orders sample:', JSON.stringify(vl.data.orders[0]));
if (vl.data.purchaseOrders) console.log('purchaseOrders sample:', JSON.stringify(vl.data.purchaseOrders[0]));

// 4. Customer ledger - check if wholesale invoice entry exists
const cl = await api('GET', '/api/ledger/customer/1');
console.log('CUSTOMER LEDGER keys:', Object.keys(cl.data));
const entries = cl.data.ledger || [];
console.log('Ledger entries count:', entries.length);
if (entries.length) console.log('First entry:', JSON.stringify(entries[0]));

// 5. Sales return - check if RESTOCK actually updates stock
const sr = await api('GET', '/api/stock');
const onion = (sr.data.items || []).find(i => i.id === 8);
console.log('Current onion stock:', onion?.stock_quantity);
