import { BaseResponse } from "../utils/responseFormat.js";

/**
 * Rate limit en memoria por IP (ventana fija). Alcanza para una sola instancia
 * (Render); con varias instancias habría que pasarlo a Redis.
 * `req.ip` es la IP real porque app.ts configura `trust proxy`.
 */
export const rateLimit = (opts: {
  name: string;
  windowMs: number;
  max: number;
  /** Solo cuenta estos métodos (por defecto, todos). */
  methods?: string[];
  message?: string;
}) => {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, opts.windowMs);
  sweep.unref();

  return (req: any, res: any, next: any) => {
    if (opts.methods && !opts.methods.includes(req.method)) return next();
    const key = `${opts.name}:${req.ip}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + opts.windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    res.setHeader("RateLimit-Limit", String(opts.max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, opts.max - entry.count)));
    if (entry.count > opts.max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      const body = new BaseResponse(
        429,
        opts.message ?? "Demasiadas solicitudes. Esperá un momento y volvé a intentar.",
        {},
      );
      return res.status(429).json(body);
    }
    next();
  };
};

const MIN = 60 * 1000;

/** Login, registro y recupero de contraseña: frena fuerza bruta y spam de emails. */
export const authLimiter = rateLimit({
  name: "auth",
  windowMs: 15 * MIN,
  max: 20,
  methods: ["POST"],
  message: "Demasiados intentos. Esperá unos minutos y volvé a intentar.",
});
export const AUTH_LIMITED_PATHS = [
  "/api/auth/signin",
  "/api/auth/signup",
  "/api/auth/signinup",
  "/api/auth/user/password/reset",
  "/api/auth/user/password/reset/token",
  "/api/auth/dashboard/api/signin",
];

/** Escrituras públicas o de clientes (carritos de invitado, pedidos, reseñas). */
export const writeLimiter = rateLimit({
  name: "write",
  windowMs: 10 * MIN,
  max: 120,
  methods: ["POST", "PUT", "DELETE"],
});
export const WRITE_LIMITED_PATHS = ["/api/cart", "/api/order", "/api/review", "/api/payment/order", "/api/shipping/address", "/api/user/invite"];

/** Tope general por IP para todo /api (evita scraping masivo y abuso). */
export const apiLimiter = rateLimit({ name: "api", windowMs: MIN, max: 600 });

/** Headers de seguridad para una API JSON (equivalente mínimo a helmet). */
export const securityHeaders = (req: any, res: any, next: any) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  // El panel de SuperTokens (/api/auth/dashboard) es HTML con scripts de su CDN.
  if (!String(req.path).startsWith("/api/auth/dashboard")) {
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  }
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
};
