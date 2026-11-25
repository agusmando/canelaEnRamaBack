# Variables de entorno por app y ambiente

Qué variables necesita cada app para correr en **local**, **dev** (`develop`)
y **prod** (`main`), dónde se cargan y cuánto sale cada servicio.

La topología de entornos y el paso a paso de deploy están en
[`DEPLOY.md`](./DEPLOY.md); los costos detallados y comisiones en
[`PRODUCCION.md`](./PRODUCCION.md).

---

## Dónde vive cada cosa

| Pieza | Local | Dev | Prod | Dónde se configuran las variables |
|---|---|---|---|---|
| API (`canelaEnRamaBack`) | `npm run dev` → :8080 | `canela-en-rama-api-dev` → `api-dev.canelaenrama.com.ar` | `canela-en-rama-api` → `api.canelaenrama.com.ar` | Render → servicio → Environment (`render.yaml`, las `sync: false` a mano) |
| Tienda (`canelaEnRamaWeb`) | `npm run dev` → :5173 | Cloudflare Pages, rama `develop` → `dev.canelaenrama.com.ar` | Cloudflare Pages, rama `main` → `canelaenrama.com.ar` | Cloudflare Pages → Settings → Variables and Secrets (build `VITE_*` y runtime `API_URL`/`SITE_URL` de las Functions) |
| Panel (`ecommerceDashboard`) | `npm run dev` → :5174 | Vercel, rama `develop` → `admin-dev.canelaenrama.com.ar` | Vercel, rama `main` → `admin.canelaenrama.com.ar` | Vercel → Settings → Environment Variables |
| Base de datos | Docker local o Supabase dev | Supabase `canela-dev` | Supabase `canela-prod` | Supabase → Project Settings → Database |
| Auth | — | Core SuperTokens dev | Core SuperTokens prod | supertokens.com → cada core da `SUPERTOKENS_CONNECTION_URI` + `SUPERTOKENS_API_KEY` |

---

## 1. Backend (`canelaEnRamaBack`)

### Local (`.env`, copiar de `.env.example`)

Obligatorias para levantar:

| Variable | Para qué |
|---|---|
| `PORT` | Puerto del server (8080). |
| `DATABASE_URL` | Pooler de Supabase (puerto 6543, `pgbouncer=true`). En local puede ser el Docker (`postgresql://…@localhost:5432/ecommerce`). |
| `DIRECT_URL` | Conexión directa (puerto 5432); la usan las migraciones. |
| `SUPERTOKENS_CONNECTION_URI` / `SUPERTOKENS_API_KEY` | Core de SuperTokens (el dev usa el core dev). |
| `API_DOMAIN` / `WEBSITE_DOMAIN` | `http://localhost:8080` / `http://localhost:5173`. SuperTokens los usa para cookies/CORS y el mail de contraseña apunta a `WEBSITE_DOMAIN`. |
| `DASHBOARD_URL` | `http://localhost:5174` (link en mails de invitación del staff). |
| `CORS_ORIGINS` | Vacío en dev = refleja cualquier origen. |

Recomendadas / según feature:

