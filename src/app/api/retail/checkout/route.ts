import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const client = await getClient();
  try {
    const session = getUserFromRequest(req);
    const body = await req.json();
    const {
      customerId,
      items, // Array of { productId, quantity, unitPrice, discount }
      paymentMethod = 'CASH',
      amountReceived,
      notes,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Cart cannot be empty' }, { status: 400 });
    }

    await client.query('BEGIN');

    // 1. Fetch products to verify pricing and stock availability
    const productIds = items.map(i => i.productId);
    const prodRes = await client.query(
      `SELECT id, sku, name, unit, cost_price, retail_price, stock_quantity FROM products WHERE id = ANY($1::int[]) FOR UPDATE`,
      [productIds]
    );

    const productMap = new Map();
    prodRes.rows.forEach(p => productMap.set(p.id, p));

    // Verify stock and calculate totals
    let subtotal = 0;
    let totalDiscount = 0;
    const verifiedItems: any[] = [];

    for (const item of items) {
      const prod = productMap.get(item.productId);
      if (!prod) {
        throw new Error(`Product ID ${item.productId} not found.`);
      }

      const qty = parseInt(item.quantity, 10);
      if (qty <= 0) {
        throw new Error(`Invalid quantity for ${prod.name}`);
      }

      if (prod.stock_quantity < qty) {
        throw new Error(`Insufficient stock for "${prod.name}". Available: ${prod.stock_quantity}, Requested: ${qty}`);
      }

      const unitPrice = Number(item.unitPrice || prod.retail_price);
      const discount = Number(item.discount || 0);
      const itemTotal = (unitPrice * qty) - discount;

      subtotal += (unitPrice * qty);
      totalDiscount += discount;

      verifiedItems.push({
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        unit: prod.unit,
        unitCost: Number(prod.cost_price),
        unitPrice,
        quantity: qty,
        discount,
        total: itemTotal,
        currentStock: prod.stock_quantity,
      });
    }

    const taxAmount = Number(((subtotal - totalDiscount) * 0.08).toFixed(2));
    const totalAmount = Number((subtotal - totalDiscount + taxAmount).toFixed(2));
    const paid = amountReceived !== undefined ? Number(amountReceived) : totalAmount;
    const changeDue = Math.max(0, Number((paid - totalAmount).toFixed(2)));

    // Generate unique POS order number
    const timestamp = Date.now().toString().slice(-6);
    const orderNumber = `POS-${new Date().getFullYear()}-${timestamp}`;

    // 2. Insert sales order
    const orderRes = await client.query(
      `INSERT INTO sales_orders (
        order_number, type, customer_id, staff_id, status,
        subtotal, discount_amount, tax_amount, total_amount,
        payment_method, payment_status, amount_paid, notes
      ) VALUES ($1, 'RETAIL', $2, $3, 'COMPLETED', $4, $5, $6, $7, $8, 'PAID', $9, $10)
      RETURNING id, order_number, created_at`,
      [
        orderNumber,
        customerId || null,
        session?.id || 1,
        subtotal,
        totalDiscount,
        taxAmount,
        totalAmount,
        paymentMethod,
        totalAmount, // Mark paid
        notes || 'In-store retail POS checkout',
      ]
    );

    const orderId = orderRes.rows[0].id;

    // 3. Insert items, deduct stock and record movements
    for (const item of verifiedItems) {
      await client.query(
        `INSERT INTO sales_order_items (
          order_id, product_id, product_name, sku, unit, unit_cost, unit_price, quantity, discount, total
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          orderId,
          item.productId,
          item.name,
          item.sku,
          item.unit,
          item.unitCost,
          item.unitPrice,
          item.quantity,
          item.discount,
          item.total,
        ]
      );

      // Deduct inventory
      const newStock = item.currentStock - item.quantity;
      await client.query(`UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [
        newStock,
        item.productId,
      ]);

      // Stock movement ledger
      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason)
         VALUES ($1, 'RETAIL_SALE', $2, $3, $4, $5, $6, 'POS Retail Register Sale')`,
        [item.productId, -item.quantity, item.currentStock, newStock, orderNumber, session?.id || 1]
      );
    }

    // 4. Audit Log
    await client.query(
      `INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address)
       VALUES ($1, $2, 'POS_SALE_COMPLETED', 'RETAIL', 'INFO', $3, '127.0.0.1')`,
      [
        session?.id || 1,
        session?.name || 'Cashier',
        JSON.stringify({
          orderNumber,
          totalAmount,
          itemCount: verifiedItems.length,
          paymentMethod,
        }),
      ]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      order: {
        id: orderId,
        orderNumber,
        type: 'RETAIL',
        subtotal,
        discount: totalDiscount,
        tax: taxAmount,
        total: totalAmount,
        paymentMethod,
        amountReceived: paid,
        changeDue,
        items: verifiedItems,
        createdAt: orderRes.rows[0].created_at,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('POS Checkout error:', error);
    return NextResponse.json({ error: error.message || 'Transaction failed' }, { status: 400 });
  } finally {
    client.release();
  }
}
