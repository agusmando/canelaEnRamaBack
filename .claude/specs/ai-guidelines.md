# Guía de trabajo para asistentes de IA

## Objetivo

Usar el contexto del repositorio para ayudar sin alterar accidentalmente contratos de API, datos históricos, inventario o pagos. Esta guía complementa, no reemplaza, el código fuente ni las instrucciones del usuario.

## Lectura antes de cambios

1. Identificar las rutas, DTOs, controladores, servicios, repositorios, mappings y pruebas implicados; no asumir que dos recursos con nombres parecidos comparten exactamente reglas.
2. Para cambios de negocio, leer la implementación del servicio y sus rutas/DTOs; para consultas genéricas, revisar mapping y builder.
3. Para DB, revisar `src/config/prisma/schema.prisma`, migraciones relacionadas y usos del campo. Generar migración compatible; no editar migraciones ya aplicadas salvo instrucción explícita.
4. Para roles y auth, inspeccionar el middleware y validar acceso a nivel de servicio/propiedad. El rol de Prisma no equivale automáticamente al de SuperTokens.
5. Para stock/pedido/pago, trazar transacciones y movimientos de reversa antes de modificar operaciones.
6. Consultar el glosario para literales exactos y actualizar la documentación al cambiar contratos/reglas.

## Reglas que no se deben romper

- No escribir `currentStock` directamente; usar los flujos de movimiento/funciones SQL existentes y conservar transacciones, auditoría y protecciones de concurrencia.
- No confundir estados de orden, pago, envío o línea de orden; respetar sus transiciones.
- No recalcular snapshots históricos de órdenes a partir del catálogo actual.
- No permitir que el cliente determine arbitrariamente el propietario de carrito, pedido, reseña, envío o pago; validar sesión y propiedad en backend.
- No exponer costo, margen ni precio histórico de movimientos en vistas públicas.
- No confiar únicamente en datos entrantes de un webhook de pagos; mantener verificación con el proveedor y controles de monto/moneda.
- No asumir que subir una imagen a Cloudinary y guardar datos DB son una sola transacción; manejar limpieza/compensación ante fallos.
- No renombrar enums, cookies, campos, paths o literales de API sin evaluar compatibilidad de datos y clientes.
- No afirmar que transportistas están integrados; PedidosYa fue retirado del modelo y no tiene integración. El reintegro total está integrado para Mercado Pago, con seguimiento manual posible si queda pendiente o falla.
- No leer ni mostrar valores secretos de `.env`; documentar nombres de variables únicamente.

## Estilo y estructura

- Mantener TypeScript estricto, módulos ESM e imports relativos con extensión `.js` según configuración actual.
- Respetar capas: rutas para wiring/middleware, controladores para HTTP, servicios para reglas, repositorios para persistencia, DTO para contratos y mappings para listas de campos.
- Mantener formato de errores y respuestas existente; preferir errores de aplicación tipados manejados por middleware.
- Validar entradas en DTO/servicio y conservar listas permitidas en campos consultables.
- Hacer cambios pequeños y coherentes con el estilo de archivos cercanos; evitar reescrituras no solicitadas.
- Si una regla está documentada pero no se aplica en servicio, reportar la brecha y no describirla como garantizada.

## Verificación y comunicación

- Usar verificaciones disponibles (`npm run build`, pruebas focalizadas si existen). La suite `npm test` actualmente está sin configurar; mencionar limitaciones y no decir que pasó.
- Confirmar que cambios en rutas tienen middleware/orden correctos; revisar las rutas específicas antes de `/:id`.
- Revisar formato de respuesta/error y los casos de propiedad/no staff.
- Para cambios de esquema, revisar la migración generada y los efectos sobre datos existentes; no ejecutar cambios destructivos sin autorización explícita.
- Distinguir hechos observados, inferencias y pendientes de confirmar. El código/migraciones actuales prevalecen frente a esta documentación.
- Al entregar, resumir comportamiento modificado, archivos afectados, verificaciones realizadas y riesgos/pendientes relevantes.

## Formato de cambios funcionales

Al agregar o modificar una funcionalidad, documentar como mínimo: actor autorizado, entrada/validaciones, efecto persistido, transacción/efectos laterales, estados/transiciones, errores, exposición pública/privada e integración externa. Actualizar `.claude/specs/functional.md`, `.claude/glossary.md` o `.claude/specs/architecture.md` cuando aplique.
