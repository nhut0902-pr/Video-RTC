const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function initDatabase() {
    try {
        console.log('🔄 Connecting to database...');

        // Test connection
        await pool.query('SELECT NOW()');
        console.log('✅ Connected to database successfully');

        // Read and execute schema
        const schemaPath = path.join(__dirname, 'db', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('🔄 Creating tables...');
        await pool.query(schema);
        console.log('✅ Tables created successfully');

        // Verify tables
        const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

        console.log('\n📋 Tables in database:');
        result.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });

        await pool.end();
        console.log('\n✅ Database initialization complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        process.exit(1);
    }
}

initDatabase();
