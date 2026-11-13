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

initSupertokens();
const app = express();
app.set("trust proxy", 1); // Render/proxies: cookies secure e IP real
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


app.use(middleware());
app.use("/api", rutas);
app.use(supertokensErrorHandler());
app.use(canelaErrorHandler);

export default app;
