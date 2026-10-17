import * as SecureStore from "expo-secure-store";

// Native token storage. Metro resolves tokenStore.web.ts on web, where
// expo-secure-store has no implementation (used for web e2e runs only).
export function getItem(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export function setItem(key: string, value: string): Promise<void> {
  return SecureStore.setItemAsync(key, value);
}

export function deleteItem(key: string): Promise<void> {
  return SecureStore.deleteItemAsync(key);
}
