// Extends app.json. The only dynamic part: local e2e/emulator builds that talk to an
// http:// API on the host (Android emulator → http://10.0.2.2:<port>, or localhost)
// get android:usesCleartextTraffic="true"; release builds block cleartext otherwise
// ("Network request failed", docs/AMBITION_PLAN.md §7). Every other build — including
// production, which uses the https API from app.json — is unchanged.
import { withAndroidManifest, type ConfigPlugin } from "expo/config-plugins";
import type { ExpoConfig, ConfigContext } from "expo/config";

const LOCAL_HTTP_API = /^http:\/\/(10\.0\.2\.2|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;

export function allowsCleartext(apiUrl: string | undefined): boolean {
  return !!apiUrl && LOCAL_HTTP_API.test(apiUrl);
}

const withCleartextTraffic: ConfigPlugin = (config) =>
  withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) app.$["android:usesCleartextTraffic"] = "true";
    return cfg;
  });

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig;
  if (!allowsCleartext(process.env.EXPO_PUBLIC_API_URL)) return base;
  return withCleartextTraffic(base) as ExpoConfig;
};
