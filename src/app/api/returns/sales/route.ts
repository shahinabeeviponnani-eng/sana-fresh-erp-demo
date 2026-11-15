export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, execute, insertReturningId, getDB } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { checkUserPermission } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
    const offset = (page - 1) * limit;

    let where = `WHERE 1=1`;
    const params: any[] = [];
    if (customerId) { where += ` AND sr.customer_id=?`; params.push(customerId); }

    const countRow = await queryOne(`SELECT COUNT(*) AS cnt FROM sales_returns sr ${where}`, params);
    const total = Number(countRow?.cnt || 0);

    const returns = await queryAll(
      `SELECT sr.*, c.name AS customer_name, c.company_name, u.name AS staff_name
       FROM sales_returns sr LEFT JOIN customers c ON sr.customer_id=c.id LEFT JOIN users u ON sr.staff_id=u.id
       ${where} ORDER BY sr.return_date DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    for (const r of returns) {
      r.items = await queryAll(`SELECT id, product_id, product_name AS productName, sku, quantity, unit_price AS unitPrice, refund_amount AS refundAmount, disposition, damage_notes AS damageNotes, batch_id AS batchId FROM sales_return_items WHERE return_id=?`, [r.id]);
    }

    // Recent orders for picker
    const orderParams: any[] = [];
    let orderWhere = `WHERE so.status!='CANCELLED'`;
    if (search?.trim()) { orderWhere += ` AND (so.order_number LIKE ? OR c.name LIKE ? OR c.company_name LIKE ?)`; orderParams.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`); }

    const recentOrders = await queryAll(
      `SELECT so.id, so.order_number, so.type, so.created_at, so.total_amount, so.status, so.customer_id,
        c.name AS customer_name, c.company_name
       FROM sales_orders so LEFT JOIN customers c ON so.customer_id=c.id
       ${orderWhere} ORDER BY so.created_at DESC LIMIT 50`,
      orderParams
    );
    for (const o of recentOrders) {
      o.items = await queryAll(`SELECT id, product_id AS productId, product_name AS productName, sku, quantity, unit_price AS unitPrice, total FROM sales_order_items WHERE order_id=?`, [o.id]);
    }

    return NextResponse.json({ returns, total, page, limit, totalPages: Math.ceil(total / limit), recentOrders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!checkUserPermission(session.role, session.permissions, 'manage_pos_intake'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const { orderId, orderNumber, customerId, items, reason, notes } = await req.json();
    if (!items || items.length === 0) return NextResponse.json({ error: 'No items provided' }, { status: 400 });

    const totalRefund = items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unitPrice), 0);
    const returnNumber = `SR-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    const returnId = await insertReturningId(
      `INSERT INTO sales_returns (return_number, original_order_id, original_order_number, customer_id, staff_id, total_refund, reason, notes) VALUES (?,?,?,?,?,?,?,?)`,
      [returnNumber, orderId || null, orderNumber || null, customerId || null, session.id, totalRefund, reason || '', notes || '']
    );

    for (const item of items) {
      const refundAmt = Number(item.quantity) * Number(item.unitPrice);
      await execute(`INSERT INTO sales_return_items (return_id, product_id, product_name, sku, quantity, unit_price, refund_amount, batch_id, disposition, damage_notes) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [returnId, item.productId, item.productName, item.sku, item.quantity, item.unitPrice, refundAmt, item.batchId || null, item.disposition || 'RESTOCK', item.damageNotes || null]);

      const prod = await queryOne(`SELECT stock_quantity FROM products WHERE id=?`, [item.productId]);
      const prevStock = Number(prod?.stock_quantity || 0);
      const newStock = prevStock + Number(item.quantity);

      if (item.disposition === 'RESTOCK') {
        await execute(`UPDATE products SET stock_quantity=?, updated_at=datetime('now') WHERE id=?`, [newStock, item.productId]);
        if (item.batchId) await execute(`UPDATE stock_batches SET quantity_remaining=quantity_remaining+? WHERE id=?`, [item.quantity, item.batchId]);
        await execute(`INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason) VALUES (?,'RETURN_CUSTOMER',?,?,?,?,?,?)`,
          [item.productId, item.quantity, prevStock, newStock, returnNumber, session.id, `Sales return restocked - ${reason || 'Customer return'}`]);
      } else {
        await execute(`INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason) VALUES (?,'ADJUSTMENT_DAMAGE',0,?,?,?,?,?)`,
          [item.productId, prevStock, prevStock, returnNumber, session.id, `Damaged return written off - ${item.damageNotes || reason || ''}`]);
      }
    }

    if (customerId) {
      const lastBal = await queryOne(`SELECT balance FROM customer_ledger WHERE customer_id=? ORDER BY entry_date DESC LIMIT 1`, [customerId]);
      const newBal = Number(lastBal?.balance || 0) - totalRefund;
      const db = getDB();
      await db.batch([
        db.prepare(`INSERT INTO customer_ledger (customer_id, type, reference_number, description, debit, credit, balance, created_by) VALUES (?,'SALES_RETURN',?,?,0,?,?,?)`)
          .bind(customerId, returnNumber, `Sales return refund - ${reason || ''}`, totalRefund, newBal, session.id),
        db.prepare(`UPDATE customers SET current_balance=current_balance-? WHERE id=?`).bind(totalRefund, customerId),
      ]);
    }

    await execute(`INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'SALES_RETURN_PROCESSED','INVENTORY','INFO',?,'127.0.0.1')`,
      [session.id, session.name, JSON.stringify({ returnNumber, totalRefund, itemCount: items.length })]);

    return NextResponse.json({ success: true, returnNumber, totalRefund });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!checkUserPermission(session.role, session.permissions, 'manage_pos_intake') && !checkUserPermission(session.role, session.permissions, 'edit_invoices'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const { returnId, items, reason, notes } = await req.json();
    if (!returnId) return NextResponse.json({ error: 'Return ID is required' }, { status: 400 });
    if (!items || items.length === 0) return NextResponse.json({ error: 'At least one item required' }, { status: 400 });

    const oldReturn = await queryOne(`SELECT * FROM sales_returns WHERE id=?`, [returnId]);
    if (!oldReturn) return NextResponse.json({ error: 'Sales return not found' }, { status: 404 });

    const oldItems = await queryAll(`SELECT * FROM sales_return_items WHERE return_id=?`, [returnId]);

    // Rollback old RESTOCK stock
    for (const oldIt of oldItems) {
      if (oldIt.disposition === 'RESTOCK') {
        const prod = await queryOne(`SELECT stock_quantity FROM products WHERE id=?`, [oldIt.product_id]);
        const rollbackStock = Math.max(0, Number(prod?.stock_quantity || 0) - Number(oldIt.quantity));
        await execute(`UPDATE products SET stock_quantity=?, updated_at=datetime('now') WHERE id=?`, [rollbackStock, oldIt.product_id]);
        if (oldIt.batch_id) await execute(`UPDATE stock_batches SET quantity_remaining=MAX(0, quantity_remaining-?) WHERE id=?`, [oldIt.quantity, oldIt.batch_id]);
      }
    }
    if (oldReturn.customer_id && Number(oldReturn.total_refund) > 0)
      await execute(`UPDATE customers SET current_balance=current_balance+? WHERE id=?`, [Number(oldReturn.total_refund), oldReturn.customer_id]);

    await execute(`DELETE FROM sales_return_items WHERE return_id=?`, [returnId]);

    let newTotalRefund = 0;
    for (const item of items) {
      const refundAmt = Number(item.quantity) * Number(item.unitPrice);
      newTotalRefund += refundAmt;
      await execute(`INSERT INTO sales_return_items (return_id, product_id, product_name, sku, quantity, unit_price, refund_amount, batch_id, disposition, damage_notes) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [returnId, item.productId, item.productName, item.sku, item.quantity, item.unitPrice, refundAmt, item.batchId || null, item.disposition || 'RESTOCK', item.damageNotes || null]);

      const prod = await queryOne(`SELECT stock_quantity FROM products WHERE id=?`, [item.productId]);
      const prevStock = Number(prod?.stock_quantity || 0);
      if (item.disposition === 'RESTOCK') {
        const newStock = prevStock + Number(item.quantity);
        await execute(`UPDATE products SET stock_quantity=?, updated_at=datetime('now') WHERE id=?`, [newStock, item.productId]);
        if (item.batchId) await execute(`UPDATE stock_batches SET quantity_remaining=quantity_remaining+? WHERE id=?`, [item.quantity, item.batchId]);
        await execute(`INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason) VALUES (?,'RETURN_CUSTOMER',?,?,?,?,?,?)`,
          [item.productId, item.quantity, prevStock, newStock, oldReturn.return_number, session.id, `Sales return edited - ${reason || oldReturn.reason}`]);
      } else {
        await execute(`INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason) VALUES (?,'ADJUSTMENT_DAMAGE',0,?,?,?,?,?)`,
          [item.productId, prevStock, prevStock, oldReturn.return_number, session.id, `Sales return edited (damage) - ${item.damageNotes || reason || ''}`]);
      }
    }

    if (oldReturn.customer_id) {
      const lastBal = await queryOne(`SELECT balance FROM customer_ledger WHERE customer_id=? ORDER BY entry_date DESC LIMIT 1`, [oldReturn.customer_id]);
      const newBal = Number(lastBal?.balance || 0) - newTotalRefund;
      await execute(`INSERT INTO customer_ledger (customer_id, type, reference_number, description, debit, credit, balance, created_by) VALUES (?,'SALES_RETURN_UPDATE',?,?,0,?,?,?)`,
        [oldReturn.customer_id, oldReturn.return_number, `Sales return edited - ${reason || oldReturn.reason}`, newTotalRefund, newBal, session.id]);
      await execute(`UPDATE customers SET current_balance=current_balance-? WHERE id=?`, [newTotalRefund, oldReturn.customer_id]);
    }

    await execute(`UPDATE sales_returns SET total_refund=?, reason=?, notes=? WHERE id=?`,
      [newTotalRefund, reason || oldReturn.reason, notes || oldReturn.notes, returnId]);
    await execute(`INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'SALES_RETURN_UPDATED','INVENTORY','INFO',?,'127.0.0.1')`,
      [session.id, session.name, JSON.stringify({ returnNumber: oldReturn.return_number, newTotalRefund })]);

    return NextResponse.json({ success: true, message: `Sales Return ${oldReturn.return_number} updated`, totalRefund: newTotalRefund });
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

    const returnId = new URL(req.url).searchParams.get('returnId');
    if (!returnId) return NextResponse.json({ error: 'Return ID is required' }, { status: 400 });

    const sReturn = await queryOne(`SELECT * FROM sales_returns WHERE id=?`, [returnId]);
    if (!sReturn) return NextResponse.json({ error: 'Sales return not found' }, { status: 404 });

    const items = await queryAll(`SELECT * FROM sales_return_items WHERE return_id=?`, [returnId]);
    for (const it of items) {
      if (it.disposition === 'RESTOCK') {
        const prod = await queryOne(`SELECT stock_quantity FROM products WHERE id=?`, [it.product_id]);
        const curStock = Number(prod?.stock_quantity || 0);
        const newStock = Math.max(0, curStock - Number(it.quantity));
        await execute(`UPDATE products SET stock_quantity=?, updated_at=datetime('now') WHERE id=?`, [newStock, it.product_id]);
        if (it.batch_id) await execute(`UPDATE stock_batches SET quantity_remaining=MAX(0, quantity_remaining-?) WHERE id=?`, [it.quantity, it.batch_id]);
        await execute(`INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason) VALUES (?,'ADJUSTMENT_DAMAGE',?,?,?,?,?,?)`,
          [it.product_id, -Number(it.quantity), curStock, newStock, sReturn.return_number, session.id, `Sales return ${sReturn.return_number} voided`]);
      }
    }

    if (sReturn.customer_id && Number(sReturn.total_refund) > 0) {
      const refundAmt = Number(sReturn.total_refund);
      const lastBal = await queryOne(`SELECT balance FROM customer_ledger WHERE customer_id=? ORDER BY entry_date DESC LIMIT 1`, [sReturn.customer_id]);
      const newBal = Number(lastBal?.balance || 0) + refundAmt;
      const db = getDB();
      await db.batch([
        db.prepare(`UPDATE customers SET current_balance=current_balance+? WHERE id=?`).bind(refundAmt, sReturn.customer_id),
        db.prepare(`INSERT INTO customer_ledger (customer_id, type, reference_number, description, debit, credit, balance, created_by) VALUES (?,'SALES_RETURN_VOID',?,?,?,0,?,?)`)
          .bind(sReturn.customer_id, sReturn.return_number, `Reversal of voided sales return ${sReturn.return_number}`, refundAmt, newBal, session.id),
      ]);
    }

    await execute(`DELETE FROM sales_return_items WHERE return_id=?`, [returnId]);
    await execute(`DELETE FROM sales_returns WHERE id=?`, [returnId]);
    await execute(`INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'SALES_RETURN_DELETED','INVENTORY','WARNING',?,'127.0.0.1')`,
      [session.id, session.name, JSON.stringify({ returnNumber: sReturn.return_number })]);

    return NextResponse.json({ success: true, message: `Sales Return ${sReturn.return_number} deleted and stock reversed.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
