import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { pino, type Logger } from "pino";
import { pinoHttp } from "pino-http";

/**
 * Logger de la aplicación (pino).
 *
 * - Producción (Render): una línea JSON por evento en stdout. En Render → Logs se
 *   puede buscar por cualquier campo, p. ej. `"orderId":123`, `"module":"payment"`,
 *   `"reqId":"..."` o `"level":50` (errores).
 * - Desarrollo: salida legible con pino-pretty (si está instalado).
 * - Tests: silencioso.
 *
 * Env:
 *   LOG_LEVEL   trace | debug | info | warn | error | fatal | silent. Default: info
 *               (debug en desarrollo). Con debug se ven, entre otras cosas, todas
 *               las llamadas a Mercado Pago / Uber con su duración.
 *   LOG_PRETTY  "on" / "off" fuerza o apaga el formato legible.
 *
 * Niveles numéricos (para buscar en Render): 20 debug, 30 info, 40 warn, 50 error, 60 fatal.
 */
const isProd = process.env.NODE_ENV === "production";
const isTest = !!process.env.VITEST;

const level = process.env.LOG_LEVEL || (isTest ? "silent" : isProd ? "info" : "debug");
const pretty = process.env.LOG_PRETTY ? process.env.LOG_PRETTY === "on" : !isProd && !isTest;

/** Nunca deben llegar a los logs. */
const REDACT = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['st-auth-mode']",
  "req.headers['x-signature']",
  "res.headers['set-cookie']",
  "*.password",
  "*.accessToken",
  "*.access_token",
  "*.token",
  "*.secret",
];

export const logger: Logger = pino({
  level,
  base: { service: "canela-api", env: process.env.NODE_ENV ?? "development" },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label, number) => ({ level: number, severity: label }) },
  redact: { paths: REDACT, censor: "[redacted]" },
  transport: pretty
    ? { target: "pino-pretty", options: { translateTime: "SYS:HH:MM:ss.l", ignore: "pid,hostname,service,env,severity,req,res" } }
    : undefined,
});

/** Logger de la request en curso (con su reqId), si lo hay. */
const requestContext = new AsyncLocalStorage<Logger>();

/**
 * Logger para un módulo: `const log = getLogger("payment")`.
 * Dentro de una request agrega automáticamente el reqId, así todo lo que pasa en
 * esa request se puede filtrar junto en Render.
 */
export const getLogger = (module: string) => {
  const current = () => (requestContext.getStore() ?? logger).child({ module });
  return {
    trace: (...a: Parameters<Logger["trace"]>) => current().trace(...a),
    debug: (...a: Parameters<Logger["debug"]>) => current().debug(...a),
    info: (...a: Parameters<Logger["info"]>) => current().info(...a),
    warn: (...a: Parameters<Logger["warn"]>) => current().warn(...a),
    error: (...a: Parameters<Logger["error"]>) => current().error(...a),
    fatal: (...a: Parameters<Logger["fatal"]>) => current().fatal(...a),
    isLevelEnabled: (l: string) => logger.isLevelEnabled(l),
  };
};

/** "juan.perez@gmail.com" → "ju***@gmail.com" (para no guardar emails completos). */
export const maskEmail = (email?: string | null) => {
  if (!email) return email ?? null;
  const [user, domain] = String(email).split("@");
  if (!domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
};

/** Error → campos útiles (sin volcar objetos enormes). */
export const errInfo = (err: any) => ({
  err: { message: err?.message ?? String(err), name: err?.name, code: err?.code },
});

/** Ids que vienen de afuera (x-request-id de Mercado Pago, proxies): solo si son razonables. */
const SAFE_ID = /^[\w.-]{1,100}$/;

/** No vale la pena loguear cada health check de Render. */
const QUIET_PATHS = new Set(["/api/health"]);

/**
 * Log de cada request: método, ruta, status, duración, usuario e id.
 * Devuelve el id en el header `x-request-id` (útil para buscar un error que reporta alguien).
 */
export const httpLogger = [
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers["x-request-id"];
      const id = typeof incoming === "string" && SAFE_ID.test(incoming) ? incoming : randomUUID();
      res.setHeader("x-request-id", id);
      return id;
    },
    // Los logs dentro de la request llevan solo el reqId; el detalle de req/res va en la línea final
    quietReqLogger: true,
    customAttributeKeys: { reqId: "reqId", responseTime: "ms" },
    autoLogging: { ignore: (req) => QUIET_PATHS.has((req.url ?? "").split("?")[0]) },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage: (req, res, ms) => `${req.method} ${(req as any).originalUrl ?? req.url} ${res.statusCode} ${Math.round(ms)}ms`,
    customErrorMessage: (req, res) => `${req.method} ${(req as any).originalUrl ?? req.url} ${res.statusCode}`,
    // Se evalúa también al terminar la request, cuando la sesión ya está cargada
    customProps: (req: any, res: any) => {
      const userId = req.session?.getUserId?.();
      const errorMessage = res.locals?.errorMessage;
      return { ...(userId ? { userId } : {}), ...(errorMessage ? { errorMessage } : {}) };
    },
    serializers: {
      req: (req: any) => ({
        method: req.method,
        url: req.url,
        ip: req.raw?.ip ?? req.remoteAddress,
        origin: req.headers?.origin,
        userAgent: req.headers?.["user-agent"],
      }),
      res: (res: any) => ({ statusCode: res.statusCode }),
    },
  }),
  // Deja el logger de la request disponible para getLogger() en servicios y repositorios
  (req: any, _res: any, next: any) => requestContext.run(req.log, next),
];
