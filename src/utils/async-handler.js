// src/utils/async-handler.js
// -----------------------------------------------------------------------------
// Express async handler
// ใช้ครอบ controller function เพื่อลด try/catch ใน route/controller
// -----------------------------------------------------------------------------

function asyncHandler(fn) {
  return function wrappedAsyncHandler(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;