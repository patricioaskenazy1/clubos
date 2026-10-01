import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, DashboardSummary } from "../api";
import { useAuth } from "../AuthContext";
import { canRead } from "../permissions";

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.dashboardSummary().then(setSummary).catch((e) => setError(e.message));
  }, []);

  const seeScouting = canRead(user, "scouting");
  const seeVideo = canRead(user, "video");
  const seeEntrenamientos = canRead(user, "entrenamientos");
  const seeData = canRead(user, "data");
  const seeFisicoMedico = canRead(user, "fisico_medico");
  const seeGestion = canRead(user, "gestion");

  return (
    <div className="page">
      <div className="page-header">
        <h2>Resumen del club</h2>
      </div>

      {error && <p className="error-text">{error}</p>}
      {!summary && !error && <p className="empty-state">Cargando...</p>}

      {summary && (
        <>
          <div className="grid-4">
            <div className="card">
              <div className="stat-label">Jugadores en plantilla</div>
              <div className="stat-value">{summary.playersInSquad}</div>
            </div>
            <div className="card">
              <div className="stat-label">Candidatos en seguimiento</div>
              <div className="stat-value" style={{ color: "var(--blue)" }}>
                {summary.candidatesTracked}
              </div>
            </div>
            {seeScouting && (
              <div className="card">
                <div className="stat-label">Informes de scouting (7 dias)</div>
                <div className="stat-value">{summary.reportsThisWeek}</div>
              </div>
            )}
            <div className="card">
              <div className="stat-label">Modulos activos</div>
              <div className="stat-value">6 / 6</div>
            </div>
          </div>

          {(seeVideo || seeEntrenamientos || seeData) && (
            <div className="grid-4" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 18 }}>
              {seeVideo && (
                <div className="card">
                  <div className="stat-label">Clips de video cargados (7 dias)</div>
                  <div className="stat-value" style={{ color: "var(--blue)" }}>
                    {summary.clipsThisWeek}
                  </div>
                </div>
              )}
              {seeEntrenamientos && (
                <div className="card">
                  <div className="stat-label">Sesiones de entrenamiento (7 dias)</div>
                  <div className="stat-value" style={{ color: "var(--red)" }}>
                    {summary.sessionsThisWeek}
                  </div>
                </div>
              )}
              {seeData && (
                <div className="card">
                  <div className="stat-label">Registros de rendimiento (7 dias)</div>
                  <div className="stat-value" style={{ color: "var(--dark-green)" }}>
                    {summary.statsThisWeek}
                  </div>
                </div>
              )}
            </div>
          )}

          {seeFisicoMedico && (
            <div className="grid-4" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 18 }}>
              <div className="card">
                <div className="stat-label">Lesiones activas</div>
                <div className="stat-value" style={{ color: "var(--red)" }}>
                  {summary.activeInjuries}
                </div>
              </div>
              <div className="card">
                <div className="stat-label">Partes medicos y tests fisicos (7 dias)</div>
                <div className="stat-value" style={{ color: "var(--blue)" }}>
                  {summary.medicalRecordsThisWeek}
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Ultima actividad</h3>
            {summary.recentActivity.length === 0 && <p className="empty-state">Todavia no hay actividad en tu sector.</p>}
            {summary.recentActivity.map((entry) => {
              const color =
                entry.type === "SCOUTING"
                  ? "var(--green)"
                  : entry.type === "VIDEO"
                  ? "var(--blue)"
                  : entry.type === "ENTRENAMIENTO"
                  ? "var(--red)"
                  : entry.type === "MEDICO"
                  ? "#8a4fb3"
                  : "var(--dark-green)";
              return (
                <div className="activity-row" key={entry.id}>
                  <span className="dot" style={{ background: color }} />
                  <span className="tag" style={{ color }}>
                    {entry.type}
                  </span>
                  <span style={{ flexGrow: 1 }}>{entry.message}</span>
                  <span className="hint-text">{new Date(entry.createdAt).toLocaleString("es-AR")}</span>
                </div>
              );
            })}
          </div>

          <p className="hint-text" style={{ marginTop: 16 }}>
            {(() => {
              const links: { key: string; node: React.ReactNode }[] = [];
              if (seeGestion) links.push({ key: "gestion", node: <>el plantel en <Link to="/plantilla">Gestion</Link></> });
              if (seeData) links.push({ key: "data", node: <>el rendimiento en <Link to="/data">Data</Link></> });
              if (seeScouting) links.push({ key: "scouting", node: <>los candidatos en <Link to="/scouting">Scouting</Link></> });
              if (seeVideo) links.push({ key: "video", node: <>los clips en <Link to="/video">Video</Link></> });
              if (seeEntrenamientos)
                links.push({ key: "entrenamientos", node: <>el calendario en <Link to="/entrenamientos">Entrenamientos</Link></> });
              if (seeFisicoMedico)
                links.push({ key: "fisico", node: <>los partes medicos en <Link to="/fisico-medico">Fisico-medico</Link></> });

              if (links.length === 0) return "Tu rol no tiene otros sectores habilitados en la plataforma.";

              return (
                <>
                  Ver{" "}
                  {links.map((l, i) => (
                    <React.Fragment key={l.key}>
                      {i > 0 && (i === links.length - 1 ? " o " : ", ")}
                      {l.node}
                    </React.Fragment>
                  ))}
                  .
                </>
              );
            })()}
          </p>
        </>
      )}
    </div>
  );
}
