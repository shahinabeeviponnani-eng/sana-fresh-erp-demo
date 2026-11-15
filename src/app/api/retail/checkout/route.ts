export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, execute, insertReturningId, getDB } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    const { customerId, items, paymentMethod = 'CASH', amountReceived, taxRate = 0,
      notes, cardReference, splitPayments } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0)
      return NextResponse.json({ error: 'Cart cannot be empty' }, { status: 400 });

    const hasSplit = Array.isArray(splitPayments) && splitPayments.length > 1;
    const effectiveMethod = hasSplit ? 'SPLIT' : paymentMethod;
    const effectiveCardRef = hasSplit
      ? (splitPayments.find((s: any) => s.method === 'CARD')?.cardReference || null)
      : (paymentMethod === 'CARD' && cardReference ? cardReference.trim() : null);

    // 1. Fetch & verify all products first
    const verifiedItems: any[] = [];
    let subtotal = 0, totalDiscount = 0;

    for (const item of items) {
      const prod = await queryOne(
        `SELECT id, sku, name, unit, cost_price, retail_price, stock_quantity FROM products WHERE id = ?`,
        [item.productId]
      );
      if (!prod) throw new Error(`Product ID ${item.productId} not found.`);
      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) throw new Error(`Invalid quantity for ${prod.name}`);
      if (parseFloat(prod.stock_quantity) < qty)
        return NextResponse.json({ error: `Insufficient stock for "${prod.name}". Available: ${prod.stock_quantity}, Requested: ${qty}` }, { status: 400 });

      const unitPrice = parseFloat(item.unitPrice || prod.retail_price);
      const discount = parseFloat(item.discount || 0);
      subtotal += unitPrice * qty;
      totalDiscount += discount;
      verifiedItems.push({
        productId: prod.id, name: prod.name, sku: prod.sku, unit: prod.unit || 'pcs',
        unitCost: Number(prod.cost_price), unitPrice, quantity: qty, discount,
        total: Number(((unitPrice * qty) - discount).toFixed(2)),
        currentStock: parseFloat(prod.stock_quantity),
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    totalDiscount = Number(totalDiscount.toFixed(2));
    const taxAmount = Number(((subtotal - totalDiscount) * ((Number(taxRate) || 0) / 100)).toFixed(2));
    const totalAmount = Number((subtotal - totalDiscount + taxAmount).toFixed(2));
    const paid = hasSplit
      ? splitPayments.reduce((s: number, p: any) => s + Number(p.amount), 0)
      : (amountReceived !== undefined ? Number(amountReceived) : totalAmount);
    const changeDue = Math.max(0, Number((paid - totalAmount).toFixed(2)));
    const paymentStatus = paid >= totalAmount - 0.01 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID';
    const unpaidAmount = Math.max(0, Number((totalAmount - paid).toFixed(2)));
    const orderNumber = `POS-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    // 2. Insert order
    const orderId = await insertReturningId(
      `INSERT INTO sales_orders (order_number, type, customer_id, staff_id, status, subtotal,
        discount_amount, tax_amount, total_amount, payment_method, payment_status, amount_paid,
        notes, card_reference, split_payments)
       VALUES (?, 'RETAIL', ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderNumber, customerId || null, session?.id || 1, subtotal, totalDiscount, taxAmount,
       totalAmount, effectiveMethod, paymentStatus, paid,
       notes || 'Cashier Counter Checkout', effectiveCardRef,
       hasSplit ? JSON.stringify(splitPayments) : null]
    );

    // 3. Items + stock updates (batch per item)
    const db = getDB();
    for (const item of verifiedItems) {
      const newStock = Number((item.currentStock - item.quantity).toFixed(2));
      const stmts = [
        db.prepare(`INSERT INTO sales_order_items (order_id, product_id, product_name, sku, unit, unit_cost, unit_price, quantity, discount, total) VALUES (?,?,?,?,?,?,?,?,?,?)`)
          .bind(orderId, item.productId, item.name, item.sku, item.unit, item.unitCost, item.unitPrice, item.quantity, item.discount, item.total),
        db.prepare(`UPDATE products SET stock_quantity=?, updated_at=datetime('now') WHERE id=?`)
          .bind(newStock, item.productId),
        db.prepare(`INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason) VALUES (?,'RETAIL_SALE',?,?,?,?,?,'POS Retail Counter Checkout')`)
          .bind(item.productId, -item.quantity, item.currentStock, newStock, orderNumber, session?.id || 1),
      ];
      await db.batch(stmts);

      // FIFO batch deduction
      const batches = await queryAll(
        `SELECT id, quantity_remaining FROM stock_batches WHERE product_id=? AND quantity_remaining>0 ORDER BY received_at ASC`,
        [item.productId]
      );
      let remaining = item.quantity;
      for (const b of batches) {
        if (remaining <= 0) break;
        const deduct = Math.min(remaining, Number(b.quantity_remaining));
        await execute(`UPDATE stock_batches SET quantity_remaining=quantity_remaining-? WHERE id=?`, [deduct, b.id]);
        remaining -= deduct;
      }
    }

    // 4. Customer balance + ledger if partial/unpaid
    if (unpaidAmount > 0 && customerId) {
      const lastBal = await queryOne(`SELECT balance FROM customer_ledger WHERE customer_id=? ORDER BY entry_date DESC LIMIT 1`, [customerId]);
      const newBal = Number(lastBal?.balance || 0) + unpaidAmount;
      await db.batch([
        db.prepare(`UPDATE customers SET current_balance=current_balance+? WHERE id=?`).bind(unpaidAmount, customerId),
        db.prepare(`INSERT INTO customer_ledger (customer_id, type, reference_number, description, debit, credit, balance, created_by) VALUES (?,'RETAIL_SALE',?,?,?,0,?,?)`)
          .bind(customerId, orderNumber, `Retail sale ${orderNumber} — balance owed`, unpaidAmount, newBal, session?.id || 1),
      ]);
    }

    await execute(
      `INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'POS_CHECKOUT','RETAIL','INFO',?,'127.0.0.1')`,
      [session?.id || 1, session?.name || 'Cashier', JSON.stringify({ orderNumber, totalAmount, itemCount: verifiedItems.length })]
    );

    return NextResponse.json({
      success: true,
      order: { id: orderId, orderNumber, subtotal, tax: taxAmount, total: totalAmount,
        amountPaid: paid, amountReceived: paid, changeDue, paymentStatus,
        paymentMethod: effectiveMethod, splitPayments: hasSplit ? splitPayments : null,
        items: verifiedItems, cashierName: session?.name || 'Cashier' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Checkout failed' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { orderId, items, notes, paymentMethod, splitPayments, cardReference } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    if (!items || items.length === 0) return NextResponse.json({ error: 'Items required' }, { status: 400 });

    const oldOrder = await queryOne(`SELECT * FROM sales_orders WHERE id=?`, [orderId]);
    if (!oldOrder) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const oldItems = await queryAll(`SELECT * FROM sales_order_items WHERE order_id=?`, [orderId]);
    const db = getDB();

    // Restore old stock
    for (const oldIt of oldItems) {
      const batch = await queryOne(`SELECT id FROM stock_batches WHERE product_id=? ORDER BY received_at DESC LIMIT 1`, [oldIt.product_id]);
      const stmts = [
        db.prepare(`UPDATE products SET stock_quantity=stock_quantity+?, updated_at=datetime('now') WHERE id=?`).bind(oldIt.quantity, oldIt.product_id),
      ];
      if (batch) stmts.push(db.prepare(`UPDATE stock_batches SET quantity_remaining=quantity_remaining+? WHERE id=?`).bind(oldIt.quantity, batch.id));
      await db.batch(stmts);
    }
    await execute(`DELETE FROM sales_order_items WHERE order_id=?`, [orderId]);

    // Verify & apply new items
    let subtotal = 0, totalDiscount = 0;
    const verifiedItems: any[] = [];

    for (const item of items) {
      const prod = await queryOne(`SELECT id, name, sku, unit, cost_price, retail_price, stock_quantity FROM products WHERE id=?`, [item.productId]);
      if (!prod) throw new Error(`Product ${item.productId} not found`);
      const qty = parseFloat(item.quantity);
      if (parseFloat(prod.stock_quantity) < qty) throw new Error(`Insufficient stock for "${prod.name}"`);
      const unitPrice = parseFloat(item.unitPrice || prod.retail_price);
      const discount = parseFloat(item.discount || 0);
      subtotal += unitPrice * qty;
      totalDiscount += discount;
      verifiedItems.push({ productId: prod.id, name: prod.name, sku: prod.sku, unit: prod.unit || 'pcs',
        unitCost: Number(prod.cost_price), unitPrice, quantity: qty, discount,
        total: (unitPrice * qty) - discount, currentStock: parseFloat(prod.stock_quantity) });
    }

    const hasSplit = Array.isArray(splitPayments) && splitPayments.length > 1;
    const effectiveMethod = hasSplit ? 'SPLIT' : (paymentMethod || oldOrder.payment_method);
    const effectiveCardRef = hasSplit
      ? (splitPayments.find((s: any) => s.method === 'CARD')?.cardReference || null)
      : (paymentMethod === 'CARD' && cardReference ? cardReference.trim() : oldOrder.card_reference);
    const totalAmount = Number((subtotal - totalDiscount).toFixed(2));

    for (const item of verifiedItems) {
      const newStock = Number((item.currentStock - item.quantity).toFixed(2));
      await db.batch([
        db.prepare(`INSERT INTO sales_order_items (order_id, product_id, product_name, sku, unit, unit_cost, unit_price, quantity, discount, total) VALUES (?,?,?,?,?,?,?,?,?,?)`)
          .bind(orderId, item.productId, item.name, item.sku, item.unit, item.unitCost, item.unitPrice, item.quantity, item.discount, item.total),
        db.prepare(`UPDATE products SET stock_quantity=?, updated_at=datetime('now') WHERE id=?`).bind(newStock, item.productId),
        db.prepare(`INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason) VALUES (?,'RETAIL_SALE',?,?,?,?,?,'POS Sale Edited')`)
          .bind(item.productId, -item.quantity, item.currentStock, newStock, oldOrder.order_number, session.id),
      ]);
      const batches = await queryAll(`SELECT id, quantity_remaining FROM stock_batches WHERE product_id=? AND quantity_remaining>0 ORDER BY received_at ASC`, [item.productId]);
      let remaining = item.quantity;
      for (const b of batches) {
        if (remaining <= 0) break;
        const deduct = Math.min(remaining, Number(b.quantity_remaining));
        await execute(`UPDATE stock_batches SET quantity_remaining=quantity_remaining-? WHERE id=?`, [deduct, b.id]);
        remaining -= deduct;
      }
    }

    await execute(
      `UPDATE sales_orders SET subtotal=?, total_amount=?, notes=COALESCE(?,notes), payment_method=?, card_reference=?, split_payments=? WHERE id=?`,
      [subtotal - totalDiscount, totalAmount, notes || null, effectiveMethod, effectiveCardRef,
       hasSplit ? JSON.stringify(splitPayments) : null, orderId]
    );
    await execute(
      `INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'POS_SALE_EDITED','RETAIL','INFO',?,'127.0.0.1')`,
      [session.id, session.name, JSON.stringify({ orderNumber: oldOrder.order_number, newTotal: totalAmount })]
    );
    return NextResponse.json({ success: true, message: `Order ${oldOrder.order_number} updated` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const orderId = new URL(req.url).searchParams.get('orderId');
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

    const order = await queryOne(`SELECT * FROM sales_orders WHERE id=?`, [orderId]);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const items = await queryAll(`SELECT * FROM sales_order_items WHERE order_id=?`, [orderId]);
    const db = getDB();

    for (const it of items) {
      const prod = await queryOne(`SELECT stock_quantity FROM products WHERE id=?`, [it.product_id]);
      const curStock = Number(prod?.stock_quantity || 0);
      const newStock = curStock + Number(it.quantity);
      const batch = await queryOne(`SELECT id FROM stock_batches WHERE product_id=? ORDER BY received_at DESC LIMIT 1`, [it.product_id]);
      const stmts = [
        db.prepare(`UPDATE products SET stock_quantity=?, updated_at=datetime('now') WHERE id=?`).bind(newStock, it.product_id),
        db.prepare(`INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason) VALUES (?,'RETURN_CUSTOMER',?,?,?,?,?,'POS Sale Voided')`)
          .bind(it.product_id, Number(it.quantity), curStock, newStock, order.order_number, session.id),
      ];
      if (batch) stmts.push(db.prepare(`UPDATE stock_batches SET quantity_remaining=quantity_remaining+? WHERE id=?`).bind(it.quantity, batch.id));
      await db.batch(stmts);
    }

    const unpaidOnVoid = Number(order.total_amount) - Number(order.amount_paid);
    const finalStmts: any[] = [
      db.prepare(`DELETE FROM sales_orders WHERE id=?`).bind(orderId),
      db.prepare(`INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'POS_SALE_DELETED','RETAIL','WARNING',?,'127.0.0.1')`)
        .bind(session.id, session.name, JSON.stringify({ orderNumber: order.order_number, total: order.total_amount })),
    ];
    if (unpaidOnVoid > 0 && order.customer_id) {
      finalStmts.push(
        db.prepare(`UPDATE customers SET current_balance=MAX(0, current_balance-?) WHERE id=?`).bind(unpaidOnVoid, order.customer_id)
      );
    }
    await db.batch(finalStmts);

    return NextResponse.json({ success: true, message: `Order ${order.order_number} voided and stock restored.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { orderId, amountPaid, paymentMethod = 'CASH', cardReference, notes } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    const paying = Number(amountPaid);
    if (isNaN(paying) || paying <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });

    const order = await queryOne(`SELECT * FROM sales_orders WHERE id=?`, [orderId]);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const outstanding = Number(order.total_amount) - Number(order.amount_paid);
    if (paying > outstanding + 0.01) throw new Error(`Amount exceeds outstanding balance of £${outstanding.toFixed(2)}`);

    const newPaid = Number(order.amount_paid) + paying;
    const newStatus = newPaid >= Number(order.total_amount) - 0.01 ? 'PAID' : 'PARTIAL';
    const cardRef = paymentMethod === 'CARD' && cardReference ? cardReference.trim() : null;

    const db = getDB();
    const stmts: any[] = [
      db.prepare(`UPDATE sales_orders SET amount_paid=?, payment_status=?, card_reference=COALESCE(?,card_reference) WHERE id=?`)
        .bind(newPaid, newStatus, cardRef, orderId),
      db.prepare(`INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'RETAIL_SALE_SETTLED','RETAIL','INFO',?,'127.0.0.1')`)
        .bind(session.id, session.name, JSON.stringify({ orderNumber: order.order_number, paying, newStatus })),
    ];

    if (order.customer_id) {
      const lastBal = await queryOne(`SELECT balance FROM customer_ledger WHERE customer_id=? ORDER BY entry_date DESC LIMIT 1`, [order.customer_id]);
      const newBal = Math.max(0, Number(lastBal?.balance || 0) - paying);
      stmts.push(
        db.prepare(`UPDATE customers SET current_balance=MAX(0, current_balance-?) WHERE id=?`).bind(paying, order.customer_id),
        db.prepare(`INSERT INTO customer_ledger (customer_id, type, reference_number, description, debit, credit, balance, created_by) VALUES (?,'RETAIL_PAYMENT',?,?,0,?,?,?)`)
          .bind(order.customer_id, order.order_number, `Payment received for ${order.order_number}${notes ? ' — ' + notes : ''}`, paying, newBal, session.id),
      );
    }
    await db.batch(stmts);
    return NextResponse.json({ success: true, newStatus, totalPaid: newPaid });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
