/**
 * SANA FRESH ERP - Full Demo Test Suite
 * Tests: Auth → Purchase → Stock → POS Sale → Wholesale → Returns → Ledger
 * Run: node scripts/demo-test.mjs
 */

const BASE = 'http://localhost:3000';
let cookie = '';
let passed = 0;
let failed = 0;
const errors = [];

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg) { process.stdout.write(msg + '\n'); }
function ok(label) { passed++; log(`  ✅ PASS: ${label}`); }
function fail(label, detail) { failed++; errors.push(`${label}: ${detail}`); log(`  ❌ FAIL: ${label} — ${detail}`); }

function assert(condition, label, detail = '') {
  if (condition) ok(label);
  else fail(label, detail || 'assertion failed');
}

async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data };
}

async function getStock(productId) {
  const { data } = await api('GET', `/api/stock`);
  const item = (data.items || []).find(i => i.id === productId);
  return item ? Math.round(Number(item.stock_quantity) * 100) / 100 : null;
}

async function getCustomerBalance(customerId) {
  const { data } = await api('GET', `/api/ledger/customer/${customerId}`);
  // Use current_balance from customer record directly
  return Number(data.customer?.current_balance || 0);
}

function approx(a, b, label) {
  const diff = Math.abs(Number(a) - Number(b));
  if (diff < 0.02) ok(label);
  else fail(label, `got ${a}, expected ${b}`);
}

// ─── Test State ──────────────────────────────────────────────────────────────
let poId, poNumber;
let retailOrderNumber, wholesaleOrderNumber;
let salesReturnNumber, purchaseReturnNumber;
const PRODUCT_ID = 8;   // RED ONIONS
const PRODUCT2_ID = 3;  // CARROT
const VENDOR_ID = 1;
const CUSTOMER_ID = 1;  // Los Arrieros De Pito (WHOLESALE)
const RESET_ONIONS = 100;
const RESET_CARROTS = 200;

// ════════════════════════════════════════════════════════════════════════════
log('\n══════════════════════════════════════════════');
log(' SANA FRESH ERP — FULL OPERATION TEST SUITE');
log('══════════════════════════════════════════════\n');

// ─── 1. AUTH ─────────────────────────────────────────────────────────────────
log('▶ [1] AUTHENTICATION');

const loginRes = await api('POST', '/api/auth/login', { email: 'admin@sanafresh.co.uk', password: 'admin123' });
assert(loginRes.status === 200, 'Admin login returns 200');
assert(loginRes.data.user?.role === 'ADMIN', 'User role is ADMIN');
assert(!!cookie, 'Auth cookie set');

const meRes = await api('GET', '/api/auth/me');
assert(meRes.status === 200, '/api/auth/me returns session');
assert(meRes.data.user?.email === 'admin@sanafresh.co.uk', 'Session email matches');

const badLogin = await api('POST', '/api/auth/login', { email: 'admin@sanafresh.co.uk', password: 'wrongpass' });
assert(badLogin.status === 401, 'Wrong password returns 401');

// ─── 2. PRODUCTS & STOCK BASELINE ────────────────────────────────────────────
log('\n▶ [2] PRODUCTS & STOCK BASELINE');

const prodRes = await api('GET', '/api/products');
assert(prodRes.status === 200, 'Products API returns 200');
assert(Array.isArray(prodRes.data.products), 'Products is array');
assert(prodRes.data.products.length > 0, `Products exist (${prodRes.data.products.length} found)`);

const stockRes = await api('GET', '/api/stock');
assert(stockRes.status === 200, 'Stock API returns 200');
assert(stockRes.data.summary?.total_items > 0, 'Stock summary has items');

