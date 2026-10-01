import { Router } from "express";
import {
  createActivityLog,
  createPlayer,
  getPlayerById,
  listMedicalRecords,
  listPhysicalTests,
  listPlayerAttendance,
  listPlayers,
  listPlayerStats,
  listScoutingReports,
  updatePlayer,
} from "../db";
import { requireAuth, requireModule } from "../middleware/auth";
import { canRead } from "../permissions";

export const playersRouter = Router();

playersRouter.use(requireAuth);

// GET /api/players?status=SQUAD|CANDIDATE -> lo usan casi todos los modulos
// (para elegir jugador en un formulario), asi que queda abierto a cualquier
// usuario autenticado. Lo que SI se filtra son los campos de gestion
// (contrato, valor de mercado): solo se mandan si el rol puede leer ese
// sector -- el resto ve nombre, posicion y club de origen, nada de plata.
playersRouter.get("/", (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const canSeeGestion = canRead(req.user!.role, "gestion");
  const players = listPlayers(status).map((p) => {
    if (canSeeGestion) return p;
    const { contractUntil, marketValueUsd, ...rest } = p;
    return rest;
  });
  res.json(players);
});

// GET /api/players/:id -> la "ficha unica" junta en una sola respuesta lo que
// en la mayoria de las plataformas vive en sistemas separados. Pero cada
// seccion se manda solo si el rol que pide tiene lectura de ese sector: un
// preparador fisico no recibe informes de scouting en la respuesta, no es
// solo que la pantalla no los muestre.
playersRouter.get("/:id", (req, res) => {
  const player = getPlayerById(req.params.id);
  if (!player) return res.status(404).json({ error: "Jugador no encontrado" });

  const role = req.user!.role;
  const response: Record<string, unknown> = { ...player };

  if (!canRead(role, "gestion")) {
    delete response.contractUntil;
    delete response.marketValueUsd;
  }
  if (canRead(role, "scouting")) response.scoutingReports = listScoutingReports(player.id);
  if (canRead(role, "entrenamientos")) response.trainingAttendance = listPlayerAttendance(player.id);
  if (canRead(role, "data")) response.playerStats = listPlayerStats(player.id);
  if (canRead(role, "fisico_medico")) {
    response.medicalRecords = listMedicalRecords(player.id);
    response.physicalTests = listPhysicalTests(player.id);
  }

  res.json(response);
});

// POST /api/players -> solo gestion puede dar de alta jugadores.
playersRouter.post("/", requireModule("gestion", "write"), (req, res) => {
  const { firstName, lastName, position, status, nationality, dorsal, contractUntil, marketValueUsd, originNotes } =
    req.body ?? {};

  if (!firstName || !lastName || !position || !status) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  const player = createPlayer({
    firstName,
    lastName,
    position,
    status,
    nationality,
    dorsal: dorsal ? Number(dorsal) : undefined,
    contractUntil: contractUntil || undefined,
    marketValueUsd: marketValueUsd ? Number(marketValueUsd) : undefined,
    originNotes,
  });

  createActivityLog({
    type: "GESTION",
    message: `Se agrego a ${player.firstName} ${player.lastName} (${status === "SQUAD" ? "plantel" : "candidato"})`,
    playerId: player.id,
  });

  res.status(201).json(player);
});

// PATCH /api/players/:id -> por ejemplo, promover un candidato a plantel.
playersRouter.patch("/:id", requireModule("gestion", "write"), (req, res) => {
  const existing = getPlayerById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Jugador no encontrado" });

  const data = req.body ?? {};
  const player = updatePlayer(req.params.id, data);

  if (data.status && data.status !== existing.status && player) {
    createActivityLog({
      type: "GESTION",
      message: `${player.firstName} ${player.lastName} paso a ${player.status === "SQUAD" ? "plantel" : "candidato"}`,
      playerId: player.id,
    });
  }

  res.json(player);
});
