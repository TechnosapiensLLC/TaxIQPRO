import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../services/api';
import { tokenStorage } from '../services/tokenStorage';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'individual' | 'chain_owner' | 'store_owner' | 'store_manager' | 'driver_employee';
  organization_id?: string | null;
  store_id?: string | null;
  profession?: string | null;
  gig_types?: string[];
  onboarded?: boolean;
  subscription_tier?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (
    email: string,
    password: string,
    name: string,
    extras?: { invite_code?: string; profession?: string; gig_types?: string[] }
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
  authError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readError(error: any): string {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return error?.message || 'Something went wrong. Please try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await tokenStorage.get();
        if (token) {
          setUser(await api.getMe());
        }
      } catch {
        await tokenStorage.clear();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    try {
      const data = await api.login(email.trim().toLowerCase(), password);
      await tokenStorage.set(data.access_token);
      setUser(data.user);
      return true;
    } catch (error) {
      setAuthError(readError(error));
      return false;
    }
  }, []);

  const signup = useCallback(
    async (
      email: string,
      password: string,
      name: string,
      extras?: { invite_code?: string; profession?: string; gig_types?: string[] }
    ) => {
      setAuthError(null);
      try {
        const data = await api.register({
          email: email.trim().toLowerCase(),
          password,
          name,
          ...extras,
        });
        await tokenStorage.set(data.access_token);
        setUser(data.user);
        return true;
      } catch (error) {
        setAuthError(readError(error));
        return false;
      }
    },
    []
  );

  const logout = useCallback(async () => {
    await tokenStorage.clear();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await api.getMe());
    } catch {
      /* keep current user on transient failures */
    }
  }, []);

  const updateUser = useCallback(async (userData: Partial<User>) => {
    const updated = await api.updateMe({
      name: userData.name,
      profession: userData.profession ?? undefined,
      gig_types: userData.gig_types,
      onboarded: userData.onboarded,
    });
    setUser(updated);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        updateUser,
        refreshUser,
        authError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
