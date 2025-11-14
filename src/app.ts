import cors from "cors";
import express from "express";
import rutas from "./routes/index.route.ts";
import { errorHandler } from "./middleware/errorHandler.ts";

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use("/api", rutas);
app.use(errorHandler);

export default app;
