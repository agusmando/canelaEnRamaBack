/**
 * Precio de venta de una variante.
 *
 *   precioVenta = price * (1 + profitMargin), redondeado HACIA ARRIBA al múltiplo
 *   de `roundingOption` (10 → decenas, 100 → centenas, 1 → sin redondeo).
 *
 * `profitMargin` se guarda como fracción (0.35 = 35%). Los mixes guardan en
 * `price` la suma de los precios de venta de sus componentes y margen 0, por eso
 * un margen 0 es válido y NO debe dejar el precio sin calcular.
 *
 * Para productos por peso (contentMeasure = KG) el precio es por kilo y el stock
 * se maneja en gramos.
 */
export function computeFinalPrice(variant: {
  price?: number | null;
  profitMargin?: number | null;
  roundingOption?: number | null;
}): number {
  const price = Number(variant.price ?? 0);
  if (!Number.isFinite(price) || price <= 0) return 0;

  const margin = Number(variant.profitMargin ?? 0);
  const raw = price * (1 + (Number.isFinite(margin) ? margin : 0));

  const step = Number(variant.roundingOption ?? 0);
  if (!Number.isFinite(step) || step <= 0) return Math.round(raw);
  // toFixed evita que 1240.0000000002 se redondee a 1250
  return Math.ceil(Number((raw / step).toFixed(6))) * step;
}

/** Convierte una cantidad de stock (gramos o unidades) a la unidad de precio. */
export function stockUnitsToPriceUnits(
  units: number,
  contentMeasure?: string | null,
): number {
  return contentMeasure === "KG" ? units / 1000 : units;
}

/**
 * Presentación efectiva de una línea (carrito u orden):
 *   - variante sin presentaciones -> null (quantity en g o u)
 *   - con presentaciones y sin elegir -> la más chica (quantity = paquetes)
 *   - elegida -> esa (debe existir en packagingOptions)
 */
export function effectiveBulkOption(
  packagingOptions: number[] | null | undefined,
  selected?: number | null,
): number | null {
  const options = (packagingOptions ?? []).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
  if (options.length === 0) return null;
  const chosen = Number(selected);
  return chosen > 0 ? chosen : options[0];
}
