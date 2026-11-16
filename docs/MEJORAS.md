# Cosas a mejorar

Estado al 16/11/2026. Ordenado por prioridad: primero lo que bloquea salir a
producción, después lo que más impacto tiene en ventas y operación.

## Resumen

| # | Mejora | Tipo | Esfuerzo | Prioridad |
|---|---|---|---|---|
| 1 | Entornos dev / prod separados | Infra | 1 día | **Bloqueante** |
| 2 | Activar Mercado Pago | Configuración | 2-3 h | **Bloqueante** para cobrar online |
| 3 | Activar reseñas de Google | Configuración | 1 h | Alta |
| 4 | Mails de pedido (confirmación, listo, enviado) | Código | 1 día | Alta |
| 5 | Backups de la base | Infra | 2 h | Alta |
| 6 | Más tests (órdenes y pagos con base de prueba) | Código | 2 días | Media |
| 7 | SEO de la tienda (títulos, sitemap, vista previa al compartir) | Código | 1-2 días | Media |
| 8 | Imágenes optimizadas (Cloudinary `f_auto,q_auto`, tamaños) | Código | 2 h | Media |
| 9 | Monitoreo de errores (Sentry) y uptime | Infra | 2 h | Media |
| 10 | Limpieza automática de carritos viejos | Código | 2 h | Baja |
| 11 | Fecha en movimientos de stock cargados a mano | Código | 3 h | Baja |
| 12 | Login con Google en el panel | Código | 3 h | Baja |
| 13 | Proteger el dashboard de SuperTokens | Configuración | 30 min | Media |

---

## 1. Entornos dev / prod separados

Hoy la compu de desarrollo usa la base y el SuperTokens de producción: cada
prueba, script o migración toca datos de clientes. La estrategia completa está
en [`DEPLOY.md`](./DEPLOY.md): dos proyectos de Supabase, dos cores de
SuperTokens, dos servicios en Render, tienda en Cloudflare Pages y panel en
Vercel, con ramas `develop` → dev y `main` → prod.

## 2. Mercado Pago (ya programado, falta configurar)

El cobro con Checkout Pro está implementado de punta a punta
(`services/payment.service.ts`): preferencia con productos + envío, webhook que
re-consulta el pago a Mercado Pago, sincronización al volver a la tienda,
vencimiento de pedidos impagos que devuelve el stock. **No anda porque
`MP_ACCESS_TOKEN` está vacío**: sin token, la tienda no ofrece Mercado Pago.

Pasos:
1. mercadopago.com.ar/developers → Tus integraciones → Crear aplicación
   ("Pagos online", Checkout Pro).
2. **Dev**: Credenciales de prueba → `MP_ACCESS_TOKEN` (empieza con `TEST-`) en
   el API dev. Crear usuarios de prueba (vendedor y comprador) para pagar con
   tarjetas de prueba.
3. **Prod**: Credenciales de producción (pide datos del negocio) →
   `MP_ACCESS_TOKEN` (`APP_USR-...`) en el API prod.
4. Webhooks (Tus integraciones → Webhooks) para cada entorno:
   - URL: `https://api.canelaenrama.com.ar/api/payment/webhook` (y la de dev).
   - Evento: **Pagos**.
   - Copiar la **clave secreta** → `MP_WEBHOOK_SECRET` (valida la firma; sin ella
     el webhook se acepta pero igual se re-consulta el pago).
5. Opcionales: `MP_STATEMENT_DESCRIPTOR` (lo que ve el cliente en el resumen),
   `MP_ORDER_TTL_HOURS` (horas para pagar, 48 por defecto), `MP_ALLOW_CASH`
   (Rapipago/Pago Fácil; tardan en acreditarse, conviene un TTL más largo).
6. Probar en dev: compra → pago aprobado → la orden pasa a "En preparación";
   pago rechazado → queda pendiente; sin pagar → se cancela al vencer.

## 3. Reseñas de Google (ya programado, falta configurar)

`services/google-review.service.ts` trae las reseñas del local con la Places
API (New), las guarda (Google devuelve hasta 5 por consulta, así que se van
acumulando) y desde el panel se eligen cuáles destacar en la tienda. Se
re-sincroniza solo cada 24 h. **No anda porque `GOOGLE_PLACES_API_KEY` está vacía.**

