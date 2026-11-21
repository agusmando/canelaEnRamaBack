import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";

// En producción el dashboard de SuperTokens queda apagado por defecto.
let server: Server;
let base = "";

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CORS_ORIGINS", "https://canelaenrama.test");
  vi.stubEnv("SUPERTOKENS_DASHBOARD", "");
  vi.stubEnv("SUPERTOKENS_CONNECTION_URI", "http://127.0.0.1:1");
  const { default: app } = await import("../src/app.js");
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

afterAll(() => {
  server?.close();
  vi.unstubAllEnvs();
});

describe("app", () => {
  it("health responde", async () => {
    const r = await fetch(`${base}/api/health`);
    expect(r.status).toBe(200);
  });

  it("el dashboard de SuperTokens no está publicado en producción", async () => {
    const r = await fetch(`${base}/api/auth/dashboard/`);
    expect(r.status).toBe(404);
  });

  it("rutas de staff piden sesión", async () => {
    const r = await fetch(`${base}/api/user/roles`);
    expect(r.status).toBe(401);
  });
});
