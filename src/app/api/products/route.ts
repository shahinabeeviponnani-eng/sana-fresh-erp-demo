import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const lowStock = searchParams.get('lowStock') === 'true';

    let queryText = `
      SELECT 
        p.id, p.sku, p.barcode, p.name, p.description, p.category_id,
        p.cost_price, p.retail_price, p.wholesale_price, p.min_wholesale_qty,
        p.stock_quantity, p.reorder_level, p.unit, p.image_url, p.is_active,
        p.created_at, p.updated_at,
        c.name AS category_name, c.code AS category_code
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true
    `;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      queryText += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`;
    }

    if (category) {
      params.push(category);
      queryText += ` AND (c.code = $${params.length} OR c.id::text = $${params.length})`;
    }

    if (lowStock) {
      queryText += ` AND p.stock_quantity <= p.reorder_level`;
    }

    queryText += ` ORDER BY p.id ASC`;

    const res = await query(queryText, params);
    return NextResponse.json({ products: res.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getUserFromRequest(req);
    const body = await req.json();
    const {
      sku,
      barcode,
      name,
      description,
      category_id,
      cost_price,
      retail_price,
      wholesale_price,
      min_wholesale_qty,
      stock_quantity,
      reorder_level,
      unit,
    } = body;

    if (!sku || !name || retail_price === undefined) {
      return NextResponse.json({ error: 'SKU, Product Name, and Retail Price are required' }, { status: 400 });
    }

    const res = await query(
      `INSERT INTO products (
        sku, barcode, name, description, category_id,
        cost_price, retail_price, wholesale_price, min_wholesale_qty,
        stock_quantity, reorder_level, unit
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        sku.toUpperCase().trim(),
        barcode || null,
        name.trim(),
        description || '',
        category_id || null,
        Number(cost_price) || 0,
        Number(retail_price) || 0,
        Number(wholesale_price) || Number(retail_price) * 0.8,
        Number(min_wholesale_qty) || 10,
        Number(stock_quantity) || 0,
        Number(reorder_level) || 15,
        unit || 'pcs',
      ]
    );

    const product = res.rows[0];

    // Log stock movement if initial stock > 0
    if (Number(stock_quantity) > 0) {
      await query(
        `INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason)
         VALUES ($1, 'PURCHASE_RECEIVE', $2, 0, $2, 'INIT-PROD', $3, 'Initial inventory count upon product creation')`,
        [product.id, Number(stock_quantity), session?.id || null]
      );
    }

    await logAuditEvent({
      staffId: session?.id,
      staffName: session?.name || 'Admin',
      action: 'PRODUCT_CREATED',
      module: 'INVENTORY',
      details: { sku: product.sku, name: product.name, retail_price: product.retail_price, wholesale_price: product.wholesale_price },
    });

    return NextResponse.json({ product, success: true }, { status: 201 });
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A product with this SKU already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = getUserFromRequest(req);
    const body = await req.json();
    const {
      id,
      sku,
      barcode,
      name,
      description,
      category_id,
      cost_price,
      retail_price,
      wholesale_price,
      min_wholesale_qty,
      reorder_level,
      unit,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const res = await query(
      `UPDATE products
       SET sku = $1, barcode = $2, name = $3, description = $4, category_id = $5,
           cost_price = $6, retail_price = $7, wholesale_price = $8,
           min_wholesale_qty = $9, reorder_level = $10, unit = $11, updated_at = CURRENT_TIMESTAMP
       WHERE id = $12
       RETURNING *`,
      [
        sku.toUpperCase().trim(),
        barcode || null,
        name.trim(),
        description || '',
        category_id || null,
        Number(cost_price),
        Number(retail_price),
        Number(wholesale_price),
        Number(min_wholesale_qty),
        Number(reorder_level),
        unit,
        id,
      ]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    await logAuditEvent({
      staffId: session?.id,
      staffName: session?.name || 'Staff',
      action: 'PRODUCT_UPDATED',
      module: 'INVENTORY',
      details: { id, sku, name },
    });

    return NextResponse.json({ product: res.rows[0], success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getUserFromRequest(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    // Soft delete to protect relational integrity with historical orders
    await query(`UPDATE products SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);

    await logAuditEvent({
      staffId: session?.id,
      staffName: session?.name || 'Admin',
      action: 'PRODUCT_ARCHIVED',
      module: 'INVENTORY',
      details: { productId: id },
    });

    return NextResponse.json({ success: true, message: 'Product archived successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
