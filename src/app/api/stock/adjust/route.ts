import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const client = await getClient();
  try {
    const session = getUserFromRequest(req);
    const body = await req.json();
    const {
      productId,
      adjustmentType, // 'ADJUSTMENT_DAMAGE', 'ADJUSTMENT_FOUND', 'COUNT_CORRECTION', 'RETURN_CUSTOMER', 'RETURN_VENDOR'
      quantity, // number to change (e.g. +10 or -5) OR target quantity
      mode = 'DELTA', // 'DELTA' (add/subtract) or 'SET_EXACT' (overwrite to physical count)
      reason,
    } = body;

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json({ error: 'A justification reason is required for inventory audits' }, { status: 400 });
    }

    await client.query('BEGIN');

    const prodRes = await client.query(
      `SELECT id, name, sku, stock_quantity, cost_price FROM products WHERE id = $1 FOR UPDATE`,
      [productId]
    );

    if (prodRes.rows.length === 0) {
      throw new Error('Product not found');
    }

    const prod = prodRes.rows[0];
    const prevStock = prod.stock_quantity;
    let newStock = prevStock;
    let delta = 0;

    if (mode === 'SET_EXACT') {
      newStock = parseInt(quantity, 10);
      if (newStock < 0) throw new Error('Stock quantity cannot be negative');
      delta = newStock - prevStock;
    } else {
      delta = parseInt(quantity, 10);
      newStock = prevStock + delta;
      if (newStock < 0) throw new Error(`Stock cannot drop below 0 (Current: ${prevStock}, Change: ${delta})`);
    }

    // Update product stock
    await client.query(`UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [
      newStock,
      productId,
    ]);

    // Insert stock movement ledger
    const refId = `ADJ-${Date.now().toString().slice(-6)}`;
    await client.query(
      `INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        productId,
        adjustmentType || (delta >= 0 ? 'ADJUSTMENT_FOUND' : 'ADJUSTMENT_DAMAGE'),
        delta,
        prevStock,
        newStock,
        refId,
        session?.id || 1,
        reason,
      ]
    );

    // Insert audit log
    await client.query(
      `INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address)
       VALUES ($1, $2, 'INVENTORY_ADJUSTED', 'INVENTORY', $3, $4, '127.0.0.1')`,
      [
        session?.id || 1,
        session?.name || 'Inventory Lead',
        Math.abs(delta) > 50 ? 'WARNING' : 'INFO',
        JSON.stringify({
          productId,
          productName: prod.name,
          sku: prod.sku,
          previousStock: prevStock,
          newStock,
          delta,
          reason,
        }),
      ]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      product: {
        id: prod.id,
        name: prod.name,
        sku: prod.sku,
        previousStock: prevStock,
        newStock,
        delta,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Stock adjustment error:', error);
    return NextResponse.json({ error: error.message || 'Adjustment failed' }, { status: 400 });
  } finally {
    client.release();
  }
}
