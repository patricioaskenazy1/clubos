import { finishRun, PlayerMatchInput, replaceMatchDetail, ShotInput, startRun, updateRun, upsertCompetition, upsertMatch } from "./store";

// Conector de StatsBomb Open Data: datos de partidos con eventos, gratis,
// publicados por StatsBomb en GitHub. Condicion de uso (a confirmar leyendo
// su acuerdo de usuario, doc/LICENSE.pdf del repositorio): si se publica o
// distribuye algo basado en estos datos hay que acreditar a StatsBomb. Por
// eso la fuente queda guardada en cada fila y la pantalla de Fuentes
// muestra la atribucion. La cobertura de Argentina es muy limitada: sirve
// para armar y probar los modulos de analisis, no para el scouting local.

export const STATSBOMB_SOURCE = "statsbomb-open";
export const STATSBOMB_ATTRIBUTION = "Datos: StatsBomb (open data)";

function baseUrl(): string {
  return (process.env.STATSBOMB_OPEN_DATA_BASE || "https://raw.githubusercontent.com/statsbomb/open-data/master/data").replace(/\/$/, "");
}

async function getJson<T>(path: string, attempts = 3): Promise<T> {
  const url = `${baseUrl()}/${path}`;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} al pedir ${path}`);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// ---------- Tipos minimos de lo que usamos del JSON de StatsBomb ----------

interface SbCompetition {
  competition_id: number;
  season_id: number;
  country_name: string;
  competition_name: string;
  competition_gender?: string;
  season_name: string;
}

interface SbMatch {
  match_id: number;
  match_date?: string;
  home_team: { home_team_name: string };
  away_team: { away_team_name: string };
  home_score?: number | null;
  away_score?: number | null;
  competition_stage?: { name: string };
}

interface SbPosition {
  position: string;
  from: string | null;
  to: string | null;
}

interface SbLineupTeam {
  team_name: string;
  lineup: { player_id: number; player_name: string; jersey_number?: number; positions: SbPosition[] }[];
}

interface SbEvent {
  period: number;
  minute: number;
  type: { name: string };
  team?: { name: string };
  player?: { id: number; name: string };
  location?: [number, number];
  shot?: { statsbomb_xg?: number; outcome?: { name: string }; body_part?: { name: string } };
  pass?: { goal_assist?: boolean };
}

export interface SbCatalogEntry {
  externalId: string; // "competitionId:seasonId"
  name: string;
  season: string;
  country: string;
}

export async function fetchCatalog(): Promise<SbCatalogEntry[]> {
  const list = await getJson<SbCompetition[]>("competitions.json");
  return list
    .map((c) => ({
      externalId: `${c.competition_id}:${c.season_id}`,
      name: c.competition_name + (c.competition_gender && c.competition_gender !== "male" ? ` (${c.competition_gender})` : ""),
      season: c.season_name,
      country: c.country_name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || b.season.localeCompare(a.season));
}

// "45:00" -> 45 (minutos de reloj de partido)
function clockMinutes(value: string | null): number | null {
  if (!value) return null;
  const [m, s] = value.split(":").map(Number);
  if (Number.isNaN(m)) return null;
  return m + (Number.isNaN(s) ? 0 : s / 60);
}

// Convierte lineup + eventos de un partido en filas por jugador y tiros.
// Se exporta para poder probarlo sin red.
export function buildMatchDetail(lineups: SbLineupTeam[], events: SbEvent[]): { players: PlayerMatchInput[]; shots: ShotInput[] } {
  const regular = events.filter((e) => e.period <= 4); // se excluye la tanda de penales (periodo 5)
  const matchLength = Math.max(90, ...regular.map((e) => e.minute));

  const goals = new Map<number, number>();
  const assists = new Map<number, number>();
  const shotCount = new Map<number, number>();
  const xgSum = new Map<number, number>();
  const shots: ShotInput[] = [];

  for (const e of regular) {
    if (e.type.name === "Shot" && e.shot) {
      const xg = e.shot.statsbomb_xg ?? 0;
      shots.push({
        minute: e.minute,
        teamName: e.team?.name ?? null,
        playerName: e.player?.name ?? null,
        x: e.location?.[0] ?? null,
        y: e.location?.[1] ?? null,
        xg: Math.round(xg * 1000) / 1000,
        outcome: e.shot.outcome?.name ?? null,
        bodyPart: e.shot.body_part?.name ?? null,
      });
      if (e.player) {
        shotCount.set(e.player.id, (shotCount.get(e.player.id) ?? 0) + 1);
        xgSum.set(e.player.id, (xgSum.get(e.player.id) ?? 0) + xg);
        if (e.shot.outcome?.name === "Goal") goals.set(e.player.id, (goals.get(e.player.id) ?? 0) + 1);
      }
    }
    if (e.type.name === "Pass" && e.pass?.goal_assist && e.player) {
      assists.set(e.player.id, (assists.get(e.player.id) ?? 0) + 1);
    }
  }

  const players: PlayerMatchInput[] = [];
  for (const team of lineups) {
    for (const p of team.lineup) {
      if (!p.positions || p.positions.length === 0) continue; // no entro a la cancha
      let minutes = 0;
      for (const pos of p.positions) {
        const from = clockMinutes(pos.from) ?? 0;
        const to = clockMinutes(pos.to) ?? matchLength;
        minutes += Math.max(0, to - from);
      }
      players.push({
        teamName: team.team_name,
        playerExternalId: String(p.player_id),
        playerName: p.player_name,
        position: p.positions[0]?.position ?? null,
        jersey: p.jersey_number ?? null,
        minutes: Math.round(minutes),
        goals: goals.get(p.player_id) ?? 0,
        assists: assists.get(p.player_id) ?? 0,
        shots: shotCount.get(p.player_id) ?? 0,
        xg: Math.round((xgSum.get(p.player_id) ?? 0) * 100) / 100,
      });
    }
  }
  return { players, shots };
}

// Importa una competicion-temporada: primero el listado de partidos
// (rapido), y despues, partido por partido, jugadores y tiros. Corre en
// segundo plano; el avance se ve en import_runs.
export async function importCompetition(opts: { externalId: string; maxMatches: number; userId: string | null }): Promise<string> {
  const [competitionId, seasonId] = opts.externalId.split(":");
  if (!competitionId || !seasonId) throw new Error("Identificador de competicion invalido");

  const catalog = await fetchCatalog();
  const entry = catalog.find((c) => c.externalId === opts.externalId);
  if (!entry) throw new Error("Esa competicion no esta en el catalogo abierto de StatsBomb");

  const matches = await getJson<SbMatch[]>(`matches/${competitionId}/${seasonId}.json`);
  const dbCompetitionId = upsertCompetition({
    source: STATSBOMB_SOURCE,
    externalId: opts.externalId,
    name: entry.name,
    season: entry.season,
    country: entry.country,
  });

  const selected = [...matches]
    .sort((a, b) => (b.match_date ?? "").localeCompare(a.match_date ?? ""))
    .slice(0, opts.maxMatches);

  const runId = startRun(STATSBOMB_SOURCE, `${entry.name} ${entry.season}`, selected.length, opts.userId);

  // Se procesa en segundo plano: el pedido HTTP responde enseguida con el runId.
  void (async () => {
    let done = 0;
    let failed = 0;
    try {
      const queue = [...selected];
      const worker = async () => {
        while (queue.length > 0) {
          const m = queue.shift()!;
          try {
            const stored = upsertMatch({
              source: STATSBOMB_SOURCE,
              externalId: String(m.match_id),
              competitionId: dbCompetitionId,
              date: m.match_date ?? null,
              homeTeam: m.home_team.home_team_name,
              awayTeam: m.away_team.away_team_name,
              homeScore: m.home_score ?? null,
              awayScore: m.away_score ?? null,
              stage: m.competition_stage?.name ?? null,
            });
            const [lineups, events] = await Promise.all([
              getJson<SbLineupTeam[]>(`lineups/${m.match_id}.json`),
              getJson<SbEvent[]>(`events/${m.match_id}.json`),
            ]);
            const detail = buildMatchDetail(lineups, events);
            replaceMatchDetail(stored.id, detail.players, detail.shots);
          } catch {
            failed++;
          }
          done++;
          updateRun(runId, done);
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      finishRun(
        runId,
        failed === selected.length && selected.length > 0 ? "ERROR" : "DONE",
        failed > 0 ? `${selected.length - failed} partidos importados, ${failed} con error` : `${selected.length} partidos importados`
      );
    } catch (err) {
      finishRun(runId, "ERROR", err instanceof Error ? err.message : "Error desconocido");
    }
  })();

  return runId;
}
