import { finishRun, startRun, upsertCompetition, upsertMatch } from "./store";

// Conector de API-Football (api-sports.io), plan gratuito: 100 pedidos por
// dia. Un fixture list de una liga-temporada es UN pedido, asi que alcanza
// para traer resultados y calendario de varias ligas por dia. El detalle por
// jugador cuesta un pedido por partido y no entra en el plan gratuito, por
// eso aca solo importamos partidos y resultados (detailLevel BASIC).
//
// Pendiente de confirmar con una clave real: que ligas y temporadas abre el
// plan gratuito (los articulos del proveedor dicen "temporadas recientes",
// sin precisar) y los terminos de uso comercial. Cualquier restriccion de
// plan llega en body.errors y se la mostramos tal cual al usuario.

export const API_FOOTBALL_SOURCE = "api-football";
export const API_FOOTBALL_ATTRIBUTION = "Datos: API-Football";

const BASE = (process.env.API_FOOTBALL_BASE || "https://v3.football.api-sports.io").replace(/\/$/, "");

export function apiFootballConfigured(): boolean {
  return !!process.env.API_FOOTBALL_KEY;
}

interface ApiEnvelope<T> {
  errors?: unknown;
  response?: T[];
}

interface CallResult<T> {
  response: T[];
  remaining: string | null;
}

async function call<T>(path: string): Promise<CallResult<T>> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("Falta configurar la variable API_FOOTBALL_KEY en el servidor");
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": key },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`API-Football respondio HTTP ${res.status}`);
  const body = (await res.json()) as ApiEnvelope<T>;
  // La API devuelve errors como [] cuando no hay problema y como objeto
  // {campo: mensaje} cuando hay uno (plan, limite diario, parametro invalido).
  const errs = body.errors;
  const hasErrors = Array.isArray(errs) ? errs.length > 0 : !!errs && Object.keys(errs as object).length > 0;
  if (hasErrors) {
    const text = Array.isArray(errs) ? errs.join("; ") : Object.values(errs as Record<string, string>).join("; ");
    throw new Error(`API-Football: ${text}`);
  }
  return { response: body.response ?? [], remaining: res.headers.get("x-ratelimit-requests-remaining") };
}

interface LeagueItem {
  league: { id: number; name: string; type: string };
  country: { name: string };
  seasons: { year: number; current: boolean }[];
}

export interface AfCatalogEntry {
  externalId: string; // "leagueId:season"
  name: string;
  season: string;
  country: string;
}

// Catalogo de ligas de un pais (un pedido).
export async function fetchCatalog(country: string): Promise<AfCatalogEntry[]> {
  const { response } = await call<LeagueItem>(`/leagues?country=${encodeURIComponent(country)}`);
  const out: AfCatalogEntry[] = [];
  for (const item of response) {
    if (item.league.type !== "League") continue;
    for (const s of item.seasons) {
      out.push({
        externalId: `${item.league.id}:${s.year}`,
        name: item.league.name,
        season: String(s.year),
        country: item.country.name,
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name) || b.season.localeCompare(a.season));
}

interface FixtureItem {
  fixture: { id: number; date: string };
  league: { id: number; name: string; season: number; round?: string; country?: string };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
}

export async function importFixtures(opts: { externalId: string; userId: string | null }): Promise<string> {
  const [leagueId, season] = opts.externalId.split(":");
  if (!leagueId || !season) throw new Error("Identificador de liga invalido");

  const runId = startRun(API_FOOTBALL_SOURCE, `Liga ${leagueId} temporada ${season}`, null, opts.userId);
  try {
    const { response, remaining } = await call<FixtureItem>(`/fixtures?league=${leagueId}&season=${season}`);
    if (response.length === 0) {
      finishRun(runId, "ERROR", "La API no devolvio partidos para esa liga y temporada (puede que el plan gratuito no la incluya)");
      return runId;
    }
    const first = response[0];
    const competitionId = upsertCompetition({
      source: API_FOOTBALL_SOURCE,
      externalId: opts.externalId,
      name: first.league.name,
      season,
      country: first.league.country ?? null,
    });
    for (const f of response) {
      upsertMatch({
        source: API_FOOTBALL_SOURCE,
        externalId: String(f.fixture.id),
        competitionId,
        date: f.fixture.date ? f.fixture.date.slice(0, 10) : null,
        homeTeam: f.teams.home.name,
        awayTeam: f.teams.away.name,
        homeScore: f.goals.home,
        awayScore: f.goals.away,
        stage: f.league.round ?? null,
      });
    }
    finishRun(
      runId,
      "DONE",
      `${response.length} partidos importados` + (remaining ? `. Pedidos restantes hoy: ${remaining}` : "")
    );
  } catch (err) {
    finishRun(runId, "ERROR", err instanceof Error ? err.message : "Error desconocido");
  }
  return runId;
}
