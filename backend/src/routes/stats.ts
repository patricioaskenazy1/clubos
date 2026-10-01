import { Router } from "express";
import { createActivityLog, createPlayerStat, getPlayerById, listPlayerStats, squadStatsSummary } from "../db";
import { requireAuth, requireModule } from "../middleware/auth";

export const statsRouter = Router();

statsRouter.use(requireAuth);

// GET /api/player-stats/summary -> tabla agregada del plantel (goles,
// asistencias, rating promedio), lo que se ve arriba de la pantalla de
// Data analyst. Va antes de /:id para no chocar con esa ruta.
statsRouter.get("/summary", requireModule("data", "read"), (_req, res) => {
  res.json(squadStatsSummary());
});

// GET /api/player-stats?playerId=... -> partido a partido.
statsRouter.get("/", requireModule("data", "read"), (req, res) => {
  const playerId = typeof req.query.playerId === "string" ? req.query.playerId : undefined;
  res.json(listPlayerStats(playerId));
});

// POST /api/player-stats -> carga el rendimiento de un jugador en un
// partido. Lo carga el cuerpo tecnico.
statsRouter.post("/", requireModule("data", "write"), (req, res) => {
  const { playerId, date, matchInfo, minutesPlayed, goals, assists, rating } = req.body ?? {};

  if (!playerId || !date || !matchInfo) {
    return res.status(400).json({ error: "Faltan campos obligatorios (playerId, date, matchInfo)" });
  }

  const player = getPlayerById(playerId);
  if (!player) return res.status(404).json({ error: "Jugador no encontrado" });

  const stat = createPlayerStat({
    playerId,
    date,
    matchInfo,
    minutesPlayed: minutesPlayed !== undefined && minutesPlayed !== "" ? Number(minutesPlayed) : undefined,
    goals: goals !== undefined && goals !== "" ? Number(goals) : undefined,
    assists: assists !== undefined && assists !== "" ? Number(assists) : undefined,
    rating: rating !== undefined && rating !== "" ? Number(rating) : undefined,
    createdById: req.user!.userId,
  });

  createActivityLog({
    type: "DATA",
    message: `Se cargo el rendimiento de ${player.firstName} ${player.lastName} vs. ${matchInfo}`,
    playerId,
  });

  res.status(201).json(stat);
});
