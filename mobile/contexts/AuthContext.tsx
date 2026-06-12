import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import * as authApi from "../api/auth";
import {
  setAccessToken,
  loadAccessToken,
  clearTokens,
  getRefreshToken,
} from "../api/client";
import { clearStorage } from "../utils/storage";
import type { UserWithPreferences } from "../types/appTypes";

interface AuthContextType {
  user: UserWithPreferences | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (
    email: string,
    password: string,
    profile?: { username?: string; age?: number; weight?: number }
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserWithPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Try to restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Load cached access token from SecureStore
        await loadAccessToken();

        // Check if we have a refresh token
        const storedRefresh = await getRefreshToken();
        if (!storedRefresh) {
          setAccessToken(null);
          setIsLoading(false);
          return;
        }

        // Try to refresh token
        const refreshResult = await authApi.refreshToken();
        if (refreshResult.success && refreshResult.data) {
          // Get full user data
          const meResult = await authApi.getMe();
          if (meResult.success && meResult.data) {
            setUser(meResult.data.user);
          }
        }
      } catch {
        await clearTokens();
        setAccessToken(null);
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
        setError(result.error || "Login failed");
        return false;
      }
    } catch {
      setError("Network error");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(
    async (
      email: string,
      password: string,
      profile?: { username?: string; age?: number; weight?: number }
    ): Promise<boolean> => {
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
          setError(result.error || "Registration failed");
          return false;
        }
      } catch {
        setError("Network error");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setAccessToken(null);
      await clearTokens();
      await clearStorage();
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await authApi.getMe();
    if (me.success && me.data) {
      setUser(me.data.user);
    }
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
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
