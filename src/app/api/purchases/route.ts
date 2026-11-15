export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, execute, insertReturningId, getDB } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { checkUserPermission } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!checkUserPermission(session.role, session.permissions, 'manage_pos_intake') && !checkUserPermission(session.role, session.permissions, 'view_vendors'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');
    const vendorId = searchParams.get('vendorId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');

    let whereClause = `WHERE 1=1`;
    const params: any[] = [];

    if (search) {
      whereClause += ` AND (po.po_number LIKE ? OR v.name LIKE ? OR v.company_name LIKE ? OR u.name LIKE ? OR po.notes LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status && status !== 'ALL') {
      whereClause += ` AND po.status = ?`;
      params.push(status);
    }

    if (paymentStatus && paymentStatus !== 'ALL') {
      whereClause += ` AND po.payment_status = ?`;
      params.push(paymentStatus);
    }

    if (vendorId) {
      whereClause += ` AND po.vendor_id = ?`;
      params.push(Number(vendorId));
    }

    if (dateFrom) {
      whereClause += ` AND date(po.created_at) >= date(?)`;
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ` AND date(po.created_at) <= date(?)`;
      params.push(dateTo);
    }

    // Summary metrics over all matching records
    const statsQuery = `
      SELECT
        COUNT(*) AS total_count,
        COALESCE(SUM(po.total_amount), 0) AS total_purchases,
        COALESCE(SUM(po.amount_paid), 0) AS total_paid,
        COALESCE(SUM(CASE WHEN po.payment_status != 'PAID' THEN (po.total_amount - po.amount_paid) ELSE 0 END), 0) AS total_owed,
        COALESCE(SUM(CASE WHEN po.status = 'RECEIVED' THEN 1 ELSE 0 END), 0) AS received_count,
        COALESCE(SUM(CASE WHEN po.status = 'ORDERED' THEN 1 ELSE 0 END), 0) AS ordered_count
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN users u ON po.staff_id = u.id
      ${whereClause}
    `;
    const stats: any = await queryOne(statsQuery, params);
    const totalCount = Number(stats?.total_count || 0);

    let listSql = `
      SELECT po.id, po.po_number, po.status, po.total_amount, po.payment_status, po.amount_paid,
        po.expected_delivery_date, po.received_at, po.notes, po.created_at, po.card_reference,
        v.id AS vendor_id, v.name AS vendor_name, v.company_name AS vendor_company,
        u.name AS staff_name
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id=v.id
      LEFT JOIN users u ON po.staff_id=u.id
      ${whereClause}
      ORDER BY po.created_at DESC
    `;

    const listParams = [...params];
    const pageNum = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const limitNum = limitParam ? Math.max(1, parseInt(limitParam, 10)) : (pageParam ? 25 : 500);

    if (pageParam) {
      listSql += ` LIMIT ? OFFSET ?`;
      listParams.push(limitNum, (pageNum - 1) * limitNum);
    }

    const pos = await queryAll(listSql, listParams);

    for (const po of pos) {
      po.items = await queryAll(
        `SELECT poi.id, poi.product_id AS productId, p.name AS productName, p.sku,
          poi.quantity_ordered AS quantityOrdered, poi.quantity_received AS quantityReceived,
          poi.unit_cost AS unitCost, poi.total_cost AS totalCost
         FROM purchase_order_items poi JOIN products p ON poi.product_id=p.id WHERE poi.po_id=?`,
        [po.id]
      );
    }

    return NextResponse.json({
      purchaseOrders: pos,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
      page: pageNum,
      summary: {
        totalPurchases: Number(stats?.total_purchases || 0),
        totalPaid: Number(stats?.total_paid || 0),
        totalOwed: Number(stats?.total_owed || 0),
        totalOrders: totalCount,
        receivedCount: Number(stats?.received_count || 0),
        orderedCount: Number(stats?.ordered_count || 0),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    const { vendorId, items, expectedDeliveryDate, notes } = await req.json();
    if (!vendorId) return NextResponse.json({ error: 'Vendor must be selected' }, { status: 400 });
    if (!items || !Array.isArray(items) || items.length === 0)
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });

    const totalAmount = items.reduce((s: number, it: any) => s + Number(it.quantity) * Number(it.unitCost), 0);
    const poNumber = `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    const poId = await insertReturningId(
      `INSERT INTO purchase_orders (po_number, vendor_id, staff_id, status, total_amount, payment_status, expected_delivery_date, notes) VALUES (?,?,?,'ORDERED',?,'UNPAID',?,?)`,
      [poNumber, vendorId, session?.id || 1, totalAmount, expectedDeliveryDate || null, notes || '']
    );

    for (const it of items) {
      const lineCost = Number(it.quantity) * Number(it.unitCost);
      await execute(`INSERT INTO purchase_order_items (po_id, product_id, quantity_ordered, quantity_received, unit_cost, total_cost) VALUES (?,?,?,0,?,?)`,
        [poId, it.productId, parseInt(it.quantity, 10), Number(it.unitCost), lineCost]);
    }

    await execute(`UPDATE vendors SET total_purchases=total_purchases+? WHERE id=?`, [totalAmount, vendorId]);
    await execute(`INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'PO_ORDER_CREATED','VENDORS','INFO',?,'127.0.0.1')`,
      [session?.id || 1, session?.name || 'Manager', JSON.stringify({ poNumber, totalAmount, vendorId })]);

    return NextResponse.json({ success: true, poId, poNumber });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { poId, items, notes, expectedDeliveryDate, amountPaid, paymentMethod, cardReference } = await req.json();
    if (!poId) return NextResponse.json({ error: 'poId is required' }, { status: 400 });

    const po = await queryOne(`SELECT po.*, v.company_name AS vendor_name FROM purchase_orders po JOIN vendors v ON po.vendor_id=v.id WHERE po.id=?`, [poId]);
    if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });

    // ── EDIT PO ITEMS ──
    if (items && Array.isArray(items)) {
      const oldItems = await queryAll(`SELECT * FROM purchase_order_items WHERE po_id=?`, [poId]);
      const isReceived = po.status === 'RECEIVED';
      const db = getDB();

      if (isReceived) {
        for (const oldIt of oldItems) {
          const qty = Number(oldIt.quantity_received || oldIt.quantity_ordered);
          const prod = await queryOne(`SELECT stock_quantity FROM products WHERE id=?`, [oldIt.product_id]);
          const newStock = Math.max(0, Number(prod?.stock_quantity || 0) - qty);
          await execute(`UPDATE products SET stock_quantity=?, updated_at=datetime('now') WHERE id=?`, [newStock, oldIt.product_id]);
        }
        await execute(`DELETE FROM stock_batches WHERE po_number=?`, [po.po_number]);
      }

      await execute(`UPDATE vendors SET total_purchases=MAX(0, total_purchases-?) WHERE id=?`, [Number(po.total_amount), po.vendor_id]);
      await execute(`DELETE FROM purchase_order_items WHERE po_id=?`, [poId]);

      let newTotal = 0;
      for (const it of items) {
        const lineCost = Number(it.quantity) * Number(it.unitCost);
        newTotal += lineCost;
        const qtyReceived = isReceived ? Number(it.quantity) : 0;
        await execute(`INSERT INTO purchase_order_items (po_id, product_id, quantity_ordered, quantity_received, unit_cost, total_cost) VALUES (?,?,?,?,?,?)`,
          [poId, it.productId, it.quantity, qtyReceived, Number(it.unitCost), lineCost]);

        if (isReceived) {
          const prod = await queryOne(`SELECT stock_quantity FROM products WHERE id=?`, [it.productId]);
          const curStock = Number(prod?.stock_quantity || 0);
          const newStock = curStock + Number(it.quantity);
          const batchNumber = `BATCH-${new Date().toISOString().slice(0,10).replace(/-/g,'')}P${it.productId}-${Math.floor(Math.random()*9000)+1000}`;
          await db.batch([
            db.prepare(`INSERT INTO stock_batches (product_id, batch_number, po_number, vendor_id, quantity_received, quantity_remaining, unit_cost, received_at, created_by) VALUES (?,?,?,?,?,?,?,datetime('now'),?)`)
              .bind(it.productId, batchNumber, po.po_number, po.vendor_id, Number(it.quantity), Number(it.quantity), Number(it.unitCost), session.id),
            db.prepare(`UPDATE products SET stock_quantity=?, cost_price=?, updated_at=datetime('now') WHERE id=?`).bind(newStock, Number(it.unitCost), it.productId),
            db.prepare(`INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason) VALUES (?,'PURCHASE_RECEIVE',?,?,?,?,?,?)`)
              .bind(it.productId, Number(it.quantity), curStock, newStock, po.po_number, session.id, `PO ${po.po_number} edited & stock synced`),
          ]);
        }
      }

      await execute(`UPDATE vendors SET total_purchases=total_purchases+? WHERE id=?`, [newTotal, po.vendor_id]);
      const paid = Number(po.amount_paid || 0);
      const newPayStatus = paid >= newTotal ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID';
      await execute(`UPDATE purchase_orders SET total_amount=?, payment_status=?, notes=COALESCE(?,notes), expected_delivery_date=COALESCE(?,expected_delivery_date) WHERE id=?`,
        [newTotal, newPayStatus, notes || null, expectedDeliveryDate || null, poId]);
      await execute(`INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'PO_EDITED','VENDORS','INFO',?,'127.0.0.1')`,
        [session.id, session.name, JSON.stringify({ poNumber: po.po_number, oldTotal: po.total_amount, newTotal })]);
      return NextResponse.json({ success: true, message: `PO ${po.po_number} updated`, totalAmount: newTotal });
    }

    // ── VENDOR PAYMENT ──
    if (amountPaid !== undefined) {
      const prevPaid = Number(po.amount_paid || 0);
      const paying = Number(amountPaid);
      const newPaid = prevPaid + paying;
      const total = Number(po.total_amount);
      const newStatus = newPaid >= total - 0.001 ? 'PAID' : 'PARTIAL';

      const lastBal = await queryOne(`SELECT balance FROM vendor_ledger WHERE vendor_id=? ORDER BY entry_date DESC LIMIT 1`, [po.vendor_id]);
      const newBal = Number(lastBal?.balance || 0) - paying;

      const db = getDB();
      await db.batch([
        db.prepare(`UPDATE purchase_orders SET amount_paid=?, payment_status=?, card_reference=COALESCE(?,card_reference) WHERE id=?`)
          .bind(newPaid, newStatus, (paymentMethod === 'CARD' && cardReference) ? cardReference.trim() : null, poId),
        db.prepare(`INSERT INTO vendor_ledger (vendor_id, type, reference_number, description, debit, credit, balance, created_by, entry_date) VALUES (?,'PO_PAYMENT',?,?,0,?,?,?,datetime('now'))`)
          .bind(po.vendor_id, po.po_number, `Payment for ${po.po_number} via ${paymentMethod || 'BANK_TRANSFER'}`, paying, newBal, session.id),
        db.prepare(`INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'PO_PAYMENT_RECORDED','VENDORS','INFO',?,'127.0.0.1')`)
          .bind(session.id, session.name, JSON.stringify({ poNumber: po.po_number, paying, newStatus })),
      ]);
      return NextResponse.json({ success: true, newStatus, totalPaid: newPaid });
    }

    return NextResponse.json({ error: 'Provide items (to edit) or amountPaid (to record payment)' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!checkUserPermission(session.role, session.permissions, 'delete_invoices') && !checkUserPermission(session.role, session.permissions, 'manage_pos_intake'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const poId = new URL(req.url).searchParams.get('poId');
    if (!poId) return NextResponse.json({ error: 'poId is required' }, { status: 400 });

    const po = await queryOne(`SELECT * FROM purchase_orders WHERE id=?`, [poId]);
    if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });

    if (po.status === 'RECEIVED') {
      const items = await queryAll(`SELECT * FROM purchase_order_items WHERE po_id=?`, [poId]);
      for (const it of items) {
        const qty = Number(it.quantity_received || it.quantity_ordered);
        const prod = await queryOne(`SELECT stock_quantity FROM products WHERE id=?`, [it.product_id]);
        const curStock = Number(prod?.stock_quantity || 0);
        const newStock = Math.max(0, curStock - qty);
        await execute(`UPDATE products SET stock_quantity=?, updated_at=datetime('now') WHERE id=?`, [newStock, it.product_id]);
        await execute(`INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason) VALUES (?,'RETURN_VENDOR',?,?,?,?,?,?)`,
          [it.product_id, -qty, curStock, newStock, po.po_number, session.id, `PO ${po.po_number} voided - stock reversed`]);
      }
      await execute(`DELETE FROM stock_batches WHERE po_number=?`, [po.po_number]);
    }

    await execute(`UPDATE vendors SET total_purchases=MAX(0, total_purchases-?) WHERE id=?`, [Number(po.total_amount), po.vendor_id]);
    await execute(`DELETE FROM purchase_order_items WHERE po_id=?`, [poId]);
    await execute(`DELETE FROM purchase_orders WHERE id=?`, [poId]);
    await execute(`INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'PO_DELETED','VENDORS','WARNING',?,'127.0.0.1')`,
      [session.id, session.name, JSON.stringify({ poNumber: po.po_number, status: po.status, total: po.total_amount })]);

    return NextResponse.json({ success: true, message: `PO ${po.po_number} deleted${po.status === 'RECEIVED' ? ' and stock reversed' : ''}.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    const { poId, receivedItems, paymentOption, amountPaid, paymentMethod, cardReference } = await req.json();
    if (!poId) return NextResponse.json({ error: 'Purchase Order ID is required' }, { status: 400 });

    const po = await queryOne(`SELECT po.*, v.company_name AS vendor_name FROM purchase_orders po JOIN vendors v ON po.vendor_id=v.id WHERE po.id=?`, [poId]);
    if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    if (po.status === 'RECEIVED') return NextResponse.json({ error: 'Purchase order has already been fully received' }, { status: 400 });

    const items = await queryAll(`SELECT poi.*, p.stock_quantity, p.cost_price, p.name AS product_name FROM purchase_order_items poi JOIN products p ON poi.product_id=p.id WHERE poi.po_id=?`, [poId]);
    const db = getDB();

    for (const it of items) {
      let qtyToReceive = Math.max(0, Number(it.quantity_ordered) - Number(it.quantity_received || 0));
      if (receivedItems && Array.isArray(receivedItems)) {
        const customItem = receivedItems.find((r: any) => r.id === it.id);
        if (customItem !== undefined) {
          qtyToReceive = Math.max(0, Number(customItem.quantityReceiving) || 0);
        }
      }

      if (qtyToReceive > 0) {
        const curStock = Number(it.stock_quantity || 0);
        const newStock = curStock + qtyToReceive;
        const newTotalReceived = Number(it.quantity_received || 0) + qtyToReceive;
        const batchNumber = `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}P${it.product_id}-${Math.floor(Math.random() * 9000) + 1000}`;

        await db.batch([
          db.prepare(`INSERT INTO stock_batches (product_id, batch_number, po_number, vendor_id, quantity_received, quantity_remaining, unit_cost, received_at, created_by) VALUES (?,?,?,?,?,?,?,datetime('now'),?)`)
            .bind(it.product_id, batchNumber, po.po_number, po.vendor_id, qtyToReceive, qtyToReceive, it.unit_cost, session?.id || 1),
          db.prepare(`UPDATE products SET stock_quantity=?, cost_price=?, updated_at=datetime('now') WHERE id=?`).bind(newStock, it.unit_cost, it.product_id),
          db.prepare(`UPDATE purchase_order_items SET quantity_received=? WHERE id=?`).bind(newTotalReceived, it.id),
          db.prepare(`INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason) VALUES (?,'PURCHASE_RECEIVE',?,?,?,?,?,?)`)
            .bind(it.product_id, qtyToReceive, curStock, newStock, po.po_number, session?.id || 1, `Batch ${batchNumber} received (${qtyToReceive} units) from ${po.vendor_name}`),
        ]);
      }
    }

    // Determine status: full vs partial
    const updatedItems = await queryAll(`SELECT quantity_ordered, quantity_received FROM purchase_order_items WHERE po_id=?`, [poId]);
    const isFullyReceived = updatedItems.every((i) => Number(i.quantity_received) >= Number(i.quantity_ordered));
    const finalStatus = isFullyReceived ? 'RECEIVED' : 'PARTIAL';

    // Handle payment if provided during receipt
    let finalPayStatus = po.payment_status;
    let newPaid = Number(po.amount_paid || 0);
    const paying = Number(amountPaid || 0);

    if (paymentOption === 'PAID') {
      const remainingUnpaid = Number(po.total_amount) - newPaid;
      if (remainingUnpaid > 0) {
        newPaid = Number(po.total_amount);
        finalPayStatus = 'PAID';
        const lastBal = await queryOne(`SELECT balance FROM vendor_ledger WHERE vendor_id=? ORDER BY entry_date DESC LIMIT 1`, [po.vendor_id]);
        const newBal = Number(lastBal?.balance || 0) - remainingUnpaid;
        await db.batch([
          db.prepare(`INSERT INTO vendor_ledger (vendor_id, type, reference_number, description, debit, credit, balance, created_by, entry_date) VALUES (?,'PO_PAYMENT',?,?,0,?,?,?,datetime('now'))`)
            .bind(po.vendor_id, po.po_number, `Paid in full for ${po.po_number} upon delivery via ${paymentMethod || 'BANK_TRANSFER'}`, remainingUnpaid, newBal, session?.id || 1),
        ]);
      }
    } else if (paying > 0) {
      newPaid = newPaid + paying;
      finalPayStatus = newPaid >= Number(po.total_amount) - 0.001 ? 'PAID' : 'PARTIAL';
      const lastBal = await queryOne(`SELECT balance FROM vendor_ledger WHERE vendor_id=? ORDER BY entry_date DESC LIMIT 1`, [po.vendor_id]);
      const newBal = Number(lastBal?.balance || 0) - paying;
      await db.batch([
        db.prepare(`INSERT INTO vendor_ledger (vendor_id, type, reference_number, description, debit, credit, balance, created_by, entry_date) VALUES (?,'PO_PAYMENT',?,?,0,?,?,?,datetime('now'))`)
          .bind(po.vendor_id, po.po_number, `Partial payment for ${po.po_number} upon delivery via ${paymentMethod || 'BANK_TRANSFER'}`, paying, newBal, session?.id || 1),
      ]);
    }

    await execute(
      `UPDATE purchase_orders SET status=?, payment_status=?, amount_paid=?, received_at=datetime('now'), card_reference=COALESCE(?, card_reference) WHERE id=?`,
      [finalStatus, finalPayStatus, newPaid, (paymentMethod === 'CARD' && cardReference) ? cardReference.trim() : null, poId]
    );

    await execute(
      `INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'PO_SHIPMENT_RECEIVED','INVENTORY','INFO',?,'127.0.0.1')`,
      [session?.id || 1, session?.name || 'Staff', JSON.stringify({ poNumber: po.po_number, vendor: po.vendor_name, status: finalStatus, paymentStatus: finalPayStatus })]
    );

    return NextResponse.json({
      success: true,
      message: `PO ${po.po_number} ${finalStatus === 'RECEIVED' ? 'fully received' : 'partially received'} into warehouse stock!`,
      status: finalStatus,
      paymentStatus: finalPayStatus,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
