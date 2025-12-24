import cors from "cors";
import express from "express";
import rutas from "./routes/index.route.ts";
import { errorHandler as canelaErrorHandler } from "./middleware/errorHandler.ts";
import { initSupertokens } from "./config/supertokens/supertokens.config.ts";
import supertokens from "supertokens-node";
import {
  errorHandler as supertokensErrorHandler,
  middleware,
} from "supertokens-node/framework/express";
import { verifySession } from "supertokens-node/recipe/session/framework/express";

initSupertokens();
const app = express();
app.use(express.json());

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://ecommercedesignforcanelaenrama.vercel.app/",
      "https://278ff69fb362.ngrok-free.app",
    ],
    credentials: true,
    allowedHeaders: [
      "content-type",
      ...supertokens.getAllCORSHeaders(),
    ],
  })
);

app.use(middleware());
app.use("/api", rutas);
app.get("/getJWT", verifySession(), async (req, res) => {
  console.log("hola");
  let session = req.session;
  console.log(session);
  let jwt = session.getAccessToken();
  console.log(jwt);

  res.json({ token: jwt });
});
app.use(supertokensErrorHandler());
app.use(canelaErrorHandler);

export default app;
