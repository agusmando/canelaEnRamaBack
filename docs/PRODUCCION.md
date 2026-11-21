# Salir a producción: qué falta y cuánto cuesta

Estado al 19/11/2026. Complementa [`DEPLOY.md`](./DEPLOY.md) (paso a paso técnico)
y [`MEJORAS.md`](./MEJORAS.md) (pendientes priorizados).

## 1. Qué falta para probar un caso real (en dev)

Estado del API dev (`https://canelaenramaback.onrender.com`) al 19/11:

| Pieza | Estado |
|---|---|
| Mercado Pago | ✅ activo (`/api/payment/config` → `enabled: true`) |
| Tarifas de envío | ❌ ninguna cargada: hoy solo se ofrece retiro en el local |
| Uber Direct | ⏸️ apagado (opcional; sin él se usan las tarifas propias) |
| Reseñas de Google | ❌ sin `GOOGLE_PLACES_API_KEY` (no bloquea la compra) |
| Dominios `*.canelaenrama.com.ar` | ❌ no resuelven: se prueba con las URLs de Render/Vercel/Pages |

Pasos:

1. **Usuarios de prueba de Mercado Pago** (vendedor y comprador) y tarjetas de
   prueba (se pueden crear con el plugin de Mercado Pago).
2. **Webhook en dev**: `https://canelaenramaback.onrender.com/api/payment/webhook`,
   evento "Pagos", y `MP_WEBHOOK_SECRET` en Render dev. Sin webhook el pago solo
   se confirma cuando el cliente vuelve a la tienda.
3. **Tarifas de envío**: cargarlas y activarlas en el panel → Envíos → Tarifas.
4. **Mails**: `BREVO_API_KEY` cargada y el remitente verificado en Brevo.
5. **URLs de dev** de tienda y panel incluidas en `CORS_ORIGINS` y
   `WEBSITE_DOMAIN` del API dev.
6. **Guion de prueba**:
   - compra con envío → pago aprobado → "En preparación" + mail;
   - pago rechazado → queda pendiente;
   - sin pagar → se cancela a las 2 h (`MP_ORDER_TTL_HOURS=2` en dev) y vuelve el stock;
   - reintegro parcial desde el panel;
   - retiro en el local con efectivo;
   - venta de mostrador.
7. **Catálogo real**: precios (`LISTA DE PRECIOS.xlsx`), stock y fotos. Sacar los
   banners de prueba ("Banner de prueba número 2") antes de prod.

## 2. Qué preparar para producción

### Cuentas y trámites (del negocio)

- [ ] **Dominio `canelaenrama.com.ar`** registrado en NIC Argentina, con el CUIT del titular.
- [ ] **Mercado Pago del negocio** (no la cuenta personal de desarrollo): cuenta
      verificada, aplicación Checkout Pro, credenciales productivas (`APP_USR-…`),
      webhook con su clave secreta, homologación / checklist de calidad.
- [ ] **Google Cloud**: OAuth client de producción (redirect URIs de prod) y
      API key de Places (pide tarjeta para facturación; el uso entra en el crédito gratis).
- [ ] **Remitente de mails con el dominio** (ej. `pedidos@canelaenrama.com.ar`)
      verificado en Brevo o SMTP con SPF/DKIM, para no caer en spam.
- [ ] **Legales**: términos y condiciones, política de privacidad, cambios y
      devoluciones, **botón de arrepentimiento** (obligatorio en Argentina) y
      datos fiscales del comercio en el sitio.

### Infraestructura

Ver `DEPLOY.md`: Supabase prod, core SuperTokens prod, `canela-en-rama-api`
en Render con las variables `sync: false`, DNS de tienda (Cloudflare Pages),
panel y API, y el checklist de la sección 6 (incluida una compra real de monto
bajo con reembolso). Backups (`pg_dump` diario o Supabase Pro) y monitoreo
(UptimeRobot, Sentry).

## 3. Costos

### Fijos mensuales (aprox., USD)

| Servicio | Mínimo para arrancar | Recomendado |
|---|---|---|
| Render API prod (starter, no se duerme) | **7** | 7 |
| Render API dev | 0 (free) | 0 |
| Supabase | 0 (free, sin backups descargables) | **25** (Pro: backups diarios) |
| SuperTokens | 0 (gratis hasta 5.000 usuarios activos/mes) | 0 |
| Account linking (SuperTokens) | 0 (apagado) | USD 100 mínimo/mes: no vale la pena al principio |
| Cloudflare Pages (tienda) | 0 | 0 |
| Panel | 0 en Cloudflare Pages | 20 si se queda en Vercel Pro* |
| Cloudinary, Brevo (300 mails/día), Sentry, UptimeRobot | 0 | 0 |
| Google Places | 0 (crédito mensual gratis) | 0 |
| **Total** | **≈ USD 7/mes** | **≈ USD 32–52/mes** |

\* Vercel Hobby es solo para uso no comercial. Para un panel de negocio
corresponde Vercel Pro o moverlo a Cloudflare Pages (gratis, donde ya está la tienda).

**Recomendación para arrancar**: Render starter + Supabase Pro + panel en
Cloudflare Pages + el resto gratis ≈ **USD 32/mes** + dominio. Account linking
y Uber Direct pueden esperar.

### Anuales

- Dominio `.com.ar` en NIC Argentina: arancel bajo en pesos. Confirmar el valor
  vigente en nic.ar (los revendedores cobran bastante más).

### Variables: comisiones de Mercado Pago (lo que más pesa)

En Checkout Pro la comisión depende del plazo de acreditación. Valores de
referencia de una fuente no oficial (**confirmar en la cuenta del negocio**,
donde se elige el plazo): 6,29% + IVA al instante, 4,39% a 10 días, 3,39% a
18 días, 1,49% a 35 días. Otras fuentes dan cifras distintas.

- Ejemplo: venta de $20.000 al instante ≈ $1.520 con IVA; a 35 días ≈ $360.
- Además hay retenciones impositivas (IIBB, IVA según la inscripción): hablarlo
  con el contador.
- Efectivo / transferencia al retirar en el local: sin comisión.

### Fuentes (noviembre 2026)

- [Comisiones Mercado Pago 2026 (calculadora no oficial)](https://app.spomsolutions.com/herramientas/comisiones-mercado-pago-2026)
- [Pasarelas de pago en Argentina](https://www.guiadesoftware.com/blog/mejor-pasarela-pago-argentina)
- [SuperTokens pricing](https://supertokens.com/pricing) · [supertokens.io pricing](https://www.supertokens.io/pricing)
- [Render: costos de hosting](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses) · [costbench Render](https://costbench.com/software/developer-tools/render/)
- [101domain .com.ar](https://www.101domain.com/com_ar.htm) · [Boletín Oficial: aranceles .AR](https://www.boletinoficial.gob.ar/pdf/aviso/primera/301798/20250624)
