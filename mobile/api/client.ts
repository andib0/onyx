import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const API_BASE = Constants.expoConfig?.extra?.apiUrl || "http://localhost:3001/api";

const ACCESS_TOKEN_KEY = "onyx_access_token";
const REFRESH_TOKEN_KEY = "onyx_refresh_token";

let cachedAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  cachedAccessToken = token;
  if (token) {
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token).catch(() => {});
  } else {
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => {});
  }
}

export function getAccessToken(): string | null {
  return cachedAccessToken;
}

export async function loadAccessToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    cachedAccessToken = token;
    return token;
  } catch {
    return null;
  }
}

export async function setRefreshToken(token: string | null): Promise<void> {
  if (token) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  cachedAccessToken = null;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {}),
  ]);
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const storedRefreshToken = await getRefreshToken();
      if (!storedRefreshToken) {
        throw new Error("No refresh token");
      }

      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });

      if (!response.ok) {
        throw new Error("Refresh failed");
      }

      const data = await response.json();
      if (data.success && data.data?.accessToken) {
        cachedAccessToken = data.data.accessToken;
        setAccessToken(data.data.accessToken);
        if (data.data.refreshToken) {
          await setRefreshToken(data.data.refreshToken);
        }
        return cachedAccessToken;
      }
      throw new Error("No token in response");
    } catch {
      cachedAccessToken = null;
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers: HeadersInit = Object.assign(
    { "Content-Type": "application/json" },
    cachedAccessToken ? { Authorization: `Bearer ${cachedAccessToken}` } : {},
    options.headers || {}
  );

  try {
    let response = await fetch(
      `${API_BASE}${endpoint}`,
      Object.assign({}, options, { headers })
    );

    // If unauthorized, try to refresh token
    if (response.status === 401 && !endpoint.includes("/auth/")) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        const retryHeaders = Object.assign({}, headers, {
          Authorization: `Bearer ${newToken}`,
        });
        response = await fetch(
          `${API_BASE}${endpoint}`,
          Object.assign({}, options, { headers: retryHeaders })
        );
      }
    }

    const data = await response.json();
    return data as ApiResponse<T>;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// Convenience methods
export const api = {
  get: <T>(endpoint: string) => apiClient<T>(endpoint, { method: "GET" }),

  post: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string) => apiClient<T>(endpoint, { method: "DELETE" }),
};
