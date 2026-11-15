export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, execute, insertReturningId } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { checkUserPermission } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!checkUserPermission(session.role, session.permissions, 'view_products'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const lowStock = searchParams.get('lowStock') === 'true';

    let sql = `
      SELECT p.*, c.name AS category_name, c.code AS category_code
      FROM products p LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
    `;
    const params: any[] = [];

    if (search) {
      sql += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category) {
      sql += ` AND (c.code = ? OR CAST(c.id AS TEXT) = ?)`;
      params.push(category, category);
    }
    if (lowStock) sql += ` AND p.stock_quantity <= p.reorder_level`;
    sql += ` ORDER BY p.id ASC`;

    const products = await queryAll(sql, params);
    return NextResponse.json({ products });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!checkUserPermission(session.role, session.permissions, 'manage_products'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const { sku, barcode, name, description, category_id, cost_price, retail_price,
      wholesale_price, min_wholesale_qty, stock_quantity, reorder_level, unit } = await req.json();

    if (!sku || !name || retail_price === undefined)
      return NextResponse.json({ error: 'SKU, Name and Retail Price are required' }, { status: 400 });

    if (barcode) {
      const dup = await queryOne(`SELECT id FROM products WHERE barcode = ? AND is_active = 1`, [barcode]);
      if (dup) return NextResponse.json({ error: 'A product with this barcode already exists.' }, { status: 409 });
    }

    const skuDup = await queryOne(`SELECT id FROM products WHERE sku = ?`, [sku.toUpperCase().trim()]);
    if (skuDup) return NextResponse.json({ error: 'A product with this SKU already exists.' }, { status: 409 });

    const id = await insertReturningId(
      `INSERT INTO products (sku, barcode, name, description, category_id, cost_price, retail_price,
        wholesale_price, min_wholesale_qty, stock_quantity, reorder_level, unit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sku.toUpperCase().trim(), barcode || null, name.trim(), description || '',
       category_id || null, Number(cost_price) || 0, Number(retail_price) || 0,
       Number(wholesale_price) || Number(retail_price) * 0.8, Number(min_wholesale_qty) || 10,
       Number(stock_quantity) || 0, Number(reorder_level) || 15, unit || 'pcs']
    );

    if (Number(stock_quantity) > 0) {
      await execute(
        `INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason)
         VALUES (?, 'PURCHASE_RECEIVE', ?, 0, ?, 'INIT-PROD', ?, 'Initial inventory count')`,
        [id, Number(stock_quantity), Number(stock_quantity), session.id]
      );
    }

    const product = await queryOne(`SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`, [id]);
    await logAuditEvent(session, 'PRODUCT_CREATED', 'INVENTORY', { sku, name });
    return NextResponse.json({ product, success: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!checkUserPermission(session.role, session.permissions, 'manage_products'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const { id, sku, barcode, name, description, category_id, cost_price, retail_price,
      wholesale_price, min_wholesale_qty, reorder_level, unit } = await req.json();

    if (!id) return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });

    if (barcode) {
      const dup = await queryOne(`SELECT id FROM products WHERE barcode = ? AND id != ? AND is_active = 1`, [barcode, id]);
      if (dup) return NextResponse.json({ error: 'A product with this barcode already exists.' }, { status: 409 });
    }

    await execute(
      `UPDATE products SET sku=?, barcode=?, name=?, description=?, category_id=?, cost_price=?,
       retail_price=?, wholesale_price=?, min_wholesale_qty=?, reorder_level=?, unit=?,
       updated_at=datetime('now') WHERE id=?`,
      [sku.toUpperCase().trim(), barcode || null, name.trim(), description || '',
       category_id || null, Number(cost_price), Number(retail_price), Number(wholesale_price),
       Number(min_wholesale_qty), Number(reorder_level), unit, id]
    );

    const product = await queryOne(`SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`, [id]);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    await logAuditEvent(session, 'PRODUCT_UPDATED', 'INVENTORY', { id, sku, name });
    return NextResponse.json({ product, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!checkUserPermission(session.role, session.permissions, 'delete_products'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });

    await execute(`UPDATE products SET is_active=0, updated_at=datetime('now') WHERE id=?`, [id]);
    await logAuditEvent(session, 'PRODUCT_ARCHIVED', 'INVENTORY', { productId: id });
    return NextResponse.json({ success: true, message: 'Product archived successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
