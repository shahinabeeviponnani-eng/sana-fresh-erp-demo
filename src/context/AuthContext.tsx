'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'SALES_REP' | 'INVENTORY_CLERK' | 'ACCOUNTANT';
  phone?: string;
  status: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password?: string, pin?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  switchUser: (role: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => false,
  logout: async () => {},
  switchUser: async () => false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } else {
        // Auto default to Admin for demo convenience if no cookie yet
        await switchUser('ADMIN');
      }
    } catch (err) {
      console.error('Auth check error:', err);
      await switchUser('ADMIN');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
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
    setUser(null);
    router.push('/login');
  };

  const switchUser = async (role: string) => {
    const roleCredentials: Record<string, { email: string; pass: string }> = {
      ADMIN: { email: 'admin@sanafresh.com', pass: 'admin123' },
      MANAGER: { email: 'sarah.manager@sanafresh.com', pass: 'manager123' },
      CASHIER: { email: 'alex.cashier@sanafresh.com', pass: 'cashier123' },
      SALES_REP: { email: 'marcus.sales@sanafresh.com', pass: 'sales123' },
      INVENTORY_CLERK: { email: 'elena.stock@sanafresh.com', pass: 'stock123' },
    };

    const target = roleCredentials[role] || roleCredentials.ADMIN;
    return await login(target.email, target.pass);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, switchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