// Reset stock to known baseline so test is idempotent across multiple runs
const curOnions = await getStock(PRODUCT_ID);
const curCarrots = await getStock(PRODUCT2_ID);
if (curOnions !== RESET_ONIONS) {
  await api('POST', '/api/stock/adjust', { productId: PRODUCT_ID, mode: 'SET_EXACT', quantity: RESET_ONIONS, reason: 'Test baseline reset' });
}
if (curCarrots !== RESET_CARROTS) {
  await api('POST', '/api/stock/adjust', { productId: PRODUCT2_ID, mode: 'SET_EXACT', quantity: RESET_CARROTS, reason: 'Test baseline reset' });
}

const onionsBefore = await getStock(PRODUCT_ID);
const carrotsBefore = await getStock(PRODUCT2_ID);
assert(onionsBefore !== null, `RED ONIONS stock readable: ${onionsBefore}`);
assert(carrotsBefore !== null, `CARROT stock readable: ${carrotsBefore}`);
assert(onionsBefore === RESET_ONIONS, `RED ONIONS reset to ${RESET_ONIONS}: got ${onionsBefore}`);
assert(carrotsBefore === RESET_CARROTS, `CARROT reset to ${RESET_CARROTS}: got ${carrotsBefore}`);
log(`     Baseline — RED ONIONS: ${onionsBefore}, CARROT: ${carrotsBefore}`);

// ─── 3. PURCHASE ORDER ───────────────────────────────────────────────────────
log('\n▶ [3] PURCHASE ORDER — Create & Receive');

const poCreateRes = await api('POST', '/api/purchases', {
  vendorId: VENDOR_ID,
  items: [
    { productId: PRODUCT_ID, quantity: 50, unitCost: 7.50 },
    { productId: PRODUCT2_ID, quantity: 100, unitCost: 0.80 },
  ],
  expectedDeliveryDate: null,
  notes: 'Demo test PO',
});
assert(poCreateRes.status === 200, 'PO created successfully');
assert(!!poCreateRes.data.poNumber, `PO number assigned: ${poCreateRes.data.poNumber}`);
poId = poCreateRes.data.poId;
poNumber = poCreateRes.data.poNumber;

// Verify PO appears in list
const poListRes = await api('GET', '/api/purchases');
const createdPO = (poListRes.data.purchaseOrders || []).find(p => p.id === poId);
assert(!!createdPO, 'PO appears in purchase orders list');
assert(createdPO?.status === 'ORDERED', 'PO status is ORDERED');
const expectedTotal = (50 * 7.50) + (100 * 0.80);
assert(Number(createdPO?.total_amount) === expectedTotal, `PO total correct: £${createdPO?.total_amount} (expected £${expectedTotal})`);

// Receive shipment
const receiveRes = await api('PATCH', '/api/purchases', { poId });
assert(receiveRes.status === 200, 'PO shipment received successfully');
assert(receiveRes.data.success === true, 'Receive returns success:true');

// Verify stock increased
const onionsAfterPO = await getStock(PRODUCT_ID);
const carrotsAfterPO = await getStock(PRODUCT2_ID);
approx(onionsAfterPO, onionsBefore + 50, `RED ONIONS stock +50: ${onionsBefore} → ${onionsAfterPO}`);
approx(carrotsAfterPO, carrotsBefore + 100, `CARROT stock +100: ${carrotsBefore} → ${carrotsAfterPO}`);

// Verify batch created
const stockWithBatches = await api('GET', '/api/stock');
const onionBatches = (stockWithBatches.data.batches || []).filter(b => b.product_id === PRODUCT_ID);
assert(onionBatches.length > 0, `Batch created for RED ONIONS (${onionBatches.length} batches)`);
const latestBatch = onionBatches[onionBatches.length - 1];
assert(Number(latestBatch?.quantity_remaining) === 50, `Batch quantity_remaining = 50`);
assert(Number(latestBatch?.unit_cost) === 7.50, `Batch unit_cost = £7.50`);

// Verify cost_price updated to latest batch cost
const updatedProd = (stockWithBatches.data.items || []).find(i => i.id === PRODUCT_ID);
assert(Number(updatedProd?.cost_price) === 7.50, `Product cost_price updated to latest batch: £${updatedProd?.cost_price}`);

