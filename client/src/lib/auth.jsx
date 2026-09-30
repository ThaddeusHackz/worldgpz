import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest('/api/auth/me').then((data) => { if (active) setUser(data.user || null); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setUser(data.user);
    return data.user;
  }, []);
  const logout = useCallback(async () => {
    try { await apiRequest('/api/auth/logout', { method: 'POST' }); } finally { setUser(null); }
  }, []);
  const value = useMemo(() => ({ user, loading, login, logout, isAuthenticated: Boolean(user) }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
