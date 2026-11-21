# Contexto de Canela en Rama Backend

Documentación de referencia para personas y agentes que trabajen sobre este backend. El contenido describe lo encontrado en el código y el esquema Prisma durante una auditoría estática; no representa una garantía del estado de producción ni de la base desplegada.

## Documentos

- [Glosario de dominio y palabras reservadas](glossary.md): conceptos, nombres de dominio y literales exactos que no deben alterarse sin migración/compatibilidad.
- [Especificación funcional](specs/functional.md): módulos, reglas de negocio, flujos y cobertura de endpoints.
- [Arquitectura y contratos técnicos](specs/architecture.md): capas, respuestas, autenticación, persistencia, integraciones y configuración.
- [Guía de trabajo para IA](specs/ai-guidelines.md): cómo usar este contexto y restricciones para evitar cambios incompatibles.
- [Operación, despliegue y brechas conocidas](specs/operations-and-gaps.md): comandos, procesos programados, entorno y asuntos no implementados o por confirmar.

## Criterio de autoridad

Si esta documentación difiere del código, prevalecen las rutas, servicios, DTOs, middleware y esquema/migraciones vigentes. Antes de cambiar contratos de datos, consultar `src/config/prisma/schema.prisma` y las migraciones; no inferir que el contenido histórico de una migración es la definición actual. Actualizar estos documentos al cambiar funcionalidades, endpoints, enums, variables de entorno o reglas de negocio.

## Alcance del término «palabras reservadas»

El glosario recopila nombres y literales propios del dominio que funcionan como vocabulario contractual del proyecto (por ejemplo enums, estados, roles, tipos de pago y nombres de campos). No pretende enumerar las palabras reservadas de JavaScript, TypeScript, SQL o Prisma: esas pertenecen a los lenguajes y no son exclusivas del proyecto.
