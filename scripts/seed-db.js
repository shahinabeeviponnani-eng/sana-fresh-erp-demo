const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:soundofheart@localhost:5432/erp_db';
const pool = new Pool({ connectionString: databaseUrl });

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding SANA FRESH ERP database with UK Produce & Real Invoice Data...');

    await client.query('BEGIN');
    await client.query(`
      TRUNCATE TABLE audit_logs, stock_movements, purchase_order_items, purchase_orders, 
      sales_order_items, sales_orders, products, categories, customers, vendors, users RESTART IDENTITY CASCADE
    `);

    // 1. Staff Users
    const salt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash('admin123', salt);
    const managerHash = await bcrypt.hash('manager123', salt);
    const cashierHash = await bcrypt.hash('cashier123', salt);
    const salesHash = await bcrypt.hash('sales123', salt);
    const stockHash = await bcrypt.hash('stock123', salt);

    const userResult = await client.query(`
      INSERT INTO users (email, name, password_hash, pin_code, role, phone, status, permissions)
      VALUES 
        ('admin@sanafresh.co.uk', 'Alexander Vance (Super Admin)', $1, '1122', 'ADMIN', '02035766816', 'ACTIVE', '["*"]'::jsonb),
        ('sarah.manager@sanafresh.co.uk', 'Sarah Jenkins (Operations Mgr)', $2, '3344', 'MANAGER', '02035766817', 'ACTIVE', '["view_invoices", "create_invoices", "edit_invoices", "delete_invoices", "settle_invoices", "access_pos", "apply_discounts", "view_products", "manage_products", "edit_prices", "adjust_stock", "view_customers", "manage_customers", "adjust_credit_limit", "view_vendors", "manage_pos_intake", "view_reports", "manage_staff", "view_logs"]'::jsonb),
        ('alex.cashier@sanafresh.co.uk', 'Alex Rivera (Front Cashier)', $3, '1234', 'CASHIER', '02035766818', 'ACTIVE', '["access_pos", "apply_discounts", "view_products"]'::jsonb),
        ('sales@sanafresh.co.uk', 'Marcus Cole (Wholesale Lead)', $4, '5566', 'SALES_REP', '02035766816', 'ACTIVE', '["view_invoices", "create_invoices", "edit_invoices", "settle_invoices", "view_products", "view_customers", "manage_customers"]'::jsonb),
        ('elena.stock@sanafresh.co.uk', 'Elena Rostova (Cold Chain Lead)', $5, '7788', 'INVENTORY_CLERK', '02035766819', 'ACTIVE', '["view_products", "adjust_stock", "view_vendors", "manage_pos_intake"]'::jsonb)
      RETURNING id, name, role;
    `, [adminHash, managerHash, cashierHash, salesHash, stockHash]);
    console.log(`Created ${userResult.rowCount} SANA FRESH Staff members.`);

    // 2. Categories
    const catResult = await client.query(`
      INSERT INTO categories (name, code, description)
      VALUES 
        ('Fresh Fruits & Tropicals', 'FRUIT', 'Plantains, bananas, tropicals and seasonal orchard fruits'),
        ('Fresh Vegetables & Herbs', 'VEG', 'Carrots, potatoes, coriander leaves and root vegetables'),
        ('Beverages & Soft Drinks', 'BEV', 'Cola, sodas, juices and refreshments in cans and bottles'),
        ('Pantry, Spices & Dry Groceries', 'PANTRY', 'Coconut milk powder, seasonings, flours, grains and provisions'),
        ('Dairy & Cold Chain', 'DAIRY', 'Milk, yogurt, cheeses and perishable goods')
      RETURNING id, name, code;
    `);
    const catMap = {};
    catResult.rows.forEach(r => { catMap[r.code] = r.id; });
    console.log(`Created ${catResult.rowCount} Categories.`);

    // 3. Products - INCLUDING ALL PRODUCTS FROM REAL SANA FRESH BILL
    const productData = [
      // From real bill INV-39584
      { sku: 'SF-DRK-COLA', barcode: '501000100001', name: 'COLA ORGIN (24X330ML)', category: 'BEV', cost: 9.50, retail: 14.50, wholesale: 12.990, min_whl: 1, stock: 120, reorder: 20, unit: 'BX' },
      { sku: 'SF-PRD-PLTR', barcode: '501000100002', name: 'PLANTAINE RIPE', category: 'FRUIT', cost: 18.00, retail: 27.50, wholesale: 24.990, min_whl: 1, stock: 85, reorder: 15, unit: 'BX' },
      { sku: 'SF-VEG-CRT', barcode: '501000100003', name: 'CARROT (KG)', category: 'VEG', cost: 0.75, retail: 1.45, wholesale: 1.100, min_whl: 1, stock: 450, reorder: 50, unit: 'KG' },
      { sku: 'SF-PAN-CMP', barcode: '501000100004', name: 'COCNT MILK PWDR(MAGGI 6x300G)', category: 'PANTRY', cost: 19.00, retail: 27.99, wholesale: 24.990, min_whl: 1, stock: 65, reorder: 10, unit: 'BX' },
      { sku: 'SF-HRB-COR', barcode: '501000100005', name: 'CORIA LEAF (BEST EA)', category: 'VEG', cost: 0.45, retail: 0.99, wholesale: 0.799, min_whl: 1, stock: 300, reorder: 40, unit: 'EA' },
      { sku: 'SF-VEG-POTR', barcode: '501000100006', name: 'POTA RED (NSD 20KG)', category: 'VEG', cost: 14.50, retail: 22.99, wholesale: 19.990, min_whl: 1, stock: 90, reorder: 15, unit: 'BG' },
      { sku: 'SF-PRD-PLTG', barcode: '501000100007', name: 'PLANTAINE GRN (BUTT)', category: 'FRUIT', cost: 26.00, retail: 38.50, wholesale: 34.990, min_whl: 1, stock: 70, reorder: 15, unit: 'BX' },
      
      // Other popular produce
      { sku: 'SF-VEG-ONR', barcode: '501000100008', name: 'RED ONIONS (10KG SACK)', category: 'VEG', cost: 7.20, retail: 11.50, wholesale: 9.500, min_whl: 1, stock: 150, reorder: 25, unit: 'BG' },
      { sku: 'SF-VEG-TOM', barcode: '501000100009', name: 'PLUM TOMATOES (BOX 6KG)', category: 'VEG', cost: 8.50, retail: 13.99, wholesale: 11.000, min_whl: 1, stock: 80, reorder: 15, unit: 'BX' },
      { sku: 'SF-PRD-YAM', barcode: '501000100010', name: 'GHANA WHITE YAM (BOX 20KG)', category: 'VEG', cost: 38.00, retail: 54.00, wholesale: 48.000, min_whl: 1, stock: 45, reorder: 10, unit: 'BX' },
      { sku: 'SF-PRD-GNG', barcode: '501000100011', name: 'FRESH GINGER (KG)', category: 'VEG', cost: 2.10, retail: 3.80, wholesale: 2.900, min_whl: 1, stock: 110, reorder: 20, unit: 'KG' },
      { sku: 'SF-PAN-GAR', barcode: '501000100012', name: 'GARLIC WHITE (BOX 10KG)', category: 'PANTRY', cost: 16.50, retail: 25.00, wholesale: 21.500, min_whl: 1, stock: 60, reorder: 10, unit: 'BX' }
    ];

    const prodMap = {};
    for (const p of productData) {
      const res = await client.query(`
        INSERT INTO products (sku, barcode, name, description, category_id, cost_price, retail_price, wholesale_price, min_wholesale_qty, stock_quantity, reorder_level, unit)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, sku, name, retail_price, wholesale_price, cost_price, unit;
      `, [
        p.sku, p.barcode, p.name, `SANA FRESH Grade A Produce: ${p.name}`,
        catMap[p.category], p.cost, p.retail, p.wholesale, p.min_whl, p.stock, p.reorder, p.unit
      ]);
      prodMap[p.sku] = res.rows[0];
    }
    console.log(`Created ${Object.keys(prodMap).length} SANA FRESH Products.`);

    // 4. Customers - INCLUDING CLIENT FROM REAL BILL
    const custResult = await client.query(`
      INSERT INTO customers (name, company_name, type, email, phone, tax_id, address, city, postal_code, country, credit_limit, current_balance, payment_terms, discount_percent, notes)
      VALUES 
        -- Real bill client
        ('Al-Rashid Halal Traders', 'Al-Rashid Halal Traders Ltd', 'WHOLESALE', 'orders@alrashidhalal.co.uk', '02071234567', 'GB-89211029', 'Eagle Yard Arch, LONDON', 'London', 'SE1 6SP', 'United Kingdom', 5000.00, 131.44, 'Due on Receipt', 0.00, 'Regular wholesale halal food and produce client in London SE1.'),
        
        -- Other wholesale clients
        ('Barakah Grocers Croydon', 'Barakah Grocers Ltd', 'WHOLESALE', 'procure@barakahgrocers.co.uk', '02086881234', 'GB-12948201', '124 London Road', 'Croydon', 'CR0 2TB', 'United Kingdom', 15000.00, 480.00, 'NET_30', 5.00, 'South London wholesale halal retail client'),
        ('Noor Fresh Market Brixton', 'Noor Fresh Foods Ltd', 'WHOLESALE', 'info@noorfresh.co.uk', '02079245678', 'GB-44910293', '45 Electric Avenue', 'Brixton', 'SW9 8JP', 'United Kingdom', 25000.00, 1250.00, 'NET_15', 3.00, 'Weekly plantain, root veg & beverage supply'),
        
        -- Retail Shoppers
        ('Walk-in Customer', NULL, 'RETAIL', NULL, NULL, NULL, 'Counter Storefront, 94 Bensham Lane', 'Croydon', 'CR7 7ES', 'United Kingdom', 0.00, 0.00, 'Due on Receipt', 0.00, 'Standard retail walk-in customer'),
        ('Yusuf Al-Amin', NULL, 'RETAIL', 'yusuf.alamin@gmail.com', '07700900123', NULL, '15 Oakwood Drive', 'Croydon', 'CR0 5TL', 'United Kingdom', 200.00, 0.00, 'Due on Receipt', 5.00, 'SANA FRESH Loyalty Club Member #402')
      RETURNING id, name, company_name, type;
    `);
    const custList = custResult.rows;
    console.log(`Created ${custList.length} Customers including 'Al-Rashid Halal Traders'.`);

    // 5. Vendors
    const vendorResult = await client.query(`
      INSERT INTO vendors (name, company_name, contact_person, email, phone, tax_id, address, payment_terms, bank_details, total_purchases)
      VALUES 
        ('Tropical Import Direct Ltd', 'Tropical Import Direct Ltd', 'Kwame Mensah', 'supply@tropicalimports.co.uk', '02079460111', 'GB-VEND-1029', 'New Spitalfields Market, Leyton', 'NET_30', 'Barclays Bank - Sort: 20-00-00 Acc: 12345678', 45000.00),
        ('Kent Farm Fresh Produce', 'Kent Horticultural Growers', 'Edward Davies', 'orders@kentfarmproduce.co.uk', '01622748111', 'GB-VEND-3391', 'Farm Lane, Maidstone, Kent', 'NET_15', 'NatWest Bank - Sort: 60-00-01 Acc: 87654321', 32000.00)
      RETURNING id, name;
    `);
    console.log(`Created ${vendorResult.rowCount} Vendors.`);

    // 6. Stock Intake movements
    for (const key of Object.keys(prodMap)) {
      const p = prodMap[key];
      await client.query(`
        INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason)
        VALUES ($1, 'PURCHASE_RECEIVE', 100.00, 0.00, 100.00, 'INIT-SF-UK', 1, 'Initial warehouse pallet intake')
      `, [p.id]);
    }

    // 7. INSERT REAL INVOICE INV-39584
    const losArrierosCust = custList[0]; // Los Arrieros De Pito
    const realBillItems = [
      { prod: prodMap['SF-DRK-COLA'], qty: 1.00, rate: 12.990, amount: 12.99, unit: 'BX' },
      { prod: prodMap['SF-PRD-PLTR'], qty: 1.00, rate: 24.990, amount: 24.99, unit: 'BX' },
      { prod: prodMap['SF-VEG-CRT'],  qty: 5.00, rate: 1.100,  amount: 5.50,  unit: 'KG' },
      { prod: prodMap['SF-PAN-CMP'],  qty: 1.00, rate: 24.990, amount: 24.99, unit: 'BX' },
      { prod: prodMap['SF-HRB-COR'],  qty: 10.00, rate: 0.799, amount: 7.99,  unit: 'EA' },
      { prod: prodMap['SF-VEG-POTR'], qty: 1.00, rate: 19.990, amount: 19.99, unit: 'BG' },
      { prod: prodMap['SF-PRD-PLTG'], qty: 1.00, rate: 34.990, amount: 34.99, unit: 'BX' }
    ];

    const realBillTotal = 131.44;

    const realOrderRes = await client.query(`
      INSERT INTO sales_orders (
        order_number, type, customer_id, staff_id, status,
        subtotal, discount_amount, tax_amount, total_amount,
        payment_method, payment_status, amount_paid,
        terms, due_date, shipping_address, notes, created_at
      ) VALUES (
        'INV-39584', 'WHOLESALE', $1, 4, 'COMPLETED',
        $2, 0.00, 0.00, $2,
        'BANK_TRANSFER', 'UNPAID', 0.00,
        'Due on Receipt', '2026-10-28', 'Eagle Yard Arch, LONDON, SE1 6SP London, United Kingdom', 'Thanks for your business.', '2026-10-28 10:30:00+00'
      ) RETURNING id;
    `, [losArrierosCust.id, realBillTotal]);

    const realOrderId = realOrderRes.rows[0].id;

    for (const it of realBillItems) {
      await client.query(`
        INSERT INTO sales_order_items (order_id, product_id, product_name, sku, unit, unit_cost, unit_price, quantity, discount, total)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0.00, $9)
      `, [
        realOrderId, it.prod.id, it.prod.name, it.prod.sku, it.unit,
        it.prod.cost_price, it.rate, it.qty, it.amount
      ]);

      await client.query(`
        INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason)
        VALUES ($1, 'WHOLESALE_SALE', $2, 100.00, 100.00 - $2, 'INV-39584', 4, 'Dispatched for Invoice INV-39584 to Al-Rashid Halal Traders')
      `, [it.prod.id, it.qty]);
    }

    console.log(`✓ Real bill INV-39584 created successfully for Al-Rashid Halal Traders with 7 produce line items (£131.44)!`);

    // Additional Wholesale order for testing
    const order2 = await client.query(`
      INSERT INTO sales_orders (
        order_number, type, customer_id, staff_id, status,
        subtotal, discount_amount, tax_amount, total_amount,
        payment_method, payment_status, amount_paid,
        terms, due_date, shipping_address, notes, created_at
      ) VALUES (
        'INV-39585', 'WHOLESALE', $1, 4, 'COMPLETED',
        480.00, 0.00, 0.00, 480.00,
        'BANK_TRANSFER', 'PAID', 480.00,
        'Due on Receipt', '2026-11-01', '124 London Road, Croydon, CR0 2TB', 'Thanks for your business.', '2026-11-01 11:15:00+00'
      ) RETURNING id;
    `, [custList[1].id]);

    await client.query(`
      INSERT INTO sales_order_items (order_id, product_id, product_name, sku, unit, unit_cost, unit_price, quantity, discount, total)
      VALUES 
        ($1, $2, 'PLANTAINE RIPE', 'SF-PRD-PLTR', 'BX', 18.00, 24.00, 10.00, 0.00, 240.00),
        ($1, $3, 'GHANA WHITE YAM (BOX 20KG)', 'SF-PRD-YAM', 'BX', 38.00, 48.00, 5.00, 0.00, 240.00)
    `, [order2.rows[0].id, prodMap['SF-PRD-PLTR'].id, prodMap['SF-PRD-YAM'].id]);

    // Retail POS order
    const retailOrder = await client.query(`
      INSERT INTO sales_orders (
        order_number, type, customer_id, staff_id, status,
        subtotal, discount_amount, tax_amount, total_amount,
        payment_method, payment_status, amount_paid,
        terms, due_date, notes, created_at
      ) VALUES (
        'POS-2026-0001', 'RETAIL', $1, 3, 'COMPLETED',
        18.49, 0.00, 0.00, 18.49,
        'CASH', 'PAID', 20.00,
        'Due on Receipt', CURRENT_DATE, 'Cashier Counter Checkout', CURRENT_TIMESTAMP
      ) RETURNING id;
    `, [custList[3].id]);

    await client.query(`
      INSERT INTO sales_order_items (order_id, product_id, product_name, sku, unit, unit_cost, unit_price, quantity, discount, total)
      VALUES 
        ($1, $2, 'COLA ORGIN (24X330ML)', 'SF-DRK-COLA', 'BX', 9.50, 14.50, 1.00, 0.00, 14.50),
        ($1, $3, 'CARROT (KG)', 'SF-VEG-CRT', 'KG', 0.75, 1.45, 2.75, 0.00, 3.99)
    `, [retailOrder.rows[0].id, prodMap['SF-DRK-COLA'].id, prodMap['SF-VEG-CRT'].id]);

    // Audit logs
    await client.query(`
      INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address)
      VALUES 
        (1, 'Alexander Vance', 'SYSTEM_INITIALIZE', 'AUTH', 'INFO', '{"message": "SANA FRESH ERP Engine Ready"}', '127.0.0.1'),
        (4, 'Marcus Cole', 'INVOICE_ISSUED', 'WHOLESALE', 'INFO', '{"order_number": "INV-39584", "customer": "Al-Rashid Halal Traders", "total": "£131.44"}', '127.0.0.1')
    `);

    await client.query('COMMIT');
    console.log('✓ Database seeding completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
