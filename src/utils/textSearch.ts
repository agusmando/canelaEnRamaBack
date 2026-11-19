/**
 * Búsqueda "como la de la tienda" (misma lógica que canelaEnRamaWeb/src/app/lib/shop.ts):
 * - sin distinguir mayúsculas ni acentos;
 * - cada palabra tiene que aparecer en algún lado, en cualquier orden;
 * - se ignoran palabras de relleno ("harina de almendras" = "harina almendras");
 * - singular/plural ("nueces" ~ "nuez") y errores de tipeo ("almedras" ~ "almendras");
 * - con 3 palabras o más, si nada coincide con todas, lo que coincide con todas menos una.
 * Primero va lo que empieza con lo buscado.
 */

/** "Almendras  Ñandú" -> "almendras nandu" */
export const normalizeText = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Palabras que no aportan a la búsqueda. "sin" NO va: "sin tacc", "sin azúcar". */
const STOPWORDS = new Set([
  "de", "del", "la", "las", "el", "los", "lo", "y", "e", "o", "u", "a", "al",
  "en", "con", "para", "por", "un", "una", "unos", "unas",
]);

const tokens = (normalized: string) => normalized.split(/[^a-z0-9ñ]+/).filter(Boolean);

/** Palabras de la búsqueda sin las de relleno (máximo 8). Si solo había relleno, se usan tal cual. */
export const searchWords = (q: unknown) => {
  const all = tokens(normalizeText(q));
  const useful = all.filter((w) => !STOPWORDS.has(w));
  return (useful.length ? useful : all).slice(0, 8);
};

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

/** Errores de tipeo tolerados según el largo de la palabra. */
const maxTypos = (w: string) => (w.length >= 8 ? 2 : w.length >= 5 ? 1 : 0);

/** Distancia de edición (con transposición de letras vecinas), cortando si supera `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** Texto preparado para buscar: sus palabras sueltas y en singular. */
export type Haystack = { words: string[]; stems: string[] };

export const haystack = (normalized: string): Haystack => {
  const words = [...new Set(tokens(normalized))];
  return { words, stems: words.map(stem) };
};

/**
 * 0 = alguna palabra empieza con `w` (tal cual o en singular: sirve mientras se
 * escribe, "almen"), 1 = con un error de tipeo, -1 = no está. Se compara con el
 * comienzo de cada palabra para que "te" no encuentre "aceite".
 */
function wordMatch(h: Haystack, w: string): 0 | 1 | -1 {
  const sw = stem(w);
  if (h.words.some((t) => t.startsWith(w)) || h.stems.some((t) => t.startsWith(sw))) return 0;
  const max = maxTypos(w);
  if (!max) return -1;
  for (let i = 0; i < h.words.length; i++) {
    const t = h.words[i];
    // palabra completa ("almedras" ~ "almendras") o a medio escribir ("almedr" ~ "almendras")
    if (editDistance(sw, h.stems[i], max) <= max) return 1;
    if (t.length > w.length) {
      // prefijo del mismo largo (letra cambiada) o con una más (letra que falta)
      if (editDistance(w, t.slice(0, w.length), 1) <= 1 || editDistance(w, t.slice(0, w.length + 1), 1) <= 1) return 1;
    }
  }
  return -1;
}

/** Cuántas palabras están (y cuántas sin error de tipeo) y si alguna necesitó tolerarlo. */
function countMatches(h: Haystack, words: string[]) {
  let found = 0;
  let exact = 0;
  let typo = false;
  for (const w of words) {
    const m = wordMatch(h, w);
    if (m >= 0) found++;
    if (m === 0) exact++;
    if (m === 1) typo = true;
  }
  return { found, exact, typo };
}

/**
 * Cada palabra aparece en el texto (tal cual, en singular o con un error de
 * tipeo). Recibe el texto ya normalizado.
 */
export const matchesWords = (hay: string | Haystack, words: string[]) => {
  const h = typeof hay === "string" ? haystack(hay) : hay;
  return countMatches(h, words).found === words.length;
};

/**
 * Relevancia de un producto (menor = mejor) o `null` si no coincide:
 *   0. el nombre empieza con lo buscado ("harina de almendras" ~ "Harina almendras pura")
 *   1. el nombre empieza con la primera palabra y tiene todas
 *   2. todas las palabras están en el nombre
 *   3. alguna está solo en el resto (descripción, marca, etiquetas…)
 *   +4 si hizo falta tolerar un error de tipeo; a igual nivel, más palabras en el nombre primero.
 * `partial` acepta que falte una palabra (para el plan B con 3+ palabras).
 */
export function searchScore(name: string, rest: string, words: string[], partial = false): number | null {
  if (!words.length) return 0;
  const hay = haystack(`${name} ${rest}`);
  const { found, typo } = countMatches(hay, words);
  if (found < words.length - (partial ? 1 : 0)) return null;
  const nameWords = tokens(name).filter((w) => !STOPWORDS.has(w));
  // En el nombre cuentan las coincidencias exactas, salvo que la búsqueda ya tenga un error de tipeo
  const nm = countMatches(haystack(name), words);
  const inName = typo ? nm.found : nm.exact;
  const firstOk = nameWords.length > 0 && wordMatch(haystack(nameWords[0]), words[0]) >= 0;
  const all = inName >= found;
  const score = nameWords.join(" ").startsWith(words.join(" ")) ? 0 : all && firstOk ? 1 : all ? 2 : 3;
  // a igual nivel, primero los que tienen más palabras en el nombre
  return score + (typo ? 4 : 0) + (words.length - inName) * 0.1;
}

export type Searchable = { id: number; name: string; text: string };

/**
 * Filtra y ordena por relevancia (ver `searchScore`) y, a igual relevancia,
 * por nombre. Con 3+ palabras y ningún resultado, devuelve lo que coincide
 * con todas menos una. Devuelve los ids en orden.
 */
export function rankByText(items: Searchable[], q: unknown): number[] {
  const words = searchWords(q);
  if (!words.length) return items.map((i) => i.id);
  const prepared = items.map((it) => ({ id: it.id, name: normalizeText(it.name), rest: normalizeText(it.text) }));
  const run = (partial: boolean) => {
    const scored: { id: number; name: string; score: number }[] = [];
    for (const it of prepared) {
      const score = searchScore(it.name, it.rest, words, partial);
      if (score !== null) scored.push({ id: it.id, name: it.name, score });
    }
    return scored;
  };
  let scored = run(false);
  if (!scored.length && words.length >= 3) scored = run(true);
  scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, "es"));
  return scored.map((s) => s.id);
}
