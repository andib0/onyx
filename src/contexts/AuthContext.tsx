import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import { setAccessToken } from '../api/client';
import { STORAGE_KEY } from '../utils/storage';

interface User {
  id: string;
  email: string;
  username?: string;
  age?: number;
  weight?: number;
  createdAt: string;
  preferences?: {
    timezone: string;
    caffeineCutoff: string;
    sleepTarget: string;
    proteinTarget: string;
    hydrationTarget: string;
    selectedProgramId?: string | null;
    selectedProgramDayId?: string | null;
  };
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, profile?: { username?: string; age?: number; weight?: number }) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Try to restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Try to refresh token (will use httpOnly cookie)
        const refreshResult = await authApi.refreshToken();
        if (refreshResult.success && refreshResult.data) {
          // Get full user data
          const meResult = await authApi.getMe();
          if (meResult.success && meResult.data) {
            setUser(meResult.data.user);
          }
        }
      } catch {
        // No valid session
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authApi.login(email, password);

      if (result.success && result.data) {
        const me = await authApi.getMe();
        if (me.success && me.data) {
          setUser(me.data.user);
        } else {
          setUser(result.data.user);
        }
        return true;
      } else {
        setError(result.error || 'Login failed');
        return false;
      }
    } catch {
      setError('Network error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, profile?: { username?: string; age?: number; weight?: number }): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authApi.register(email, password, profile);

      if (result.success && result.data) {
        const me = await authApi.getMe();
        if (me.success && me.data) {
          setUser(me.data.user);
        } else {
          setUser(result.data.user);
        }
        return true;
      } else {
        setError(result.error || 'Registration failed');
        return false;
      }
    } catch {
      setError('Network error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem(STORAGE_KEY);
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
