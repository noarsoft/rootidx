// src/app.js
// -----------------------------------------------------------------------------
// Express app setup
// -----------------------------------------------------------------------------

const express = require("express");
const cors = require("cors");

const config = require("./config/config");
const pool = require("./db/pool");

const createRoutes = require("./routes");
const notFound = require("./middlewares/not-found");
const errorHandler = require("./middlewares/error-handler");

function createApp() {
  const app = express();

  app.disable("x-powered-by");

  app.use(
    cors({
      origin: config.app.corsOrigin === "*" ? true : config.app.corsOrigin,
      credentials: true,
    })
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  app.use((req, res, next) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    next();
  });

  app.get("/", (req, res) => {
    res.json({
      ok: true,
      service: config.app.name,
      message: "Root-ID Figma Prototype Backend",
      timestamp: Date.now(),
    });
  });

  app.use("/api", createRoutes(pool));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;