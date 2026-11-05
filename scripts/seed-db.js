const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const databaseUrl = process.env.DATABASE_URL || 'postgres://apple@localhost:5432/erp_db';
const pool = new Pool({ connectionString: databaseUrl });

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding ApexERP database...');

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

    // 3. Insert Users / Staff
    const userResult = await client.query(`
      INSERT INTO users (email, name, password_hash, pin_code, role, phone, status)
      VALUES 
        ('admin@apexerp.com', 'Alexander Vance (Super Admin)', $1, '1122', 'ADMIN', '+1 (555) 019-2834', 'ACTIVE'),
        ('sarah.manager@apexerp.com', 'Sarah Jenkins (Operations Mgr)', $2, '3344', 'MANAGER', '+1 (555) 019-8765', 'ACTIVE'),
        ('alex.cashier@apexerp.com', 'Alex Rivera (Front Cashier)', $3, '1234', 'CASHIER', '+1 (555) 019-4455', 'ACTIVE'),
        ('marcus.sales@apexerp.com', 'Marcus Cole (Wholesale Rep)', $4, '5566', 'SALES_REP', '+1 (555) 019-7711', 'ACTIVE'),
        ('elena.stock@apexerp.com', 'Elena Rostova (Inventory Lead)', $5, '7788', 'INVENTORY_CLERK', '+1 (555) 019-9922', 'ACTIVE')
      RETURNING id, name, role;
    `, [adminHash, managerHash, cashierHash, salesHash, stockHash]);
    console.log(`Created ${userResult.rowCount} Staff members.`);

    // 4. Insert Categories
    const catResult = await client.query(`
      INSERT INTO categories (name, code, description)
      VALUES 
        ('Electronics & Gadgets', 'ELEC', 'Consumer electronics, accessories, smart devices and peripherals'),
        ('Industrial & Hardware', 'IND', 'Tools, industrial components, fasteners, packaging supplies'),
        ('Apparel & Workwear', 'APP', 'Corporate uniforms, high-vis workwear, bulk textiles'),
        ('FMCG & Beverages', 'FMCG', 'Fast moving packaged food, bulk drinks and pantry supplies'),
        ('Office Essentials', 'OFF', 'Stationery, paper rolls, printing supplies, desk equipment')
      RETURNING id, name, code;
    `);
    const catMap = {};
    catResult.rows.forEach(r => { catMap[r.code] = r.id; });
    console.log(`Created ${catResult.rowCount} Categories.`);

    // 5. Insert Products (Retail & Wholesale Pricing, Barcodes, Stock Levels)
    const productData = [
      // Electronics
      { sku: 'ELEC-LOG-MX3', barcode: '890123456701', name: 'Logitech MX Master 3S Wireless Mouse', category: 'ELEC', cost: 65.00, retail: 99.99, wholesale: 78.00, min_whl: 10, stock: 145, reorder: 20, unit: 'pcs' },
      { sku: 'ELEC-ANC-700', barcode: '890123456702', name: 'Bose 700 Wireless ANC Headphones', category: 'ELEC', cost: 195.00, retail: 299.00, wholesale: 235.00, min_whl: 5, stock: 42, reorder: 10, unit: 'pcs' },
      { sku: 'ELEC-USB-C100', barcode: '890123456703', name: 'Braided 100W USB-C 2M Fast Cable', category: 'ELEC', cost: 3.50, retail: 14.99, wholesale: 6.50, min_whl: 50, stock: 520, reorder: 100, unit: 'pcs' },
      { sku: 'ELEC-GAN-65W', barcode: '890123456704', name: 'Dual Port GaN 65W Compact Fast Charger', category: 'ELEC', cost: 11.20, retail: 29.99, wholesale: 16.50, min_whl: 25, stock: 210, reorder: 35, unit: 'pcs' },
      
      // Industrial
      { sku: 'IND-TAPE-HVY', barcode: '890123456705', name: 'Industrial Heavy-Duty Duct Tape (50m)', category: 'IND', cost: 2.10, retail: 6.50, wholesale: 3.20, min_whl: 40, stock: 380, reorder: 50, unit: 'roll' },
      { sku: 'IND-STR-500M', barcode: '890123456706', name: 'Pallet Stretch Film Wrap 500m Roll', category: 'IND', cost: 12.00, retail: 24.50, wholesale: 16.00, min_whl: 20, stock: 85, reorder: 25, unit: 'roll' },
      { sku: 'IND-GLV-NITR', barcode: '890123456707', name: 'Nitrile Heavy-Duty Work Gloves (Box of 100)', category: 'IND', cost: 7.50, retail: 18.00, wholesale: 11.00, min_whl: 15, stock: 16, reorder: 30, unit: 'box' }, // Low stock alert!
      { sku: 'IND-MEAS-8M', barcode: '890123456708', name: 'Magnetic Rubberized Tape Measure 8M/26ft', category: 'IND', cost: 4.80, retail: 12.50, wholesale: 7.20, min_whl: 20, stock: 110, reorder: 20, unit: 'pcs' },

      // Apparel
      { sku: 'APP-POLO-BLK', barcode: '890123456709', name: 'Breathable Pique Cotton Polo Shirt - Black', category: 'APP', cost: 8.50, retail: 24.00, wholesale: 13.50, min_whl: 30, stock: 310, reorder: 40, unit: 'pcs' },
      { sku: 'APP-VEST-HIV', barcode: '890123456710', name: 'ANSI Class 2 Reflective Safety Vest - Neon', category: 'APP', cost: 3.20, retail: 9.99, wholesale: 5.10, min_whl: 50, stock: 450, reorder: 60, unit: 'pcs' },
      { sku: 'APP-JKT-WTR', barcode: '890123456711', name: 'All-Weather Waterproof Softshell Jacket', category: 'APP', cost: 28.00, retail: 69.99, wholesale: 42.00, min_whl: 10, stock: 95, reorder: 20, unit: 'pcs' },

      // FMCG & Beverages
      { sku: 'FMCG-ESP-1KG', barcode: '890123456712', name: 'Premium Arabica Whole Bean Coffee 1KG Bag', category: 'FMCG', cost: 11.50, retail: 26.00, wholesale: 17.50, min_whl: 12, stock: 180, reorder: 30, unit: 'bag' },
      { sku: 'FMCG-TEA-500', barcode: '890123456713', name: 'Organic Ceylon High-Grown Black Tea 500g', category: 'FMCG', cost: 5.20, retail: 13.50, wholesale: 8.00, min_whl: 24, stock: 140, reorder: 25, unit: 'tin' },
      { sku: 'FMCG-WTR-24P', barcode: '890123456714', name: 'Natural Spring Mineral Water 500ml (Pack of 24)', category: 'FMCG', cost: 4.00, retail: 10.99, wholesale: 6.20, min_whl: 30, stock: 8, reorder: 40, unit: 'pack' }, // Critically Low!

      // Office
      { sku: 'OFF-PAP-A4', barcode: '890123456715', name: 'High-Speed Copier Paper A4 80GSM (Ream 500)', category: 'OFF', cost: 3.10, retail: 7.50, wholesale: 4.40, min_whl: 40, stock: 680, reorder: 100, unit: 'ream' },
      { sku: 'OFF-POS-80MM', barcode: '890123456716', name: 'Thermal POS Receipt Paper Rolls 80x80 (Box of 50)', category: 'OFF', cost: 22.00, retail: 49.00, wholesale: 32.00, min_whl: 10, stock: 95, reorder: 20, unit: 'box' },
      { sku: 'OFF-PEN-BLU', barcode: '890123456717', name: 'Gel Retractable 0.7mm Ballpoint Pen (Box of 12)', category: 'OFF', cost: 4.50, retail: 11.99, wholesale: 6.80, min_whl: 20, stock: 240, reorder: 30, unit: 'box' }
    ];

    const prodInsertQueries = productData.map(p => {
      return client.query(`
        INSERT INTO products (sku, barcode, name, description, category_id, cost_price, retail_price, wholesale_price, min_wholesale_qty, stock_quantity, reorder_level, unit)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, sku, name, retail_price, wholesale_price, cost_price;
      `, [
        p.sku, p.barcode, p.name, `High-demand commercial inventory item: ${p.name}`,
        catMap[p.category], p.cost, p.retail, p.wholesale, p.min_whl, p.stock, p.reorder, p.unit
      ]);
    });
    const insertedProducts = await Promise.all(prodInsertQueries);
    const prodList = insertedProducts.map(res => res.rows[0]);
    console.log(`Created ${prodList.length} Products with Wholesale & Retail price tiers.`);

    // 6. Insert Customers (Both Retail and Wholesale Segments)
    const custResult = await client.query(`
      INSERT INTO customers (name, company_name, type, email, phone, tax_id, address, city, credit_limit, current_balance, payment_terms, discount_percent, notes)
      VALUES 
        -- Retail Shoppers
        ('Walk-in Customer', NULL, 'RETAIL', NULL, NULL, NULL, 'Counter Storefront', 'Metropolis', 0.00, 0.00, 'IMMEDIATE', 0.00, 'Default retail guest customer'),
        ('David Miller', NULL, 'RETAIL', 'david.miller@email.com', '+1 (555) 234-5678', NULL, '45 Elm Street, Apt 3B', 'Metropolis', 500.00, 0.00, 'IMMEDIATE', 5.00, 'VIP Loyalty Member #884'),
        ('Sophia Chen', NULL, 'RETAIL', 'sophia.c@techmail.org', '+1 (555) 345-6789', NULL, '88 Maple Ave', 'Metropolis', 300.00, 0.00, 'IMMEDIATE', 0.00, 'Regular retail patron'),
        
        -- Wholesale B2B Clients
        ('Apex Metro Supermarkets Ltd', 'Metro Retail Group Corp', 'WHOLESALE', 'procurement@metrogroup.com', '+1 (555) 888-0101', 'TAX-US-9938210', '100 Distribution Parkway, Suite 400', 'Chicago', 50000.00, 14250.00, 'NET_30', 8.00, 'Tier 1 Wholesale Account. High volume weekly bulk orders.'),
        ('BuildCorp Contractors & Engineering', 'BuildCorp Global LLC', 'WHOLESALE', 'supplies@buildcorp.com', '+1 (555) 777-0202', 'TAX-US-4829103', '744 Industrial Blvd', 'Dallas', 25000.00, 6800.00, 'NET_60', 5.00, 'Industrial safety gear and hardware supplies bulk contract.'),
        ('Horizon Tech Solutions Inc', 'Horizon Technologies LLC', 'WHOLESALE', 'hardware@horizontech.io', '+1 (555) 666-0303', 'TAX-US-7193845', '120 Silicon Way', 'Austin', 15000.00, 0.00, 'NET_15', 3.00, 'IT equipment and accessories reseller partner.'),
        ('Grand Pacific Hotel & Resorts', 'Pacific Hospitality Partners', 'WHOLESALE', 'ops@grandpacific.com', '+1 (555) 555-0404', 'TAX-US-1029482', '200 Ocean Promenade', 'Miami', 30000.00, 8900.00, 'NET_30', 6.00, 'Hospitality linens, coffee, tea, and guest amenities.')
      RETURNING id, name, company_name, type;
    `);
    const custList = custResult.rows;
    console.log(`Created ${custList.length} Customers across Wholesale and Retail divisions.`);

    // 7. Insert Vendors
    const vendorResult = await client.query(`
      INSERT INTO vendors (name, company_name, contact_person, email, phone, tax_id, address, payment_terms, bank_details, total_purchases)
      VALUES 
        ('Global Tech Logistics', 'Global Tech Imports LLC', 'Robert Hansen', 'accounts@globaltechlogistics.com', '+1 (555) 444-1111', 'VEND-US-89211', '12 Port Terminal Rd, Seattle, WA', 'NET_30', 'Chase Bank NA - Acc: 992817293', 84500.00),
        ('Vanguard Industrial Supplies', 'Vanguard Manufacturing Corp', 'Rachel Green', 'orders@vanguardind.com', '+1 (555) 444-2222', 'VEND-US-33491', '808 Foundry Road, Cleveland, OH', 'NET_30', 'Bank of America - Acc: 448102931', 46200.00),
        ('Apex Plantation Direct', 'Apex Agro Exporters Ltd', 'Carlos Mendez', 'supply@apexplantation.com', '+1 (555) 444-3333', 'VEND-US-66102', '55 Rainforest Drive, San Jose, CA', 'NET_15', 'Wells Fargo - Acc: 110293847', 29800.00)
      RETURNING id, name, company_name;
    `);
    const vendorList = vendorResult.rows;
    console.log(`Created ${vendorList.length} Vendors.`);

    // 8. Insert Initial Stock Movements
    for (const prod of prodList) {
      await client.query(`
        INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason)
        VALUES ($1, 'PURCHASE_RECEIVE', 100, 0, 100, 'INIT-STOCK-2026', 1, 'Initial opening stock intake verified')
      `, [prod.id]);
    }

    // 9. Insert Historical Orders (Retail POS & Wholesale B2B)
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
          { prod: prodList[0], qty: 1, price: 99.99, cost: 65.00 },
          { prod: prodList[2], qty: 2, price: 14.99, cost: 3.50 }
        ]
      },
      {
        orderNum: 'POS-2026-1002',
        customer: custList[1].id, // David Miller
        staff: cashierId,
        paymentMethod: 'CARD',
        items: [
          { prod: prodList[11], qty: 2, price: 26.00, cost: 11.50 },
          { prod: prodList[12], qty: 1, price: 13.50, cost: 5.20 }
        ]
      },
      {
        orderNum: 'POS-2026-1003',
        customer: custList[2].id, // Sophia Chen
        staff: cashierId,
        paymentMethod: 'UPI',
        items: [
          { prod: prodList[3], qty: 1, price: 29.99, cost: 11.20 },
          { prod: prodList[8], qty: 2, price: 24.00, cost: 8.50 }
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

        // Stock movement
        await client.query(`
          INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, staff_id, reason)
          VALUES ($1, 'RETAIL_SALE', $2, 100, 100 + $2, $3, $4, 'Retail Store POS checkout')
        `, [item.prod.id, -item.qty, ro.orderNum, ro.staff]);
      }
    }

    // B. Wholesale B2B Contracts & Invoices
    const wholesaleOrders = [
      {
        orderNum: 'WHL-2026-5001',
        customer: custList[3].id, // Metro Supermarkets
        staff: salesRepId,
        paymentMethod: 'BANK_TRANSFER',
        paymentStatus: 'PARTIAL',
        paid: 8000.00,
        items: [
          { prod: prodList[11], qty: 100, price: 17.50, cost: 11.50 }, // Coffee
          { prod: prodList[12], qty: 150, price: 8.00, cost: 5.20 },  // Tea
          { prod: prodList[14], qty: 200, price: 4.40, cost: 3.10 }   // Paper
        ]
      },
      {
        orderNum: 'WHL-2026-5002',
        customer: custList[4].id, // BuildCorp Contractors
        staff: salesRepId,
        paymentMethod: 'CREDIT',
        paymentStatus: 'UNPAID',
        paid: 0.00,
        items: [
          { prod: prodList[4], qty: 80, price: 3.20, cost: 2.10 },   // Duct tape
          { prod: prodList[5], qty: 40, price: 16.00, cost: 12.00 }, // Stretch film
          { prod: prodList[9], qty: 100, price: 5.10, cost: 3.20 }   // Safety Vests
        ]
      },
      {
        orderNum: 'WHL-2026-5003',
        customer: custList[5].id, // Horizon Tech Solutions
        staff: salesRepId,
        paymentMethod: 'BANK_TRANSFER',
        paymentStatus: 'PAID',
        paid: 6240.00,
        items: [
          { prod: prodList[0], qty: 40, price: 78.00, cost: 65.00 }, // Mice
          { prod: prodList[2], qty: 120, price: 6.50, cost: 3.50 },  // Cables
          { prod: prodList[3], qty: 50, price: 16.50, cost: 11.20 }  // Chargers
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
          VALUES ($1, 'WHOLESALE_SALE', $2, 200, 200 + $2, $3, $4, 'B2B Wholesale bulk shipment fulfillment')
        `, [item.prod.id, -item.qty, wo.orderNum, wo.staff]);
      }
    }
    console.log(`Seeded Retail and Wholesale sales orders.`);

    // 10. Insert Purchase Order (Restocking from Vendors)
    const poRes = await client.query(`
      INSERT INTO purchase_orders (po_number, vendor_id, staff_id, status, total_amount, payment_status, expected_delivery_date, received_at, notes)
      VALUES ('PO-2026-901', $1, $2, 'RECEIVED', 4250.00, 'PAID', CURRENT_DATE - INTERVAL '2 days', CURRENT_TIMESTAMP, 'Emergency restocking for high velocity electronics and cables.')
      RETURNING id;
    `, [vendorList[0].id, adminId]);

    const poId = poRes.rows[0].id;
    await client.query(`
      INSERT INTO purchase_order_items (po_id, product_id, quantity_ordered, quantity_received, unit_cost, total_cost)
      VALUES 
        ($1, $2, 50, 50, 65.00, 3250.00),
        ($1, $3, 200, 200, 5.00, 1000.00)
    `, [poId, prodList[0].id, prodList[2].id]);
    console.log(`Seeded Purchase Orders & Inbound shipments.`);

    // 11. Insert System Audit Logs (Event logs)
    const auditEvents = [
      { staff_id: 1, name: 'Alexander Vance', action: 'SYSTEM_BOOT', module: 'AUTH', severity: 'INFO', details: { msg: 'ERP Server cluster initialized with PostgreSQL 16 engine' } },
      { staff_id: 1, name: 'Alexander Vance', action: 'USER_CREATED', module: 'STAFF', severity: 'INFO', details: { user: 'marcus.sales@apexerp.com', role: 'SALES_REP' } },
      { staff_id: 4, name: 'Marcus Cole', action: 'WHOLESALE_ORDER_CREATED', module: 'WHOLESALE', severity: 'INFO', details: { order_number: 'WHL-2026-5001', customer: 'Metro Retail Group Corp', total: 3820.00 } },
      { staff_id: 3, name: 'Alex Rivera', action: 'POS_CHECKOUT', module: 'RETAIL', severity: 'INFO', details: { order_number: 'POS-2026-1001', payment: 'CASH', total: 140.37 } },
      { staff_id: 5, name: 'Elena Rostova', action: 'STOCK_RESTOCKED', module: 'INVENTORY', severity: 'INFO', details: { po_number: 'PO-2026-901', items_received: 250 } },
      { staff_id: 1, name: 'Alexander Vance', action: 'PRICE_TIER_ADJUSTED', module: 'INVENTORY', severity: 'WARNING', details: { sku: 'ELEC-LOG-MX3', old_wholesale: 82.00, new_wholesale: 78.00 } },
      { staff_id: 4, name: 'Marcus Cole', action: 'CREDIT_LIMIT_APPROVED', module: 'CUSTOMERS', severity: 'INFO', details: { customer: 'BuildCorp Global LLC', limit: 25000.00, terms: 'NET_60' } }
    ];

    for (const evt of auditEvents) {
      await client.query(`
        INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, '127.0.0.1')
      `, [evt.staff_id, evt.name, evt.action, evt.module, evt.severity, JSON.stringify(evt.details)]);
    }
    console.log(`Seeded System Event & Audit Logs.`);

    await client.query('COMMIT');
    console.log('✓ ApexERP Database seeded successfully with enterprise data!');
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