| Variable | Para qué |
|---|---|
| `BREVO_API_KEY` **o** `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM_EMAIL`/`SMTP_FROM_NAME` | Mails (pedidos, recuperar contraseña). Sin canal, SuperTokens manda uno genérico en inglés. El remitente debe estar verificado en Brevo. |
| `CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Upload de imágenes. |
| `GOOGLE_PLACES_API_KEY` / `GOOGLE_PLACE_ID` / `GOOGLE_PLACE_QUERY` / `GOOGLE_PLACES_LANGUAGE` | Reseñas de Google del sitio. Sin key no bloquea nada, solo no muestra reviews. |
| `MP_ACCESS_TOKEN` | Mercado Pago. En local usar credenciales de **prueba** (`TEST-…`). |
| `MP_WEBHOOK_SECRET` | Firma HMAC de webhooks (obligatoria con `NODE_ENV=production`). |
| `WEB_URL` / `API_PUBLIC_URL` | URL pública de la tienda y del API (back_urls de MP y `notification_url`). En local: `http://localhost:5173` y vacío o `http://localhost:8080`. |
| `MP_STATEMENT_DESCRIPTOR`, `MP_ORDER_TTL_HOURS`, `MP_ALLOW_CASH` | Config de Checkout Pro (default `CANELA EN RAMA`, 48 h, `false`). En dev conviene `MP_ORDER_TTL_HOURS=2`. |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `EMAIL_LOGO_URL` | Mails de cuenta y reintegros de MP por Resend. |
| `UBER_DIRECT_CUSTOMER_ID` / `UBER_DIRECT_CLIENT_ID` / `UBER_DIRECT_CLIENT_SECRET` | Uber Direct (opcional; sin eso, tarifas propias por departamento). |
| `SHIPPING_PICKUP_*` | Dirección del local como origen de envíos (Uber Direct). |
| `SUPERTOKENS_DASHBOARD` / `SUPERTOKENS_DASHBOARD_ADMINS` | `/api/auth/dashboard`: `on`/`off` (default on en dev, off en prod) y emails con permiso de modificar. |
| `ACCOUNT_LINKING` | `on` solo después de activar la función paga en el core de SuperTokens. |
| `CART_EMPTY_TTL_DAYS` / `CART_GUEST_TTL_DAYS` / `CART_CLEANUP` | Limpieza de carritos abandonados (7 / 30 días; corre sola en prod). |
| `LOG_LEVEL` / `LOG_PRETTY` | `debug` en dev local; `info` en prod. |
| `PIXABAY_API_KEY` | Solo para `scripts/seed-images.ts`. |

### Render — dev (`canela-en-rama-api-dev`, plan **free**)

Mismas variables que prod pero con **credenciales dev**: base `canela-dev`,
core SuperTokens dev, MP de prueba, Google OAuth client de dev, mails a una
casilla de prueba. Fijos del `render.yaml`: `NODE_ENV=production`,
`LOG_LEVEL=debug`, `API_DOMAIN=https://api-dev.canelaenrama.com.ar`,
`WEBSITE_DOMAIN=https://dev.canelaenrama.com.ar`, `DASHBOARD_URL=https://admin-dev.canelaenrama.com.ar`,
`WEB_URL=https://dev.canelaenrama.com.ar`, `API_PUBLIC_URL=https://api-dev.canelaenrama.com.ar`,
`SUPERTOKENS_DASHBOARD=on`, `MP_ORDER_TTL_HOURS=2`. Las migraciones corren al
arrancar (`dockerCommand`).

### Render — prod (`canela-en-rama-api`, plan **starter**)

`NODE_ENV=production`, `LOG_LEVEL=info`, dominios `api.`/`canelaenrama.com.ar`/`admin.`,
`CORS_ORIGINS=https://canelaenrama.com.ar,https://www.canelaenrama.com.ar,https://admin.canelaenrama.com.ar`,
`SUPERTOKENS_DASHBOARD=off`, `ACCOUNT_LINKING=off` (hasta activarla en el core),
`MP_ORDER_TTL_HOURS=48`, `MP_ALLOW_CASH=false`. Migraciones en `preDeployCommand`.
Las `sync: false` del `render.yaml` son las que hay que cargar a mano: `DATABASE_URL`,
`DIRECT_URL`, `SUPERTOKENS_*`, `CLOUDINARY_*`, `GOOGLE_PLACES_*`, `MP_*`,
`SMTP_*`/`BREVO_API_KEY`, `DASHBOARD_URL`, `RESEND_*`, `UBER_DIRECT_*`,
`SHIPPING_PICKUP_PHONE`, `SUPERTOKENS_DASHBOARD_ADMINS`.

---

## 2. Tienda (`canelaEnRamaWeb`)

### Local (`.env`, copiar de `.env.example`) — todas opcionales

