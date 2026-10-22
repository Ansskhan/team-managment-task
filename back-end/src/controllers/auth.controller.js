import bcrypt from 'bcrypt';
import passport from '../config/passport.js';
import { query } from '../config/connection.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const SALT_ROUNDS = 10;

/** Promise wrapper around req.login so it works inside async handlers. */
const loginUser = (req, user) =>
  new Promise((resolve, reject) =>
    req.login(user, (err) => (err ? reject(err) : resolve())),
  );

// ---------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const [existing] = await query(
    'SELECT 1 FROM users WHERE email = $1 LIMIT 1',
    [email],
  );
  if (existing) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const [user] = await query(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
    [name, email, passwordHash],
  );

  // Log the freshly registered user straight in
  await loginUser(req, user);

  return res.status(201).json({ user });
});

// ---------------------------------------------------------------
// POST /auth/login - custom passport callback so auth failures return
// JSON instead of the passport default plain-text "Unauthorized"
// ---------------------------------------------------------------
export const login = (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({
        message: info?.message || 'Invalid email or password',
      });
    }
    return req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      return res.json({
        user: { id: user.id, name: user.name, email: user.email },
      });
    });
  })(req, res, next);
};

// ---------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------
export const logout = (req, res, next) => {
  // passport.destroySession + drop the session row / cookie
  req.logout((err) => {
    if (err) return next(err);
    return res.json({ message: 'Logged out' });
  });
};

// ---------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------
export const me = (req, res) => {
  res.json({ user: req.user ?? null });
};
