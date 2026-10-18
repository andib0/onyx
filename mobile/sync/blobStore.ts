// Large JSON blobs (persisted query cache, full-history backup). On native they
// are files in the app's document directory — AsyncStorage on Android cannot
// read rows over ~2 MB (CursorWindow) and a multi-year backup can exceed that.
// On web they go to AsyncStorage (localStorage), used only by local e2e runs.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";

type FsModule = { File: typeof File; Paths: typeof Paths };
const fs = (): FsModule | null => (Platform.OS === "web" ? null : { File, Paths });

const fileName = (name: string) => `${name.replace(/[^A-Za-z0-9_.-]/g, "_")}.json`;

export async function readBlob(name: string): Promise<string | null> {
  const m = fs();
  try {
    if (!m) return await AsyncStorage.getItem(`blob:${name}`);
    const file = new m.File(m.Paths.document, fileName(name));
    if (!file.exists) return null;
    return await file.text();
  } catch {
    return null;
  }
}

export async function writeBlob(name: string, text: string): Promise<void> {
  const m = fs();
  try {
    if (!m) {
      await AsyncStorage.setItem(`blob:${name}`, text);
      return;
    }
    const file = new m.File(m.Paths.document, fileName(name));
    if (!file.exists) file.create();
    file.write(text);
  } catch {
    // best effort: a failed cache write only costs a slower next launch
  }
}

export async function removeBlob(name: string): Promise<void> {
  const m = fs();
  try {
    if (!m) {
      await AsyncStorage.removeItem(`blob:${name}`);
      return;
    }
    const file = new m.File(m.Paths.document, fileName(name));
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
}
