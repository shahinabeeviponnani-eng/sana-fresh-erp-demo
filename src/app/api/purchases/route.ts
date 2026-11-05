import { NextRequest, NextResponse } from 'next/server';
import { getClient, query } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export async function GET() {
  try {
    const res = await query(`
      SELECT 
        po.id, po.po_number, po.status, po.total_amount, po.payment_status,
        po.expected_delivery_date, po.received_at, po.notes, po.created_at,
        v.id AS vendor_id, v.name AS vendor_name, v.company_name AS vendor_company,
        u.name AS staff_name,
        json_agg(
          json_build_object(
            'id', poi.id,
            'productId', poi.product_id,
            'productName', p.name,
            'sku', p.sku,
            'quantityOrdered', poi.quantity_ordered,
            'quantityReceived', poi.quantity_received,
            'unitCost', poi.unit_cost,
            'totalCost', poi.total_cost
          )
        ) AS items
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN users u ON po.staff_id = u.id
      LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
      LEFT JOIN products p ON poi.product_id = p.id
      GROUP BY po.id, v.id, u.id
      ORDER BY po.created_at DESC;
    `);
    return NextResponse.json({ purchaseOrders: res.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const client = await getClient();
  try {
    const session = getUserFromRequest(req);
    const body = await req.json();
    const {
      vendorId,
      items, // Array of { productId, quantity, unitCost }
      expectedDeliveryDate,
      notes,
    } = body;

    if (!vendorId) {
      return NextResponse.json({ error: 'Vendor must be selected' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    await client.query('BEGIN');

    const totalAmount = items.reduce(
      (sum: number, it: any) => sum + Number(it.quantity) * Number(it.unitCost),
      0
    );

    const poNumber = `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    const poRes = await client.query(
      `INSERT INTO purchase_orders (
        po_number, vendor_id, staff_id, status, total_amount, payment_status, expected_delivery_date, notes
      ) VALUES ($1, $2, $3, 'ORDERED', $4, 'UNPAID', $5, $6)
      RETURNING id, po_number`,
      [poNumber, vendorId, session?.id || 1, totalAmount, expectedDeliveryDate || null, notes || '']
    );

    const poId = poRes.rows[0].id;

    for (const it of items) {
      const lineCost = Number(it.quantity) * Number(it.unitCost);
      await client.query(
        `INSERT INTO purchase_order_items (po_id, product_id, quantity_ordered, quantity_received, unit_cost, total_cost)
         VALUES ($1, $2, $3, 0, $4, $5)`,
        [poId, it.productId, parseInt(it.quantity, 10), Number(it.unitCost), lineCost]
      );
    }

    // Update vendor total_purchases
    await client.query(`UPDATE vendors SET total_purchases = total_purchases + $1 WHERE id = $2`, [
      totalAmount,
      vendorId,
    ]);

    await client.query(
      `INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address)
       VALUES ($1, $2, 'PO_ORDER_CREATED', 'VENDORS', 'INFO', $3, '127.0.0.1')`,
      [session?.id || 1, session?.name || 'Manager', JSON.stringify({ poNumber, totalAmount, vendorId })]
    );

    await client.query('COMMIT');

    return NextResponse.json({ success: true, poId, poNumber });
  } catch (error: any) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    client.release();
  }
}

// Receive Shipment -> Restock Products
export async function PATCH(req: NextRequest) {
  const client = await getClient();
  try {
    const session = getUserFromRequest(req);
    const body = await req.json();
    const { poId } = body;

    if (!poId) {
      return NextResponse.json({ error: 'Purchase Order ID is required' }, { status: 400 });
    }

    await client.query('BEGIN');

    const poRes = await client.query(
      `SELECT po.*, v.company_name AS vendor_name FROM purchase_orders po JOIN vendors v ON po.vendor_id = v.id WHERE po.id = $1 FOR UPDATE`,
      [poId]
    );

    if (poRes.rows.length === 0) {
      throw new Error('Purchase order not found');
    }

    const po = poRes.rows[0];
    if (po.status === 'RECEIVED') {
      throw new Error('Purchase order has already been received');
    }

    // Fetch items
    const itemsRes = await client.query(
      `SELECT poi.*, p.stock_quantity, p.cost_price, p.name AS product_name 
       FROM purchase_order_items poi 
       JOIN products p ON poi.product_id = p.id 
       WHERE poi.po_id = $1 FOR UPDATE`,
      [poId]
    );

    for (const it of itemsRes.rows) {
      const qtyToReceive = it.quantity_ordered - it.quantity_received;
      if (qtyToReceive > 0) {
        const newStock = it.stock_quantity + qtyToReceive;

        // Update product stock and update cost price to latest vendor unit cost
        await client.query(
          `UPDATE products SET stock_quantity = $1, cost_price = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [newStock, it.unit_cost, it.product_id]
        );

        // Update PO item
        await client.query(`UPDATE purchase_order_items SET quantity_received = quantity_ordered WHERE id = $1`, [
          it.id,
        ]);

        // Insert stock movement
        await client.query(
          `INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason)
           VALUES ($1, 'PURCHASE_RECEIVE', $2, $3, $4, $5, $6, $7)`,
          [
            it.product_id,
            qtyToReceive,
            it.stock_quantity,
            newStock,
            po.po_number,
            session?.id || 1,
            `Vendor delivery received from ${po.vendor_name}`,
          ]
        );
      }
    }

    // Mark PO received
    await client.query(
      `UPDATE purchase_orders SET status = 'RECEIVED', payment_status = 'PAID', received_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [poId]
    );

    await client.query(
      `INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address)
       VALUES ($1, $2, 'PO_SHIPMENT_RECEIVED', 'INVENTORY', 'INFO', $3, '127.0.0.1')`,
      [session?.id || 1, session?.name || 'Staff', JSON.stringify({ poNumber: po.po_number, vendor: po.vendor_name })]
    );

    await client.query('COMMIT');

    return NextResponse.json({ success: true, message: `PO ${po.po_number} received into stock successfully!` });
  } catch (error: any) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    client.release();
  }
}
