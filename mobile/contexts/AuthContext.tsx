import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";

import * as authApi from "../api/auth";
import { clearTokens, onAuthExpired, setAccessToken } from "../api/client";
import { takeSession, writeCachedUser } from "../api/session";
import { adoptPreviousAccount, onAccountLost, onServerUser } from "../sync/dayData";
import {
  flushNow,
  onUserIntent,
  overlayIntents,
  startSync,
  stopSync,
} from "../sync/runtime";
import type { Intent } from "../sync/intents";
import { clearStorage } from "../utils/storage";
import { perfMark } from "../utils/perfMarks";
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
const LAST_ACCOUNT_KEY = "onyx_last_account_v1";

/** Apply an optimistic prefs/profile write to the user object. */
export function applyUserIntent(
  user: UserWithPreferences,
  intent: Intent
): UserWithPreferences {
  if (intent.t === "prefs") {
    const prefs = Object.assign(
      {},
      user.preferences || {},
      intent.data
    ) as UserWithPreferences["preferences"];
    return Object.assign({}, user, { preferences: prefs });
  }
  if (intent.t === "profile") return Object.assign({}, user, intent.data);
  return user;
}

function withPendingUserWrites(user: UserWithPreferences, since: number) {
  return overlayIntents("user", since).reduce(applyUserIntent, user);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUserState] = useState<UserWithPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only replace the user object when something changed: every /today fetch
  // reports the user, and a new identity would re-render the whole tree.
  const setUser = useCallback((next: UserWithPreferences | null) => {
    setUserState((prev) => {
      if (prev && next && JSON.stringify(prev) === JSON.stringify(next)) return prev;
      return next;
    });
    writeCachedUser(next).catch(() => {});
  }, []);

  // Restore the session from disk: zero network calls when a user is cached.
  useEffect(() => {
    let cancelled = false;
    takeSession()
      .then((result) => {
        if (cancelled) return;
        if (result.user) {
          // Start the engine before any screen mounts and reads through it.
          startSync(result.user.id, queryClient).catch(() => {});
          setUserState(result.user);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        perfMark("auth_ready");
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  // One sync engine (outbox + clock) per signed-in user.
  const userId = user ? user.id : null;
  useEffect(() => {
    if (userId) startSync(userId, queryClient).catch(() => {});
    else stopSync({ clear: false }).catch(() => {});
  }, [userId, queryClient]);

  // Server and optimistic updates of the user object.
  useEffect(() => {
    const offServer = onServerUser((serverUser) => {
      setUser(withPendingUserWrites(serverUser, Date.now()));
    });
    const offIntent = onUserIntent((intent) => {
      setUserState((prev) => {
        if (!prev) return prev;
        const next = applyUserIntent(prev, intent);
        writeCachedUser(next).catch(() => {});
        return next;
      });
    });
    // Refresh token definitively rejected, or the account no longer exists on
    // the server: back to sign-in. Local data stays (namespaced per user) so a
    // re-registration with the same email can rehydrate the server from it.
    const signedOut = () => {
      clearTokens().catch(() => {});
      setUser(null);
    };
    const offExpired = onAuthExpired(signedOut);
    const offLost = onAccountLost(signedOut);
    return () => {
      offServer();
      offIntent();
      offExpired();
      offLost();
    };
  }, [setUser]);

  const signedIn = useCallback(
    async (signed: UserWithPreferences, email: string) => {
      try {
        const raw = await AsyncStorage.getItem(LAST_ACCOUNT_KEY);
        const last = raw ? (JSON.parse(raw) as { id: string; email: string }) : null;
        if (
          last &&
          last.id !== signed.id &&
          last.email.toLowerCase() === email.toLowerCase()
        ) {
          await adoptPreviousAccount(last.id, signed.id);
        }
        await AsyncStorage.setItem(
          LAST_ACCOUNT_KEY,
          JSON.stringify({ id: signed.id, email })
        );
      } catch {
        // best effort
      }
      startSync(signed.id, queryClient).catch(() => {});
      setUser(signed);
    },
    [setUser, queryClient]
  );

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await authApi.login(email, password);
        if (result.success && result.data) {
          const me = await authApi.getMe();
          await signedIn(me.success && me.data ? me.data.user : result.data.user, email);
          return true;
        }
        setError(result.error || "Login failed");
        return false;
      } catch {
        setError("Network error");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [signedIn]
  );

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
          await signedIn(me.success && me.data ? me.data.user : result.data.user, email);
          return true;
        }
        setError(result.error || "Registration failed");
        return false;
      } catch {
        setError("Network error");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [signedIn]
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      // Last chance to deliver queued writes before they are discarded.
      await Promise.race([
        flushNow().catch(() => null),
        new Promise((r) => setTimeout(r, 3_000)),
      ]);
      await authApi.logout().catch(() => null);
    } finally {
      // The outbox is per user and cleared here, so nothing replays into the
      // next account (audit 02 §2.11).
      await stopSync({ clear: true });
      setAccessToken(null);
      await clearTokens();
      queryClient.clear();
      await clearStorage();
      setUser(null);
      setIsLoading(false);
    }
  }, [queryClient, setUser]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const since = Date.now();
    const me = await authApi.getMe();
    if (me.success && me.data) setUser(withPendingUserWrites(me.data.user, since));
  }, [setUser]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      error,
      login,
      register,
      logout,
      clearError,
      refreshUser,
    }),
    [user, isLoading, error, login, register, logout, clearError, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
