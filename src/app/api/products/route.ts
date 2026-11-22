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

    const canManageProducts = checkUserPermission(session.role, session.permissions, 'manage_products');
    const canAccessPos = checkUserPermission(session.role, session.permissions, 'access_pos');
    const canCreateInvoices = checkUserPermission(session.role, session.permissions, 'create_invoices');
    if (!canManageProducts && !canAccessPos && !canCreateInvoices)
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const { sku, barcode, name, description, category_id, cost_price, retail_price,
      wholesale_price, retail_margin_percent, wholesale_margin_percent, min_wholesale_qty, stock_quantity, reorder_level, unit, image_url } = await req.json();

    if (!name || (retail_price === undefined && retail_margin_percent === undefined))
      return NextResponse.json({ error: 'Product name and Retail Price (or Retail Margin %) are required' }, { status: 400 });

    const cleanBarcode = barcode && typeof barcode === 'string' && barcode.trim() ? barcode.trim() : null;
    if (cleanBarcode) {
      const dup = await queryOne(`SELECT id FROM products WHERE barcode = ? AND is_active = 1`, [cleanBarcode]);
      if (dup) return NextResponse.json({ error: 'A product with this barcode already exists.' }, { status: 409 });
    }

    let finalSku = sku && typeof sku === 'string' && sku.trim() ? sku.trim().toUpperCase() : '';
    if (!finalSku) {
      if (cleanBarcode) {
        finalSku = cleanBarcode.toUpperCase();
      } else {
        finalSku = `SKU-${Date.now().toString().slice(-6)}`;
      }
    }

    const skuDup = await queryOne(`SELECT id FROM products WHERE sku = ?`, [finalSku]);
    if (skuDup) {
      if (!sku || !sku.trim()) {
        finalSku = `${finalSku}-${Math.floor(100 + Math.random() * 900)}`;
      } else {
        return NextResponse.json({ error: 'A product with this SKU already exists.' }, { status: 409 });
      }
    }

    const initStock = Number(stock_quantity) || 0;
    const costPriceNum = Number(cost_price) || 0;
    let retMarginNum = retail_margin_percent !== undefined && retail_margin_percent !== '' ? Number(retail_margin_percent) : NaN;
    let wsMarginNum = wholesale_margin_percent !== undefined && wholesale_margin_percent !== '' ? Number(wholesale_margin_percent) : NaN;

    let retailPriceNum = Number(retail_price);
    if ((isNaN(retailPriceNum) || retailPriceNum <= 0) && costPriceNum > 0 && !isNaN(retMarginNum) && retMarginNum > 0) {
      retailPriceNum = Number((costPriceNum * (1 + retMarginNum / 100)).toFixed(2));
    } else if (isNaN(retailPriceNum)) {
      retailPriceNum = 0;
    }

    if ((isNaN(retMarginNum) || retMarginNum === 0) && costPriceNum > 0 && retailPriceNum > 0) {
      retMarginNum = Number((((retailPriceNum - costPriceNum) / costPriceNum) * 100).toFixed(2));
    }
    if (isNaN(retMarginNum)) retMarginNum = 0;

    let wholesalePriceNum = wholesale_price !== undefined && wholesale_price !== '' ? Number(wholesale_price) : NaN;
    if ((isNaN(wholesalePriceNum) || wholesalePriceNum <= 0) && costPriceNum > 0 && !isNaN(wsMarginNum) && wsMarginNum > 0) {
      wholesalePriceNum = Number((costPriceNum * (1 + wsMarginNum / 100)).toFixed(2));
    } else if (isNaN(wholesalePriceNum)) {
      wholesalePriceNum = Number((retailPriceNum * 0.8).toFixed(2));
    }

    if ((isNaN(wsMarginNum) || wsMarginNum === 0) && costPriceNum > 0 && wholesalePriceNum > 0) {
      wsMarginNum = Number((((wholesalePriceNum - costPriceNum) / costPriceNum) * 100).toFixed(2));
    }
    if (isNaN(wsMarginNum)) wsMarginNum = 0;

    const id = await insertReturningId(
      `INSERT INTO products (sku, barcode, name, description, category_id, cost_price, retail_price,
        wholesale_price, retail_margin_percent, wholesale_margin_percent, min_wholesale_qty, stock_quantity, reorder_level, unit, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [finalSku, cleanBarcode, name.trim(), description || '',
       category_id || null, costPriceNum, retailPriceNum,
       wholesalePriceNum, retMarginNum, wsMarginNum, Number(min_wholesale_qty) || 10,
       initStock, Number(reorder_level) || 15, unit || 'pcs', image_url || null]
    );

    if (initStock > 0) {
      const batchNum = `BAT-INIT-${id}-${Date.now().toString().slice(-4)}`;
      await execute(
        `INSERT INTO stock_batches (product_id, batch_number, po_number, vendor_id, quantity_received, quantity_remaining, unit_cost, received_at, created_by)
         VALUES (?, ?, 'INIT-STOCK', NULL, ?, ?, ?, datetime('now'), ?)`,
        [id, batchNum, initStock, initStock, costPriceNum, session.id || 1]
      );
      await execute(
        `INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason)
         VALUES (?, 'PURCHASE_RECEIVE', ?, 0, ?, 'INIT-PROD', ?, 'Initial shelf inventory / POS quick-add')`,
        [id, initStock, initStock, session.id || 1]
      );
    }

    const product = await queryOne(
      `SELECT p.*, c.name AS category_name, c.code AS category_code FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`,
      [id]
    );
    await logAuditEvent(session, 'PRODUCT_CREATED', 'INVENTORY', { sku: finalSku, name });
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
      wholesale_price, retail_margin_percent, wholesale_margin_percent, min_wholesale_qty, reorder_level, unit, image_url } = await req.json();

    if (!id) return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });

    if (barcode) {
      const dup = await queryOne(`SELECT id FROM products WHERE barcode = ? AND id != ? AND is_active = 1`, [barcode, id]);
      if (dup) return NextResponse.json({ error: 'A product with this barcode already exists.' }, { status: 409 });
    }

    const costNum = Number(cost_price) || 0;
    let retPriceNum = Number(retail_price) || 0;
    let retMarginNum = retail_margin_percent !== undefined && retail_margin_percent !== '' ? Number(retail_margin_percent) : 0;
    if (retMarginNum > 0 && costNum > 0 && (!retPriceNum || retPriceNum <= 0)) {
      retPriceNum = Number((costNum * (1 + retMarginNum / 100)).toFixed(2));
    } else if (retMarginNum === 0 && costNum > 0 && retPriceNum > 0) {
      retMarginNum = Number((((retPriceNum - costNum) / costNum) * 100).toFixed(2));
    }

    let wsPriceNum = Number(wholesale_price) || 0;
    let wsMarginNum = wholesale_margin_percent !== undefined && wholesale_margin_percent !== '' ? Number(wholesale_margin_percent) : 0;
    if (wsMarginNum > 0 && costNum > 0 && (!wsPriceNum || wsPriceNum <= 0)) {
      wsPriceNum = Number((costNum * (1 + wsMarginNum / 100)).toFixed(2));
    } else if (wsMarginNum === 0 && costNum > 0 && wsPriceNum > 0) {
      wsMarginNum = Number((((wsPriceNum - costNum) / costNum) * 100).toFixed(2));
    }

    await execute(
      `UPDATE products SET sku=?, barcode=?, name=?, description=?, category_id=?, cost_price=?,
       retail_price=?, wholesale_price=?, retail_margin_percent=?, wholesale_margin_percent=?,
       min_wholesale_qty=?, reorder_level=?, unit=?, image_url=?, updated_at=datetime('now') WHERE id=?`,
      [sku.toUpperCase().trim(), barcode || null, name.trim(), description || '',
       category_id || null, costNum, retPriceNum, wsPriceNum, retMarginNum, wsMarginNum,
       Number(min_wholesale_qty), Number(reorder_level), unit, image_url || null, id]
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
