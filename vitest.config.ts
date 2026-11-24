import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Los tests no tocan la base ni SuperTokens: si algo intenta conectarse, que falle rápido.
    env: { DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test", DIRECT_URL: "postgresql://test:test@127.0.0.1:1/test" },
  },
});