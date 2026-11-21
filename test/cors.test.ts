import test from "node:test";
import assert from "node:assert/strict";
import { getAllowedCorsOrigins } from "../src/config/cors.js";

test("CORS permite una lista separada por comas", () => {
  assert.deepEqual(
    getAllowedCorsOrigins("https://tienda.com, https://admin.tienda.com", "development"),
    ["https://tienda.com", "https://admin.tienda.com"],
  );
});

test("CORS falla en producción sin lista", () => {
  assert.throws(
    () => getAllowedCorsOrigins("", "production"),
    /CORS_ORIGINS es obligatorio en producción/,
  );
});
