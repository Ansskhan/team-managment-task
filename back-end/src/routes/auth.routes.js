import { Router } from 'express';
import {
  register,
  login,
  logout,
  me,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { loginSchema, registerSchema } from '../validators/schemas.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.post('/register', validate(registerSchema), register);

// the controller wraps passport.authenticate so failures stay JSON
router.post('/login', validate(loginSchema), login);

// Only makes sense when logged in
router.post('/logout', requireAuth, logout);

// Returns { user: null } for anonymous visitors so the frontend can hydrate
router.get('/me', me);

export default router;
