// src/controllers/business.controller.js

const BusinessService = require("../services/business.service");

function createBusinessController(db) {
  const service = new BusinessService(db);

  return {
    async create(req, res, next) {
      try {
        const result = await service.createBusiness(req.body);
        return res.status(201).json({ ok: true, data: result });
      } catch (err) {
        return next(err);
      }
    },

    async updateByRootId(req, res, next) {
      try {
        const { rootid } = req.params;
        const result = await service.updateBusiness(rootid, req.body);
        return res.json({ ok: true, data: result });
      } catch (err) {
        return next(err);
      }
    },

    async getById(req, res, next) {
      try {
        const { id } = req.params;
        const result = await service.getBusinessById(id);
        return res.json({ ok: true, data: result });
      } catch (err) {
        return next(err);
      }
    },

    async getLatestByRootId(req, res, next) {
      try {
        const { rootid } = req.params;
        const result = await service.getLatestByRootId(rootid, {
          includeDeleted: req.query.includeDeleted === "true",
        });
        return res.json({ ok: true, data: result });
      } catch (err) {
        return next(err);
      }
    },

    async listLatest(req, res, next) {
      try {
        const result = await service.listLatest({
          includeDeleted: req.query.includeDeleted === "true",
          limit: req.query.limit,
          offset: req.query.offset,
        });
        return res.json({ ok: true, data: result });
      } catch (err) {
        return next(err);
      }
    },

    async getHistory(req, res, next) {
      try {
        const { rootid } = req.params;
        const result = await service.getHistory(rootid);
        return res.json({ ok: true, data: result });
      } catch (err) {
        return next(err);
      }
    },

    async deleteByRootId(req, res, next) {
      try {
        const { rootid } = req.params;
        const result = await service.deleteBusiness(rootid);
        return res.json({ ok: true, data: result });
      } catch (err) {
        return next(err);
      }
    },
  };
}

module.exports = createBusinessController;
