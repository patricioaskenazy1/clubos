import { db, newId } from "../db";

// Capa de almacenamiento de datos externos. Los conectores (statsbomb.ts,
// apifootball.ts) traducen lo que devuelve cada proveedor a estas funciones,
// asi el resto de la app nunca depende del formato de un proveedor.

export interface ExtCompetitionRow {
  id: string;
  source: string;
  externalId: string;
  name: string;
  season: string;
  country: string | null;
  matchCount?: number;
}

export interface ExtMatchRow {
  id: string;
  source: string;
  externalId: string;
  competitionId: string;
  date: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  stage: string | null;
  detailLevel: string;
}

export interface ImportRunRow {
  id: string;
  source: string;
  scope: string;
  status: "RUNNING" | "DONE" | "ERROR";
  itemsDone: number;
  itemsTotal: number | null;
  message: string | null;
  startedById: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export function upsertCompetition(c: { source: string; externalId: string; name: string; season: string; country?: string | null }): string {
  const existing = db
    .prepare("SELECT id FROM ext_competitions WHERE source = ? AND externalId = ?")
    .get(c.source, c.externalId) as { id: string } | undefined;
  if (existing) {
    db.prepare("UPDATE ext_competitions SET name = ?, season = ?, country = ? WHERE id = ?").run(
      c.name,
      c.season,
      c.country ?? null,
      existing.id
    );
    return existing.id;
  }
  const id = newId();
  db.prepare(
    "INSERT INTO ext_competitions (id, source, externalId, name, season, country) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, c.source, c.externalId, c.name, c.season, c.country ?? null);
  return id;
}

export function upsertMatch(m: {
  source: string;
  externalId: string;
  competitionId: string;
  date?: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number | null;
  awayScore?: number | null;
  stage?: string | null;
}): { id: string; detailLevel: string } {
  const existing = db
    .prepare("SELECT id, detailLevel FROM ext_matches WHERE source = ? AND externalId = ?")
    .get(m.source, m.externalId) as { id: string; detailLevel: string } | undefined;
  if (existing) {
    db.prepare(
      "UPDATE ext_matches SET date = ?, homeTeam = ?, awayTeam = ?, homeScore = ?, awayScore = ?, stage = ? WHERE id = ?"
    ).run(m.date ?? null, m.homeTeam, m.awayTeam, m.homeScore ?? null, m.awayScore ?? null, m.stage ?? null, existing.id);
    return existing;
  }
  const id = newId();
  db.prepare(
    `INSERT INTO ext_matches (id, source, externalId, competitionId, date, homeTeam, awayTeam, homeScore, awayScore, stage)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, m.source, m.externalId, m.competitionId, m.date ?? null, m.homeTeam, m.awayTeam, m.homeScore ?? null, m.awayScore ?? null, m.stage ?? null);
  return { id, detailLevel: "BASIC" };
}

export interface PlayerMatchInput {
  teamName: string;
  playerExternalId: string;
  playerName: string;
  position: string | null;
  jersey: number | null;
  minutes: number | null;
  goals: number;
  assists: number;
  shots: number;
  xg: number;
}

export interface ShotInput {
  minute: number | null;
  teamName: string | null;
  playerName: string | null;
  x: number | null;
  y: number | null;
  xg: number | null;
  outcome: string | null;
  bodyPart: string | null;
}

// Reemplaza el detalle de un partido (jugadores + tiros) de una sola vez,
// dentro de una transaccion: si se reimporta, no queda nada duplicado.
export const replaceMatchDetail = db.transaction((matchId: string, players: PlayerMatchInput[], shots: ShotInput[]) => {
  db.prepare("DELETE FROM ext_player_matches WHERE matchId = ?").run(matchId);
  db.prepare("DELETE FROM ext_shots WHERE matchId = ?").run(matchId);
  const insPlayer = db.prepare(
    `INSERT INTO ext_player_matches (id, matchId, teamName, playerExternalId, playerName, position, jersey, minutes, goals, assists, shots, xg)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const p of players) {
    insPlayer.run(newId(), matchId, p.teamName, p.playerExternalId, p.playerName, p.position, p.jersey, p.minutes, p.goals, p.assists, p.shots, p.xg);
  }
  const insShot = db.prepare(
    `INSERT INTO ext_shots (id, matchId, minute, teamName, playerName, x, y, xg, outcome, bodyPart)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const s of shots) {
    insShot.run(newId(), matchId, s.minute, s.teamName, s.playerName, s.x, s.y, s.xg, s.outcome, s.bodyPart);
  }
  db.prepare("UPDATE ext_matches SET detailLevel = 'EVENTS' WHERE id = ?").run(matchId);
});

// ---------- Consultas para la UI ----------

export function listExtCompetitions(): ExtCompetitionRow[] {
  return db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM ext_matches m WHERE m.competitionId = c.id) as matchCount
       FROM ext_competitions c ORDER BY c.name ASC, c.season DESC`
    )
    .all() as ExtCompetitionRow[];
}

export function listExtMatches(competitionId: string): ExtMatchRow[] {
  return db
    .prepare("SELECT * FROM ext_matches WHERE competitionId = ? ORDER BY date DESC, id")
    .all(competitionId) as ExtMatchRow[];
}

export function getExtMatch(id: string) {
  const match = db.prepare("SELECT * FROM ext_matches WHERE id = ?").get(id) as ExtMatchRow | undefined;
  if (!match) return undefined;
  const players = db
    .prepare("SELECT * FROM ext_player_matches WHERE matchId = ? ORDER BY teamName, COALESCE(jersey, 99)")
    .all(id);
  const shots = db.prepare("SELECT * FROM ext_shots WHERE matchId = ? ORDER BY minute").all(id);
  return { ...match, players, shots };
}

export interface ExtPlayerRankRow {
  playerExternalId: string;
  playerName: string;
  teamName: string;
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  xg: number;
}

// Ranking de jugadores de una competicion, agregando todos los partidos
// con detalle. Es el insumo para buscar candidatos para Scouting.
export function rankExtPlayers(competitionId: string, limit = 50): ExtPlayerRankRow[] {
  return db
    .prepare(
      `SELECT pm.playerExternalId, pm.playerName, MAX(pm.teamName) as teamName,
         COUNT(*) as matches, COALESCE(SUM(pm.minutes), 0) as minutes,
         SUM(pm.goals) as goals, SUM(pm.assists) as assists, SUM(pm.shots) as shots,
         ROUND(SUM(pm.xg), 2) as xg
       FROM ext_player_matches pm
       JOIN ext_matches m ON m.id = pm.matchId
       WHERE m.competitionId = ?
       GROUP BY pm.playerExternalId, pm.playerName
       ORDER BY goals DESC, xg DESC, assists DESC
       LIMIT ?`
    )
    .all(competitionId, limit) as ExtPlayerRankRow[];
}

// ---------- Corridas de importacion ----------

export function startRun(source: string, scope: string, total: number | null, userId: string | null): string {
  const id = newId();
  db.prepare("INSERT INTO import_runs (id, source, scope, status, itemsTotal, startedById) VALUES (?, ?, ?, 'RUNNING', ?, ?)").run(
    id,
    source,
    scope,
    total,
    userId
  );
  return id;
}

export function updateRun(id: string, done: number, total?: number | null) {
  if (total !== undefined) {
    db.prepare("UPDATE import_runs SET itemsDone = ?, itemsTotal = ? WHERE id = ?").run(done, total, id);
  } else {
    db.prepare("UPDATE import_runs SET itemsDone = ? WHERE id = ?").run(done, id);
  }
}

export function finishRun(id: string, status: "DONE" | "ERROR", message: string | null) {
  db.prepare("UPDATE import_runs SET status = ?, message = ?, finishedAt = datetime('now') WHERE id = ?").run(status, message, id);
}

export function listRuns(limit = 15): ImportRunRow[] {
  return db.prepare("SELECT * FROM import_runs ORDER BY startedAt DESC, rowid DESC LIMIT ?").all(limit) as ImportRunRow[];
}

// Si el servidor se reinicia a mitad de una importacion, la corrida queda
// "RUNNING" para siempre; al arrancar las marcamos como interrumpidas.
export function failStaleRuns() {
  db.prepare(
    "UPDATE import_runs SET status = 'ERROR', message = 'Interrumpida por un reinicio del servidor', finishedAt = datetime('now') WHERE status = 'RUNNING'"
  ).run();
}
