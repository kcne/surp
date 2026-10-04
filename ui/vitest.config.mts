import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

const alias = { "@": fileURLToPath(new URL("./", import.meta.url)) }

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        // tsconfig keeps `jsx: "preserve"` for Next; tests need it compiled.
        oxc: { jsx: { runtime: "automatic" } },
        test: {
          name: "components",
          environment: "jsdom",
          include: ["test/**/*.test.{ts,tsx}"],
          restoreMocks: true,
        },
      },
      {
        resolve: { alias },
        test: {
          name: "i18n",
          environment: "node",
          include: ["i18n/**/*.test.ts"],
          // Formatting output depends on the process timezone unless every call
          // pins one. Running under a timezone that is neither UTC nor the tenant's
          // keeps that mistake from passing.
          env: { TZ: "America/New_York" },
        },
      },
    ],
  },
})
