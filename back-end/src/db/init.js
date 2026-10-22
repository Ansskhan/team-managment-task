import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Which database to connect to for administration (creating team_task_manager)
const dbUrl =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/team_task_manager';

const parsed = new URL(dbUrl);
const dbName = parsed.pathname.replace('/', '') || 'team_task_manager';
const adminUrl = new URL(dbUrl);
adminUrl.pathname = '/postgres';

async function main() {
  // Step 1: connect to the default "postgres" database and create the app DB
  const adminPool = new Pool({ connectionString: adminUrl.toString() });

  try {
    const existing = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (existing.rowCount === 0) {
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`[db:init] created database ${dbName}`);
    } else {
      console.log(`[db:init] database ${dbName} already exists`);
    }
  } finally {
    await adminPool.end();
  }

  // Step 2: connect to the app database and run the schema
  const appPool = new Pool({ connectionString: dbUrl });
  try {
    const schema = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf8',
    );
    await appPool.query(schema);
    console.log(`[db:init] applied schema.sql to ${dbName}`);
  } finally {
    await appPool.end();
  }
}

main().catch((err) => {
  console.error('[db:init] failed:', err.message);
  console.error(
    '[db:init] check your DATABASE_URL / local PostgreSQL credentials, then retry: npm run db:init',
  );
  process.exit(1);
});
