// src/routes/index.js

const express = require("express");

const createSchemaRoute = require("./schema.route");
const createDataRoute = require("./data.route");
const createFormRoute = require("./form.route");
const createViewRoute = require("./view.route");

function createRoutes(db) {
  const router = express.Router();

  router.get("/health", (req, res) => {
    res.json({
      ok: true,
      service: "rootid-figma-prototype",
      timestamp: Date.now(),
    });
  });

  router.use("/schema", createSchemaRoute(db));
  router.use("/data", createDataRoute(db));
  router.use("/form", createFormRoute(db));
  router.use("/view", createViewRoute(db));

  return router;
}

module.exports = createRoutes;