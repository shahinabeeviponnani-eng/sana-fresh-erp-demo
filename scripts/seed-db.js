const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const databaseUrl = process.env.DATABASE_URL || 'postgres://apple@localhost:5432/erp_db';
const pool = new Pool({ connectionString: databaseUrl });

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding SANA FRESH ERP database...');

    // 1. Clear existing seed data safely
    await client.query('BEGIN');
    await client.query(`
      TRUNCATE TABLE audit_logs, stock_movements, purchase_order_items, purchase_orders, 
      sales_order_items, sales_orders, products, categories, customers, vendors, users RESTART IDENTITY CASCADE
    `);

    // 2. Hash passwords
    const salt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash('admin123', salt);
    const managerHash = await bcrypt.hash('manager123', salt);
    const cashierHash = await bcrypt.hash('cashier123', salt);
    const salesHash = await bcrypt.hash('sales123', salt);
    const stockHash = await bcrypt.hash('stock123', salt);

    // 3. Insert Users / Staff (@sanafresh.com)
    const userResult = await client.query(`
      INSERT INTO users (email, name, password_hash, pin_code, role, phone, status)
      VALUES 
        ('admin@sanafresh.com', 'Alexander Vance (Super Admin)', $1, '1122', 'ADMIN', '+1 (555) 019-2834', 'ACTIVE'),
        ('sarah.manager@sanafresh.com', 'Sarah Jenkins (Operations Mgr)', $2, '3344', 'MANAGER', '+1 (555) 019-8765', 'ACTIVE'),
        ('alex.cashier@sanafresh.com', 'Alex Rivera (Front Cashier)', $3, '1234', 'CASHIER', '+1 (555) 019-4455', 'ACTIVE'),
        ('marcus.sales@sanafresh.com', 'Marcus Cole (Wholesale Rep)', $4, '5566', 'SALES_REP', '+1 (555) 019-7711', 'ACTIVE'),
        ('elena.stock@sanafresh.com', 'Elena Rostova (Cold Chain Lead)', $5, '7788', 'INVENTORY_CLERK', '+1 (555) 019-9922', 'ACTIVE')
      RETURNING id, name, role;
    `, [adminHash, managerHash, cashierHash, salesHash, stockHash]);
    console.log(`Created ${userResult.rowCount} SANA FRESH Staff members.`);

    // 4. Insert Categories
    const catResult = await client.query(`
      INSERT INTO categories (name, code, description)
      VALUES 
        ('Fresh Fruits & Berries', 'FRUIT', 'Organic orchard fruits, seasonal berries, citrus and tropicals'),
        ('Farm Fresh Vegetables', 'VEG', 'Locally harvested organic vegetables, greens and hydroponics'),
        ('Organic Dairy & Cold Chain', 'DAIRY', 'Pasture-raised milk, farm butter, artisanal cheeses, yogurts'),
        ('Fresh Juices & Beverages', 'BEV', 'Cold-pressed raw juices, kombucha, smoothies and coconut waters'),
        ('Bakery & Pantry Organics', 'PANTRY', 'Artisan sourdough, ancient grains, cold-pressed oils, pure honey')
      RETURNING id, name, code;
    `);
    const catMap = {};
    catResult.rows.forEach(r => { catMap[r.code] = r.id; });
    console.log(`Created ${catResult.rowCount} Categories.`);

    // 5. Insert Products (Retail & Wholesale Pricing, Barcodes, Stock Levels)
    const productData = [
      // Fresh Fruits
      { sku: 'SF-FRUIT-AVO', barcode: '890200101001', name: 'Organic Hass Avocados (Grade A)', category: 'FRUIT', cost: 1.20, retail: 2.49, wholesale: 1.60, min_whl: 30, stock: 240, reorder: 40, unit: 'kg' },
      { sku: 'SF-FRUIT-APL', barcode: '890200101002', name: 'Crisp Royal Gala Apples (Fresh Crop)', category: 'FRUIT', cost: 1.50, retail: 3.29, wholesale: 2.10, min_whl: 50, stock: 380, reorder: 50, unit: 'kg' },
      { sku: 'SF-FRUIT-BAN', barcode: '890200101003', name: 'Premium Cavendish Bananas (Cluster)', category: 'FRUIT', cost: 0.70, retail: 1.69, wholesale: 0.99, min_whl: 50, stock: 450, reorder: 60, unit: 'kg' },
      { sku: 'SF-FRUIT-STR', barcode: '890200101004', name: 'Farm Picked Sweet Strawberries (400g Clamshell)', category: 'FRUIT', cost: 1.80, retail: 4.20, wholesale: 2.60, min_whl: 20, stock: 18, reorder: 30, unit: 'box' }, // Low stock alert!

      // Vegetables
      { sku: 'SF-VEG-SPIN', barcode: '890200101005', name: 'Hydroponic Tender Baby Spinach (250g)', category: 'VEG', cost: 0.90, retail: 2.89, wholesale: 1.45, min_whl: 25, stock: 180, reorder: 30, unit: 'pack' },
      { sku: 'SF-VEG-TOM', barcode: '890200101006', name: 'Vine-Ripened Heirloom Tomatoes', category: 'VEG', cost: 1.10, retail: 2.80, wholesale: 1.65, min_whl: 30, stock: 290, reorder: 40, unit: 'kg' },
      { sku: 'SF-VEG-PEP', barcode: '890200101007', name: 'Sweet Bell Peppers Trio Pack (Red/Yellow/Green)', category: 'VEG', cost: 1.40, retail: 3.49, wholesale: 2.10, min_whl: 25, stock: 140, reorder: 25, unit: 'pack' },
      { sku: 'SF-VEG-CAR', barcode: '890200101008', name: 'Organic Sweet Bunch Carrots with Tops', category: 'VEG', cost: 0.80, retail: 2.19, wholesale: 1.25, min_whl: 30, stock: 15, reorder: 30, unit: 'bunch' }, // Low stock!

      // Dairy & Cold Chain
      { sku: 'SF-DRY-MILK', barcode: '890200101009', name: 'Pasture-Raised Whole Milk 1L (Glass Bottle)', category: 'DAIRY', cost: 1.80, retail: 3.89, wholesale: 2.40, min_whl: 40, stock: 220, reorder: 35, unit: 'bottle' },
      { sku: 'SF-DRY-YOG', barcode: '890200101010', name: 'Traditional Greek Probiotic Yogurt 1KG Tub', category: 'DAIRY', cost: 3.40, retail: 6.99, wholesale: 4.50, min_whl: 20, stock: 95, reorder: 20, unit: 'tub' },
      { sku: 'SF-DRY-BUT', barcode: '890200101011', name: 'Cultured Farm Butter Salted 250g', category: 'DAIRY', cost: 2.10, retail: 4.50, wholesale: 2.90, min_whl: 30, stock: 160, reorder: 25, unit: 'block' },
      { sku: 'SF-DRY-CHD', barcode: '890200101012', name: 'Aged Artisan Farmhouse Cheddar 300g', category: 'DAIRY', cost: 4.20, retail: 8.99, wholesale: 5.80, min_whl: 15, stock: 85, reorder: 15, unit: 'block' },

      // Beverages
      { sku: 'SF-BEV-ORJ', barcode: '890200101013', name: 'Cold-Pressed Valencia Orange Juice 1L Bottle', category: 'BEV', cost: 2.20, retail: 4.99, wholesale: 3.10, min_whl: 24, stock: 150, reorder: 30, unit: 'bottle' },
      { sku: 'SF-BEV-GRN', barcode: '890200101014', name: 'Supergreen Kale & Ginger Detox Smoothie 500ml', category: 'BEV', cost: 1.90, retail: 4.49, wholesale: 2.70, min_whl: 24, stock: 110, reorder: 20, unit: 'bottle' },
      { sku: 'SF-BEV-COC', barcode: '890200101015', name: 'Pure Young Coconut Water 330ml (Pack of 12)', category: 'BEV', cost: 9.00, retail: 18.99, wholesale: 12.50, min_whl: 10, stock: 75, reorder: 15, unit: 'pack' },

      // Pantry & Bakery
      { sku: 'SF-PAN-SRD', barcode: '890200101016', name: 'Artisan Stoneground Country Sourdough Loaf', category: 'PANTRY', cost: 1.90, retail: 4.50, wholesale: 2.75, min_whl: 15, stock: 65, reorder: 15, unit: 'loaf' },
      { sku: 'SF-PAN-HON', barcode: '890200101017', name: 'Raw Wildflower Pure Honey 500g Hex Jar', category: 'PANTRY', cost: 4.50, retail: 9.99, wholesale: 6.50, min_whl: 15, stock: 120, reorder: 20, unit: 'jar' }
    ];

    const prodInsertQueries = productData.map(p => {
      return client.query(`
        INSERT INTO products (sku, barcode, name, description, category_id, cost_price, retail_price, wholesale_price, min_wholesale_qty, stock_quantity, reorder_level, unit)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, sku, name, retail_price, wholesale_price, cost_price;
      `, [
        p.sku, p.barcode, p.name, `Premium SANA FRESH certified stock: ${p.name}`,
        catMap[p.category], p.cost, p.retail, p.wholesale, p.min_whl, p.stock, p.reorder, p.unit
      ]);
    });
    const insertedProducts = await Promise.all(prodInsertQueries);
    const prodList = insertedProducts.map(res => res.rows[0]);
    console.log(`Created ${prodList.length} SANA FRESH Products with Wholesale & Retail price tiers.`);

    // 6. Insert Customers (Wholesale B2B & Retail Shoppers)
    const custResult = await client.query(`
      INSERT INTO customers (name, company_name, type, email, phone, tax_id, address, city, credit_limit, current_balance, payment_terms, discount_percent, notes)
      VALUES 
        -- Retail Shoppers
        ('Walk-in Customer', NULL, 'RETAIL', NULL, NULL, NULL, 'Counter Storefront', 'Metropolis', 0.00, 0.00, 'IMMEDIATE', 0.00, 'Default retail guest customer'),
        ('David Miller', NULL, 'RETAIL', 'david.miller@email.com', '+1 (555) 234-5678', NULL, '45 Elm Street, Apt 3B', 'Metropolis', 500.00, 0.00, 'IMMEDIATE', 5.00, 'SANA FRESH Loyalty Club #884'),
        ('Sophia Chen', NULL, 'RETAIL', 'sophia.c@techmail.org', '+1 (555) 345-6789', NULL, '88 Maple Ave', 'Metropolis', 300.00, 0.00, 'IMMEDIATE', 0.00, 'Organic produce retail shopper'),
        
        -- Wholesale B2B Corporate Clients
        ('GreenLeaf Supermarkets Group', 'GreenLeaf Retail Corp', 'WHOLESALE', 'procurement@greenleaf.com', '+1 (555) 888-0101', 'TAX-SF-9938210', '100 Distribution Parkway, Suite 400', 'Chicago', 60000.00, 18450.00, 'NET_30', 8.00, 'Tier 1 Wholesale Account. 15 supermarket stores daily produce supply.'),
        ('Grand Hyatt Culinary & Banquets', 'Hyatt Hospitality Partners', 'WHOLESALE', 'chef.procurement@hyatt.com', '+1 (555) 777-0202', 'TAX-SF-4829103', '744 Boulevard Promenade', 'Dallas', 35000.00, 8200.00, 'NET_30', 5.00, 'Daily fresh berries, microgreens, dairy and artisan bread contract.'),
        ('FreshBite Healthy Cafes Network', 'FreshBite Brands LLC', 'WHOLESALE', 'supplies@freshbite.io', '+1 (555) 666-0303', 'TAX-SF-7193845', '120 Silicon Way', 'Austin', 20000.00, 0.00, 'NET_15', 3.00, 'Avocados, citrus and cold pressed juices daily supply.'),
        ('Metro City Healthcare Catering', 'Metro Hospital System Corp', 'WHOLESALE', 'nutrition@metrohealth.org', '+1 (555) 555-0404', 'TAX-SF-1029482', '200 Medical Center Drive', 'Miami', 40000.00, 11500.00, 'NET_60', 6.00, 'Fresh organic fruits and pasteurized milk daily bulk supply.')
      RETURNING id, name, company_name, type;
    `);
    const custList = custResult.rows;
    console.log(`Created ${custList.length} Customers across Wholesale and Retail divisions.`);

    // 7. Insert Vendors (Organic Farms & Creameries)
    const vendorResult = await client.query(`
      INSERT INTO vendors (name, company_name, contact_person, email, phone, tax_id, address, payment_terms, bank_details, total_purchases)
      VALUES 
        ('Valley View Organic Orchards', 'Valley View Agricultural Farms LLC', 'Robert Hansen', 'accounts@valleyviewfarms.com', '+1 (555) 444-1111', 'VEND-SF-89211', '12 Orchard Valley Rd, Yakima, WA', 'NET_30', 'Chase Bank NA - Acc: 992817293', 92500.00),
        ('GreenMeadow Dairy & Creamery', 'GreenMeadow Pastures Corp', 'Rachel Green', 'orders@greenmeadowdairy.com', '+1 (555) 444-2222', 'VEND-SF-33491', '808 Pasture Road, Madison, WI', 'NET_30', 'Bank of America - Acc: 448102931', 54200.00),
        ('Highland Hydroponic Farms Ltd', 'Highland Hydroponics Group', 'Carlos Mendez', 'supply@highlandfarms.com', '+1 (555) 444-3333', 'VEND-SF-66102', '55 Greenhouse Drive, Salinas, CA', 'NET_15', 'Wells Fargo - Acc: 110293847', 36800.00)
      RETURNING id, name, company_name;
    `);
    const vendorList = vendorResult.rows;
    console.log(`Created ${vendorList.length} Vendors.`);

    // 8. Insert Initial Stock Movements
    for (const prod of prodList) {
      await client.query(`
        INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason)
        VALUES ($1, 'PURCHASE_RECEIVE', 150, 0, 150, 'INIT-SF-2026', 1, 'Initial SANA FRESH cold chain intake verified')
      `, [prod.id]);
    }

    // 9. Historical Sales Orders (Retail POS & Wholesale B2B)
    const adminId = 1;
    const cashierId = 3;
    const salesRepId = 4;

    // A. Retail POS Sales
    const retailOrders = [
      {
        orderNum: 'POS-2026-1001',
        customer: custList[0].id, // walk-in
        staff: cashierId,
        paymentMethod: 'CASH',
        items: [
          { prod: prodList[0], qty: 2, price: 2.49, cost: 1.20 }, // Avocados
          { prod: prodList[8], qty: 2, price: 3.89, cost: 1.80 }  // Milk
        ]
      },
      {
        orderNum: 'POS-2026-1002',
        customer: custList[1].id, // David Miller
        staff: cashierId,
        paymentMethod: 'CARD',
        items: [
          { prod: prodList[1], qty: 3, price: 3.29, cost: 1.50 }, // Apples
          { prod: prodList[12], qty: 1, price: 4.99, cost: 2.20 } // Orange Juice
        ]
      },
      {
        orderNum: 'POS-2026-1003',
        customer: custList[2].id, // Sophia Chen
        staff: cashierId,
        paymentMethod: 'UPI',
        items: [
          { prod: prodList[4], qty: 2, price: 2.89, cost: 0.90 }, // Spinach
          { prod: prodList[15], qty: 1, price: 4.50, cost: 1.90 } // Sourdough
        ]
      }
    ];

    for (const ro of retailOrders) {
      const subtotal = ro.items.reduce((acc, it) => acc + (it.price * it.qty), 0);
      const tax = +(subtotal * 0.08).toFixed(2);
      const total = +(subtotal + tax).toFixed(2);

      const orderRes = await client.query(`
        INSERT INTO sales_orders (order_number, type, customer_id, staff_id, status, subtotal, discount_amount, tax_amount, total_amount, payment_method, payment_status, amount_paid)
        VALUES ($1, 'RETAIL', $2, $3, 'COMPLETED', $4, 0, $5, $6, $7, 'PAID', $6)
        RETURNING id;
      `, [ro.orderNum, ro.customer, ro.staff, subtotal, tax, total, ro.paymentMethod]);

      const orderId = orderRes.rows[0].id;
      for (const item of ro.items) {
        const itemTot = +(item.price * item.qty).toFixed(2);
        await client.query(`
          INSERT INTO sales_order_items (order_id, product_id, product_name, sku, unit, unit_cost, unit_price, quantity, discount, total)
          VALUES ($1, $2, $3, $4, 'pcs', $5, $6, $7, 0, $8)
        `, [orderId, item.prod.id, item.prod.name, item.prod.sku, item.cost, item.price, item.qty, itemTot]);

        await client.query(`
          INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason)
          VALUES ($1, 'RETAIL_SALE', $2, 100, 100 + $2, $3, $4, 'SANA FRESH Retail Store Checkout')
        `, [item.prod.id, -item.qty, ro.orderNum, ro.staff]);
      }
    }

    // B. Wholesale B2B Contracts & Invoices
    const wholesaleOrders = [
      {
        orderNum: 'WHL-2026-5001',
        customer: custList[3].id, // GreenLeaf Supermarkets
        staff: salesRepId,
        paymentMethod: 'BANK_TRANSFER',
        paymentStatus: 'PARTIAL',
        paid: 8000.00,
        items: [
          { prod: prodList[0], qty: 200, price: 1.60, cost: 1.20 }, // Avocados
          { prod: prodList[1], qty: 300, price: 2.10, cost: 1.50 }, // Apples
          { prod: prodList[8], qty: 250, price: 2.40, cost: 1.80 }  // Milk
        ]
      },
      {
        orderNum: 'WHL-2026-5002',
        customer: custList[4].id, // Grand Hyatt Hotel
        staff: salesRepId,
        paymentMethod: 'CREDIT',
        paymentStatus: 'UNPAID',
        paid: 0.00,
        items: [
          { prod: prodList[3], qty: 80, price: 2.60, cost: 1.80 },   // Strawberries
          { prod: prodList[9], qty: 50, price: 4.50, cost: 3.40 },   // Yogurt
          { prod: prodList[15], qty: 60, price: 2.75, cost: 1.90 }   // Sourdough
        ]
      },
      {
        orderNum: 'WHL-2026-5003',
        customer: custList[5].id, // FreshBite Cafes
        staff: salesRepId,
        paymentMethod: 'BANK_TRANSFER',
        paymentStatus: 'PAID',
        paid: 4890.00,
        items: [
          { prod: prodList[0], qty: 100, price: 1.60, cost: 1.20 }, // Avocados
          { prod: prodList[12], qty: 120, price: 3.10, cost: 2.20 }, // Orange juice
          { prod: prodList[13], qty: 100, price: 2.70, cost: 1.90 }  // Green smoothie
        ]
      }
    ];

    for (const wo of wholesaleOrders) {
      const subtotal = wo.items.reduce((acc, it) => acc + (it.price * it.qty), 0);
      const tax = +(subtotal * 0.05).toFixed(2);
      const total = +(subtotal + tax).toFixed(2);

      const orderRes = await client.query(`
        INSERT INTO sales_orders (order_number, type, customer_id, staff_id, status, subtotal, discount_amount, tax_amount, total_amount, payment_method, payment_status, amount_paid, due_date)
        VALUES ($1, 'WHOLESALE', $2, $3, 'COMPLETED', $4, 0, $5, $6, $7, $8, $9, CURRENT_DATE + INTERVAL '30 days')
        RETURNING id;
      `, [wo.orderNum, wo.customer, wo.staff, subtotal, tax, total, wo.paymentMethod, wo.paymentStatus, wo.paid]);

      const orderId = orderRes.rows[0].id;
      for (const item of wo.items) {
        const itemTot = +(item.price * item.qty).toFixed(2);
        await client.query(`
          INSERT INTO sales_order_items (order_id, product_id, product_name, sku, unit, unit_cost, unit_price, quantity, discount, total)
          VALUES ($1, $2, $3, $4, 'bulk', $5, $6, $7, 0, $8)
        `, [orderId, item.prod.id, item.prod.name, item.prod.sku, item.cost, item.price, item.qty, itemTot]);

        await client.query(`
          INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason)
          VALUES ($1, 'WHOLESALE_SALE', $2, 250, 250 + $2, $3, $4, 'SANA FRESH Cold Chain Wholesale Dispatch')
        `, [item.prod.id, -item.qty, wo.orderNum, wo.staff]);
      }
    }
    console.log(`Seeded SANA FRESH Retail and Wholesale sales orders.`);

    // 10. Purchase Order (Restocking from Farms)
    const poRes = await client.query(`
      INSERT INTO purchase_orders (po_number, vendor_id, staff_id, status, total_amount, payment_status, expected_delivery_date, received_at, notes)
      VALUES ('PO-2026-901', $1, $2, 'RECEIVED', 4850.00, 'PAID', CURRENT_DATE - INTERVAL '2 days', CURRENT_TIMESTAMP, 'Direct organic farm intake for avocados and gala apples.')
      RETURNING id;
    `, [vendorList[0].id, adminId]);

    const poId = poRes.rows[0].id;
    await client.query(`
      INSERT INTO purchase_order_items (po_id, product_id, quantity_ordered, quantity_received, unit_cost, total_cost)
      VALUES 
        ($1, $2, 500, 500, 1.20, 600.00),
        ($1, $3, 1000, 1000, 1.50, 1500.00)
    `, [poId, prodList[0].id, prodList[1].id]);
    console.log(`Seeded Farm Inbound Purchase Orders.`);

    // 11. System Event Logs
    const auditEvents = [
      { staff_id: 1, name: 'Alexander Vance', action: 'SYSTEM_BOOT', module: 'AUTH', severity: 'INFO', details: { msg: 'SANA FRESH Omnichannel ERP Engine Online' } },
      { staff_id: 1, name: 'Alexander Vance', action: 'USER_CREATED', module: 'STAFF', severity: 'INFO', details: { user: 'marcus.sales@sanafresh.com', role: 'SALES_REP' } },
      { staff_id: 4, name: 'Marcus Cole', action: 'WHOLESALE_ORDER_CREATED', module: 'WHOLESALE', severity: 'INFO', details: { order_number: 'WHL-2026-5001', customer: 'GreenLeaf Retail Corp', total: 1627.50 } },
      { staff_id: 3, name: 'Alex Rivera', action: 'POS_CHECKOUT', module: 'RETAIL', severity: 'INFO', details: { order_number: 'POS-2026-1001', payment: 'CASH', total: 13.82 } },
      { staff_id: 5, name: 'Elena Rostova', action: 'COLD_CHAIN_INTAKE', module: 'INVENTORY', severity: 'INFO', details: { po_number: 'PO-2026-901', items_received: 1500 } },
      { staff_id: 1, name: 'Alexander Vance', action: 'PRICE_TIER_ADJUSTED', module: 'INVENTORY', severity: 'WARNING', details: { sku: 'SF-FRUIT-AVO', old_wholesale: 1.70, new_wholesale: 1.60 } },
      { staff_id: 4, name: 'Marcus Cole', action: 'CREDIT_LIMIT_APPROVED', module: 'CUSTOMERS', severity: 'INFO', details: { customer: 'GreenLeaf Retail Corp', limit: 60000.00, terms: 'NET_30' } }
    ];

    for (const evt of auditEvents) {
      await client.query(`
        INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, '127.0.0.1')
      `, [evt.staff_id, evt.name, evt.action, evt.module, evt.severity, JSON.stringify(evt.details)]);
    }
    console.log(`Seeded SANA FRESH System Event & Audit Logs.`);

    await client.query('COMMIT');
    console.log('✓ SANA FRESH ERP Database seeded successfully with fresh produce & organic goods data!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to seed database:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
