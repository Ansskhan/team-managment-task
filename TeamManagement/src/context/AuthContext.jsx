import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // until /auth/me resolves once

  useEffect(() => {
    let cancelled = false;
    api('/auth/me')
      .then(({ user }) => {
        if (!cancelled) setUser(user);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      /** @returns {object} logged-in user */
      async login(credentials) {
        const { user } = await api('/auth/login', { method: 'POST', body: credentials });
        setUser(user);
        return user;
      },
      /** @returns {object} created user (backend auto-logs in) */
      async register(details) {
        const { user } = await api('/auth/register', { method: 'POST', body: details });
        setUser(user);
        return user;
      },
      async logout() {
        try {
          await api('/auth/logout', { method: 'POST' });
        } finally {
          setUser(null);
        }
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
