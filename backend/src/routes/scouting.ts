import { Router } from "express";
import { createActivityLog, createScoutingReport, getPlayerById, listScoutingReports } from "../db";
import { requireAuth, requireModule } from "../middleware/auth";

export const scoutingRouter = Router();

scoutingRouter.use(requireAuth);

// GET /api/scouting-reports?playerId=... -> solo lo ve quien tiene Scouting
// habilitado (scout o admin).
scoutingRouter.get("/", requireModule("scouting", "read"), (req, res) => {
  const playerId = typeof req.query.playerId === "string" ? req.query.playerId : undefined;
  res.json(listScoutingReports(playerId));
});

// POST /api/scouting-reports -> lo cargan scouts (o admin); queda linkeado a
// la ficha del jugador y dispara un evento en el feed de actividad del club.
scoutingRouter.post("/", requireModule("scouting", "write"), (req, res) => {
  const { playerId, matchInfo, rating, strengths, weaknesses, recommendation } = req.body ?? {};

  if (!playerId || !rating) {
    return res.status(400).json({ error: "Faltan campos obligatorios (playerId, rating)" });
  }

  const player = getPlayerById(playerId);
  if (!player) return res.status(404).json({ error: "Jugador no encontrado" });

  const report = createScoutingReport({
    playerId,
    authorId: req.user!.userId,
    matchInfo,
    rating: Number(rating),
    strengths,
    weaknesses,
    recommendation,
  });

  createActivityLog({
    type: "SCOUTING",
    message: `Nuevo informe de scouting sobre ${player.firstName} ${player.lastName}`,
    playerId,
  });

  res.status(201).json(report);
});