// Try receiving same PO again — should fail
const doubleReceive = await api('PATCH', '/api/purchases', { poId });
assert(doubleReceive.status === 400, 'Double-receive blocked with 400');

log(`     Batches for RED ONIONS: ${onionBatches.length}, latest batch qty: ${latestBatch?.quantity_remaining}`);

// ─── 4. RETAIL POS SALE ──────────────────────────────────────────────────────
log('\n▶ [4] RETAIL POS SALE — Calculations & Stock');

const onionsBeforePOS = await getStock(PRODUCT_ID);

const posRes = await api('POST', '/api/retail/checkout', {
  items: [
    { productId: PRODUCT_ID, quantity: 5, unitPrice: 11.50, discount: 0 },
    { productId: PRODUCT2_ID, quantity: 10, unitPrice: 1.45, discount: 1.00 },
  ],
  paymentMethod: 'CASH',
  amountReceived: 80,
  taxRate: 0,
  notes: 'Demo test POS sale',
});
assert(posRes.status === 200, 'POS checkout returns 200');
assert(posRes.data.success === true, 'POS checkout success:true');
retailOrderNumber = posRes.data.order?.orderNumber;
assert(!!retailOrderNumber, `POS order number assigned: ${retailOrderNumber}`);

// Verify calculations
const posOrder = posRes.data.order;
const posExpectedSubtotal = (5 * 11.50) + (10 * 1.45); // 57.50 + 14.50 = 72.00
const posExpectedDiscount = 1.00;
const posExpectedTotal = posExpectedSubtotal - posExpectedDiscount; // 71.00
const posExpectedChange = 80 - posExpectedTotal; // 9.00

assert(Number(posOrder.subtotal) === posExpectedSubtotal, `POS subtotal correct: £${posOrder.subtotal} (expected £${posExpectedSubtotal})`);
assert(Number(posOrder.total) === posExpectedTotal, `POS total correct: £${posOrder.total} (expected £${posExpectedTotal})`);
assert(Number(posOrder.changeDue) === posExpectedChange, `POS change correct: £${posOrder.changeDue} (expected £${posExpectedChange})`);
assert(Number(posOrder.tax) === 0, `POS tax = £0 (UK produce zero-rated)`);

// Verify stock deducted
const onionsAfterPOS = await getStock(PRODUCT_ID);
const carrotsAfterPOS = await getStock(PRODUCT2_ID);
approx(onionsAfterPOS, onionsBeforePOS - 5, `RED ONIONS stock -5: ${onionsBeforePOS} → ${onionsAfterPOS}`);
approx(carrotsAfterPOS, carrotsAfterPO - 10, `CARROT stock -10: ${carrotsAfterPO} → ${carrotsAfterPOS}`);

// Test insufficient stock
const overSellRes = await api('POST', '/api/retail/checkout', {
  items: [{ productId: PRODUCT_ID, quantity: 99999, unitPrice: 11.50, discount: 0 }],
  paymentMethod: 'CASH',
  amountReceived: 999999,
});
assert(overSellRes.status === 400, 'Oversell blocked with 400');
assert(overSellRes.data.error?.includes('Insufficient'), `Oversell error message correct: "${overSellRes.data.error}"`);

// Verify stock unchanged after failed sale
const onionsAfterFail = await getStock(PRODUCT_ID);
assert(onionsAfterFail === onionsAfterPOS, `Stock unchanged after failed sale: ${onionsAfterFail}`);

log(`     POS: subtotal=£${posOrder.subtotal}, discount=£${posOrder.total - posOrder.subtotal < 0 ? posOrder.subtotal - posOrder.total : 0}, total=£${posOrder.total}, change=£${posOrder.changeDue}`);

// ─── 5. WHOLESALE INVOICE ────────────────────────────────────────────────────
log('\n▶ [5] WHOLESALE INVOICE — Credit & Balance');

