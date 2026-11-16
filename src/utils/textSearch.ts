/**
 * Búsqueda "como la de la tienda": sin distinguir mayúsculas ni acentos, cada
 * palabra tiene que aparecer en algún lado (en cualquier orden) y primero va
 * lo que empieza con lo buscado.
 */

/** "Almendras  Ñandú" -> "almendras nandu" */
export const normalizeText = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Palabras de la búsqueda (máximo 8). */
export const searchWords = (q: unknown) => normalizeText(q).split(" ").filter(Boolean).slice(0, 8);

/**
 * Singular aproximado para que "nuez" encuentre "nueces" y "almendras"
 * encuentre "almendra": -ces -> z, -es -> "" (palabras largas), -s -> "".
 */
export const stem = (w: string) => {
  if (w.length > 4 && w.endsWith("ces")) return w.slice(0, -3) + "z";
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
};
const stemText = (normalized: string) => normalized.split(" ").map(stem).join(" ");

/**
 * Cada palabra aparece en el texto tal cual (sirve mientras se escribe:
 * "almen") o en singular ("nueces" ~ "nuez"). Recibe textos ya normalizados.
 */
export const matchesWords = (hay: string, words: string[], stemmedHay = stemText(hay)) =>
  words.every((w) => hay.includes(w) || stemmedHay.includes(stem(w)));

export type Searchable = { id: number; name: string; text: string };

/**
 * Filtra y ordena por relevancia:
 *   0. el nombre empieza con lo buscado
 *   1. todas las palabras están en el nombre
 *   2. alguna palabra está solo en el resto (descripción, marca, etiquetas…)
 * y, a igual relevancia, por nombre. Devuelve los ids en orden.
 */
export function rankByText(items: Searchable[], q: unknown): number[] {
  const words = searchWords(q);
  if (!words.length) return items.map((i) => i.id);
  const term = words.join(" ");
  const scored: { id: number; name: string; score: number }[] = [];
  for (const it of items) {
    const name = normalizeText(it.name);
    const hay = `${name} ${normalizeText(it.text)}`;
    if (!matchesWords(hay, words)) continue;
    const score = name.startsWith(term) ? 0 : matchesWords(name, words) ? 1 : 2;
    scored.push({ id: it.id, name, score });
  }
  scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, "es"));
  return scored.map((s) => s.id);
}
