import { Router } from "express";
import {
  createActivityLog,
  createMedicalRecord,
  createPhysicalTest,
  getPlayerById,
  listMedicalRecords,
  listPhysicalTests,
} from "../db";
import { requireAuth, requireModule } from "../middleware/auth";

export const medicalRecordsRouter = Router();
export const physicalTestsRouter = Router();

medicalRecordsRouter.use(requireAuth);
physicalTestsRouter.use(requireAuth);

// GET /api/medical-records?playerId=... -> partes medicos (lesion, control,
// alta), mas reciente primero. Sector exclusivo del cuerpo medico: ni
// scouting ni cuerpo tecnico lo ven.
medicalRecordsRouter.get("/", requireModule("fisico_medico", "read"), (req, res) => {
  const playerId = typeof req.query.playerId === "string" ? req.query.playerId : undefined;
  res.json(listMedicalRecords(playerId));
});

// POST /api/medical-records -> carga un parte medico nuevo. Lo carga el
// preparador fisico / kinesiologo (o admin).
medicalRecordsRouter.post("/", requireModule("fisico_medico", "write"), (req, res) => {
  const { playerId, type, date, diagnosis, status, expectedReturn, notes } = req.body ?? {};

  if (!playerId || !type || !date || !diagnosis || !status) {
    return res.status(400).json({ error: "Faltan campos obligatorios (playerId, type, date, diagnosis, status)" });
  }

  const player = getPlayerById(playerId);
  if (!player) return res.status(404).json({ error: "Jugador no encontrado" });

  const record = createMedicalRecord({
    playerId,
    type,
    date,
    diagnosis,
    status,
    expectedReturn: expectedReturn || undefined,
    notes,
    createdById: req.user!.userId,
  });

  createActivityLog({
    type: "MEDICO",
    message: `Nuevo parte medico de ${player.firstName} ${player.lastName}: ${diagnosis}`,
    playerId,
  });

  res.status(201).json(record);
});

// GET /api/physical-tests?playerId=... -> resultados de tests fisicos
// (peso, grasa corporal, velocidad, salto, etc.), mas reciente primero.
physicalTestsRouter.get("/", requireModule("fisico_medico", "read"), (req, res) => {
  const playerId = typeof req.query.playerId === "string" ? req.query.playerId : undefined;
  res.json(listPhysicalTests(playerId));
});

// POST /api/physical-tests -> carga un resultado de test fisico. Mismo
// sector que los partes medicos.
physicalTestsRouter.post("/", requireModule("fisico_medico", "write"), (req, res) => {
  const { playerId, date, testType, value, unit, notes } = req.body ?? {};

  if (!playerId || !date || !testType || value === undefined || value === null || !unit) {
    return res.status(400).json({ error: "Faltan campos obligatorios (playerId, date, testType, value, unit)" });
  }

  const player = getPlayerById(playerId);
  if (!player) return res.status(404).json({ error: "Jugador no encontrado" });

  const test = createPhysicalTest({
    playerId,
    date,
    testType,
    value: Number(value),
    unit,
    notes,
    createdById: req.user!.userId,
  });

  createActivityLog({
    type: "MEDICO",
    message: `Nuevo test fisico de ${player.firstName} ${player.lastName}: ${testType} ${value}${unit}`,
    playerId,
  });

  res.status(201).json(test);
});
