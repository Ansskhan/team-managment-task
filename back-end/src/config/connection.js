import { Pool } from 'pg';

// Connection priority:
// 1. DATABASE_URL from .env (production / GCP Cloud SQL / Neon etc.)
// 2. Default local PostgreSQL connection for development
const connectionString =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5600/team_task_manager';

export const isLocalDatabase = !process.env.DATABASE_URL;

export const pool = new Pool({ connectionString });

pool.on('error', (err) => {
  // A crashed idle client must not take the process down
  console.error('[postgres] idle client error:', err.message);
});

export async function query(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

export default pool;
