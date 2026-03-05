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
import { verifySession } from "supertokens-node/recipe/session/framework/express";

initSupertokens();
const app = express();
app.use(express.json());

const corsMiddleware = cors({
  origin: true, // devuelve el Origin recibido y permite credentials
  allowedHeaders: ["content-type", ...supertokens.getAllCORSHeaders()],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

// app.use(
//   cors({
//     origin: "http://localhost:3000",
//     allowedHeaders: ["content-type", ...supertokens.getAllCORSHeaders()],
//     credentials: true,
//   })
// );
// const corsMiddleware = cors({
//   origin: function (origin, callback) {
//     const allowedOrigins = [
//       "http://localhost:3000",
//       "https://ecommercedesignforcanelaenrama.vercel.app",
//       "https://846e52c106c6.ngrok-free.app",
//       //supertokens dashboard
//       "https://localhost:8080/api/auth"
//     ];

//     if (!origin) return callback(null, true);
//     if (allowedOrigins.includes(origin)) {
//       return callback(null, true);
//     }

//     return callback(new Error("Not allowed by CORS"));
//   },
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], 
//   allowedHeaders: [
//     "content-type",
//     "ngrok-skip-browser-warning", // 🔥 ESTA ES LA CLAVE
//     ...supertokens.getAllCORSHeaders(),
//   ],
// });

app.use(corsMiddleware);

/**
 * ⚠️ ESTO ES LO CLAVE
 * SuperTokens necesita que el mismo CORS
 * esté activo cuando él responde OPTIONS
 */
// app.use((req, res, next) => {
//   if (req.method === "OPTIONS") {
//     return corsMiddleware(req, res, next);
//   }
//   next();
// });

app.use(middleware());
app.use("/api", rutas);
app.use(supertokensErrorHandler());
app.use(canelaErrorHandler);

export default app;
