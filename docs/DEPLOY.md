# Deploy: entornos dev y prod

Tres apps, dos entornos. Cada entorno tiene **su propia base, su propio
SuperTokens y sus propias credenciales**: nada de lo que se haga en dev toca
clientes reales.

| Pieza | Prod (rama `main`) | Dev (rama `develop`) | Dónde |
|---|---|---|---|
| Base de datos | Supabase `canela-prod` | Supabase `canela-dev` | supabase.com (2 proyectos free) |
| Auth | Core SuperTokens prod | Core SuperTokens dev | supertokens.com (managed) |
| API (este repo) | `canela-en-rama-api` → `api.canelaenrama.com.ar` | `canela-en-rama-api-dev` → `api-dev.canelaenrama.com.ar` | Render (`render.yaml`) |
| Tienda (`canelaEnRamaWeb`) | `canelaenrama.com.ar` | `dev.canelaenrama.com.ar` | Cloudflare Pages (`public/_headers`) |
| Panel (`ecommerceDashboard`) | `admin.canelaenrama.com.ar` | `admin-dev.canelaenrama.com.ar` | Vercel (`vercel.json`) |
| Imágenes | Cloudinary | Cloudinary (otra carpeta o cuenta free) | cloudinary.com |
| Pagos | Mercado Pago credenciales productivas | Mercado Pago credenciales de prueba | mercadopago.com.ar/developers |

**Flujo de trabajo**

```
feature/x ──PR──▶ develop ──(se prueba en *-dev)──PR──▶ main ──▶ producción
```

- Se trabaja en ramas, se mergea a `develop` → se deploya solo a dev.
- Cuando dev está OK, PR de `develop` a `main` → se deploya a prod.
- Las migraciones de la base se aplican **solo en los deploys** (Render), nunca
  desde una compu apuntando a prod. Ver "Migraciones".
- CI (GitHub Actions) corre typecheck + tests en cada push y PR del backend.

> Los tres repos usan `main` como rama principal (el panel usaba `master`:
> después de pushear `main`, cambiar la rama por defecto en GitHub →
> Settings → Branches y borrar `master`).

---

## 1. Bases de datos (Supabase)

1. La base actual pasa a ser **prod** (`canela-prod`). No hace falta migrar nada.
2. Crear el proyecto **`canela-dev`** (misma región: `us-east-1`).
3. Copiar las dos URLs de cada proyecto (Project Settings → Database → Connection string):
   - `DATABASE_URL`: pooler (puerto 6543, `?pgbouncer=true`), la usa la app.
   - `DIRECT_URL`: conexión directa (puerto 5432), la usan las migraciones.
4. Crear las tablas en dev: el primer deploy de `canela-en-rama-api-dev` corre
   `prisma migrate deploy`. También se puede desde la compu **apuntando a dev**:
   ```bash
   DIRECT_URL=<url-directa-dev> DATABASE_URL=<url-pooler-dev> \
     npx prisma migrate deploy --schema=src/config/prisma/schema.prisma
   ```
5. Datos de prueba en dev: copiar **solo el catálogo** de prod (sin clientes,
   órdenes ni carritos):
   ```bash
   pg_dump "<DIRECT_URL prod>" --data-only --no-owner \
     -t '"Category"' -t '"Brand"' -t '"Tag"' -t '"Supplier"' -t '"Product"' \
     -t '"ProductVariant"' -t '"Image"' -t '"Dependency"' -t '"Offer"' \
     -t '"ShippingZone"' -t '"Banner"' -t '"_ProductToTag"' -t '"_BrandToSupplier"' \
     > catalogo.sql
   psql "<DIRECT_URL dev>" -f catalogo.sql
   ```
   El orden importa por las claves foráneas; si `psql` se queja, correrlo con
   `--single-transaction` después de `SET session_replication_role = replica;`.
6. Para desarrollar en la compu, el `.env` local apunta a **dev** (o a un
   Postgres local con Docker: `LOCAL_DATABASE_URL`). Nunca a prod.

## 2. SuperTokens

En supertokens.com crear **dos cores** (o dos "apps"): `prod` (el actual) y `dev`.
Cada uno da `SUPERTOKENS_CONNECTION_URI` + `SUPERTOKENS_API_KEY`.

- Login con Google (tienda y panel): en Google Cloud Console → Credentials →
  OAuth client, "Authorized redirect URIs":
  - prod: `https://canelaenrama.com.ar/auth/callback/google` y
    `https://admin.canelaenrama.com.ar/auth/callback/google`
  - dev (otro client): `https://dev.canelaenrama.com.ar/auth/callback/google`,
    `https://admin-dev.canelaenrama.com.ar/auth/callback/google`,
    `http://localhost:5173/auth/callback/google` y `http://localhost:5174/auth/callback/google`

  Cada client id/secret se carga en su core.
- Sin "account linking", una misma persona con cuenta de email y cuenta de
  Google son dos usuarios distintos: el rol se asigna a la cuenta con la que
  va a entrar al panel (Usuarios → buscar por email).
- Dashboard de SuperTokens (`/api/auth/dashboard`): apagado en prod
  (`SUPERTOKENS_DASHBOARD=off`), prendido en dev. Si hace falta en prod, ponerlo
  en `on` un rato y volver a apagarlo; `SUPERTOKENS_DASHBOARD_ADMINS` limita
  quién puede modificar.
- Después del primer login en dev, darse rol ADMIN desde el dashboard de
  SuperTokens del core dev (o con el script de roles), y de ahí en más se
  gestionan usuarios desde **Usuarios** en el panel.

## 3. API en Render

`render.yaml` define los dos servicios. Render → New → Blueprint → este repo.