| Variable | Default | Uso |
|---|---|---|
| `VITE_API_URL` | vacío = mismo origen | URL del backend sin `/api`. Vacío en dev: las llamadas van por el proxy de Vite. |
| `VITE_API_PROXY_TARGET` | `http://localhost:8080` | Destino del proxy `/api` en `npm run dev`. |
| `VITE_API_TIMEOUT` | 20000 | Timeout por request en ms. |
| `VITE_WHATSAPP` | — | Número de WhatsApp del sitio. |
| `VITE_INSTAGRAM_URL` / `VITE_FACEBOOK_URL` | — | Redes del sitio. |

### Cloudflare Pages — build (Settings → Variables)

| Variable | Production | Preview (develop) |
|---|---|---|
| `VITE_API_URL` | `https://api.canelaenrama.com.ar` | `https://api-dev.canelaenrama.com.ar` |
| `VITE_WHATSAPP` / `VITE_INSTAGRAM_URL` / `VITE_FACEBOOK_URL` | valores reales | los mismos |
| `NODE_VERSION` | `22` | `22` |

### Cloudflare Pages — Functions (runtime, sitemap y previews de producto)

| Variable | Production | Preview |
|---|---|---|
| `API_URL` | `https://api.canelaenrama.com.ar` | `https://api-dev.canelaenrama.com.ar` |
| `SITE_URL` | `https://canelaenrama.com.ar` | `https://dev.canelaenrama.com.ar` |

Sin `API_URL` las Functions no fallan: el sitemap sale solo con páginas fijas.

---

## 3. Panel (`ecommerceDashboard`)

### Local (`.env`, copiar de `.env.example`) — todas opcionales

| Variable | Default | Uso |
|---|---|---|
| `VITE_API_URL` | vacío = `/api` del mismo origen | URL del backend sin `/api`. |
| `VITE_API_PROXY_TARGET` | `http://localhost:8080` | Destino del proxy `/api` en dev. |
| `VITE_API_TIMEOUT` | 15000 | Timeout por request en ms. |
| `VITE_SHOP_URL` | `http://localhost:5173` | URL de la tienda; el login enlaza a su página de recuperar contraseña. |

### Vercel — Environment Variables

| Variable | Production | Preview |
|---|---|---|
| `VITE_API_URL` | `https://api.canelaenrama.com.ar` | `https://api-dev.canelaenrama.com.ar` |
| `VITE_SHOP_URL` | `https://canelaenrama.com.ar` | `https://dev.canelaenrama.com.ar` |

---

## Hosting y costos (resumen)

Detalle y fuentes en [`PRODUCCION.md` §3](./PRODUCCION.md).

| Servicio | Qué hospeda | Costo aprox. |
|---|---|---|
| **Render** | API (Docker). Prod `starter` (~USD 7/mes, no se duerme); dev `free` (se duerme, OK para probar). | USD 0–7/mes |
| **Supabase** | Postgres prod + dev. Free no tiene backups descargables; Pro suma backups diarios. | USD 0–25/mes |
| **supertokens.com** | Core de auth gestionado (prod y dev). | USD 0 (hasta 5.000 MAU); Account Linking es pago aparte (~USD 100/mes, no vale la pena al inicio) |
| **Cloudflare Pages** | Tienda estática + Pages Functions (sitemap, previews). | USD 0 |
| **Vercel** | Panel. Hobby es solo no comercial → para el negocio corresponde Pro o moverlo a Cloudflare Pages. | USD 0–20/mes |
| **Cloudinary** | Imágenes. | USD 0 (free tier) |
| **Brevo / Resend** | Mails. Brevo free ~300/día; Resend free ~100/día. | USD 0 |
| **Google Places / Cloud** | Reseñas (API key con crédito gratis) y OAuth. | USD 0 |
| **Mercado Pago** | Pagos: sin costo fijo, comisión por venta (~1,5–6,3% + IVA según plazo). | por transacción |
| **Uber Direct** | Envíos (opcional). | por envío |
| **Dominio `.com.ar`** | NIC Argentina. | arancel anual en pesos |

**Total para arrancar**: ≈ USD 7/mes (Render starter + todo lo demás free,
Supabase free) + dominio. **Recomendado**: ≈ USD 32–52/mes (suma Supabase Pro
y Vercel Pro, o menos moviendo el panel a Cloudflare Pages).
