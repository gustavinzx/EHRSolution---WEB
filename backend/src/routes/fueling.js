const express = require("express");
const fuelingController = require("../controllers/fuelingController");
const stationsController = require("../controllers/stationsController");

const router = express.Router();

// Fueling logs
router.get("/", fuelingController.list);

// Fueling sessions
router.post("/sessions", fuelingController.requestSession);
router.post("/sessions/:id/authorize", fuelingController.authorizeSession);
router.post("/sessions/:id/finish", fuelingController.finishSession);
router.get("/sessions/:truckId/active", fuelingController.getActiveSession);

// Fuel stations
router.get("/stations", stationsController.list);
router.post("/stations", stationsController.create);
router.put("/stations/:id", stationsController.update);
router.patch("/stations/:id/toggle", stationsController.toggleAuthorized);
router.get("/stations/nearest", stationsController.nearest);

module.exports = router;
