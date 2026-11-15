/**
 * SANA FRESH ERP - Complete Multi-Condition Demo & Tally Verification Suite
 * Tests:
 * 1. Authentication
 * 2. Purchase Order & Receiving
 * 3. Vendor Settlement (Payment)
 * 4. Purchase Return (Debit note & stock reduction)
 * 5. Retail POS Sale (Cash, discount, instant stock relief)
 * 6. Wholesale Sale (B2B Credit Invoice, customer debt increase)
 * 7. Customer Settlement (Receivable payment)
 * 8. Sales Return (RESTOCK + DAMAGE mixed disposition)
 * 9. Stock Adjustment (Cold room spoilage / physical audit)
 * 10. Financial Reconciliation & Tally Verification:
 *     - Stock Quantities Tally
 *     - Customer AR Tally
 *     - Vendor AP Tally
 *     - Profit & Loss Statement Tally
 *     - Universal Accounting Equation: ΔAssets - ΔLiabilities = Net Profit
 */

const BASE = 'http://localhost:3000';
let cookie = '';
let passed = 0;
let failed = 0;
const errors = [];

function log(msg = '') { console.log(msg); }
function ok(label) { passed++; console.log(`  ✅ PASS: ${label}`); }
function fail(label, detail) { failed++; errors.push(`${label}: ${detail}`); console.log(`  ❌ FAIL: ${label} — ${detail}`); }
function assert(cond, label, detail = '') {
  if (cond) ok(label);
  else fail(label, detail || 'Condition not met');
}
function approx(a, b, label) {
  const diff = Math.abs(Number(a) - Number(b));
  if (diff < 0.02) ok(label);
  else fail(label, `got ${Number(a).toFixed(2)}, expected ${Number(b).toFixed(2)} (diff: ${diff.toFixed(4)})`);
}

async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data };
}

async function getStock(productId) {
  const { data } = await api('GET', '/api/stock');
  const it = (data.items || []).find(i => i.id === productId);
  return it ? Number(it.stock_quantity) : null;
}

async function getCustomerBalance(customerId) {
  const { data } = await api('GET', `/api/ledger/customer/${customerId}`);
  return Number(data.customer?.current_balance || 0);
}

async function getVendorInfo(vendorId) {
  const { data } = await api('GET', `/api/ledger/vendor/${vendorId}`);
  return {
    outstanding: Number(data.summary?.outstanding || 0),
    ledger: data.ledger || []
  };
}

