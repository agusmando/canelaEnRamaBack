import cors from "cors";
import express from "express";
import rutas from "./routes/index.route.js";
import { errorHandler as canelaErrorHandler } from "./middleware/errorHandler.js";
import {
  apiLimiter,
  AUTH_LIMITED_PATHS,
  authLimiter,
  securityHeaders,
  WRITE_LIMITED_PATHS,
  writeLimiter,
} from "./middleware/security.js";
import { initSupertokens } from "./config/supertokens/supertokens.config.js";
import supertokens from "supertokens-node";
import {
  errorHandler as supertokensErrorHandler,
  middleware,
} from "supertokens-node/framework/express";

initSupertokens();
const app = express();
app.set("trust proxy", 1); // Render/proxies: IP real del cliente (rate limit)
app.disable("x-powered-by");
app.use(securityHeaders);
app.use(express.json({ limit: "1mb" }));

// CORS_ORIGINS="https://tienda.com,https://admin.tienda.com". Sin definir refleja
// cualquier origen (comportamiento anterior): definirlo en producción.
const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsMiddleware = cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  allowedHeaders: ["content-type", ...supertokens.getAllCORSHeaders()],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

app.use(corsMiddleware);

// Rate limits (después de CORS para que los 429 lleguen legibles al navegador)
app.use("/api", apiLimiter);
app.use(AUTH_LIMITED_PATHS, authLimiter);
app.use(WRITE_LIMITED_PATHS, writeLimiter);


app.use(middleware());
app.use("/api", rutas);
app.use(supertokensErrorHandler());
app.use(canelaErrorHandler);

export default app;
