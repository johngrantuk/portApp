import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": src("./src"),
      // `server-only` throws outside a Next server build; stub it for unit tests.
      "server-only": src("./tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Application logic only; React components and pages are not unit-tested (see docs/test-plan.md).
      include: ["src/lib/**/*.ts", "src/proxy.ts", "src/app/api/**/*.ts"],
      exclude: ["src/lib/useLocalStorage.ts", "src/lib/types.ts"],
      reporter: ["text", "json-summary", "html"],
    },
  },
});
