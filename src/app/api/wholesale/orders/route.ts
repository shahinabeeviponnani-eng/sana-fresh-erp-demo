export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, execute, insertReturningId, getDB } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { checkUserPermission } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'WHOLESALE';
    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');
    const customerId = searchParams.get('customerId');
    const orderNumber = searchParams.get('orderNumber');
    const id = searchParams.get('id');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
    const offset = (page - 1) * limit;

    let where = `WHERE 1=1`;
    const params: any[] = [];
    if (type && type !== 'ALL') { where += ` AND so.type=?`; params.push(type); }
    if (status) { where += ` AND so.status=?`; params.push(status); }
    if (paymentStatus) { where += ` AND so.payment_status=?`; params.push(paymentStatus); }
    if (customerId) { where += ` AND so.customer_id=?`; params.push(customerId); }
    if (orderNumber) { where += ` AND so.order_number=?`; params.push(orderNumber); }
    if (id) { where += ` AND so.id=?`; params.push(id); }

    const countRow = await queryOne(`SELECT COUNT(*) AS cnt FROM sales_orders so ${where}`, params);
    const total = Number(countRow?.cnt || 0);

    // D1 has no json_agg — fetch orders then items separately
    const orders = await queryAll(
      `SELECT so.id, so.order_number, so.type, so.status, so.subtotal, so.discount_amount,
        so.tax_amount, so.total_amount, so.payment_method, so.payment_status, so.amount_paid,
        so.terms, so.due_date, so.shipping_address, so.notes, so.created_at, so.card_reference,
        c.id AS customer_id, c.name AS customer_name, c.company_name,
        c.address AS customer_address, c.city AS customer_city, c.postal_code AS customer_postal_code,
        c.country AS customer_country, c.email AS customer_email, c.phone AS customer_phone,
        c.tax_id AS customer_tax_id, c.credit_limit, c.current_balance, c.payment_terms,
        u.name AS staff_name
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id=c.id
       LEFT JOIN users u ON so.staff_id=u.id
       ${where} ORDER BY so.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Attach items to each order
    for (const order of orders) {
      order.items = await queryAll(
        `SELECT id, product_id AS productId, product_name AS productName, sku, unit,
          unit_price AS unitPrice, unit_cost AS unitCost, quantity, discount, total
         FROM sales_order_items WHERE order_id=? ORDER BY id ASC`,
        [order.id]
      );
    }

    return NextResponse.json({ orders, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (session && !checkUserPermission(session.role, session.permissions, 'create_invoices'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const { orderNumber: reqOrderNumber, customerId, items, paymentMethod: rawMethod = 'BANK_TRANSFER',
      paymentStatus = 'UNPAID', amountPaid = 0, paymentTerms = 'Due on Receipt',
      taxRate = 0, shippingAddress, notes = 'Thanks for your business.', cardReference } = await req.json();

    const paymentMethod = rawMethod === 'PARTIAL_CASH' ? 'CASH' : rawMethod;
    if (!customerId) return NextResponse.json({ error: 'A Wholesale Customer must be selected' }, { status: 400 });
    if (!items || !Array.isArray(items) || items.length === 0)
      return NextResponse.json({ error: 'Order must contain at least one item' }, { status: 400 });

    const customer = await queryOne(
      `SELECT id, name, company_name, address, city, postal_code, country FROM customers WHERE id=?`,
      [customerId]
    );
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    let subtotal = 0, totalDiscount = 0;
    const verifiedItems: any[] = [];

    for (const it of items) {
      const prod = await queryOne(
        `SELECT id, sku, name, unit, cost_price, wholesale_price, stock_quantity FROM products WHERE id=?`,
        [it.productId]
      );
      if (!prod) throw new Error(`Product ID ${it.productId} not found.`);
      const qty = parseFloat(it.quantity);
      if (isNaN(qty) || qty <= 0) throw new Error(`Invalid quantity for ${prod.name}`);
      if (prod.stock_quantity < qty)
        return NextResponse.json({ error: `Insufficient stock for "${prod.name}". Available: ${prod.stock_quantity}, Requested: ${qty}` }, { status: 400 });

      const unitPrice = parseFloat(it.unitPrice ?? prod.wholesale_price);
      const discount = parseFloat(it.discount || 0);
      subtotal += unitPrice * qty;
      totalDiscount += discount;
      verifiedItems.push({
        productId: prod.id, name: it.productName || prod.name, sku: prod.sku,
        unit: it.unit || prod.unit || 'BX', unitCost: Number(prod.cost_price),
        unitPrice, quantity: qty, discount,
        total: Number(((unitPrice * qty) - discount).toFixed(2)),
        currentStock: parseFloat(prod.stock_quantity),
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    totalDiscount = Number(totalDiscount.toFixed(2));
    const taxAmount = Number(((subtotal - totalDiscount) * ((Number(taxRate) || 0) / 100)).toFixed(2));
    const totalAmount = Number((subtotal - totalDiscount + taxAmount).toFixed(2));
    const paid = Number(amountPaid) || 0;
    const unpaidAmount = Number((totalAmount - paid).toFixed(2));

    let termDays = 0;
    if (paymentTerms === 'NET_15') termDays = 15;
    else if (paymentTerms === 'NET_30') termDays = 30;
    else if (paymentTerms === 'NET_60') termDays = 60;

    const orderNumber = reqOrderNumber?.trim() || `INV-${Math.floor(10000 + Math.random() * 90000)}`;
    const dueDate = new Date(Date.now() + termDays * 86400000).toISOString().slice(0, 10);
    const fullAddress = shippingAddress ||
      [customer.address, customer.city, customer.postal_code, customer.country].filter(Boolean).join(', ') || '';

    const orderId = await insertReturningId(
      `INSERT INTO sales_orders (order_number, type, customer_id, staff_id, status, subtotal,
        discount_amount, tax_amount, total_amount, payment_method, payment_status, amount_paid,
        terms, due_date, shipping_address, notes, card_reference)
       VALUES (?, 'WHOLESALE', ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderNumber, customerId, session?.id || 1, subtotal, totalDiscount, taxAmount, totalAmount,
       paymentMethod, paymentStatus, paid, paymentTerms, dueDate, fullAddress, notes,
       (paymentMethod === 'CARD' && cardReference) ? cardReference.trim() : null]
    );

    const db = getDB();
    for (const it of verifiedItems) {
      const newStock = Number((it.currentStock - it.quantity).toFixed(2));
      await db.batch([
        db.prepare(`INSERT INTO sales_order_items (order_id, product_id, product_name, sku, unit, unit_cost, unit_price, quantity, discount, total) VALUES (?,?,?,?,?,?,?,?,?,?)`)
          .bind(orderId, it.productId, it.name, it.sku, it.unit, it.unitCost, it.unitPrice, it.quantity, it.discount, it.total),
        db.prepare(`UPDATE products SET stock_quantity=?, updated_at=datetime('now') WHERE id=?`).bind(newStock, it.productId),
        db.prepare(`INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason) VALUES (?,'WHOLESALE_SALE',?,?,?,?,?,?)`)
          .bind(it.productId, -it.quantity, it.currentStock, newStock, orderNumber, session?.id || 1, `Dispatched for Invoice ${orderNumber}`),
      ]);
      const batches = await queryAll(`SELECT id, quantity_remaining FROM stock_batches WHERE product_id=? AND quantity_remaining>0 ORDER BY received_at ASC`, [it.productId]);
      let rem = it.quantity;
      for (const b of batches) {
        if (rem <= 0) break;
        const deduct = Math.min(rem, Number(b.quantity_remaining));
        await execute(`UPDATE stock_batches SET quantity_remaining=quantity_remaining-? WHERE id=?`, [deduct, b.id]);
        rem -= deduct;
      }
    }

    if (unpaidAmount > 0) {
      const lastBal = await queryOne(`SELECT balance FROM customer_ledger WHERE customer_id=? ORDER BY entry_date DESC LIMIT 1`, [customerId]);
      const newBal = Number(lastBal?.balance || 0) + unpaidAmount;
      await db.batch([
        db.prepare(`UPDATE customers SET current_balance=current_balance+? WHERE id=?`).bind(unpaidAmount, customerId),
        db.prepare(`INSERT INTO customer_ledger (customer_id, type, reference_number, description, debit, credit, balance, created_by) VALUES (?,'WHOLESALE_SALE',?,?,?,0,?,?)`)
          .bind(customerId, orderNumber, `Wholesale invoice ${orderNumber} — balance owed £${unpaidAmount.toFixed(2)}`, unpaidAmount, newBal, session?.id || 1),
      ]);
    }

    await execute(
      `INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'WHOLESALE_INVOICE_CREATED','WHOLESALE','INFO',?,'127.0.0.1')`,
      [session?.id || 1, session?.name || 'Wholesale Rep', JSON.stringify({ orderNumber, totalAmount, paymentStatus })]
    );

    return NextResponse.json({ success: true, order: { id: orderId, orderNumber, totalAmount, customerName: customer.name, companyName: customer.company_name, items: verifiedItems, dueDate } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Wholesale order failed' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (session && !checkUserPermission(session.role, session.permissions, 'edit_invoices'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const { orderId, items, terms, notes } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });

    const oldOrder = await queryOne(`SELECT * FROM sales_orders WHERE id=?`, [orderId]);
    if (!oldOrder) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const oldItems = await queryAll(`SELECT * FROM sales_order_items WHERE order_id=?`, [orderId]);
    for (const oldIt of oldItems) {
      if (oldIt.product_id) await execute(`UPDATE products SET stock_quantity=stock_quantity+? WHERE id=?`, [oldIt.quantity, oldIt.product_id]);
    }
    await execute(`DELETE FROM sales_order_items WHERE order_id=?`, [orderId]);

    let subtotal = 0;
    const verifiedItems: any[] = [];
    for (const it of items) {
      const prod = await queryOne(`SELECT * FROM products WHERE id=?`, [it.productId]);
      if (!prod) throw new Error(`Product ${it.productId} not found`);
      const qty = parseFloat(it.quantity) || 1;
      const unitPrice = parseFloat(it.unitPrice ?? prod.wholesale_price) || 0;
      const lineTotal = Number((qty * unitPrice).toFixed(2));
      subtotal += lineTotal;
      verifiedItems.push({ productId: prod.id, name: prod.name, sku: prod.sku, unit: it.unit || prod.unit || 'BX', unitCost: Number(prod.cost_price), unitPrice, quantity: qty, total: lineTotal });
      await execute(`INSERT INTO sales_order_items (order_id, product_id, product_name, sku, unit, unit_cost, unit_price, quantity, discount, total) VALUES (?,?,?,?,?,?,?,?,0,?)`,
        [orderId, prod.id, prod.name, prod.sku, it.unit || prod.unit, prod.cost_price, unitPrice, qty, lineTotal]);
      await execute(`UPDATE products SET stock_quantity=stock_quantity-? WHERE id=?`, [qty, prod.id]);
    }

    subtotal = Number(subtotal.toFixed(2));
    const oldUnpaid = Number(oldOrder.total_amount) - Number(oldOrder.amount_paid);
    const newUnpaid = subtotal - Number(oldOrder.amount_paid);
    const diff = newUnpaid - oldUnpaid;
    if (diff !== 0 && oldOrder.customer_id)
      await execute(`UPDATE customers SET current_balance=current_balance+? WHERE id=?`, [diff, oldOrder.customer_id]);

    await execute(`UPDATE sales_orders SET subtotal=?, total_amount=?, terms=COALESCE(?,terms), notes=COALESCE(?,notes) WHERE id=?`,
      [subtotal, subtotal, terms || null, notes || null, orderId]);
    await execute(`INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'WHOLESALE_INVOICE_EDITED','WHOLESALE','INFO',?,'127.0.0.1')`,
      [session?.id || 1, session?.name || 'Staff', JSON.stringify({ orderNumber: oldOrder.order_number, newTotal: subtotal })]);

    return NextResponse.json({ success: true, message: `Invoice ${oldOrder.order_number} edited successfully.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (session && !checkUserPermission(session.role, session.permissions, 'delete_invoices'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const orderId = new URL(req.url).searchParams.get('orderId');
    if (!orderId) return NextResponse.json({ error: 'Order ID required' }, { status: 400 });

    const order = await queryOne(`SELECT * FROM sales_orders WHERE id=?`, [orderId]);
    if (!order) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const items = await queryAll(`SELECT * FROM sales_order_items WHERE order_id=?`, [orderId]);
    const db = getDB();

    for (const it of items) {
      if (!it.product_id) continue;
      const prod = await queryOne(`SELECT stock_quantity FROM products WHERE id=?`, [it.product_id]);
      const curStock = Number(prod?.stock_quantity || 0);
      const newStock = curStock + Number(it.quantity);
      await db.batch([
        db.prepare(`UPDATE products SET stock_quantity=? WHERE id=?`).bind(newStock, it.product_id),
        db.prepare(`INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason) VALUES (?,'RETURN_CUSTOMER',?,?,?,?,?,'Restored stock from voided invoice')`)
          .bind(it.product_id, it.quantity, curStock, newStock, order.order_number, session?.id || 1),
      ]);
    }

    const unpaid = Number(order.total_amount) - Number(order.amount_paid);
    const finalStmts: any[] = [
      db.prepare(`DELETE FROM sales_orders WHERE id=?`).bind(orderId),
      db.prepare(`INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'WHOLESALE_INVOICE_DELETED','WHOLESALE','WARNING',?,'127.0.0.1')`)
        .bind(session?.id || 1, session?.name || 'Staff', JSON.stringify({ orderNumber: order.order_number, total: order.total_amount })),
    ];
    if (unpaid > 0 && order.customer_id) {
      const lastBal = await queryOne(`SELECT balance FROM customer_ledger WHERE customer_id=? ORDER BY entry_date DESC LIMIT 1`, [order.customer_id]);
      const newBal = Math.max(0, Number(lastBal?.balance || 0) - unpaid);
      finalStmts.push(
        db.prepare(`UPDATE customers SET current_balance=MAX(0, current_balance-?) WHERE id=?`).bind(unpaid, order.customer_id),
        db.prepare(`INSERT INTO customer_ledger (customer_id, type, reference_number, description, debit, credit, balance, created_by) VALUES (?,'INVOICE_VOIDED',?,?,0,?,?,?)`)
          .bind(order.customer_id, order.order_number, `Invoice ${order.order_number} voided — balance reversed`, unpaid, newBal, session?.id || 1),
      );
    }
    await db.batch(finalStmts);
    return NextResponse.json({ success: true, message: `Invoice ${order.order_number} voided and stock restored.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (session && !checkUserPermission(session.role, session.permissions, 'settle_invoices'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const { orderId, paymentStatus, amountPaid, status, cardReference: patchCardRef } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'Order ID required' }, { status: 400 });

    const current = await queryOne(`SELECT amount_paid, total_amount, customer_id, payment_status, order_number FROM sales_orders WHERE id=?`, [orderId]);
    if (!current) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const sets: string[] = [];
    const params: any[] = [];
    if (paymentStatus) { sets.push(`payment_status=?`); params.push(paymentStatus); }
    if (amountPaid !== undefined) { sets.push(`amount_paid=?`); params.push(Number(amountPaid)); }
    if (status) { sets.push(`status=?`); params.push(status); }
    if (patchCardRef !== undefined) { sets.push(`card_reference=?`); params.push(patchCardRef ? patchCardRef.trim() : null); }
    if (sets.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

    params.push(orderId);
    await execute(`UPDATE sales_orders SET ${sets.join(',')} WHERE id=?`, params);

    if (amountPaid !== undefined && current.customer_id) {
      const delta = Number(amountPaid) - Number(current.amount_paid);
      if (delta > 0) {
        const lastBal = await queryOne(`SELECT balance FROM customer_ledger WHERE customer_id=? ORDER BY entry_date DESC LIMIT 1`, [current.customer_id]);
        const newBal = Math.max(0, Number(lastBal?.balance || 0) - delta);
        const db = getDB();
        await db.batch([
          db.prepare(`UPDATE customers SET current_balance=current_balance-? WHERE id=?`).bind(delta, current.customer_id),
          db.prepare(`INSERT INTO customer_ledger (customer_id, type, reference_number, description, debit, credit, balance, created_by) VALUES (?,'WHOLESALE_PAYMENT',?,?,0,?,?,?)`)
            .bind(current.customer_id, current.order_number, `Payment received for ${current.order_number}`, delta, newBal, session?.id || 1),
        ]);
      }
    }

    await execute(`INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'ORDER_PAYMENT_UPDATED','WHOLESALE','INFO',?,'127.0.0.1')`,
      [session?.id || 1, session?.name || 'Staff', JSON.stringify({ orderId, paymentStatus, amountPaid })]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
