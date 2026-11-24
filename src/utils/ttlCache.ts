/**
 * Caché en memoria con TTL para respuestas de lectura públicas.
 *
 * Se guarda el resultado CRUDO del servicio/repositorio, antes de los
 * middlewares que filtran por actor (`hideCostForPublic`, `webOnlyForPublic`),
 * así una misma entrada sirve a staff e invitados.
 *
 * La invalidación es por prefijo de clave y se engancha a las escrituras con
 * `invalidateCacheOnWrite` (mismo patrón que los índices de búsqueda).
 */

type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();
const MAX_ENTRIES = 300;

/** JSON con claves ordenadas: misma consulta = misma clave aunque cambie el orden de params. */
export const stableStringify = (v: unknown): string =>
  JSON.stringify(v, (_k, val) =>
    val && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)
      ? Object.keys(val as Record<string, unknown>)
          .sort()
          .reduce((o: Record<string, unknown>, k) => {
            o[k] = (val as Record<string, unknown>)[k];
            return o;
          }, {})
      : val,
  );

/** Devuelve `fn()` o el valor cacheado si la clave no venció. */
export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value as T);
  return fn().then((value) => {
    if (store.size >= MAX_ENTRIES) {
      const now = Date.now();
      for (const [k, e] of store) if (e.expires <= now) store.delete(k);
      if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value as string);
    }
    store.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  });
}

/** Borra las entradas cuya clave empiece con `prefix` (sin prefijo: todo). */
export function invalidateCache(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}

/**
 * Middleware: tras una escritura exitosa (respuesta terminada, status < 400)
 * invalida las claves con los prefijos indicados.
 */
export const invalidateCacheOnWrite =
  (...prefixes: string[]) =>
  (req: any, res: any, next: any) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      res.on("finish", () => {
        if (res.statusCode < 400) prefixes.forEach((p) => invalidateCache(p));
      });
    }
    next();
  };