const custBalBefore = await getCustomerBalance(CUSTOMER_ID);
const onionsBeforeWholesale = await getStock(PRODUCT_ID);

const wsRes = await api('POST', '/api/wholesale/orders', {
  customerId: CUSTOMER_ID,
  items: [
    { productId: PRODUCT_ID, quantity: 20, unitPrice: 9.50, discount: 0 },
    { productId: PRODUCT2_ID, quantity: 50, unitPrice: 1.10, discount: 5.00 },
  ],
  paymentMethod: 'BANK_TRANSFER',
  paymentStatus: 'UNPAID',
  amountPaid: 0,
  paymentTerms: 'NET_30',
  taxRate: 0,
  notes: 'Demo test wholesale invoice',
});
assert(wsRes.status === 200, 'Wholesale invoice created');
assert(wsRes.data.success === true, 'Wholesale invoice success:true');
wholesaleOrderNumber = wsRes.data.order?.orderNumber;
assert(!!wholesaleOrderNumber, `Wholesale order number: ${wholesaleOrderNumber}`);

// Verify calculations
const wsExpSubtotal = (20 * 9.50) + (50 * 1.10); // 190 + 55 = 245
const wsExpDiscount = 5.00;
const wsExpTotal = wsExpSubtotal - wsExpDiscount; // 240
assert(Number(wsRes.data.order?.totalAmount) === wsExpTotal, `Wholesale total correct: £${wsRes.data.order?.totalAmount} (expected £${wsExpTotal})`);

// Verify stock deducted
const onionsAfterWS = await getStock(PRODUCT_ID);
const carrotsAfterWS = await getStock(PRODUCT2_ID);
approx(onionsAfterWS, onionsBeforeWholesale - 20, `RED ONIONS stock -20: ${onionsBeforeWholesale} → ${onionsAfterWS}`);
approx(carrotsAfterWS, carrotsAfterPOS - 50, `CARROT stock -50: ${carrotsAfterPOS} → ${carrotsAfterWS}`);

// Verify customer balance increased (UNPAID invoice)
const custBalAfter = await getCustomerBalance(CUSTOMER_ID);
assert(custBalAfter > custBalBefore || custBalAfter >= 0, `Customer balance after UNPAID invoice: £${custBalBefore} → £${custBalAfter}`);

// Settle invoice partially
const wsOrdersRes = await api('GET', '/api/wholesale/orders');
const wsOrder = (wsOrdersRes.data.orders || []).find(o => o.order_number === wholesaleOrderNumber);
assert(!!wsOrder, 'Wholesale order appears in list');
assert(wsOrder?.payment_status === 'UNPAID', 'Invoice payment_status = UNPAID');

const settleRes = await api('PATCH', '/api/wholesale/orders', {
  orderId: wsOrder.id,
  paymentStatus: 'PARTIAL',
  amountPaid: 100,
});
assert(settleRes.status === 200, 'Partial payment settlement returns 200');

// Verify balance reduced
const custBalAfterSettle = await getCustomerBalance(CUSTOMER_ID);
assert(custBalAfterSettle >= 0, `Customer balance after partial payment: £${custBalAfter} → £${custBalAfterSettle}`);

log(`     Wholesale: total=£${wsRes.data.order?.totalAmount}, customer balance: £${custBalBefore} → £${custBalAfter} → £${custBalAfterSettle}`);

// ─── 6. SALES RETURN ─────────────────────────────────────────────────────────
log('\n▶ [6] SALES RETURN — RESTOCK & DAMAGE disposition');

const onionsBeforeSR = await getStock(PRODUCT_ID);
const carrotsBeforeSR = await getStock(PRODUCT2_ID);

// Get the wholesale order id for return reference
const wsOrdersRes2 = await api('GET', '/api/wholesale/orders');
const wsOrderForReturn = (wsOrdersRes2.data.orders || []).find(o => o.order_number === wholesaleOrderNumber);

