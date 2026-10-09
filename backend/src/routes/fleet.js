const express = require("express");
const fleetController = require("../controllers/fleetController");
const alertsController = require("../controllers/alertsController");
const authMiddleware = require("../middleware/auth");
const authHardware = require("../middleware/authHardware");
const requireRole = authMiddleware.requireRole('admin', 'manager');

const router = express.Router();

router.get("/live-events", authMiddleware, fleetController.liveEvents);
router.get("/", authMiddleware, fleetController.list);
router.get("/dashboard-stats", authMiddleware, fleetController.getDashboardStats);
router.get("/:id", authMiddleware, fleetController.getOne);
router.get("/:id/unloading-events", authMiddleware, fleetController.getUnloadingEvents);
router.get("/:id/route", authMiddleware, fleetController.getRoute);
router.post("/:id/route", authMiddleware, requireRole, fleetController.configureRoute);
router.post("/:id/cancel-route", authMiddleware, requireRole, fleetController.cancelRoute);
router.post("/:id/force-fueling", authMiddleware, requireRole, fleetController.forceFueling);

// Hardware Endpoints
router.post("/:id/security-events", authHardware, fleetController.securityEvent);
router.post("/:id/telemetry", authHardware, fleetController.ingestTelemetry);

router.patch("/alerts/:id/resolve", authMiddleware, requireRole, alertsController.resolve);
router.get('/:id/investigation', authMiddleware, fleetController.getInvestigation);

module.exports = router;
