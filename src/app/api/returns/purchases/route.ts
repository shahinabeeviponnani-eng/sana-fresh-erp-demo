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
    const vendorId = searchParams.get('vendorId');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
    const offset = (page - 1) * limit;

    let where = `WHERE 1=1`;
    const params: any[] = [];
    if (vendorId) { where += ` AND pr.vendor_id=?`; params.push(vendorId); }

    const countRow = await queryOne(`SELECT COUNT(*) AS cnt FROM purchase_returns pr ${where}`, params);
    const total = Number(countRow?.cnt || 0);

    const returns = await queryAll(
      `SELECT pr.*, v.company_name AS vendor_company, v.name AS vendor_name, u.name AS staff_name
       FROM purchase_returns pr LEFT JOIN vendors v ON pr.vendor_id=v.id LEFT JOIN users u ON pr.staff_id=u.id
       ${where} ORDER BY pr.return_date DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    for (const r of returns) {
      r.items = await queryAll(`SELECT id, product_id, product_name AS productName, sku, quantity, unit_cost AS unitCost, credit_amount AS creditAmount, reason, batch_id AS batchId FROM purchase_return_items WHERE return_id=?`, [r.id]);
    }

    // Received POs for reference picker
    const poParams: any[] = [];
    let poWhere = `WHERE po.status='RECEIVED'`;
    if (search) { poWhere += ` AND (po.po_number LIKE ? OR v.company_name LIKE ? OR v.name LIKE ?)`; poParams.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const receivedPOs = await queryAll(
      `SELECT po.id, po.po_number, po.vendor_id, po.received_at, po.total_amount,
        v.company_name AS vendor_company, v.name AS vendor_name
       FROM purchase_orders po JOIN vendors v ON po.vendor_id=v.id
       ${poWhere} ORDER BY po.received_at DESC LIMIT 250`,
      poParams
    );
    for (const po of receivedPOs) {
      po.items = await queryAll(
        `SELECT poi.id, poi.product_id AS productId, p.name AS productName, p.sku, poi.quantity_received AS quantityReceived, poi.unit_cost AS unitCost, sb.id AS batchId
         FROM purchase_order_items poi JOIN products p ON poi.product_id=p.id LEFT JOIN stock_batches sb ON sb.po_number=? AND sb.product_id=poi.product_id WHERE poi.po_id=?`,
        [po.po_number, po.id]
      );
    }

    return NextResponse.json({ returns, total, page, limit, totalPages: Math.ceil(total / limit), receivedPOs });
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

    const { poId, poNumber, vendorId, items, reason, notes } = await req.json();
    if (!vendorId) return NextResponse.json({ error: 'Vendor is required' }, { status: 400 });
    if (!items || items.length === 0) return NextResponse.json({ error: 'No items provided' }, { status: 400 });

    const totalCredit = items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unitCost), 0);
    const returnNumber = `PR-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    const returnId = await insertReturningId(
      `INSERT INTO purchase_returns (return_number, original_po_id, original_po_number, vendor_id, staff_id, total_credit, reason, notes) VALUES (?,?,?,?,?,?,?,?)`,
      [returnNumber, poId || null, poNumber || null, vendorId, session.id, totalCredit, reason || '', notes || '']
    );

    for (const item of items) {
      const creditAmt = Number(item.quantity) * Number(item.unitCost);
      await execute(`INSERT INTO purchase_return_items (return_id, product_id, product_name, sku, quantity, unit_cost, credit_amount, batch_id, reason) VALUES (?,?,?,?,?,?,?,?,?)`,
        [returnId, item.productId, item.productName, item.sku, item.quantity, item.unitCost, creditAmt, item.batchId || null, item.reason || reason || '']);

      const prod = await queryOne(`SELECT stock_quantity FROM products WHERE id=?`, [item.productId]);
      const prevStock = Number(prod?.stock_quantity || 0);
      const newStock = Math.max(0, prevStock - Number(item.quantity));
      await execute(`UPDATE products SET stock_quantity=?, updated_at=datetime('now') WHERE id=?`, [newStock, item.productId]);

      if (item.batchId) {
        await execute(`UPDATE stock_batches SET quantity_remaining=MAX(0, quantity_remaining-?) WHERE id=?`, [item.quantity, item.batchId]);
      } else {
        const batches = await queryAll(`SELECT id, quantity_remaining FROM stock_batches WHERE product_id=? AND quantity_remaining>0 ORDER BY received_at ASC`, [item.productId]);
        let remaining = Number(item.quantity);
        for (const b of batches) {
          if (remaining <= 0) break;
          const deduct = Math.min(remaining, Number(b.quantity_remaining));
          await execute(`UPDATE stock_batches SET quantity_remaining=quantity_remaining-? WHERE id=?`, [deduct, b.id]);
          remaining -= deduct;
        }
      }
      await execute(`INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason) VALUES (?,'RETURN_VENDOR',?,?,?,?,?,?)`,
        [item.productId, -Number(item.quantity), prevStock, newStock, returnNumber, session.id, `Purchase return to vendor - ${item.reason || reason || ''}`]);
    }

    const lastBal = await queryOne(`SELECT balance FROM vendor_ledger WHERE vendor_id=? ORDER BY entry_date DESC LIMIT 1`, [vendorId]);
    const newBal = Number(lastBal?.balance || 0) + totalCredit;
    const db = getDB();
    await db.batch([
      db.prepare(`INSERT INTO vendor_ledger (vendor_id, type, reference_number, description, debit, credit, balance, created_by) VALUES (?,'PURCHASE_RETURN',?,?,?,0,?,?)`)
        .bind(vendorId, returnNumber, `Purchase return credit - ${reason || ''}`, totalCredit, newBal, session.id),
      db.prepare(`UPDATE vendors SET total_purchases=MAX(0, total_purchases-?) WHERE id=?`).bind(totalCredit, vendorId),
      db.prepare(`INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'PURCHASE_RETURN_PROCESSED','INVENTORY','INFO',?,'127.0.0.1')`)
        .bind(session.id, session.name, JSON.stringify({ returnNumber, totalCredit, vendorId })),
    ]);

    return NextResponse.json({ success: true, returnNumber, totalCredit });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!checkUserPermission(session.role, session.permissions, 'manage_pos_intake') && !checkUserPermission(session.role, session.permissions, 'create_pos'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const { returnId, items, reason, notes } = await req.json();
    if (!returnId) return NextResponse.json({ error: 'Return ID is required' }, { status: 400 });
    if (!items || items.length === 0) return NextResponse.json({ error: 'At least one return item is required' }, { status: 400 });

    const oldReturn = await queryOne(`SELECT * FROM purchase_returns WHERE id=?`, [returnId]);
    if (!oldReturn) return NextResponse.json({ error: 'Purchase return not found' }, { status: 404 });

    const oldItems = await queryAll(`SELECT * FROM purchase_return_items WHERE return_id=?`, [returnId]);

    // Rollback old stock deductions
    for (const oldIt of oldItems) {
      const prod = await queryOne(`SELECT stock_quantity FROM products WHERE id=?`, [oldIt.product_id]);
      const restoredStock = Number(prod?.stock_quantity || 0) + Number(oldIt.quantity);
      await execute(`UPDATE products SET stock_quantity=?, updated_at=datetime('now') WHERE id=?`, [restoredStock, oldIt.product_id]);
      if (oldIt.batch_id) await execute(`UPDATE stock_batches SET quantity_remaining=quantity_remaining+? WHERE id=?`, [oldIt.quantity, oldIt.batch_id]);
    }
    if (oldReturn.vendor_id && Number(oldReturn.total_credit) > 0)
      await execute(`UPDATE vendors SET total_purchases=total_purchases+? WHERE id=?`, [Number(oldReturn.total_credit), oldReturn.vendor_id]);

    await execute(`DELETE FROM purchase_return_items WHERE return_id=?`, [returnId]);

    let newTotalCredit = 0;
    for (const item of items) {
      const creditAmt = Number(item.quantity) * Number(item.unitCost);
      newTotalCredit += creditAmt;
      await execute(`INSERT INTO purchase_return_items (return_id, product_id, product_name, sku, quantity, unit_cost, credit_amount, batch_id, reason) VALUES (?,?,?,?,?,?,?,?,?)`,
        [returnId, item.productId, item.productName, item.sku, item.quantity, item.unitCost, creditAmt, item.batchId || null, item.reason || reason || '']);

      const prod = await queryOne(`SELECT stock_quantity FROM products WHERE id=?`, [item.productId]);
      const prevStock = Number(prod?.stock_quantity || 0);
      const newStock = Math.max(0, prevStock - Number(item.quantity));
      await execute(`UPDATE products SET stock_quantity=?, updated_at=datetime('now') WHERE id=?`, [newStock, item.productId]);
      if (item.batchId) await execute(`UPDATE stock_batches SET quantity_remaining=MAX(0, quantity_remaining-?) WHERE id=?`, [item.quantity, item.batchId]);
      await execute(`INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason) VALUES (?,'RETURN_VENDOR',?,?,?,?,?,?)`,
        [item.productId, -Number(item.quantity), prevStock, newStock, oldReturn.return_number, session.id, `Purchase return edited - ${item.reason || reason || ''}`]);
    }

    if (oldReturn.vendor_id) {
      const lastBal = await queryOne(`SELECT balance FROM vendor_ledger WHERE vendor_id=? ORDER BY entry_date DESC LIMIT 1`, [oldReturn.vendor_id]);
      const newBal = Number(lastBal?.balance || 0) + newTotalCredit;
      await execute(`INSERT INTO vendor_ledger (vendor_id, type, reference_number, description, debit, credit, balance, created_by) VALUES (?,'PURCHASE_RETURN_UPDATE',?,?,?,0,?,?)`,
        [oldReturn.vendor_id, oldReturn.return_number, `Purchase return edited - ${reason || oldReturn.reason}`, newTotalCredit, newBal, session.id]);
      await execute(`UPDATE vendors SET total_purchases=MAX(0, total_purchases-?) WHERE id=?`, [newTotalCredit, oldReturn.vendor_id]);
    }

    await execute(`UPDATE purchase_returns SET total_credit=?, reason=?, notes=? WHERE id=?`,
      [newTotalCredit, reason || oldReturn.reason, notes || oldReturn.notes, returnId]);
    await execute(`INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'PURCHASE_RETURN_UPDATED','INVENTORY','INFO',?,'127.0.0.1')`,
      [session.id, session.name, JSON.stringify({ returnNumber: oldReturn.return_number, newTotalCredit })]);

    return NextResponse.json({ success: true, message: `Purchase Return ${oldReturn.return_number} updated successfully`, totalCredit: newTotalCredit });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!checkUserPermission(session.role, session.permissions, 'delete_invoices') && !checkUserPermission(session.role, session.permissions, 'create_pos'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const returnId = new URL(req.url).searchParams.get('returnId');
    if (!returnId) return NextResponse.json({ error: 'Return ID is required' }, { status: 400 });

    const pReturn = await queryOne(`SELECT * FROM purchase_returns WHERE id=?`, [returnId]);
    if (!pReturn) return NextResponse.json({ error: 'Purchase return not found' }, { status: 404 });

    const items = await queryAll(`SELECT * FROM purchase_return_items WHERE return_id=?`, [returnId]);
    for (const it of items) {
      const prod = await queryOne(`SELECT stock_quantity FROM products WHERE id=?`, [it.product_id]);
      const curStock = Number(prod?.stock_quantity || 0);
      const newStock = curStock + Number(it.quantity);
      await execute(`UPDATE products SET stock_quantity=?, updated_at=datetime('now') WHERE id=?`, [newStock, it.product_id]);
      if (it.batch_id) await execute(`UPDATE stock_batches SET quantity_remaining=quantity_remaining+? WHERE id=?`, [it.quantity, it.batch_id]);
      await execute(`INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason) VALUES (?,'PURCHASE_RECEIVE',?,?,?,?,?,?)`,
        [it.product_id, Number(it.quantity), curStock, newStock, pReturn.return_number, session.id, `Purchase return ${pReturn.return_number} voided - stock restored`]);
    }

    if (pReturn.vendor_id && Number(pReturn.total_credit) > 0) {
      const creditAmt = Number(pReturn.total_credit);
      const lastBal = await queryOne(`SELECT balance FROM vendor_ledger WHERE vendor_id=? ORDER BY entry_date DESC LIMIT 1`, [pReturn.vendor_id]);
      const newBal = Number(lastBal?.balance || 0) - creditAmt;
      await execute(`UPDATE vendors SET total_purchases=total_purchases+? WHERE id=?`, [creditAmt, pReturn.vendor_id]);
      await execute(`INSERT INTO vendor_ledger (vendor_id, type, reference_number, description, debit, credit, balance, created_by) VALUES (?,'PURCHASE_RETURN_VOID',?,?,0,?,?,?)`,
        [pReturn.vendor_id, pReturn.return_number, `Reversal of voided purchase return ${pReturn.return_number}`, creditAmt, newBal, session.id]);
    }

    await execute(`DELETE FROM purchase_return_items WHERE return_id=?`, [returnId]);
    await execute(`DELETE FROM purchase_returns WHERE id=?`, [returnId]);
    await execute(`INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'PURCHASE_RETURN_DELETED','INVENTORY','WARNING',?,'127.0.0.1')`,
      [session.id, session.name, JSON.stringify({ returnNumber: pReturn.return_number, totalCredit: pReturn.total_credit })]);

    return NextResponse.json({ success: true, message: `Purchase Return ${pReturn.return_number} deleted and stock/balances reversed.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
