import js from "@eslint/js";
import eslintPrettier from "eslint-config-prettier/flat";
import eslintReact from "eslint-plugin-react";
import pluginLingui from "eslint-plugin-lingui";
import { defineConfig } from "eslint/config";
import globals from "globals";
import eslintTypescript from "typescript-eslint";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"], plugins: { js }, extends: ["js/recommended"] },
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"], languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  eslintTypescript.configs.recommended,
  eslintReact.configs.flat.recommended,
  eslintReact.configs.flat['jsx-runtime'],
  eslintPrettier,
  // Overrides:
  {
    // `@typescript-eslint/no-require-imports` is enabled by default in `typescript-eslint/recommended` config.
    // This allows us to use `require` syntax in CJS files.
    files: ["**/*.{cjs,cts}"],
    rules: {
      "@typescript-eslint/no-require-imports": ["off"]
    }
  },
  // Lingui i18n guard — only on user-facing client surfaces. Server, scripts,
  // emails (server-rendered, no babel macros), shared types, and ui primitives
  // (shadcn-generated) are excluded.
  {
    files: [
      "src/pages/**/*.{ts,tsx}",
      "src/layout/**/*.{ts,tsx}",
      "src/auth/**/*.{ts,tsx}",
      "src/components/editorial/**/*.{ts,tsx}",
      "src/App.tsx",
    ],
    plugins: { lingui: pluginLingui },
    rules: {
      "lingui/no-unlocalized-strings": ["warn", {
        ignore: [
          // ignore lowercase-only single tokens (CSS values, identifiers)
          "^(?![A-Z])\\S+$",
          // ignore SHOUTY_SNAKE_CASE constants
          "^[A-Z0-9_-]+$",
        ],
        ignoreNames: [
          { regex: { pattern: "className", flags: "i" } },
          { regex: { pattern: "^data-" } },
          "style", "styleName", "src", "srcSet", "type", "id", "key", "to", "href",
          "name", "role", "displayName", "fill", "stroke",
          "viewBox", "width", "height", "size", "as", "asChild",
          "autoComplete", "rel", "target", "method", "scope", "loading",
        ],
        ignoreFunctions: [
          "console.*",
          "Error",
          "require",
          "*.getElementById", "*.addEventListener", "*.removeEventListener",
          "*.includes", "*.indexOf", "*.startsWith", "*.endsWith",
          "*.querySelector", "*.querySelectorAll",
          "*.classList.*",
          "z.string", "z.object", "z.enum", "z.literal",
          "useNavigate", "navigate",
        ],
      }],
      "lingui/no-trans-inside-trans": "warn",
    },
  },
]);
