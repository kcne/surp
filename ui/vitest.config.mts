import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    // Formatting output depends on the process timezone unless every call
    // pins one. Running under a timezone that is neither UTC nor the tenant's
    // keeps that mistake from passing.
    env: { TZ: "America/New_York" },
  },
})
