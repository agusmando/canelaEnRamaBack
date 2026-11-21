import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyWebhookSignature } from "../src/config/mercadopago.js";

test("firma Mercado Pago válida", () => {
  const previous = process.env.MP_WEBHOOK_SECRET;
  process.env.MP_WEBHOOK_SECRET = "test-secret";
  const ts = String(Math.floor(Date.now() / 1000));
  const requestId = "request-123";
  const dataId = "987654";
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac("sha256", "test-secret").update(manifest).digest("hex");
  assert.equal(verifyWebhookSignature(`ts=${ts},v1=${v1}`, requestId, dataId).ok, true);
  if (previous === undefined) delete process.env.MP_WEBHOOK_SECRET;
  else process.env.MP_WEBHOOK_SECRET = previous;
});

test("firma Mercado Pago rechazada sin coincidencia", () => {
  const previous = process.env.MP_WEBHOOK_SECRET;
  process.env.MP_WEBHOOK_SECRET = "test-secret";
  assert.equal(verifyWebhookSignature("ts=1,v1=bad", "request", "123").ok, false);
  if (previous === undefined) delete process.env.MP_WEBHOOK_SECRET;
  else process.env.MP_WEBHOOK_SECRET = previous;
});