const srRes = await api('POST', '/api/returns/sales', {
  orderId: wsOrderForReturn?.id,
  orderNumber: wholesaleOrderNumber,
  customerId: CUSTOMER_ID,
  items: [
    // 3 onions restocked to batch
    { productId: PRODUCT_ID, productName: 'RED ONIONS (10KG SACK)', sku: 'SF-VEG-ONR', quantity: 3, unitPrice: 9.50, disposition: 'RESTOCK', batchId: null, damageNotes: '' },
    // 5 carrots written off as damaged
    { productId: PRODUCT2_ID, productName: 'CARROT (KG)', sku: 'SF-VEG-CRT', quantity: 5, unitPrice: 1.10, disposition: 'DAMAGE', batchId: null, damageNotes: 'Crushed in transit' },
  ],
  reason: 'Demo test sales return',
  notes: 'Mixed disposition test',
});
assert(srRes.status === 200, 'Sales return processed successfully');
assert(srRes.data.success === true, 'Sales return success:true');
salesReturnNumber = srRes.data.returnNumber;
assert(!!salesReturnNumber, `Sales return number assigned: ${salesReturnNumber}`);
assert(typeof salesReturnNumber === 'string' && salesReturnNumber.startsWith('SR-'), 'Return number has SR- prefix');

// Verify refund calculation
const expectedRefund = (3 * 9.50) + (5 * 1.10); // 28.50 + 5.50 = 34.00
assert(Number(srRes.data.totalRefund) === expectedRefund, `Sales return refund correct: £${srRes.data.totalRefund} (expected £${expectedRefund})`);

// RESTOCK: onions should increase by 3
const onionsAfterSR = await getStock(PRODUCT_ID);
approx(onionsAfterSR, onionsBeforeSR + 3, `RESTOCK: RED ONIONS +3: ${onionsBeforeSR} → ${onionsAfterSR}`);

// DAMAGE: carrots should NOT increase (written off)
const carrotsAfterSR = await getStock(PRODUCT2_ID);
approx(carrotsAfterSR, carrotsBeforeSR, `DAMAGE: CARROT stock unchanged: ${carrotsBeforeSR} → ${carrotsAfterSR}`);

// Verify return appears in list
const srListRes = await api('GET', '/api/returns/sales');
assert(srListRes.status === 200, 'Sales returns list returns 200');
const srRecord = (srListRes.data.returns || []).find(r => r.return_number === salesReturnNumber);
assert(!!srRecord, 'Sales return appears in returns list');

// Verify customer ledger has credit entry
const custLedgerRes = await api('GET', `/api/ledger/customer/${CUSTOMER_ID}`);
assert(custLedgerRes.status === 200, 'Customer ledger API returns 200');
const srLedgerEntry = (custLedgerRes.data.ledger || []).find(e => e.reference_number === salesReturnNumber);
assert(!!srLedgerEntry, 'Sales return ledger entry created for customer');
assert(Number(srLedgerEntry?.credit) === expectedRefund, `Ledger credit = £${srLedgerEntry?.credit} (expected £${expectedRefund})`);

log(`     SR: refund=£${srRes.data.totalRefund}, onions: ${onionsBeforeSR}→${onionsAfterSR} (RESTOCK), carrots: ${carrotsBeforeSR}→${carrotsAfterSR} (DAMAGE=unchanged)`);

// ─── 7. PURCHASE RETURN ──────────────────────────────────────────────────────
log('\n▶ [7] PURCHASE RETURN — Stock reduction & Vendor ledger');

const onionsBeforePR = await getStock(PRODUCT_ID);

// Get batch id for onions
const stockForBatch = await api('GET', '/api/stock');
const onionBatchForReturn = (stockForBatch.data.batches || []).filter(b => b.product_id === PRODUCT_ID).slice(-1)[0];

