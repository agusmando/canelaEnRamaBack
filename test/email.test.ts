import test from "node:test";
import assert from "node:assert/strict";
import { renderBrandedEmail } from "../src/services/email.service.js";

test("emails de marca incluyen logo, acción y versión de texto", () => {
  const { html, text } = renderBrandedEmail(
    {
      subject: "Confirmá tu correo",
      preheader: "Un paso más para dejar tu cuenta lista.",
      heading: "¡Gracias por sumarte!",
      greeting: "Hola,",
      paragraphs: ["Confirmá tu correo para cuidar tu cuenta."],
      action: { label: "Confirmar mi correo", url: "https://example.com/verify" },
    },
    "https://canelaenrama.com.ar/favicon.png",
  );

  assert.match(html, /alt="Canela en Rama"/);
  assert.match(html, /https:\/\/canelaenrama\.com\.ar\/favicon\.png/);
  assert.match(html, /Confirmar mi correo/);
  assert.match(text, /Confirmar mi correo: https:\/\/example\.com\/verify/);
  assert.match(text, /Con cariño/);
});

test("el contenido dinámico se escapa en el HTML", () => {
  const { html } = renderBrandedEmail(
    {
      subject: "Pedido",
      preheader: "Novedades",
      heading: "Hola <script>alert(1)</script>",
      greeting: "Hola,",
      paragraphs: ["Falta <almendra> & más."],
      action: { label: "Ver pedido", url: "https://example.com/?a=1&b=2" },
    },
    "https://canelaenrama.com.ar/favicon.png",
  );

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;almendra&gt; &amp; más\./);
  assert.match(html, /a=1&amp;b=2/);
});
