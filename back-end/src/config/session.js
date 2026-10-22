import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './connection.js';

// connect-pg-simple creates (and reuses) the "session" table in PostgreSQL
const PgStore = connectPgSimple(session);

/**
 * Session middleware.
 *
 * `usePostgresStore === true`  -> sessions persisted in PostgreSQL.
 * `usePostgresStore === false` -> default MemoryStore (dev fallback when
 * PostgreSQL is unreachable); a warning is logged on boot.
 *
 * Always HTTP-only cookies; secure + sameSite:none when serving over HTTPS
 * in production so the SPA on another origin can still send the cookie.
 */
export function createSessionMiddleware({ usePostgresStore }) {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!usePostgresStore) {
    console.warn(
      '[session] PostgreSQL unavailable - falling back to in-memory sessions (dev only).',
    );
  }

  return session({
    name: 'ttm.sid',
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    resave: false,
    saveUninitialized: false,
    store: usePostgresStore
      ? new PgStore({ pool, createTableIfMissing: true })
      : undefined,
    cookie: {
      httpOnly: true,
      secure: isProduction, // HTTPS-only in production
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  });
}
