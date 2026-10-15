// routes/bpkm/v1/index.js
const express = require('express');

const makeCatalogos       = require('./catalogos');
const makeRutas           = require('./rutas');
const makeMon             = require('./monitoreo');
const makeBpkm            = require('./bpkm');
const makeSelecciones     = require('./selecciones');
const makeCambiosForma    = require('./cambiosForma');
const makeCambiosSucursal = require('./cambiosSucursal');
const makeTeClientes      = require('./te/clientes');
const makeEvidencias      = require('./evidencias');

module.exports = function makeBpkmV1Router({ pool } = {}) {
  const router = express.Router();

  router.use(makeCatalogos({ pool }));
  router.use(makeRutas({ pool }));
  router.use(makeMon({ pool }));
  router.use(makeBpkm({ pool }));
  router.use(makeSelecciones({ pool }));
  router.use(makeCambiosForma({ pool }));
  router.use(makeCambiosSucursal({ pool }));
  router.use(makeTeClientes({ pool }));
  router.use(makeEvidencias({ pool }));

  return router;
};