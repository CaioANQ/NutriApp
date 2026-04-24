// mobile/patient-app/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';

// SecureStore: armazenamento criptografado pelo keychain/keystore do SO
// Nunca usar AsyncStorage para tokens — não é criptografado

const ACCESS_KEY = 'nutriapp_access_token';
const REFRESH_KEY = 'nutriapp_refresh_token';

interface PatientProfile {
  id: string;
  name: string;
  targetKcal: number;
  waterTargetMl: number;
  conditions: string[];
}

interface AuthUser {
  id: string;
  email: string;
  role: 'PATIENT';
  profile: PatientProfile;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const token = await SecureStore.getItemAsync(ACCESS_KEY);
      if (!token) return;
      // Injetar token no header e verificar sessão
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const { data } = await api.get<AuthUser>('/auth/me');
      // Garantir que só pacientes usam o app do paciente
      if (data.role !== 'PATIENT') {
        await clearTokens();
        return;
      }
      setUser(data);
    } catch {
      await clearTokens();
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const { data } = await api.post<{
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
    }>('/auth/login', { email: email.trim().toLowerCase(), password });

    if (data.user.role !== 'PATIENT') {
      throw new Error('Este app é exclusivo para pacientes. Use o app do nutricionista.');
    }

    // Armazenar tokens criptografados no SecureStore
    await SecureStore.setItemAsync(ACCESS_KEY, data.accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, data.refreshToken);

    api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
    setUser(data.user);
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      await clearTokens();
      setUser(null);
    }
  }

  async function clearTokens() {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    delete api.defaults.headers.common['Authorization'];
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
};
