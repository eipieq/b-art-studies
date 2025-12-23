'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAccount } from '@/lib/appwrite';
import { ID } from 'appwrite';
import type { User, LoginCredentials, SignupCredentials } from '@/types/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const account = getAccount();

  // Check for existing session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const currentUser = await account.get();
      console.log('Session check successful:', currentUser.$id);
      setUser(currentUser as User);
    } catch (error) {
      console.log('No active session found:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async ({ email, password }: LoginCredentials) => {
    try {
      console.log('Attempting login...');
      const session = await account.createEmailPasswordSession(email, password);
      console.log('Login successful, session created:', session);
      await checkSession();
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const signup = async ({ email, password, name }: SignupCredentials) => {
    try {
      console.log('Attempting signup...');
      await account.create(ID.unique(), email, password, name);
      console.log('Account created, logging in...');
      await login({ email, password });
    } catch (error) {
      console.error('Signup failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    await account.deleteSession('current');
    setUser(null);
  };

  const isAdmin = user?.labels?.includes('admin') ?? false;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        isAdmin,
        login,
        signup,
        logout,
        refreshSession: checkSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
