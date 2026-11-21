/**
 * Qué ve un cliente en la tienda. Una variante se muestra (y se puede comprar)
 * solo si está activa, marcada "Disponible en la web" y su producto está activo.
 */
export const isWebVariant = (v: any) => !!v && v.active !== false && v.availableWeb !== false;

/** La misma condición como filtro de Prisma sobre ProductVariant. */
export const webVariantWhere = { active: true, availableWeb: true, product: { active: true } } as const;
