import { GoogleReviewRepository, type GoogleReviewInput } from "../repository/google-review.repository.js";
import { ExternalServiceError } from "../errors/infra/ExternalServiceError.js";
import { BadRequestError } from "../errors/application/BadRequestError.js";
import { ValidationError } from "../errors/application/ValidationError.js";

const PLACES_URL = "https://places.googleapis.com/v1/places/";
const FIELD_MASK = "id,displayName,rating,userRatingCount,googleMapsUri,reviews";
const STALE_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 60 * 60 * 1000; // tras un intento automático, no reintentar antes de 1 h

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DEFAULT_QUERY = "Canela en Rama, Colombia 1268, Godoy Cruz, Mendoza";

const config = () => ({
  apiKey: process.env.GOOGLE_PLACES_API_KEY ?? "",
  placeId: process.env.GOOGLE_PLACE_ID ?? "",
  placeQuery: process.env.GOOGLE_PLACE_QUERY || DEFAULT_QUERY,
  language: process.env.GOOGLE_PLACES_LANGUAGE ?? "es",
});

/**
 * Reseñas del local en Google (Places API "New").
 *
 * Google devuelve como máximo 5 reseñas por consulta, así que se acumulan en
 * la base (upsert por id de Google) y el staff elige cuáles destacar en la web.
 * El GET público dispara una re-sincronización en segundo plano si la última
 * tiene más de 24 h.
 *
 * Env: GOOGLE_PLACES_API_KEY (obligatoria), GOOGLE_PLACE_ID (opcional: si falta
 * se busca el local por nombre con GOOGLE_PLACE_QUERY, por defecto
 * "Canela en Rama, Colombia 1268, Godoy Cruz, Mendoza"), GOOGLE_PLACES_LANGUAGE ("es").
 */
export class GoogleReviewService {
  private syncing: Promise<any> | null = null;
  private lastAutoSyncAt = 0;
  /** Place ID encontrado por búsqueda (si no vino en GOOGLE_PLACE_ID). */
  private resolvedPlaceId: string | null = null;
  /** Error de la última sincronización cuando todavía no hay un lugar donde guardarlo. */
  private lastError: string | null = null;

  constructor(private readonly repository = new GoogleReviewRepository()) {}

  isConfigured() {
    return Boolean(config().apiKey);
  }

  /** Lugar ya conocido: el de la env, el resuelto en esta ejecución o el último guardado. */
  private async knownPlace() {
    const id = config().placeId || this.resolvedPlaceId;
    if (id) return { id, place: await this.repository.findPlace(id) };
    const place = await this.repository.latestPlace();
    return { id: place?.placeId ?? null, place };
  }

  /** Place ID a usar; si no hay ninguno, lo busca en Google por nombre/dirección. */
  private async resolvePlaceId(apiKey: string): Promise<string> {
    const known = await this.knownPlace();
    if (known.id) return known.id;
    const { placeQuery, language } = config();
    const res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
      },
      body: JSON.stringify({ textQuery: placeQuery, languageCode: language }),
      signal: AbortSignal.timeout(15000),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
    const found = data.places?.[0];
    if (!found?.id) throw new Error(`No se encontró el local en Google buscando "${placeQuery}"`);
    console.info(
      `[google-review] Place ID resuelto: ${found.id} (${found.displayName?.text ?? ""} · ${found.formattedAddress ?? ""}). ` +
        "Podés fijarlo con GOOGLE_PLACE_ID.",
    );
    this.resolvedPlaceId = found.id;
    return found.id;
  }

  private async placeInfo() {
    const { id: placeId, place } = await this.knownPlace();
    return {
      placeId: placeId || null,
      name: place?.name ?? null,
      rating: place?.rating ?? null,
      userRatingCount: place?.userRatingCount ?? null,
      googleMapsUri: place?.googleMapsUri ?? null,
      lastSyncAt: place?.lastSyncAt ?? null,
      configured: this.isConfigured(),
      lastError: place?.lastError ?? this.lastError,
    };
  }

  async getPublic() {
    const place = await this.placeInfo();
    const stale = !place.lastSyncAt || Date.now() - new Date(place.lastSyncAt).getTime() > STALE_MS;
    if (place.configured && stale && Date.now() - this.lastAutoSyncAt > RETRY_MS) {
      this.lastAutoSyncAt = Date.now();
      // No bloquea la respuesta; los errores quedan en GooglePlace.lastError
      this.sync().catch((err) => console.warn("[google-review] sync en segundo plano falló:", err.message));
    }
    return { place, reviews: await this.repository.list(true) };
  }

  async getAll() {
    return { place: await this.placeInfo(), reviews: await this.repository.list(false) };
  }

  /** Una sola sincronización a la vez (requests concurrentes esperan la misma). */
  sync() {
    this.syncing ??= this.doSync().finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }

  private async doSync() {
    if (!this.isConfigured()) {
      throw new BadRequestError(
        "Google Places no está configurado: definí GOOGLE_PLACES_API_KEY en el .env del backend",
      );
    }
    const { apiKey, language } = config();

    let data: any;
    let placeId = "";
    try {
      placeId = await this.resolvePlaceId(apiKey);
      const res = await fetch(
        `${PLACES_URL}${encodeURIComponent(placeId)}?languageCode=${encodeURIComponent(language)}`,
        {
          headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELD_MASK },
          signal: AbortSignal.timeout(15000),
        },
      );
      data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      }
    } catch (err: any) {
      const message = String(err?.message ?? err).slice(0, 500);
      this.lastError = message;
      if (placeId) await this.repository.savePlace(placeId, { lastError: message });
      throw new ExternalServiceError("Google Places", message);
    }

    const reviews: GoogleReviewInput[] = (data.reviews ?? [])
      .filter((r: any) => r?.name && Number(r?.rating) > 0)
      .map((r: any) => ({
        googleId: String(r.name),
        authorName: r.authorAttribution?.displayName ?? "Usuario de Google",
        authorPhotoUrl: r.authorAttribution?.photoUri ?? null,
        authorUrl: r.authorAttribution?.uri ?? null,
        rating: Math.round(Number(r.rating)),
        text: r.text?.text ?? r.originalText?.text ?? null,
        language: r.text?.languageCode ?? r.originalText?.languageCode ?? null,
        relativeTime: r.relativePublishTimeDescription ?? null,
        publishedAt: r.publishTime ? new Date(r.publishTime) : null,
      }));

    await this.repository.upsertMany(reviews);
    await this.repository.savePlace(placeId, {
      name: data.displayName?.text ?? null,
      rating: typeof data.rating === "number" ? data.rating : null,
      userRatingCount: typeof data.userRatingCount === "number" ? data.userRatingCount : null,
      googleMapsUri: data.googleMapsUri ?? null,
      lastSyncAt: new Date(),
      lastError: null,
    });
    this.lastError = null;

    return { ...(await this.getAll()), synced: reviews.length };
  }

  async update(id: number, body: any) {
    const data: { featured?: boolean; active?: boolean } = {};
    for (const key of ["featured", "active"] as const) {
      if (body?.[key] === undefined) continue;
      if (typeof body[key] !== "boolean") throw new ValidationError(`${key} debe ser booleano`);
      data[key] = body[key];
    }
    if (Object.keys(data).length === 0) throw new ValidationError("Nada para actualizar");
    return this.repository.update(id, data);
  }
}
