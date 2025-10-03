const express = require("express");
const cors = require("cors");
const rutas = require("./routes/index.route");
const errorHandler = require("./middleware/errorHandler");

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

module.exports = app;
