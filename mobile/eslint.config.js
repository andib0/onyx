import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["node_modules", ".expo", "**/._*"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, reactHooks.configs["recommended-latest"]],
    languageOptions: {
      ecmaVersion: 2020,
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "no-undef": "off",
      // Barrels evaluate every icon set / font weight and ship their assets (Bet 11).
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@expo/vector-icons",
              message: "Import the family directly: @expo/vector-icons/Ionicons",
            },
            {
              name: "@expo-google-fonts/archivo",
              message: "Import the weight directly: @expo-google-fonts/archivo/700Bold",
            },
            {
              name: "@expo-google-fonts/jetbrains-mono",
              message:
                "Import the weight directly: @expo-google-fonts/jetbrains-mono/500Medium",
            },
          ],
        },
      ],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^[A-Z_]" },
      ],
    },
  },
]);