| | Prod | Dev |
|---|---|---|
| Rama | `main` | `develop` |
| Plan | starter (no se duerme; corre los timers de pagos y envíos) | free (se duerme sin tráfico) |
| Migraciones | `preDeployCommand` (antes de poner la versión nueva) | al arrancar (`dockerCommand`) |

Variables marcadas `sync: false`: se cargan a mano en cada servicio
(Environment). Las de dev usan **las credenciales de dev** de cada proveedor.

Dominios: Settings → Custom Domains → `api.canelaenrama.com.ar` (prod) y
`api-dev.canelaenrama.com.ar` (dev). Render indica el CNAME para cargar en el DNS.

### Migraciones

- Se crean en la compu contra **dev**:
  `npx prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ... --script`
  → archivo nuevo en `src/config/prisma/migrations/<fecha>_<nombre>/migration.sql`.
- Se commitean con el código que las usa. Al deployar, cada servicio las aplica
  a su base.
- **Cambios destructivos** (borrar/renombrar columnas): en dos deploys. Primero
  el código deja de usar la columna; después, otra migración la borra. Así la
  versión vieja que todavía corre durante el deploy no se rompe.
  (Ej.: `20261116140000_drop_pedidosya` va en el mismo deploy que el código que
  ya no la usa: Render aplica el pre-deploy y enseguida cambia de versión; el
  riesgo es de segundos. Para tablas grandes o columnas usadas en muchos lados,
  hacerlo en dos pasos.)

## 4. Tienda en Cloudflare Pages

Cloudflare → Workers & Pages → Create → Pages → conectar `canelaEnRamaWeb`.

- Build command: `npm run build` · Output: `dist` · Node 22 (`NODE_VERSION=22`).
- Production branch: `main`. Preview branches: `develop` (y las que quieras).
- Variables (Settings → Environment variables), por entorno:

| Variable | Production | Preview (develop) |
|---|---|---|
| `VITE_API_URL` | `https://api.canelaenrama.com.ar` | `https://api-dev.canelaenrama.com.ar` |
| `VITE_WHATSAPP`, `VITE_INSTAGRAM_URL`, `VITE_FACEBOOK_URL` | los reales | los mismos |
| `API_URL` (Functions: sitemap y vista previa de productos) | `https://api.canelaenrama.com.ar` | `https://api-dev.canelaenrama.com.ar` |
| `SITE_URL` (dominio canónico) | `https://canelaenrama.com.ar` | `https://dev.canelaenrama.com.ar` |

- `functions/` (Cloudflare Pages Functions) genera `/sitemap.xml` y agrega
  título, descripción, imagen y datos de producto a `/producto/:id` para que
  WhatsApp/Facebook/Google los vean sin ejecutar JavaScript. Después del primer
  deploy, probar un link en https://developers.facebook.com/tools/debug/ y
  cargar el sitemap en Google Search Console.

- Dominios: `canelaenrama.com.ar` y `www` → producción. Para dev: Custom
  domain `dev.canelaenrama.com.ar` apuntando al alias de la rama
  (`develop.<proyecto>.pages.dev`), o usar ese alias directamente y agregarlo a
  `CORS_ORIGINS`/`WEBSITE_DOMAIN` del API dev.
- `public/_headers` ya trae CSP, HSTS y cache. Si cambia el dominio del API,
  actualizar `connect-src`.
- Conviene proteger dev con **Cloudflare Access** (gratis hasta 50 usuarios)
  para que no lo indexe Google ni lo use nadie de afuera.

## 5. Panel en Vercel

Vercel → Add New → Project → `ecommerceDashboard`. `vercel.json` ya configura
build, rewrites de SPA y headers de seguridad (Vercel no lee `_headers`).

- Production branch: `main`.
- Variables (Settings → Environment Variables):

| Variable | Production | Preview |
|---|---|---|
| `VITE_API_URL` | `https://api.canelaenrama.com.ar` | `https://api-dev.canelaenrama.com.ar` |
| `VITE_SHOP_URL` | `https://canelaenrama.com.ar` | `https://dev.canelaenrama.com.ar` |

- Dominios: `admin.canelaenrama.com.ar` → producción;
  `admin-dev.canelaenrama.com.ar` → asignado a la rama `develop`
  (Settings → Domains → Git Branch).
- Opcional: Vercel Deployment Protection en previews.

## 6. Checklist del primer deploy a prod

- [ ] Variables de Render prod cargadas (ver `render.yaml`), en especial
      `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `SMTP_*`, `DASHBOARD_URL`.
- [ ] `CORS_ORIGINS` incluye tienda, `www` y panel.
- [ ] `WEBSITE_DOMAIN` = tienda (los mails de contraseña llevan ahí).
- [ ] Webhook de Mercado Pago apuntando a `https://api.canelaenrama.com.ar/api/payment/webhook`.
- [ ] Tarifas de envío cargadas y activadas en el panel.
- [ ] `GET https://api.canelaenrama.com.ar/api/health` → `{"status":"ok"}`.
- [ ] Compra de prueba con Mercado Pago (monto bajo) y reembolso.
- [ ] Login al panel (email y Google), invitar un usuario de prueba, recuperar contraseña (llega el mail).
- [ ] Compra de prueba: llegan los mails de pedido recibido / pago acreditado / listo.
- [ ] `GET https://api.canelaenrama.com.ar/api/auth/dashboard/` → 404 (apagado).

## 7. Backups y monitoreo

- Supabase free no tiene backups automáticos descargables: programar un
  `pg_dump` diario (GitHub Action con el secreto `DIRECT_URL` → artifact o
  bucket) o pasar a Supabase Pro (backups diarios + point-in-time).
- Render: alertas de deploy fallido y de health check por mail.
- UptimeRobot (gratis) sobre `/api/health`, la tienda y el panel.
- Errores: Sentry (free) en backend y frontends.
