import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ExtCatalogEntry, ExtCompetition, ExtMatch, ExtPlayerRank, ExtSource, ImportRun } from "../api";
import { useAuth } from "../AuthContext";
import { canWrite } from "../permissions";

export default function Fuentes() {
  const { user } = useAuth();
  const canImport = canWrite(user, "data");
  const canPromote = canWrite(user, "scouting");

  const [sources, setSources] = useState<ExtSource[]>([]);
  const [competitions, setCompetitions] = useState<ExtCompetition[]>([]);
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Importar
  const [sourceKey, setSourceKey] = useState("statsbomb-open");
  const [catalog, setCatalog] = useState<ExtCatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [maxMatches, setMaxMatches] = useState("30");
  const [importing, setImporting] = useState<string | null>(null);

  // Explorar
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"jugadores" | "partidos">("jugadores");
  const [ranking, setRanking] = useState<ExtPlayerRank[]>([]);
  const [matches, setMatches] = useState<ExtMatch[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const pollRef = useRef<number | null>(null);

  function loadCompetitions() {
    api.listExtCompetitions().then(setCompetitions).catch((e) => setError(e.message));
  }

  function loadRuns() {
    return api.listImportRuns().then((r) => {
      setRuns(r);
      return r;
    });
  }

  useEffect(() => {
    api.listExtSources().then(setSources).catch((e) => setError(e.message));
    loadCompetitions();
    loadRuns().catch(() => undefined);
  }, []);

  // Mientras haya una importacion corriendo, se consulta el avance cada 2 s.
  const anyRunning = runs.some((r) => r.status === "RUNNING");
  useEffect(() => {
    if (!anyRunning) return;
    pollRef.current = window.setInterval(() => {
      loadRuns()
        .then((r) => {
          if (!r.some((x) => x.status === "RUNNING")) loadCompetitions();
        })
        .catch(() => undefined);
    }, 2000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [anyRunning]);

  useEffect(() => {
    if (!selectedId) return;
    api.listExtPlayers(selectedId).then(setRanking).catch((e) => setError(e.message));
    api.listExtMatches(selectedId).then(setMatches).catch((e) => setError(e.message));
  }, [selectedId, competitions]);

  async function loadCatalog() {
    setCatalogLoading(true);
    setError(null);
    setCatalog([]);
    try {
      setCatalog(await api.extCatalog(sourceKey));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar la fuente");
    } finally {
      setCatalogLoading(false);
    }
  }

  async function startImport(entry: ExtCatalogEntry) {
    setImporting(entry.externalId);
    setError(null);
    try {
      await api.extImport({ source: sourceKey, externalId: entry.externalId, maxMatches: Number(maxMatches) || 30 });
      await loadRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar la importacion");
    } finally {
      setImporting(null);
    }
  }

  async function promote(p: ExtPlayerRank, competition: ExtCompetition) {
    setError(null);
    setNotice(null);
    try {
      const created = await api.promoteExtPlayer({
        playerName: p.playerName,
        teamName: p.teamName,
        competition: `${competition.name} ${competition.season}`,
      });
      setNotice(`${created.firstName} ${created.lastName} se agrego como candidato en Scouting.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar el jugador");
    }
  }

  const selected = competitions.find((c) => c.id === selectedId) ?? null;
  const currentSource = sources.find((s) => s.key === sourceKey);
  const filteredCatalog = catalog.filter((c) => `${c.name} ${c.season} ${c.country}`.toLowerCase().includes(filter.toLowerCase())).slice(0, 60);
  const attributionFor = (source: string) => sources.find((s) => s.key === source)?.attribution;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Fuentes de datos</h2>
      </div>

      {error && <p className="error-text">{error}</p>}
      {notice && <p className="hint-text" style={{ color: "var(--green)", marginBottom: 12 }}>{notice}</p>}

      <div className="two-col" style={{ marginBottom: 18 }}>
        {sources.map((s) => (
          <div className="card" key={s.key}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 16 }}>{s.label}</h3>
              <span className={`pill ${s.configured ? "squad" : "candidate"}`}>{s.configured ? "Lista" : "Falta clave"}</span>
            </div>
            <p className="hint-text" style={{ marginTop: 8 }}>{s.coverage}</p>
            <p className="hint-text" style={{ marginTop: 6 }}>{s.attribution}</p>
          </div>
        ))}
      </div>

      {canImport && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 16, marginBottom: 10 }}>Traer datos</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select value={sourceKey} onChange={(e) => { setSourceKey(e.target.value); setCatalog([]); }} style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)" }}>
              {sources.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <button className="btn btn-secondary" onClick={loadCatalog} disabled={catalogLoading || (currentSource && !currentSource.configured)}>
              {catalogLoading ? "Consultando..." : "Ver competiciones disponibles"}
            </button>
            {sourceKey === "statsbomb-open" && (
              <label className="hint-text" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                Partidos a traer
                <input type="number" min={1} max={400} value={maxMatches} onChange={(e) => setMaxMatches(e.target.value)} style={{ width: 70, padding: "7px 8px", borderRadius: 8, border: "1px solid var(--border)" }} />
              </label>
            )}
          </div>
          {currentSource && !currentSource.configured && (
            <p className="hint-text" style={{ marginTop: 10 }}>
              Esta fuente necesita una clave gratuita. Se configura en el servidor con la variable API_FOOTBALL_KEY.
            </p>
          )}
          {catalog.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <input placeholder="Filtrar por nombre, pais o temporada" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 8 }} />
              {filteredCatalog.map((c) => (
                <div className="activity-row" key={c.externalId}>
                  <span style={{ flexGrow: 1 }}>
                    {c.name} <span className="hint-text">{c.season} · {c.country}</span>
                  </span>
                  <button className="btn btn-primary" disabled={importing !== null || anyRunning} onClick={() => startImport(c)}>
                    {importing === c.externalId ? "Iniciando..." : "Importar"}
                  </button>
                </div>
              ))}
              {catalog.length > filteredCatalog.length && <p className="hint-text" style={{ marginTop: 8 }}>Mostrando 60 de {catalog.length}. Usa el filtro para encontrar otras.</p>}
            </div>
          )}
        </div>
      )}

      {runs.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Importaciones recientes</h3>
          {runs.slice(0, 5).map((r) => (
            <div className="activity-row" key={r.id}>
              <span style={{ flexGrow: 1 }}>{r.scope}</span>
              <span className="hint-text" style={{ flexGrow: 2 }}>
                {r.status === "RUNNING" ? `En curso: ${r.itemsDone}${r.itemsTotal ? ` de ${r.itemsTotal}` : ""}` : r.message}
              </span>
              <span className={`pill ${r.status === "DONE" ? "squad" : r.status === "ERROR" ? "lesionado" : "candidate"}`}>
                {r.status === "DONE" ? "Listo" : r.status === "ERROR" ? "Error" : "Corriendo"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="split">
        <div className="card" style={{ padding: 12 }}>
          <div className="stat-label" style={{ padding: "0 8px 8px" }}>Competiciones importadas</div>
          {competitions.length === 0 && <p className="empty-state" style={{ padding: 8 }}>Todavia no hay datos externos.</p>}
          {competitions.map((c) => (
            <div key={c.id} className={`candidate-list-item${c.id === selectedId ? " active" : ""}`} onClick={() => setSelectedId(c.id)}>
              <div className="candidate-name">{c.name}</div>
              <div className="candidate-meta">{c.season} · {c.matchCount ?? 0} partidos</div>
            </div>
          ))}
        </div>

        <div>
          {!selected && <div className="card"><p className="empty-state">Elegi una competicion para ver sus jugadores y partidos.</p></div>}
          {selected && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ fontSize: 18 }}>{selected.name} {selected.season}</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className={`btn ${tab === "jugadores" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("jugadores")}>Jugadores</button>
                  <button className={`btn ${tab === "partidos" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("partidos")}>Partidos</button>
                </div>
              </div>

              {tab === "jugadores" && (
                ranking.length === 0 ? (
                  <p className="empty-state">Esta fuente no trae detalle por jugador (solo resultados). Los rankings salen de fuentes con eventos, como StatsBomb.</p>
                ) : (
                  <table className="player-table">
                    <thead>
                      <tr>
                        <th>Jugador</th><th>Equipo</th><th>PJ</th><th>Min</th><th>Goles</th><th>Asist.</th><th>Tiros</th><th>xG</th>{canPromote && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((p) => (
                        <tr key={p.playerExternalId}>
                          <td>{p.playerName}</td>
                          <td>{p.teamName}</td>
                          <td>{p.matches}</td>
                          <td>{p.minutes}</td>
                          <td style={{ fontWeight: 700, color: "var(--green)" }}>{p.goals}</td>
                          <td>{p.assists}</td>
                          <td>{p.shots}</td>
                          <td>{p.xg}</td>
                          {canPromote && (
                            <td><button className="btn btn-secondary" onClick={() => promote(p, selected)}>A Scouting</button></td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {tab === "partidos" && (
                matches.length === 0 ? (
                  <p className="empty-state">No hay partidos importados.</p>
                ) : (
                  matches.map((m) => (
                    <div className="activity-row" key={m.id}>
                      <span className="hint-text" style={{ width: 90, flexShrink: 0 }}>{m.date ? new Date(m.date).toLocaleDateString("es-AR", { timeZone: "UTC" }) : "-"}</span>
                      <span style={{ flexGrow: 1 }}>{m.homeTeam} <strong>{m.homeScore ?? "-"} - {m.awayScore ?? "-"}</strong> {m.awayTeam}</span>
                      <span className="hint-text">{m.stage ?? ""}</span>
                      {m.detailLevel === "EVENTS" && <span className="pill squad">Con detalle</span>}
                    </div>
                  ))
                )
              )}

              {attributionFor(selected.source) && <p className="hint-text" style={{ marginTop: 14 }}>{attributionFor(selected.source)}</p>}
            </div>
          )}
        </div>
      </div>
      <p className="hint-text" style={{ marginTop: 16 }}>
        Los jugadores que agregues a Scouting quedan como candidatos y se pueden ver en <Link to="/scouting">Scouting</Link>.
      </p>
    </div>
  );
}
