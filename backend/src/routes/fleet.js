const express = require("express");
const fleetController = require("../controllers/fleetController");
const alertsController = require("../controllers/alertsController");

const router = express.Router();

router.get("/live-events", fleetController.liveEvents);
router.get("/", fleetController.list);
router.get("/dashboard-stats", fleetController.getDashboardStats);
router.get("/:id", fleetController.getOne);
router.get("/:id/unloading-events", fleetController.getUnloadingEvents);
router.get("/:id/route", fleetController.getRoute);
router.post("/:id/route", fleetController.configureRoute);
router.post("/:id/cancel-route", fleetController.cancelRoute);
router.post("/:id/force-fueling", fleetController.forceFueling);
router.post("/:id/security-events", fleetController.securityEvent);
router.post("/:id/telemetry", fleetController.ingestTelemetry);
router.patch("/alerts/:id/resolve", alertsController.resolve);

router.get('/:id/investigation', fleetController.getInvestigation);

module.exports = router;
