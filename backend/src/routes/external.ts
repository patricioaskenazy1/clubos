import { NextFunction, Request, Response, Router } from "express";
import { createActivityLog, createPlayer, db } from "../db";
import { requireAuth, requireModule } from "../middleware/auth";
import { canRead } from "../permissions";
import { API_FOOTBALL_ATTRIBUTION, API_FOOTBALL_SOURCE, apiFootballConfigured, fetchCatalog as afCatalog, importFixtures } from "../ingest/apifootball";
import { fetchCatalog as sbCatalog, importCompetition, STATSBOMB_ATTRIBUTION, STATSBOMB_SOURCE } from "../ingest/statsbomb";
import { getExtMatch, listExtCompetitions, listExtMatches, listRuns, rankExtPlayers } from "../ingest/store";

export const externalRouter = Router();

externalRouter.use(requireAuth);

// Los datos externos (rivales, ligas, rankings de jugadores) los usan tanto
// el cuerpo tecnico (Data) como los scouts (Scouting). No tienen datos
// sensibles del club, pero igual no quedan abiertos a cualquier rol: hace
// falta lectura de alguno de esos dos sectores.
function requireExternalRead(req: Request, res: Response, next: NextFunction) {
  const role = req.user?.role ?? "";
  if (canRead(role, "data") || canRead(role, "scouting")) return next();
  return res.status(403).json({ error: "No tenes acceso a este sector de la plataforma" });
}

// Traer datos de afuera consume cuota de proveedores y escribe en la base,
// asi que lo hace quien carga datos (Data analyst); el scout solo consulta.
const requireImport = requireModule("data", "write");

externalRouter.get("/sources", requireExternalRead, (_req, res) => {
  res.json([
    {
      key: STATSBOMB_SOURCE,
      label: "StatsBomb Open Data",
      attribution: STATSBOMB_ATTRIBUTION,
      configured: true,
      coverage: "Partidos con eventos (tiros, xG, minutos). Gratis; cobertura de Argentina muy limitada.",
    },
    {
      key: API_FOOTBALL_SOURCE,
      label: "API-Football (plan gratuito)",
      attribution: API_FOOTBALL_ATTRIBUTION,
      configured: apiFootballConfigured(),
      coverage: "Calendario y resultados de ligas, incluidas las argentinas. 100 pedidos por dia. Requiere una clave gratuita.",
    },
  ]);
});

externalRouter.get("/competitions", requireExternalRead, (_req, res) => {
  res.json(listExtCompetitions());
});

externalRouter.get("/competitions/:id/matches", requireExternalRead, (req, res) => {
  res.json(listExtMatches(req.params.id));
});

externalRouter.get("/competitions/:id/players", requireExternalRead, (req, res) => {
  res.json(rankExtPlayers(req.params.id));
});

externalRouter.get("/matches/:id", requireExternalRead, (req, res) => {
  const match = getExtMatch(req.params.id);
  if (!match) return res.status(404).json({ error: "Partido no encontrado" });
  res.json(match);
});

externalRouter.get("/runs", requireExternalRead, (_req, res) => {
  res.json(listRuns());
});

// GET /api/external/catalog/:source -> que se puede importar de esa fuente.
externalRouter.get("/catalog/:source", requireImport, async (req, res) => {
  try {
    if (req.params.source === STATSBOMB_SOURCE) return res.json(await sbCatalog());
    if (req.params.source === API_FOOTBALL_SOURCE) {
      const country = typeof req.query.country === "string" && req.query.country ? req.query.country : "Argentina";
      return res.json(await afCatalog(country));
    }
    return res.status(404).json({ error: "Fuente desconocida" });
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : "No se pudo consultar la fuente" });
  }
});

// POST /api/external/import { source, externalId, maxMatches? } -> arranca la
// importacion y devuelve el id de la corrida; el avance se consulta en /runs.
externalRouter.post("/import", requireImport, async (req, res) => {
  const { source, externalId, maxMatches } = req.body ?? {};
  if (typeof source !== "string" || typeof externalId !== "string") {
    return res.status(400).json({ error: "Faltan campos obligatorios (source, externalId)" });
  }
  const running = db.prepare("SELECT COUNT(*) as c FROM import_runs WHERE status = 'RUNNING'").get() as { c: number };
  if (running.c > 0) {
    return res.status(409).json({ error: "Ya hay una importacion en curso, espera a que termine" });
  }
  try {
    const userId = req.user!.userId;
    let runId: string;
    if (source === STATSBOMB_SOURCE) {
      const limit = Math.min(Math.max(Number(maxMatches) || 30, 1), 400);
      runId = await importCompetition({ externalId, maxMatches: limit, userId });
    } else if (source === API_FOOTBALL_SOURCE) {
      runId = await importFixtures({ externalId, userId });
    } else {
      return res.status(404).json({ error: "Fuente desconocida" });
    }
    createActivityLog({ type: "DATA", message: `Se inicio una importacion de datos externos (${source})` });
    return res.status(202).json({ runId });
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : "No se pudo importar" });
  }
});

// ---------- De dato externo a candidato de Scouting ----------

function mapPosition(sb: string | null | undefined): string {
  const p = (sb ?? "").toLowerCase();
  if (p.includes("goalkeeper")) return "Arquero";
  if (p.includes("wing back") || (p.endsWith("back") && !p.includes("center"))) return "Lateral";
  if (p.includes("back")) return "Defensor";
  if (p.includes("wing")) return "Extremo";
  if (p.includes("midfield")) return "Mediocampista";
  if (p.includes("forward") || p.includes("striker")) return "Delantero";
  return sb || "Sin posicion";
}

// POST /api/external/promote { playerExternalId, playerName, teamName, position, competition }
// Crea un candidato en Scouting a partir de un jugador del ranking externo.
externalRouter.post("/promote", requireModule("scouting", "write"), (req, res) => {
  const { playerName, teamName, position, competition } = req.body ?? {};
  if (typeof playerName !== "string" || !playerName.trim()) {
    return res.status(400).json({ error: "Falta el nombre del jugador" });
  }
  const parts = playerName.trim().split(/\s+/);
  const firstName = parts.length > 1 ? parts[0] : "-";
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : parts[0];

  const dup = db
    .prepare("SELECT id FROM players WHERE lower(firstName) = lower(?) AND lower(lastName) = lower(?)")
    .get(firstName, lastName) as { id: string } | undefined;
  if (dup) return res.status(409).json({ error: "Ya existe un jugador con ese nombre en ClubOS", playerId: dup.id });

  const player = createPlayer({
    firstName,
    lastName,
    position: mapPosition(position),
    status: "CANDIDATE",
    originNotes: `Importado de datos externos${teamName ? `. Equipo: ${teamName}` : ""}${competition ? `. Competicion: ${competition}` : ""}`,
  });
  createActivityLog({
    type: "SCOUTING",
    message: `Se agrego a ${player.firstName} ${player.lastName} como candidato desde datos externos`,
    playerId: player.id,
  });
  return res.status(201).json(player);
});
