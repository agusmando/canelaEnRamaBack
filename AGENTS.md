# Canela en Rama — Backend

API Express + Prisma + SuperTokens. Ver también `../canelaEnRamaWeb` (tienda) y `../ecommerceDashboard` (panel staff).

## Comandos

- `npm run dev` — tsx watch en :8080
- `npm test` — vitest (tests en `tests/`)
- `npm run typecheck` / `npx tsc --noEmit`
- `npx prisma migrate deploy` — aplica migraciones (en Render corre en pre-deploy)
- `npx prisma generate` — regenerar cliente tras tocar `schema.prisma`

## Seguridad — cosas a tener en cuenta

- **Base de datos**: `DATABASE_URL`/`DIRECT_URL` del `.env` local apuntan a la base **remota de producción**. Un `migrate deploy` local aplica migraciones en prod. Regla: nunca correr migraciones contra esa URL desde la máquina de desarrollo; usar una base local (Docker `canelaenramaback-db-1`, hay que recrearla con `migrate dev` porque tiene esquema viejo) o un `.env` separado para dev. Al tocar `schema.prisma`, validar el SQL de la migración antes de deployar.
- **Rate limiting**: `src/middleware/security.ts` tiene limiters en memoria por IP (auth 20/15min, writes 120/10min, API 600/min). Correcto para UNA instancia (Render); si se escala a varias hay que moverlos a un store compartido (Redis) o cada instancia cuenta por separado.
- **Webhooks de Mercado Pago**: firma HMAC obligatoria en producción (`MP_WEBHOOK_SECRET`); el pago siempre se re-consulta a la API de MP, nunca se confía en la notificación. `applyPayment` es idempotente y maneja pagos duplicados/fuera de término (`paid_after_cancel`, `amount_mismatch` quedan para revisión manual).
- **Stock**: `placeOrder` bloquea las variantes con `stockRepository.lockVariants` dentro de la transacción — no quitar ese lock o hay sobreventa. `computeFulfillment` ajusta cantidades al stock y marca `OUT_OF_STOCK`/`PARTIALLY_RETURNED`.
- **Uploads**: `fileUploader` valida mimetype y tamaño, pero el mimetype lo declara el cliente — si se endurece, verificar magic bytes. SVG está excluido a propósito (XSS).
- **Colores de banner**: `backgroundColor`/`textColor` se validan con regex `CSS_COLOR` (sin `;` ni `url()`) — mantener esa validación si se agregan campos de estilo nuevos.
- **Reintegros MP**: idempotency key por orden+monto; `refundFullOrder` y `refund` ya manejan duplicados. No saltear el `FOR UPDATE` del pedido.
- **Dependencias**: correr `npm audit` periódicamente; preferir versiones publicadas hace +7 días.
- **Logs**: no loguear tokens, `MP_ACCESS_TOKEN`, emails de clientes ni datos de pago completos.

## Convenciones

- Errores de dominio en `src/errors/` (`ValidationError`, `ConflictError`, `NotFoundError`, `BadRequestError`, `ExternalServiceError`).
- Tests con vitest + mocks; `tests/order-mail.test.ts` cubre los mails de pedido.
- Migraciones en `src/config/prisma/migrations/<timestamp>_<nombre>/migration.sql`.
