import type { LinguiConfig } from "@lingui/conf";

const config: LinguiConfig = {
  locales: ["en", "pl"],
  sourceLocale: "en",
  catalogs: [
    {
      path: "<rootDir>/src/locales/{locale}/messages",
      include: ["src"],
      exclude: ["**/node_modules/**", "**/.wasp/**", "src/server/**", "src/locales/**"],
    },
  ],
  format: "po",
  compileNamespace: "es",
};

export default config;
