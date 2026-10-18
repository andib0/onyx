import type { UserWithPreferences } from "../types/appTypes";
import { api, getRefreshToken, setAccessToken, setRefreshToken } from "./client";

type User = UserWithPreferences;

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
}

interface MeResponse {
  user: User;
}

type RegisterProfile = {
  username?: string;
  age?: number;
  weight?: number;
};

function deviceTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export async function register(
  email: string,
  password: string,
  profile?: RegisterProfile
) {
  const response = await api.post<AuthResponse>(
    "/auth/register",
    Object.assign({ email, password, timezone: deviceTimezone() }, profile || {})
  );

  if (response.success && response.data) {
    setAccessToken(response.data.accessToken);
    if (response.data.refreshToken) {
      await setRefreshToken(response.data.refreshToken);
    }
  }

  return response;
}

export async function login(email: string, password: string) {
  const response = await api.post<AuthResponse>("/auth/login", { email, password });

  if (response.success && response.data) {
    setAccessToken(response.data.accessToken);
    if (response.data.refreshToken) {
      await setRefreshToken(response.data.refreshToken);
    }
  }

  return response;
}

export async function logout() {
  // Send this device's refresh token so only its token family is revoked.
  const refreshToken = await getRefreshToken();
  const response = await api.post(
    "/auth/logout",
    refreshToken ? { refreshToken } : undefined
  );
  setAccessToken(null);
  await setRefreshToken(null);
  return response;
}

export async function getMe() {
  return api.get<MeResponse>("/auth/me");
}

/** Direct (online) profile update — screens go through the outbox version in
 *  sync/writes.ts, re-exported as `updateProfile` below. */
export async function updateProfileNow(profile: RegisterProfile) {
  return api.put<MeResponse>("/auth/profile", profile);
}

export { updateProfile } from "../sync/writes";
