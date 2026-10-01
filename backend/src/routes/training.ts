import { Router } from "express";
import {
  createActivityLog,
  createTrainingSession,
  getPlayerById,
  getTrainingSessionById,
  listSessionAttendance,
  listTrainingSessions,
  upsertAttendance,
} from "../db";
import { requireAuth, requireModule } from "../middleware/auth";

export const trainingRouter = Router();

trainingRouter.use(requireAuth);

// GET /api/training-sessions -> calendario de sesiones, mas reciente primero.
trainingRouter.get("/", requireModule("entrenamientos", "read"), (_req, res) => {
  res.json(listTrainingSessions());
});

// GET /api/training-sessions/:id -> la sesion con la asistencia cargada.
trainingRouter.get("/:id", requireModule("entrenamientos", "read"), (req, res) => {
  const session = getTrainingSessionById(req.params.id);
  if (!session) return res.status(404).json({ error: "Sesion no encontrada" });
  const attendance = listSessionAttendance(session.id);
  res.json({ ...session, attendance });
});

// POST /api/training-sessions -> agenda una sesion nueva. Lo carga el
// cuerpo tecnico.
trainingRouter.post("/", requireModule("entrenamientos", "write"), (req, res) => {
  const { date, title, sessionType, notes } = req.body ?? {};

  if (!date || !title || !sessionType) {
    return res.status(400).json({ error: "Faltan campos obligatorios (date, title, sessionType)" });
  }

  const session = createTrainingSession({
    date,
    title,
    sessionType,
    notes,
    createdById: req.user!.userId,
  });

  createActivityLog({
    type: "ENTRENAMIENTO",
    message: `Se agendo la sesion "${session.title}" (${session.sessionType})`,
  });

  res.status(201).json(session);
});

// POST /api/training-sessions/:id/attendance -> marca o actualiza la
// asistencia de un jugador para esa sesion (presente/ausente/lesionado +
// carga de esfuerzo), lo que despues se ve tambien en su ficha.
trainingRouter.post("/:id/attendance", requireModule("entrenamientos", "write"), (req, res) => {
  const session = getTrainingSessionById(req.params.id);
  if (!session) return res.status(404).json({ error: "Sesion no encontrada" });

  const { playerId, status, load, note } = req.body ?? {};
  if (!playerId || !status) {
    return res.status(400).json({ error: "Faltan campos obligatorios (playerId, status)" });
  }

  const player = getPlayerById(playerId);
  if (!player) return res.status(404).json({ error: "Jugador no encontrado" });

  const attendance = upsertAttendance({
    sessionId: session.id,
    playerId,
    status,
    load: load !== undefined && load !== null && load !== "" ? Number(load) : undefined,
    note,
    createdById: req.user!.userId,
  });

  res.status(201).json(attendance);
});