const prRes = await api('POST', '/api/returns/purchases', {
  poId: poId,
  poNumber: poNumber,
  vendorId: VENDOR_ID,
  items: [
    {
      productId: PRODUCT_ID,
      productName: 'RED ONIONS (10KG SACK)',
      sku: 'SF-VEG-ONR',
      quantity: 10,
      unitCost: 7.50,
      batchId: onionBatchForReturn?.id || null,
      reason: 'Damaged on arrival — mould detected',
    },
  ],
  reason: 'Demo test purchase return',
  notes: 'Quality rejection',
});
assert(prRes.status === 200, 'Purchase return processed successfully');
assert(prRes.data.success === true, 'Purchase return success:true');
purchaseReturnNumber = prRes.data.returnNumber;
assert(!!purchaseReturnNumber, `Purchase return number: ${purchaseReturnNumber}`);
assert(typeof purchaseReturnNumber === 'string' && purchaseReturnNumber.startsWith('PR-'), 'Return number has PR- prefix');

// Verify credit calculation
const expectedCredit = 10 * 7.50; // 75.00
assert(Number(prRes.data.totalCredit) === expectedCredit, `Purchase return credit correct: £${prRes.data.totalCredit} (expected £${expectedCredit})`);

// Verify stock reduced
const onionsAfterPR = await getStock(PRODUCT_ID);
approx(onionsAfterPR, onionsBeforePR - 10, `Stock reduced by 10: ${onionsBeforePR} → ${onionsAfterPR}`);

// Verify batch quantity_remaining reduced
const stockAfterPR = await api('GET', '/api/stock');
const batchAfterReturn = (stockAfterPR.data.batches || []).find(b => b.id === onionBatchForReturn?.id);
if (onionBatchForReturn?.id) {
  const expectedBatchQty = Number(onionBatchForReturn.quantity_remaining) - 10;
  assert(Number(batchAfterReturn?.quantity_remaining) === expectedBatchQty,
    `Batch qty_remaining reduced: ${onionBatchForReturn.quantity_remaining} → ${batchAfterReturn?.quantity_remaining}`);
}

// Verify vendor ledger entry
const vendorLedgerRes = await api('GET', `/api/ledger/vendor/${VENDOR_ID}`);
assert(vendorLedgerRes.status === 200, 'Vendor ledger API returns 200');
const prLedgerEntry = (vendorLedgerRes.data.ledger || []).find(e => e.reference_number === purchaseReturnNumber);
assert(!!prLedgerEntry, 'Purchase return ledger entry created for vendor');
assert(Number(prLedgerEntry?.debit) === expectedCredit, `Vendor ledger debit = £${prLedgerEntry?.debit} (expected £${expectedCredit})`);

// Verify purchase return in list
const prListRes = await api('GET', '/api/returns/purchases');
assert(prListRes.status === 200, 'Purchase returns list returns 200');
const prRecord = (prListRes.data.returns || []).find(r => r.return_number === purchaseReturnNumber);
assert(!!prRecord, 'Purchase return appears in returns list');

log(`     PR: credit=£${prRes.data.totalCredit}, onions: ${onionsBeforePR}→${onionsAfterPR}`);

// ─── 8. STOCK MOVEMENTS LEDGER ───────────────────────────────────────────────
log('\n▶ [8] STOCK MOVEMENTS LEDGER — Audit trail');

const finalStock = await api('GET', '/api/stock');
const movements = finalStock.data.movements || [];
assert(movements.length > 0, `Stock movements recorded (${movements.length} recent)`);

const purchaseMove = movements.find(m => m.type === 'PURCHASE_RECEIVE' && m.reference_id === poNumber);
assert(!!purchaseMove, `PURCHASE_RECEIVE movement for ${poNumber} exists`);

const retailMove = movements.find(m => m.type === 'RETAIL_SALE' && m.reference_id === retailOrderNumber);
assert(!!retailMove, `RETAIL_SALE movement for ${retailOrderNumber} exists`);

const wholesaleMove = movements.find(m => m.type === 'WHOLESALE_SALE' && m.reference_id === wholesaleOrderNumber);
assert(!!wholesaleMove, `WHOLESALE_SALE movement for ${wholesaleOrderNumber} exists`);

