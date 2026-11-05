import { NextRequest, NextResponse } from 'next/server';
import { getClient, query } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');
    const customerId = searchParams.get('customerId');

    let sql = `
      SELECT 
        so.id,
        so.order_number,
        so.type,
        so.status,
        so.subtotal,
        so.discount_amount,
        so.tax_amount,
        so.total_amount,
        so.payment_method,
        so.payment_status,
        so.amount_paid,
        so.due_date,
        so.shipping_address,
        so.notes,
        so.created_at,
        c.id AS customer_id,
        c.name AS customer_name,
        c.company_name,
        c.credit_limit,
        c.current_balance,
        c.payment_terms,
        u.name AS staff_name,
        json_agg(
          json_build_object(
            'id', soi.id,
            'productId', soi.product_id,
            'productName', soi.product_name,
            'sku', soi.sku,
            'unit', soi.unit,
            'unitPrice', soi.unit_price,
            'unitCost', soi.unit_cost,
            'quantity', soi.quantity,
            'discount', soi.discount,
            'total', soi.total
          )
        ) AS items
      FROM sales_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      LEFT JOIN users u ON so.staff_id = u.id
      LEFT JOIN sales_order_items soi ON soi.order_id = so.id
      WHERE so.type = 'WHOLESALE'
    `;

    const params: any[] = [];
    if (status) {
      params.push(status);
      sql += ` AND so.status = $${params.length}`;
    }
    if (paymentStatus) {
      params.push(paymentStatus);
      sql += ` AND so.payment_status = $${params.length}`;
    }
    if (customerId) {
      params.push(customerId);
      sql += ` AND so.customer_id = $${params.length}`;
    }

    sql += ` GROUP BY so.id, c.id, u.id ORDER BY so.created_at DESC`;

    const res = await query(sql, params);
    return NextResponse.json({ orders: res.rows });
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
      customerId,
      items, // Array of { productId, quantity, unitPrice, discount }
      paymentMethod = 'BANK_TRANSFER', // BANK_TRANSFER, CREDIT, CASH
      paymentStatus = 'UNPAID', // PAID, PARTIAL, UNPAID
      amountPaid = 0,
      paymentTerms = 'NET_30',
      shippingAddress,
      notes,
    } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'A Wholesale Customer must be selected' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Order must contain at least one item' }, { status: 400 });
    }

    await client.query('BEGIN');

    // 1. Fetch and verify customer
    const custRes = await client.query(
      `SELECT id, name, company_name, type, credit_limit, current_balance, payment_terms FROM customers WHERE id = $1 FOR UPDATE`,
      [customerId]
    );

    if (custRes.rows.length === 0) {
      throw new Error('Customer not found');
    }

    const customer = custRes.rows[0];

    // 2. Fetch products and calculate total wholesale pricing
    const productIds = items.map(i => i.productId);
    const prodRes = await client.query(
      `SELECT id, sku, name, unit, cost_price, wholesale_price, retail_price, min_wholesale_qty, stock_quantity 
       FROM products WHERE id = ANY($1::int[]) FOR UPDATE`,
      [productIds]
    );

    const productMap = new Map();
    prodRes.rows.forEach(p => productMap.set(p.id, p));

    let subtotal = 0;
    let totalDiscount = 0;
    const verifiedItems: any[] = [];

    for (const it of items) {
      const prod = productMap.get(it.productId);
      if (!prod) throw new Error(`Product ID ${it.productId} not found.`);

      const qty = parseInt(it.quantity, 10);
      if (qty <= 0) throw new Error(`Invalid quantity for ${prod.name}`);

      if (prod.stock_quantity < qty) {
        throw new Error(
          `Insufficient stock for wholesale order: "${prod.name}". Available: ${prod.stock_quantity}, Requested: ${qty}`
        );
      }

      // Default to wholesale_price or custom price
      const unitPrice = Number(it.unitPrice || prod.wholesale_price);
      const discount = Number(it.discount || 0);
      const lineTotal = (unitPrice * qty) - discount;

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
        total: lineTotal,
        currentStock: prod.stock_quantity,
      });
    }

    const taxAmount = Number(((subtotal - totalDiscount) * 0.05).toFixed(2));
    const totalAmount = Number((subtotal - totalDiscount + taxAmount).toFixed(2));
    const paid = Number(amountPaid) || 0;
    const unpaidAmount = totalAmount - paid;

    // Check Credit Limit if payment is on credit / unpaid
    if (unpaidAmount > 0) {
      const projectedBalance = Number(customer.current_balance) + unpaidAmount;
      if (Number(customer.credit_limit) > 0 && projectedBalance > Number(customer.credit_limit)) {
        throw new Error(
          `Credit limit exceeded! Customer credit limit: $${customer.credit_limit}, Current balance: $${customer.current_balance}, Order unpaid portion: $${unpaidAmount}. Projected balance ($${projectedBalance.toFixed(2)}) exceeds limit.`
        );
      }
    }

    // Determine due date from payment terms
    let termDays = 30;
    if (paymentTerms === 'NET_15') termDays = 15;
    else if (paymentTerms === 'NET_60') termDays = 60;
    else if (paymentTerms === 'IMMEDIATE') termDays = 0;

    const timestamp = Date.now().toString().slice(-6);
    const orderNumber = `WHL-${new Date().getFullYear()}-${timestamp}`;

    // 3. Insert sales_orders
    const orderRes = await client.query(
      `INSERT INTO sales_orders (
        order_number, type, customer_id, staff_id, status,
        subtotal, discount_amount, tax_amount, total_amount,
        payment_method, payment_status, amount_paid, due_date, shipping_address, notes
      ) VALUES ($1, 'WHOLESALE', $2, $3, 'COMPLETED', $4, $5, $6, $7, $8, $9, $10, CURRENT_DATE + ($11 || ' days')::interval, $12, $13)
      RETURNING id, order_number, created_at, due_date`,
      [
        orderNumber,
        customerId,
        session?.id || 1,
        subtotal,
        totalDiscount,
        taxAmount,
        totalAmount,
        paymentMethod,
        paymentStatus,
        paid,
        termDays,
        shippingAddress || customer.company_name || '',
        notes || `B2B Wholesale fulfillment - Terms: ${paymentTerms}`,
      ]
    );

    const orderId = orderRes.rows[0].id;

    // 4. Insert items, deduct inventory, record stock movements
    for (const it of verifiedItems) {
      await client.query(
        `INSERT INTO sales_order_items (
          order_id, product_id, product_name, sku, unit, unit_cost, unit_price, quantity, discount, total
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [orderId, it.productId, it.name, it.sku, it.unit, it.unitCost, it.unitPrice, it.quantity, it.discount, it.total]
      );

      const newStock = it.currentStock - it.quantity;
      await client.query(`UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [
        newStock,
        it.productId,
      ]);

      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason)
         VALUES ($1, 'WHOLESALE_SALE', $2, $3, $4, $5, $6, 'B2B Wholesale Order Dispatch')`,
        [it.productId, -it.quantity, it.currentStock, newStock, orderNumber, session?.id || 1]
      );
    }

    // 5. Update customer balance if unpaid amount exists
    if (unpaidAmount > 0) {
      await client.query(`UPDATE customers SET current_balance = current_balance + $1 WHERE id = $2`, [
        unpaidAmount,
        customerId,
      ]);
    }

    // 6. Audit log
    await client.query(
      `INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address)
       VALUES ($1, $2, 'WHOLESALE_ORDER_CREATED', 'WHOLESALE', 'INFO', $3, '127.0.0.1')`,
      [
        session?.id || 1,
        session?.name || 'Wholesale Rep',
        JSON.stringify({
          orderNumber,
          customerName: customer.name,
          company: customer.company_name,
          totalAmount,
          paymentStatus,
          terms: paymentTerms,
        }),
      ]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      order: {
        id: orderId,
        orderNumber,
        totalAmount,
        customerName: customer.name,
        companyName: customer.company_name,
        items: verifiedItems,
        dueDate: orderRes.rows[0].due_date,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Wholesale Order error:', error);
    return NextResponse.json({ error: error.message || 'Wholesale order failed' }, { status: 400 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = getUserFromRequest(req);
    const body = await req.json();
    const { orderId, paymentStatus, amountPaid, status } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }

    const updates: string[] = [];
    const params: any[] = [orderId];

    if (paymentStatus) {
      params.push(paymentStatus);
      updates.push(`payment_status = $${params.length}`);
    }

    if (amountPaid !== undefined) {
      params.push(Number(amountPaid));
      updates.push(`amount_paid = $${params.length}`);
    }

    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const res = await query(
      `UPDATE sales_orders SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    await logAuditEvent({
      staffId: session?.id,
      staffName: session?.name || 'Staff',
      action: 'ORDER_STATUS_UPDATED',
      module: 'WHOLESALE',
      details: { orderId, paymentStatus, status },
    });

    return NextResponse.json({ success: true, order: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
