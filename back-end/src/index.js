import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import passport from './config/passport.js';
import { createSessionMiddleware } from './config/session.js';
import pool from './config/connection.js';
import authRoutes from './routes/auth.routes.js';
import teamRoutes from './routes/teams.routes.js';
import taskRoutes from './routes/tasks.routes.js';

const app = express();
app.set('trust proxy', 1); // needed behind load balancer / deployed behind HTTPS
app.disable('x-powered-by'); // don't advertise the framework version

// -----------------------------------------------
// core middleware
// -----------------------------------------------
const clientOrigins = (process.env.CLIENT_ORIGIN || 'https://team-tasks-manager.netlify.app')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
// dynamic check: other origins get NO Access-Control-Allow-Origin header
app.use(
  cors({
    origin: (origin, cb) => cb(null, clientOrigins.includes(origin ?? '')),
    credentials: true,
  }),
);
app.use(express.json({ limit: '50kb' })); // payload limit is basic sanitization too

// -----------------------------------------------
// sessions: PostgreSQL store when reachable, memory fallback in dev
// -----------------------------------------------
const bootstrap = async () => {
  let usePostgresStore = true;
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    usePostgresStore = false;
    console.warn(`[db] PostgreSQL unavailable: ${err.message}`);
  }

  app.use(createSessionMiddleware({ usePostgresStore }));
  app.use(passport.initialize());
  app.use(passport.session());

  // -----------------------------------------------
  // routes
  // -----------------------------------------------
  app.get('/health', (req, res) =>
    res.json({
      status: 'ok',
      dbReachable: usePostgresStore,
      sessionStore: usePostgresStore ? 'postgres' : 'memory (dev fallback)',
    }),
  );

  app.use('/auth', authRoutes);
  app.use('/teams', teamRoutes);
  app.use('/tasks', taskRoutes);

  // 404
  app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` }));

  // central error handler - every async failure lands here
  app.use((err, req, res, next) => {
    console.error('[error]', err.message);
    if (res.headersSent) return next(err);
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ message: 'Request payload too large' });
    }
    // body-parser attaches err.status for client-side errors (bad JSON etc.)
    const status = err?.status || err?.statusCode || 500;
    if (status >= 500) {
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(status).json({ message: err.message || 'Invalid request' });
  });

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `[server] listening on http://localhost:${PORT} (session store: ${
        usePostgresStore ? 'postgres' : 'memory'
      })`,
    );
  });
};

bootstrap().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
