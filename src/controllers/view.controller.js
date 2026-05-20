// src/controllers/view.controller.js

const ViewService = require("../services/view.service");

function createViewController(db) {
  const viewService = new ViewService(db);

  return {
    async create(req, res, next) {
      try {
        const result = await viewService.createView(req.body);

        return res.status(201).json({
          ok: true,
          data: result,
        });
      } catch (err) {
        return next(err);
      }
    },

    async updateByRootId(req, res, next) {
      try {
        const { rootid } = req.params;

        const result = await viewService.updateView(rootid, req.body);

        return res.json({
          ok: true,
          data: result,
        });
      } catch (err) {
        return next(err);
      }
    },

    async getById(req, res, next) {
      try {
        const { id } = req.params;

        const result = await viewService.getViewById(id);

        return res.json({
          ok: true,
          data: result,
        });
      } catch (err) {
        return next(err);
      }
    },

    async getLatestByRootId(req, res, next) {
      try {
        const { rootid } = req.params;
        const includeDeleted = req.query.includeDeleted === "true";

        const result = await viewService.getLatestViewByRootId(rootid, {
          includeDeleted,
        });

        return res.json({
          ok: true,
          data: result,
        });
      } catch (err) {
        return next(err);
      }
    },

    async listLatest(req, res, next) {
      try {
        const result = await viewService.listLatestViews({
          includeDeleted: req.query.includeDeleted === "true",
          limit: req.query.limit,
          offset: req.query.offset,
          data_schema_id: req.query.data_schema_id,
          data_schema_rootid: req.query.data_schema_rootid,
        });

        return res.json({
          ok: true,
          data: result,
        });
      } catch (err) {
        return next(err);
      }
    },

    async listBySchemaId(req, res, next) {
      try {
        const { schemaId } = req.params;

        const result = await viewService.listLatestViewsBySchemaId(schemaId, {
          includeDeleted: req.query.includeDeleted === "true",
          limit: req.query.limit,
          offset: req.query.offset,
        });

        return res.json({
          ok: true,
          data: result,
        });
      } catch (err) {
        return next(err);
      }
    },

    async listBySchemaRootId(req, res, next) {
      try {
        const { schemaRootId } = req.params;

        const result = await viewService.listLatestViewsBySchemaRootId(
          schemaRootId,
          {
            includeDeleted: req.query.includeDeleted === "true",
            limit: req.query.limit,
            offset: req.query.offset,
          }
        );

        return res.json({
          ok: true,
          data: result,
        });
      } catch (err) {
        return next(err);
      }
    },

    async getEditorContext(req, res, next) {
      try {
        const { id } = req.params;

        const result = await viewService.getViewEditorContext(id);

        return res.json({
          ok: true,
          data: result,
        });
      } catch (err) {
        return next(err);
      }
    },

    async renderFixedSchemaView(req, res, next) {
      try {
        const { id } = req.params;

        const result = await viewService.renderFixedSchemaView(id, {
          limit: req.query.limit,
          offset: req.query.offset,
        });

        return res.json({
          ok: true,
          data: result,
        });
      } catch (err) {
        return next(err);
      }
    },

    async renderLatestRootSchemaView(req, res, next) {
      try {
        const { id } = req.params;

        const result = await viewService.renderLatestRootSchemaView(id, {
          limit: req.query.limit,
          offset: req.query.offset,
        });

        return res.json({
          ok: true,
          data: result,
        });
      } catch (err) {
        return next(err);
      }
    },

    async migrateToLatestSchema(req, res, next) {
      try {
        const { rootid } = req.params;

        const result = await viewService.migrateViewToLatestSchema(rootid, {
          force: req.body.force === true,
        });

        return res.json({
          ok: true,
          data: result,
        });
      } catch (err) {
        return next(err);
      }
    },

    async getHistory(req, res, next) {
      try {
        const { rootid } = req.params;

        const result = await viewService.getViewHistory(rootid);

        return res.json({
          ok: true,
          data: result,
        });
      } catch (err) {
        return next(err);
      }
    },

    async deleteByRootId(req, res, next) {
      try {
        const { rootid } = req.params;

        const result = await viewService.deleteView(rootid);

        return res.json({
          ok: true,
          data: result,
        });
      } catch (err) {
        return next(err);
      }
    },

    async restoreVersion(req, res, next) {
      try {
        const { id } = req.params;

        const result = await viewService.restoreView(id);

        return res.json({
          ok: true,
          data: result,
        });
      } catch (err) {
        return next(err);
      }
    },
  };
}

module.exports = createViewController;