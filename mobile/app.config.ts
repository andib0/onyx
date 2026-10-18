// Extends app.json. The only dynamic part: local e2e/emulator builds that talk to an
// http:// API on the host (Android emulator → http://10.0.2.2:<port>, or localhost)
// get android:usesCleartextTraffic="true"; release builds block cleartext otherwise
// ("Network request failed", docs/AMBITION_PLAN.md §7). Every other build — including
// production, which uses the https API from app.json — is unchanged.
//
// Every Android release build also runs R8 (minify + resource shrinking): the
// unshrunk app ships ~25 MB of dex in 3 files, which ART has to open and verify at
// every cold start. And Ionicons is embedded as an Android font asset named after its
// family ("ionicons"), so tab/header icons draw in the first frame instead of after a
// runtime Font.loadAsync + one re-render per icon (docs/log/cold-start.md).
import fs from "node:fs";
import path from "node:path";
import {
  withAndroidManifest,
  withDangerousMod,
  withGradleProperties,
  type ConfigPlugin,
} from "expo/config-plugins";
import type { ExpoConfig, ConfigContext } from "expo/config";

const LOCAL_HTTP_API = /^http:\/\/(10\.0\.2\.2|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;

export function allowsCleartext(apiUrl: string | undefined): boolean {
  return !!apiUrl && LOCAL_HTTP_API.test(apiUrl);
}

const RELEASE_SHRINKING: Record<string, string> = {
  "android.enableMinifyInReleaseBuilds": "true",
  "android.enableShrinkResourcesInReleaseBuilds": "true",
};

const withReleaseShrinking: ConfigPlugin = (config) =>
  withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(RELEASE_SHRINKING)) {
      const item = cfg.modResults.find((p) => p.type === "property" && p.key === key);
      if (item && item.type === "property") item.value = value;
      else cfg.modResults.push({ type: "property", key, value });
    }
    return cfg;
  });

const IONICONS_TTF =
  "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf";

const withEmbeddedIonicons: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "android",
    async (cfg) => {
      const dir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app/src/main/assets/fonts"
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(
        path.join(cfg.modRequest.projectRoot, IONICONS_TTF),
        path.join(dir, "ionicons.ttf")
      );
      return cfg;
    },
  ]);

const withCleartextTraffic: ConfigPlugin = (config) =>
  withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) app.$["android:usesCleartextTraffic"] = "true";
    return cfg;
  });

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = withEmbeddedIonicons(
    withReleaseShrinking(config as ExpoConfig)
  ) as ExpoConfig;
  if (!allowsCleartext(process.env.EXPO_PUBLIC_API_URL)) return base;
  return withCleartextTraffic(base) as ExpoConfig;
};
