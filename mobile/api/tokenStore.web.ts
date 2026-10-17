// Web fallback for token storage (expo-secure-store is native-only). Only the
// Expo web build used for local e2e runs reaches this file.
export async function getItem(key: string): Promise<string | null> {
  return globalThis.localStorage ? globalThis.localStorage.getItem(key) : null;
}

export async function setItem(key: string, value: string): Promise<void> {
  if (globalThis.localStorage) globalThis.localStorage.setItem(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (globalThis.localStorage) globalThis.localStorage.removeItem(key);
}
