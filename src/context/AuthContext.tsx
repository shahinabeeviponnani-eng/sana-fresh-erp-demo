'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { checkUserPermission } from '@/lib/permissions';

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'SALES_REP' | 'INVENTORY_CLERK' | 'ACCOUNTANT' | string;
  phone?: string;
  status: string;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password?: string, pin?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  hasPermission: (permissionKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => false,
  logout: async () => {},
  hasPermission: () => false,
});

// Module-level cache — survives re-renders, cleared on logout
let cachedUser: User | null = null;
let sessionChecked = false;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState(!sessionChecked);
  const router = useRouter();
  const pathname = usePathname();

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          cachedUser = data.user;
          sessionChecked = true;
          setUser(data.user);
        } else {
          cachedUser = null;
          sessionChecked = true;
          setUser(null);
          if (pathname !== '/login') router.replace('/login');
        }
      } else {
        cachedUser = null;
        sessionChecked = true;
        setUser(null);
        if (pathname !== '/login') router.replace('/login');
      }
    } catch {
      cachedUser = null;
      sessionChecked = true;
      setUser(null);
      if (pathname !== '/login') router.replace('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionChecked) fetchCurrentUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password?: string, pin?: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, pin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        cachedUser = data.user;
        sessionChecked = true;
        setUser(data.user);
        return true;
      }
      throw new Error(data.error || 'Login failed');
    } catch (err: any) {
      alert(err.message);
      return false;
    }
  };

  const logout = async () => {
    await fetch('/api/auth/me', { method: 'POST' });
    // Clear product cache for this user
    if (cachedUser?.id) {
      try { localStorage.removeItem(`sf_products_cache_${cachedUser.id}`); } catch {}
    }
    cachedUser = null;
    sessionChecked = false;
    setUser(null);
    router.push('/login');
  };

  const hasPermission = (permissionKey: string): boolean => {
    if (!user) return false;
    return checkUserPermission(user.role, user.permissions, permissionKey);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