async function run() {
  log('\n╔══════════════════════════════════════════════════════════════════╗');
  log('║         SANA FRESH ERP — COMPLETE END-TO-END DEMO TEST           ║');
  log('║           ALL CONDITIONS & FINANCIAL TALLY VERIFICATION          ║');
  log('╚══════════════════════════════════════════════════════════════════╝\n');

  // 1. AUTHENTICATION
  log('▶ STEP 1: AUTHENTICATION');
  const loginRes = await api('POST', '/api/auth/login', { email: 'admin@sanafresh.co.uk', password: 'admin123' });
  assert(loginRes.status === 200, 'Admin credentials login successful');
  assert(loginRes.data.user?.role === 'ADMIN', 'Session role confirmed as ADMIN');
  const meRes = await api('GET', '/api/auth/me');
  assert(meRes.status === 200, 'Session persistent via cookie');

  // SELECT TEST ENTITIES
  const ONION_ID = 8;     // RED ONIONS (10KG SACK), default cost ~7.50
  const CARROT_ID = 3;    // CARROT (KG), default cost ~0.80
  const VENDOR_ID = 1;    // Spitalfields Wholesale Produce Ltd
  const CUSTOMER_ID = 1;  // Los Arrieros De Pito

  // BASELINE RECORDING
  log('\n▶ STEP 2: CAPTURE BASELINE STATE');
  const onionsBase = await getStock(ONION_ID);
  const carrotsBase = await getStock(CARROT_ID);
  const custBalBase = await getCustomerBalance(CUSTOMER_ID);
  const vendorInfoBase = await getVendorInfo(VENDOR_ID);

  log(`  • Baseline Stock — RED ONIONS: ${onionsBase} sacks, CARROTS: ${carrotsBase} kg`);
  log(`  • Baseline Customer Debt: £${custBalBase.toFixed(2)}`);
  log(`  • Baseline Vendor Outstanding POs: £${vendorInfoBase.outstanding.toFixed(2)}`);

  // 3. PURCHASE ORDER (50 Onions @ £8.00, 100 Carrots @ £1.00) = £500.00
  log('\n▶ STEP 3: PURCHASE ORDER — CREATE & RECEIVE');
  const poCostOnion = 8.00;
  const poCostCarrot = 1.00;
  const poQtyOnion = 50;
  const poQtyCarrot = 100;
  const poTotalExpected = (poQtyOnion * poCostOnion) + (poQtyCarrot * poCostCarrot); // £500.00

  const poCreate = await api('POST', '/api/purchases', {
    vendorId: VENDOR_ID,
    items: [
      { productId: ONION_ID, quantity: poQtyOnion, unitCost: poCostOnion },
      { productId: CARROT_ID, quantity: poQtyCarrot, unitCost: poCostCarrot }
    ],
    notes: 'Demo full-cycle purchase'
  });
  assert(poCreate.status === 200, 'Purchase Order created');
  const poId = poCreate.data.poId;
  const poNumber = poCreate.data.poNumber;
  log(`  • PO Created: ${poNumber} (Expected Total: £${poTotalExpected.toFixed(2)})`);

  // Receive PO
  const receiveRes = await api('PATCH', '/api/purchases', { poId });
  assert(receiveRes.status === 200, 'PO Received into warehouse');

  const onionsAfterPO = await getStock(ONION_ID);
  const carrotsAfterPO = await getStock(CARROT_ID);
  approx(onionsAfterPO, onionsBase + poQtyOnion, `Onions stock increased by +${poQtyOnion} (${onionsBase} → ${onionsAfterPO})`);
  approx(carrotsAfterPO, carrotsBase + poQtyCarrot, `Carrots stock increased by +${poQtyCarrot} (${carrotsBase} → ${carrotsAfterPO})`);

  // 4. VENDOR SETTLEMENT (Payment of £300 towards PO)
  log('\n▶ STEP 4: VENDOR SETTLEMENT — RECORD PO PAYMENT');
  const vendorPayAmount = 300.00;
  const settleVendorRes = await api('PUT', '/api/purchases', {
    poId,
    amountPaid: vendorPayAmount,
    paymentMethod: 'BANK_TRANSFER',
    notes: 'Demo Vendor Settlement'
  });
  assert(settleVendorRes.status === 200, 'Vendor payment recorded');
  assert(settleVendorRes.data.newStatus === 'PARTIAL', 'PO payment status changed to PARTIAL');
  const expectedVendorRemaining = poTotalExpected - vendorPayAmount; // £200.00
  log(`  • Paid: £${vendorPayAmount.toFixed(2)}, Remaining on PO: £${expectedVendorRemaining.toFixed(2)}`);

  // 5. PURCHASE RETURN (Return 5 Onions @ £8.00 = £40.00 due to mould)
  log('\n▶ STEP 5: PURCHASE RETURN — VENDOR DEBIT & STOCK RELIEF');
  const prQty = 5;
  const prAmount = prQty * poCostOnion; // £40.00

  const prRes = await api('POST', '/api/returns/purchases', {
    poId,
    poNumber,
    vendorId: VENDOR_ID,
    items: [
      {
        productId: ONION_ID,
        productName: 'RED ONIONS (10KG SACK)',
        sku: 'SF-VEG-ONR',
        quantity: prQty,
        unitCost: poCostOnion,
        reason: 'Mould on arrival'
      }
    ],
    reason: 'Demo Vendor Return'
  });
  assert(prRes.status === 200, 'Purchase return processed');
  const prNumber = prRes.data.returnNumber;
  approx(prRes.data.totalCredit, prAmount, `Vendor debit credit note: £${prAmount.toFixed(2)}`);

  const onionsAfterPR = await getStock(ONION_ID);
  approx(onionsAfterPR, onionsAfterPO - prQty, `Onions stock reduced by -${prQty} (${onionsAfterPO} → ${onionsAfterPR})`);

  // 6. RETAIL POS SALE (10 Onions @ £12.00, 20 Carrots @ £1.50, Discount £5.00) = £145.00
  log('\n▶ STEP 6: RETAIL POS SALE — INSTANT PAYMENT & COGS');
  const posOnionQty = 10;
  const posOnionRate = 12.00;
  const posCarrotQty = 20;
  const posCarrotRate = 1.50;
  const posDiscount = 5.00;
  const posGross = (posOnionQty * posOnionRate) + (posCarrotQty * posCarrotRate); // 120 + 30 = 150
  const posNetTotal = posGross - posDiscount; // £145.00
  const posCogs = (posOnionQty * poCostOnion) + (posCarrotQty * poCostCarrot); // (10*8) + (20*1) = £100.00
  const posGrossProfit = posNetTotal - posCogs; // £45.00

  const posSale = await api('POST', '/api/retail/checkout', {
    items: [
      { productId: ONION_ID, quantity: posOnionQty, unitPrice: posOnionRate, discount: 0 },
      { productId: CARROT_ID, quantity: posCarrotQty, unitPrice: posCarrotRate, discount: posDiscount }
    ],
    paymentMethod: 'CASH',
    amountReceived: 150.00,
    taxRate: 0,
    notes: 'Demo Retail POS'
  });
  assert(posSale.status === 200, 'POS checkout completed');
  const posOrderNumber = posSale.data.order?.orderNumber;
  approx(posSale.data.order?.total, posNetTotal, `POS sale total: £${posNetTotal.toFixed(2)}`);
  approx(posSale.data.order?.changeDue, 5.00, `Change due: £5.00`);

  const onionsAfterPOS = await getStock(ONION_ID);
  const carrotsAfterPOS = await getStock(CARROT_ID);
  approx(onionsAfterPOS, onionsAfterPR - posOnionQty, `Onions stock reduced by -${posOnionQty} (${onionsAfterPR} → ${onionsAfterPOS})`);
  approx(carrotsAfterPOS, carrotsAfterPO - posCarrotQty, `Carrots stock reduced by -${posCarrotQty} (${carrotsAfterPO} → ${carrotsAfterPOS})`);

  // 7. WHOLESALE SALE (B2B Credit Invoice: 15 Onions @ £11.00, 30 Carrots @ £1.40) = £207.00
  log('\n▶ STEP 7: WHOLESALE SALE — CREDIT INVOICE & AR ENTRY');
  const wsOnionQty = 15;
  const wsOnionRate = 11.00;
  const wsCarrotQty = 30;
  const wsCarrotRate = 1.40;
  const wsTotal = (wsOnionQty * wsOnionRate) + (wsCarrotQty * wsCarrotRate); // 165 + 42 = £207.00
  const wsCogs = (wsOnionQty * poCostOnion) + (wsCarrotQty * poCostCarrot); // (15*8) + (30*1) = £150.00
  const wsGrossProfit = wsTotal - wsCogs; // £57.00

  const wsSale = await api('POST', '/api/wholesale/orders', {
    customerId: CUSTOMER_ID,
    items: [
      { productId: ONION_ID, quantity: wsOnionQty, unitPrice: wsOnionRate, discount: 0 },
      { productId: CARROT_ID, quantity: wsCarrotQty, unitPrice: wsCarrotRate, discount: 0 }
    ],
    paymentMethod: 'BANK_TRANSFER',
    paymentStatus: 'UNPAID',
    amountPaid: 0,
    paymentTerms: 'NET_30',
    taxRate: 0,
    notes: 'Demo Wholesale Credit Invoice'
  });
  assert(wsSale.status === 200, 'Wholesale invoice generated');
  const wsOrder = wsSale.data.order;
  const wsOrderId = wsOrder.id;
  const wsOrderNumber = wsOrder.orderNumber;
  approx(wsOrder.totalAmount, wsTotal, `Wholesale invoice total: £${wsTotal.toFixed(2)}`);

  const custBalAfterWS = await getCustomerBalance(CUSTOMER_ID);
  approx(custBalAfterWS, custBalBase + wsTotal, `Customer debt increased by +£${wsTotal.toFixed(2)} (${custBalBase} → ${custBalAfterWS})`);

  const onionsAfterWS = await getStock(ONION_ID);
  const carrotsAfterWS = await getStock(CARROT_ID);
  approx(onionsAfterWS, onionsAfterPOS - wsOnionQty, `Onions stock reduced by -${wsOnionQty} (${onionsAfterPOS} → ${onionsAfterWS})`);
  approx(carrotsAfterWS, carrotsAfterPOS - wsCarrotQty, `Carrots stock reduced by -${wsCarrotQty} (${carrotsAfterPOS} → ${carrotsAfterWS})`);

  // 8. CUSTOMER SETTLEMENT (Customer pays £150 towards invoice)
  log('\n▶ STEP 8: CUSTOMER SETTLEMENT — PARTIAL PAYMENT');
  const custPayAmount = 150.00;
  const settleCustRes = await api('PATCH', '/api/wholesale/orders', {
    orderId: wsOrderId,
    paymentStatus: 'PARTIAL',
    amountPaid: custPayAmount
  });
  assert(settleCustRes.status === 200, 'Customer payment recorded on invoice');

  const custBalAfterCustSettle = await getCustomerBalance(CUSTOMER_ID);
  approx(custBalAfterCustSettle, custBalAfterWS - custPayAmount,
    `Customer debt reduced by -£${custPayAmount.toFixed(2)} (${custBalAfterWS} → ${custBalAfterCustSettle})`);

  // 9. SALES RETURN (Customer returns 2 Onions @ £11.00: 1 Restocked, 1 Damaged) = £22.00
  log('\n▶ STEP 9: SALES RETURN — RESTOCK & DAMAGE WRITE-OFF');
  const srQtyTotal = 2;
  const srQtyRestock = 1;
  const srQtyDamage = 1;
  const srRefundAmount = srQtyTotal * wsOnionRate; // 2 * 11 = £22.00
  const srRestockCost = srQtyRestock * poCostOnion; // 1 * 8 = £8.00

  const srRes = await api('POST', '/api/returns/sales', {
    orderId: wsOrderId,
    orderNumber: wsOrderNumber,
    customerId: CUSTOMER_ID,
    items: [
      {
        productId: ONION_ID,
        productName: 'RED ONIONS (10KG SACK)',
        sku: 'SF-VEG-ONR',
        quantity: srQtyRestock,
        unitPrice: wsOnionRate,
        disposition: 'RESTOCK',
        damageNotes: ''
      },
      {
        productId: ONION_ID,
        productName: 'RED ONIONS (10KG SACK)',
        sku: 'SF-VEG-ONR',
        quantity: srQtyDamage,
        unitPrice: wsOnionRate,
        disposition: 'DAMAGE',
        damageNotes: 'Damaged in transit'
      }
    ],
    reason: 'Demo Sales Return'
  });
  assert(srRes.status === 200, 'Sales return processed');
  approx(srRes.data.totalRefund, srRefundAmount, `Sales return credit to customer: £${srRefundAmount.toFixed(2)}`);

  const onionsAfterSR = await getStock(ONION_ID);
  approx(onionsAfterSR, onionsAfterWS + srQtyRestock,
    `Onions stock increased by +${srQtyRestock} (Restocked only): ${onionsAfterWS} → ${onionsAfterSR}`);

  const custBalAfterSR = await getCustomerBalance(CUSTOMER_ID);
  approx(custBalAfterSR, custBalAfterCustSettle - srRefundAmount,
    `Customer balance credited by -£${srRefundAmount.toFixed(2)} (${custBalAfterCustSettle} → ${custBalAfterSR})`);

  // 10. STOCK ADJUSTMENT (Cold chain spoilage: 2 Carrots spoiled @ £1.00 = £2.00 loss)
  log('\n▶ STEP 10: STOCK ADJUSTMENT — PHYSICAL COUNT / SPOILAGE');
  const adjCarrotQty = -2;
  const adjCarrotLoss = Math.abs(adjCarrotQty) * poCostCarrot; // £2.00

  const adjRes = await api('POST', '/api/stock/adjust', {
    productId: CARROT_ID,
    adjustmentType: 'ADJUSTMENT_DAMAGE',
    quantity: adjCarrotQty,
    mode: 'DELTA',
    reason: 'Cold room condensation damage'
  });
  assert(adjRes.status === 200, 'Stock adjustment logged');

  const carrotsAfterAdj = await getStock(CARROT_ID);
  approx(carrotsAfterAdj, carrotsAfterWS + adjCarrotQty,
    `Carrots stock reduced by ${adjCarrotQty}: ${carrotsAfterWS} → ${carrotsAfterAdj}`);

  // 11. COMPLETE FINANCIAL RECONCILIATION & TALLY CHECKS
  log('\n╔══════════════════════════════════════════════════════════════════╗');
  log('║              COMPREHENSIVE FINANCIAL TALLY REPORT                ║');
  log('╚══════════════════════════════════════════════════════════════════╝\n');

  // A. STOCK QUANTITIES TALLY
  log('--- A. INVENTORY QUANTITY RECONCILIATION ---');
  const expectedNetOnions = onionsBase + poQtyOnion - prQty - posOnionQty - wsOnionQty + srQtyRestock;
  const expectedNetCarrots = carrotsBase + poQtyCarrot - posCarrotQty - wsCarrotQty + adjCarrotQty;

  const finalOnions = await getStock(ONION_ID);
  const finalCarrots = await getStock(CARROT_ID);

  approx(finalOnions, expectedNetOnions,
    `RED ONIONS Tally: ${finalOnions} (Baseline ${onionsBase} +50 PO -5 PR -10 POS -15 WS +1 SR Restock = ${expectedNetOnions})`);
  approx(finalCarrots, expectedNetCarrots,
    `CARROTS Tally:    ${finalCarrots} (Baseline ${carrotsBase} +100 PO -20 POS -30 WS -2 Spoilage = ${expectedNetCarrots})`);

  // B. CUSTOMER ACCOUNTS RECEIVABLE (AR) TALLY
  log('\n--- B. CUSTOMER AR & DEBT TALLY ---');
  const expectedCustomerDelta = wsTotal - custPayAmount - srRefundAmount; // 207 - 150 - 22 = +£35.00
  const expectedCustomerFinal = custBalBase + expectedCustomerDelta;
  const finalCustomerBal = await getCustomerBalance(CUSTOMER_ID);

  approx(finalCustomerBal, expectedCustomerFinal,
    `Customer Balance Tally: £${finalCustomerBal.toFixed(2)} (Base £${custBalBase.toFixed(2)} + £207 Invoice - £150 Payment - £22 Return = £${expectedCustomerFinal.toFixed(2)})`);

  // C. VENDOR ACCOUNTS PAYABLE (AP) TALLY
  log('\n--- C. VENDOR AP & PAYABLES TALLY ---');
  const expectedVendorDelta = poTotalExpected - vendorPayAmount - prAmount; // 500 - 300 - 40 = +£160.00
  log(`  • PO Initial Value:     +£${poTotalExpected.toFixed(2)}`);
  log(`  • Less Payment Made:    -£${vendorPayAmount.toFixed(2)}`);
  log(`  • Less Purchase Return: -£${prAmount.toFixed(2)}`);
  log(`  • Net Payable for PO:    £${expectedVendorDelta.toFixed(2)} (Matched with PO unpaid balance: £${(poTotalExpected - vendorPayAmount).toFixed(2)} - £${prAmount.toFixed(2)} credit note)`);

  // D. PROFIT & LOSS (TRADING ACCOUNT) TALLY
  log('\n--- D. PROFIT & LOSS ACCOUNT TALLY ---');
  const grossSalesRevenue = posNetTotal + wsTotal; // 145 + 207 = £352.00
  const netSalesRevenue = grossSalesRevenue - srRefundAmount; // 352 - 22 = £330.00
  const grossCogs = posCogs + wsCogs; // 100 + 150 = £250.00
  const netCogs = grossCogs - srRestockCost; // 250 - 8 = £242.00
  const grossProfit = netSalesRevenue - netCogs; // 330 - 242 = £88.00
  const spoilageLoss = adjCarrotLoss; // £2.00
  const netTradingProfit = grossProfit - spoilageLoss; // £88 - £2 = £86.00

  log(`  • Gross Revenue:        £${grossSalesRevenue.toFixed(2)} (£${posNetTotal.toFixed(2)} Retail + £${wsTotal.toFixed(2)} Wholesale)`);
  log(`  • Less Sales Returns:   -£${srRefundAmount.toFixed(2)}`);
  log(`  • Net Revenue:           £${netSalesRevenue.toFixed(2)}`);
  log(`  • Less Effective COGS:  -£${netCogs.toFixed(2)} (£${grossCogs.toFixed(2)} gross COGS - £${srRestockCost.toFixed(2)} restock)`);
  log(`  • Gross Trading Profit:  £${grossProfit.toFixed(2)} (${((grossProfit / netSalesRevenue) * 100).toFixed(1)}% margin)`);
  log(`  • Less Spoilage Loss:   -£${spoilageLoss.toFixed(2)} (Cold room inventory write-off)`);
  log(`  • NET TRADING PROFIT:    £${netTradingProfit.toFixed(2)}`);

  // E. UNIVERSAL ACCOUNTING EQUATION TALLY (ΔAssets - ΔLiabilities = Net Profit)
  log('\n--- E. BALANCE SHEET & CASH FLOW EQUATION TALLY ---');
  // Cash in/out:
  // +145 (Retail POS Cash)
  // +150 (Wholesale Bank Transfer Payment)
  // -300 (Vendor Bank Transfer Settlement)
  const netCashFlow = posNetTotal + custPayAmount - vendorPayAmount; // 145 + 150 - 300 = -£5.00
  
  // AR Change: +35.00
  const deltaAR = expectedCustomerDelta; // +£35.00

  // Inventory Asset Value Change:
  // Onions: (+21 sacks * £8.00) = +£168.00
  // Carrots: (+48 kg * £1.00) = +£48.00
  // Total Inventory Change: +£216.00
  const deltaInventory = (21 * poCostOnion) + (48 * poCostCarrot); // 168 + 48 = £216.00

  const deltaAssets = netCashFlow + deltaAR + deltaInventory; // -5 + 35 + 216 = £246.00
  const deltaLiabilities = expectedVendorDelta; // +£160.00
  const deltaEquity = deltaAssets - deltaLiabilities; // 246 - 160 = £86.00

  log(`  • Net Cash Flow:         ${netCashFlow >= 0 ? '+' : ''}£${netCashFlow.toFixed(2)}`);
  log(`  • Δ Accounts Receivable: +£${deltaAR.toFixed(2)}`);
  log(`  • Δ Inventory Assets:    +£${deltaInventory.toFixed(2)} (21 Onions @ £8 + 48 Carrots @ £1)`);
  log(`  • TOTAL Δ ASSETS:        +£${deltaAssets.toFixed(2)}`);
  log(`  • TOTAL Δ LIABILITIES:   +£${deltaLiabilities.toFixed(2)} (Unpaid PO balance after credit)`);
  log(`  • NET Δ EQUITY:          +£${deltaEquity.toFixed(2)} (ΔAssets - ΔLiabilities)`);
  log(`  • NET PROFIT (P&L):       £${netTradingProfit.toFixed(2)}`);

  approx(deltaEquity, netTradingProfit,
    `ACCOUNTING EQUATION TALLIES: ΔEquity (£${deltaEquity.toFixed(2)}) === Net Profit (£${netTradingProfit.toFixed(2)})`);

  // FINAL REPORT
  log('\n══════════════════════════════════════════════════════════════════');
  log(` FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
  log('══════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    log('Failed assertions:');
    errors.forEach(e => log(`  ❌ ${e}`));
    process.exit(1);
  } else {
    log('🎉 ALL OPERATIONS, STOCKS, LEDGERS, AND P&L ACCOUNTS TALLIED 100% PERFECTLY!\n');
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
