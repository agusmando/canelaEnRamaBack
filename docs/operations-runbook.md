# Runbook operativo

## Pagos tardíos y reembolsos

1. Para una orden que no pueda completarse, abrirla en el dashboard y usar **Cancelar y reintegrar total**. La acción requiere indicar los productos faltantes.
2. El flujo solicita el reintegro total a Mercado Pago, cancela la orden y repone el stock. El cliente recibe un correo por Resend.
3. Si falla el envío del correo, reintentar la notificación desde la misma acción; no se crea un segundo reintegro.
4. Si el reintegro queda pendiente o falla, revisar `refundStatus`, `refundId` y el estado del pago en Mercado Pago. Dar seguimiento manual si el proveedor no lo resuelve.
5. Si un pago se aprueba después de cancelar por otro flujo, reconciliar `paymentStatus`, `paymentId`, `paymentPreferenceId` y la orden; no asumir que ya se reintegró.

La integración requiere `MP_ACCESS_TOKEN`, `RESEND_API_KEY` y `RESEND_FROM_EMAIL`; verificar el remitente en Resend. Los correos de acceso y verificación usan Resend cuando esas variables están configuradas; en caso contrario se conserva el envío predeterminado de SuperTokens. El logo usa `WEBSITE_DOMAIN/favicon.png` o la URL opcional `EMAIL_LOGO_URL`. No usar la cancelación normal para reembolsar órdenes pagadas por Mercado Pago.

## Fallos de Cloudinary

1. Revisar logs y el `public_id` afectado.
2. Confirmar si quedó un recurso huérfano o si la operación de DB finalizó.
3. Borrar recursos huérfanos después de validar que no están referenciados.
4. Conservar recursos anteriores hasta completar reemplazos y compensaciones.

## Restauración de base de datos

1. No restaurar sobre producción sin ventana y respaldo verificable.
2. Restaurar primero en un entorno aislado y validar migraciones.
3. Confirmar `DIRECT_URL` y ejecutar `npx prisma migrate status`.
4. Validar `/api/health`, pedidos, stock, carrito y pagos antes de habilitar tráfico.

## Asignación de staff en SuperTokens

1. Los permisos reales usan SuperTokens UserRoles, no `User.role` de Prisma.
2. Alta/baja mediante el proceso administrativo autorizado del core SuperTokens.
3. Verificar que una sesión nueva recibe el rol esperado.
4. Auditar cambios y aplicar mínimo privilegio.

## Rotación de credenciales

1. Rotar en el proveedor y actualizar variables en Render.
2. Reiniciar y validar salud, login, Cloudinary y Mercado Pago.
3. Revocar credenciales antiguas después de confirmar el arranque.
4. Nunca registrar valores reales en logs, commits o documentación.

## Transportistas

No hay integración automática. El tracking se carga manualmente en envío. PedidosYa fue retirado del modelo de variantes.
