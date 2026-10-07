const express = require("express");
const fuelingController = require("../controllers/fuelingController");
const stationsController = require("../controllers/stationsController");
const authMiddleware = require("../middleware/auth");
const { allow } = require("../middleware/authAny");

const router = express.Router();

const managerOrDriver = allow({ manager: true, driver: true });
const anyActor = allow({ manager: true, driver: true, hardware: true });
const managerOnly = allow({ manager: true });
const driverOnly = allow({ driver: true });

// Fueling logs (Manager)
router.get("/", authMiddleware, fuelingController.list);

// Fuel stations (Manager) — declaradas antes de /sessions/:id para não colidir
router.get("/stations", authMiddleware, stationsController.list);
router.post("/stations", authMiddleware, stationsController.create);
router.get("/stations/nearest", authMiddleware, stationsController.nearest);
router.put("/stations/:id", authMiddleware, stationsController.update);
router.patch("/stations/:id/toggle", authMiddleware, stationsController.toggleAuthorized);

// Emergência: liberação manual pelo gestor (sem sessão prévia)
router.post("/emergency-unlock", managerOnly, fuelingController.emergencyUnlockTruck);
// Pedidos de liberação manual pendentes (motoristas que estouraram as tentativas faciais)
router.get("/sessions/pending-emergency", managerOnly, fuelingController.listPendingEmergency);

// Fueling sessions (App do motorista + painel do gestor)
router.post("/sessions", managerOrDriver, fuelingController.requestSession);
router.post("/sessions/:id/authorize", managerOrDriver, fuelingController.authorizeSession);
router.post("/sessions/:id/finish", anyActor, fuelingController.finishSession);
router.post("/sessions/:id/facial-failure", driverOnly, fuelingController.reportFacialFailure);
router.post("/sessions/:id/emergency-unlock", managerOnly, fuelingController.emergencyUnlockSession);
router.post("/sessions/:id/pump-reading", allow({ hardware: true }), fuelingController.reportPumpReading);

// Sessão ativa (hardware consulta para abrir a trava; painel/app para exibir status)
router.get("/sessions/:truckId/active", anyActor, fuelingController.getActiveSession);

module.exports = router;
