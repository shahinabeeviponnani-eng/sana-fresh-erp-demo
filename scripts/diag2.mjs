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

// 1. Stock movements - check actual field names
const sm = await api('GET', '/api/stock');
const movements = sm.data.movements || [];
console.log('Total movements:', movements.length);
if (movements.length) {
  console.log('Movement sample:', JSON.stringify(movements[0]));
  const types = [...new Set(movements.map(m => m.movement_type || m.type))];
  console.log('Movement types:', types);
  const onionMoves = movements.filter(m => m.product_id === 8);
  console.log('Onion movements:', onionMoves.length);
}

// 2. PO amount_paid after partial payment
const pos = await api('GET', '/api/purchases');
const po = (pos.data.purchaseOrders || []).find(p => p.payment_status === 'PARTIAL' || p.payment_status === 'PAID');
if (po) console.log('PO amount_paid field:', po.amount_paid, '| all keys:', Object.keys(po));

// 3. Customer ledger - what does wholesale invoice entry look like?
const cl = await api('GET', '/api/ledger/customer/1');
const entries = cl.data.ledger || [];
console.log('Customer ledger entries:', entries.length);
entries.forEach(e => console.log(' entry:', e.type, '|', e.description, '| ref:', e.reference_number));

// 4. Customer balance after full settlement - what is it?
const cust = cl.data.customer;
console.log('Customer current_balance:', cust?.current_balance);
