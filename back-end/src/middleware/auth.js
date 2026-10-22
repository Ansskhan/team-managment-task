/**
 * Authentication middleware.
 * All non-auth routes are protected: without a valid session cookie the
 * request is rejected with 401.
 */
export const requireAuth = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ message: 'Authentication required' });
};

export default requireAuth;