Pasos:
1. console.cloud.google.com → proyecto nuevo → activar facturación (Google da
   crédito mensual gratis; este uso queda muy por debajo).
2. APIs & Services → habilitar **Places API (New)**.
3. Credentials → Create API key → restringirla a "Places API (New)".
4. Cargar `GOOGLE_PLACES_API_KEY` en el API (prod y dev pueden compartirla).
5. Opcional: `GOOGLE_PLACE_ID` del local (más exacto que buscar por nombre;
   se obtiene en developers.google.com/maps/documentation/places/web-service/place-id).
6. Panel → Reseñas → Google → "Sincronizar" y destacar las que se muestran.

## 4. Mails de pedido

Hoy solo salen mails de contraseña e invitación. Faltan: pedido recibido
(con detalle y forma de pago), pago acreditado, pedido listo para retirar,
pedido enviado (con seguimiento). El SMTP ya está configurado en
`config/supertokens/email.ts`; se puede reutilizar con nodemailer y disparar
desde `order.service` / `payment.service` / `shipment.service`.

## 5. Backups

Supabase free no deja descargar backups. Opciones: GitHub Action diaria con
`pg_dump` guardado como artifact (o en un bucket), o Supabase Pro (USD 25/mes,
backups diarios y restauración a cualquier momento). Probar restaurar un
backup en dev al menos una vez.

## 6. Más tests

Ya hay 52 tests (`npm test`, sin base de datos) para precios, ofertas, roles y
permisos, vistas públicas, rate limit y carga masiva, y CI en GitHub Actions.
Lo que falta cubrir necesita una base de prueba (Postgres como servicio en el
CI, migraciones con `prisma migrate deploy`):
- `order.service`: crear pedido desde el carrito, reserva y devolución de stock,
  edición de ítems, cancelaciones.
- `payment.service`: webhook (aprobado / rechazado / duplicado), vencimiento.
- Endpoints con supertest: que cada ruta pida el permiso correcto.

## 7. SEO de la tienda

La tienda es una SPA: Google la indexa, pero WhatsApp/Facebook/Instagram no
ven título ni foto al compartir un producto. Opciones: prerender de las
páginas de producto en el build, o una función de Cloudflare que inyecte las
etiquetas `og:` por producto. Sumar `sitemap.xml` y `robots.txt`.

## 8. Imágenes

Usar transformaciones de Cloudinary en las URLs (`f_auto,q_auto,w_600` en
tarjetas, `w_1200` en el detalle) y `srcset`. Baja mucho el peso en celulares.

## 9. Monitoreo

Sentry (free) en backend y frontends para ver errores reales de clientes;
UptimeRobot sobre `/api/health`, tienda y panel; alertas de Render por mail.

## 10. Carritos viejos

No hay limpieza: los carritos de invitados y los vacíos se acumulan. Propuesta:
borrar carritos de invitado sin actividad en 30 días y vacíos en 7 días, con
un timer del servidor. Pendiente de confirmar los plazos.

## 11. Fecha en movimientos manuales

La carga masiva y el alta de movimientos usan la fecha actual. Para cargar
movimientos de días anteriores hace falta un parámetro de fecha en la función
SQL que registra el movimiento.

## 12. Login con Google en el panel

El panel solo acepta email y contraseña; las cuentas de Google se invitan con
una cuenta de email aparte. Se puede sumar el botón "Ingresar con Google"
(mismo flujo que la tienda).

## 13. Dashboard de SuperTokens

Está publicado en `/api/auth/dashboard`. Tiene su propio login, pero conviene
crear un único usuario fuerte, o bloquear esa ruta en prod y usarlo solo desde dev.

## Ajustes chicos detectados

- "Ajustar stock" desde Inventario guarda por la ruta de edición de variante:
  solo editores pueden usarlo. Los empleados usan Movimientos.
- El panel usa la rama `master`; la tienda y el API, `main`. Unificar.
- El rate limit es en memoria: alcanza con una instancia (prod tiene
  `numInstances: 1`); con más, pasarlo a Redis.
