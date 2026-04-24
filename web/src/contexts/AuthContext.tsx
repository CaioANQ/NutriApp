// web/src/contexts/AuthContext.tsx
'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';

export type Role = 'ADMIN' | 'PATIENT';

interface UserProfile {
  id: string;
  name: string;
  crnNumber?: string; // apenas ADMIN
}

interface AuthUser {
  id: string;
  email: string;
  role: Role;
  profile: UserProfile;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Verificar sessão ao montar
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const { data } = await api.get<AuthUser>('/auth/me');
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ user: AuthUser }>('/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    });

    setUser(data.user);

    // Redirecionar conforme role
    if (data.user.role === 'ADMIN') {
      router.push('/admin/dashboard');
    } else {
      router.push('/patient/cardapio');
    }
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      router.push('/login');
    }
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}

export function useRequireRole(role: Role) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user?.role !== role) {
      router.push('/login');
    }
  }, [user, isLoading, role, router]);

  return { user, isLoading };
}
