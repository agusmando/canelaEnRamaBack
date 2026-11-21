import cors from "cors";
import express from "express";
import rutas from "./routes/index.route.js";
import { errorHandler as canelaErrorHandler } from "./middleware/errorHandler.js";
import { initSupertokens } from "./config/supertokens/supertokens.config.js";
import supertokens from "supertokens-node";
import {
  errorHandler as supertokensErrorHandler,
  middleware,
} from "supertokens-node/framework/express";
import { getAllowedCorsOrigins } from "./config/cors.js";

initSupertokens();
const app = express();
app.set("trust proxy", 1); // Render/proxies: cookies secure e IP real
app.use(express.json({ limit: "1mb" }));

// CORS_ORIGINS="https://tienda.com,https://admin.tienda.com".
// En desarrollo puede omitirse y refleja orígenes para facilitar localhost;
// en producción el arranque falla si no existe una lista explícita.
const allowedOrigins = getAllowedCorsOrigins(process.env.CORS_ORIGINS, process.env.NODE_ENV);

const corsMiddleware = cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  allowedHeaders: ["content-type", ...supertokens.getAllCORSHeaders()],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

app.use(corsMiddleware);

app.use(middleware());
app.use("/api", rutas);
app.use(supertokensErrorHandler());
app.use(canelaErrorHandler);

export default app;
