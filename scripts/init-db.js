const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:soundofheart@localhost:5432/erp_db';

console.log('Connecting to PostgreSQL at:', databaseUrl.replace(/:[^:@]+@/, ':***@'));

const pool = new Pool({
  connectionString: databaseUrl,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Reading schema.sql...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    
    console.log('Executing database schema migrations...');
    await client.query(schemaSql);
    console.log('✓ SANA FRESH ERP Database Schema initialized successfully!');
  } catch (err) {
    console.error('Error initializing schema:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
