export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute, getDB } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { checkUserPermission } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!checkUserPermission(session.role, session.permissions, 'adjust_stock'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const { productId, adjustmentType, quantity, mode = 'DELTA', reason } = await req.json();
    if (!productId) return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    if (!reason) return NextResponse.json({ error: 'A justification reason is required' }, { status: 400 });

    const prod = await queryOne(`SELECT id, name, sku, stock_quantity FROM products WHERE id = ?`, [productId]);
    if (!prod) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const prevStock = parseFloat(prod.stock_quantity) || 0;
    let newStock = prevStock;
    let delta = 0;

    if (mode === 'SET_EXACT') {
      newStock = parseFloat(quantity) || 0;
      if (newStock < 0) throw new Error('Stock quantity cannot be negative');
      delta = Number((newStock - prevStock).toFixed(2));
    } else {
      delta = parseFloat(quantity) || 0;
      newStock = Number((prevStock + delta).toFixed(2));
      if (newStock < 0) throw new Error(`Stock cannot drop below 0 (Current: ${prevStock}, Change: ${delta})`);
    }

    const refId = `ADJ-${Date.now().toString().slice(-6)}`;
    const movType = adjustmentType || (delta >= 0 ? 'ADJUSTMENT_FOUND' : 'ADJUSTMENT_DAMAGE');

    const db = getDB();
    await db.batch([
      db.prepare(`UPDATE products SET stock_quantity=?, updated_at=datetime('now') WHERE id=?`).bind(newStock, productId),
      db.prepare(`INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason) VALUES (?,?,?,?,?,?,?,?)`)
        .bind(productId, movType, delta, prevStock, newStock, refId, session.id, reason),
      db.prepare(`INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address) VALUES (?,?,'INVENTORY_ADJUSTED','INVENTORY',?,?,'127.0.0.1')`)
        .bind(session.id, session.name, Math.abs(delta) > 50 ? 'WARNING' : 'INFO',
          JSON.stringify({ productId, productName: prod.name, sku: prod.sku, previousStock: prevStock, newStock, delta, reason })),
    ]);

    return NextResponse.json({ success: true, product: { id: prod.id, name: prod.name, sku: prod.sku, previousStock: prevStock, newStock, delta } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Adjustment failed' }, { status: 400 });
  }
}