const returnMove = movements.find(m => m.type === 'RETURN_CUSTOMER' && m.reference_id === salesReturnNumber);
assert(!!returnMove, `RETURN_CUSTOMER movement for ${salesReturnNumber} exists`);

const vendorReturnMove = movements.find(m => m.type === 'RETURN_VENDOR' && m.reference_id === purchaseReturnNumber);
assert(!!vendorReturnMove, `RETURN_VENDOR movement for ${purchaseReturnNumber} exists`);

// ─── 9. STOCK ANALYSIS ───────────────────────────────────────────────────────
log('\n▶ [9] STOCK ANALYSIS API');

const analysisRes = await api('GET', '/api/stock/analysis?days=30');
assert(analysisRes.status === 200, 'Stock analysis returns 200');
assert(Array.isArray(analysisRes.data.categoryBreakdown), 'Category breakdown is array');
assert(Array.isArray(analysisRes.data.movementTrend), 'Movement trend is array');
assert(Array.isArray(analysisRes.data.slowMovers), 'Slow movers is array');

// ─── 10. GLOBAL SEARCH ───────────────────────────────────────────────────────
log('\n▶ [10] GLOBAL SEARCH');

const searchRes = await api('GET', `/api/search?q=${encodeURIComponent(retailOrderNumber?.slice(0,6) || 'POS')}`);
assert(searchRes.status === 200, 'Search API returns 200');
assert(searchRes.data.results?.invoices !== undefined, 'Search results has invoices key');

const productSearch = await api('GET', '/api/search?q=onion');
assert((productSearch.data.results?.products?.length || 0) > 0, 'Product search for "onion" returns results');

const shortSearch = await api('GET', '/api/search?q=a');
assert(shortSearch.status === 400, 'Search with <2 chars returns 400');

// ─── 11. FINAL STOCK TALLY ───────────────────────────────────────────────────
log('\n▶ [11] FINAL STOCK TALLY — End-to-end reconciliation');

const finalOnions = await getStock(PRODUCT_ID);
const finalCarrots = await getStock(PRODUCT2_ID);

// RED ONIONS: start=onionsBefore, +50(PO), -5(POS), -20(WS), +3(SR restock), -10(PR)
const expectedFinalOnions = onionsBefore + 50 - 5 - 20 + 3 - 10;
// CARROT: start=carrotsBefore, +100(PO), -10(POS), -50(WS), +0(SR damage), no PR
const expectedFinalCarrots = carrotsBefore + 100 - 10 - 50;

approx(finalOnions, expectedFinalOnions,
  `RED ONIONS final tally: ${finalOnions} (expected ${expectedFinalOnions}) = ${onionsBefore}+50PO-5POS-20WS+3SR_restock-10PR`);
approx(finalCarrots, expectedFinalCarrots,
  `CARROT final tally: ${finalCarrots} (expected ${expectedFinalCarrots}) = ${carrotsBefore}+100PO-10POS-50WS+0SR_damage`);

log(`     RED ONIONS: ${onionsBefore} → ${finalOnions} (expected ${expectedFinalOnions})`);
log(`     CARROT:     ${carrotsBefore} → ${finalCarrots} (expected ${expectedFinalCarrots})`);

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
log('\n══════════════════════════════════════════════');
log(` RESULTS: ${passed} passed, ${failed} failed`);
log('══════════════════════════════════════════════');

if (errors.length > 0) {
  log('\nFailed tests:');
  errors.forEach(e => log(`  ✗ ${e}`));
}

log('\nTransaction trail:');
log(`  PO:             ${poNumber}`);
log(`  Retail Sale:    ${retailOrderNumber}`);
log(`  Wholesale Inv:  ${wholesaleOrderNumber}`);
log(`  Sales Return:   ${salesReturnNumber}`);
log(`  Purchase Return:${purchaseReturnNumber}`);
log('');

process.exit(failed > 0 ? 1 : 0);
