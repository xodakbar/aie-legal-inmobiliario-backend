import pool from './db';

async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('PostgreSQL connected at:', res.rows[0]);
    process.exit(0);
  } catch (error) {
    console.error('Error connecting to PostgreSQL:', error);
    process.exit(1);
  }
}

testConnection();
