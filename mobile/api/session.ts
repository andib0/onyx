// Offline-first session restore (Bet 1).
//
// A launch never waits for the network: stored tokens + the cached user are
// enough to show the app. The access token is refreshed lazily by the API
// client (on a 401, or when it is about to expire — decoded locally). Only a
// definitive rejection of the refresh token logs the user out; offline,
// timeouts, 5xx and non-JSON answers keep the session.
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { UserWithPreferences } from "../types/appTypes";
import { clearTokens, decodeJwt, getRefreshToken, loadAccessToken } from "./client";
import * as authApi from "./auth";

export const SESSION_USER_KEY = "onyx_session_user_v1";

export type RestoreResult = {
  user: UserWithPreferences | null;
  /** cache: zero network; network: fetched /auth/me (first launch after an
   *  upgrade); offline-stub: no cached user and no network, identity from the JWT */
  source: "cache" | "network" | "offline-stub" | "none";
};

export async function readCachedUser(): Promise<UserWithPreferences | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.id === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeCachedUser(user: UserWithPreferences | null): Promise<void> {
  try {
    if (user) await AsyncStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    else await AsyncStorage.removeItem(SESSION_USER_KEY);
  } catch {
    // best effort: the next launch falls back to the network path
  }
}

export async function restoreSession(): Promise<RestoreResult> {
  const [refresh, access, cached] = await Promise.all([
    getRefreshToken(),
    loadAccessToken(),
    readCachedUser(),
  ]);
  if (!refresh) return { user: null, source: "none" };

  const claims = decodeJwt(access) || decodeJwt(refresh);
  if (cached && (!claims?.sub || claims.sub === cached.id)) {
    return { user: cached, source: "cache" };
  }

  // No cached profile (first launch of this version): ask the server once.
  const me = await authApi.getMe();
  if (me.success && me.data) {
    await writeCachedUser(me.data.user);
    return { user: me.data.user, source: "network" };
  }
  if (me.code === "SESSION_EXPIRED" || (me.status === 401 && !me.networkError)) {
    await clearTokens();
    return { user: null, source: "none" };
  }
  // Offline / server asleep: keep the session with the identity in the token.
  if (claims?.sub) {
    return { user: { id: claims.sub, email: "", createdAt: "" }, source: "offline-stub" };
  }
  return { user: null, source: "none" };
}
