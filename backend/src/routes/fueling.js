const express = require("express");
const fuelingController = require("../controllers/fuelingController");
const stationsController = require("../controllers/stationsController");
const authMiddleware = require("../middleware/auth");
const authDriver = require("../middleware/authDriver");
const authHardware = require("../middleware/authHardware");

const router = express.Router();

// Fueling logs (Manager)
router.get("/", authMiddleware, fuelingController.list);

// Fueling sessions (Driver App)
router.post("/sessions", authDriver, fuelingController.requestSession);
router.post("/sessions/:id/authorize", authDriver, fuelingController.authorizeSession);
router.post("/sessions/:id/finish", authDriver, fuelingController.finishSession);

// Hardware checks for active sessions
router.get("/sessions/:truckId/active", authHardware, fuelingController.getActiveSession);

// Fuel stations (Manager)
router.get("/stations", authMiddleware, stationsController.list);
router.post("/stations", authMiddleware, stationsController.create);
router.put("/stations/:id", authMiddleware, stationsController.update);
router.patch("/stations/:id/toggle", authMiddleware, stationsController.toggleAuthorized);
router.get("/stations/nearest", authMiddleware, stationsController.nearest);

module.exports = router;
