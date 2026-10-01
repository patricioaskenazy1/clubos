import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, PlayerDetail } from "../api";
import { useAuth } from "../AuthContext";
import { canRead, canWrite } from "../permissions";

export default function FichaJugador() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canManage = canWrite(user, "gestion");
  const seeGestion = canRead(user, "gestion");
  const seeScouting = canRead(user, "scouting");
  const seeData = canRead(user, "data");
  const seeFisicoMedico = canRead(user, "fisico_medico");
  const seeEntrenamientos = canRead(user, "entrenamientos");

  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);

  function load() {
    if (!id) return;
    api.getPlayer(id).then(setPlayer).catch((e) => setError(e.message));
  }

  useEffect(load, [id]);

  async function promoteToSquad() {
    if (!id) return;
    setPromoting(true);
    try {
      await api.updatePlayer(id, { status: "SQUAD" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar");
    } finally {
      setPromoting(false);
    }
  }

  if (error) return <div className="page"><p className="error-text">{error}</p></div>;
  if (!player) return <div className="page"><p className="empty-state">Cargando...</p></div>;

  const hasActiveInjury = !!player.medicalRecords?.some((r) => r.type === "LESION" && r.status !== "ALTA");
  const noSections = !seeGestion && !seeScouting && !seeData && !seeFisicoMedico && !seeEntrenamientos;

  return (
    <div className="page">
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span className={`pill ${player.status === "SQUAD" ? "squad" : "candidate"}`}>
              {player.status === "SQUAD" ? "PLANTEL" : "CANDIDATO"}
            </span>
            {hasActiveInjury && (
              <span className="pill lesionado" style={{ marginLeft: 8 }}>
                Lesionado
              </span>
            )}
            <h2 style={{ marginTop: 8 }}>
              {player.firstName} {player.lastName}
            </h2>
            <p className="hint-text" style={{ marginTop: 4 }}>
              {player.position}
              {player.dorsal ? ` · Dorsal ${player.dorsal}` : ""}
              {player.nationality ? ` · ${player.nationality}` : ""}
            </p>
          </div>
          {player.status === "CANDIDATE" && canManage && (
            <button className="btn btn-primary" onClick={promoteToSquad} disabled={promoting}>
              {promoting ? "Moviendo..." : "Pasar a plantel"}
            </button>
          )}
        </div>
      </div>

      {noSections && (
        <p className="empty-state">Tu rol no tiene acceso a ninguna seccion de la ficha de este jugador.</p>
      )}

      {seeGestion && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Datos de gestion</h3>
          <div className="activity-row">
            <span style={{ flexGrow: 1, color: "var(--text-muted)" }}>Contrato hasta</span>
            <span>{player.contractUntil ? new Date(player.contractUntil).toLocaleDateString("es-AR") : "-"}</span>
          </div>
          <div className="activity-row">
            <span style={{ flexGrow: 1, color: "var(--text-muted)" }}>Valor de mercado</span>
            <span>{player.marketValueUsd ? `USD ${player.marketValueUsd.toLocaleString("es-AR")}` : "-"}</span>
          </div>
          <div className="activity-row">
            <span style={{ flexGrow: 1, color: "var(--text-muted)" }}>Origen / club anterior</span>
            <span>{player.originNotes || "-"}</span>
          </div>
        </div>
      )}

      {seeScouting && player.scoutingReports && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Informes de scouting</h3>
          {player.scoutingReports.length === 0 && <p className="empty-state">Todavia no hay informes para este jugador.</p>}
          {player.scoutingReports.map((r) => (
            <div className="report-card" key={r.id}>
              <div className="report-meta">
                {r.matchInfo || "Sin partido asociado"} · por {r.authorName} · <span className="rating">{r.rating}/5</span> ·{" "}
                {new Date(r.createdAt).toLocaleDateString("es-AR")}
              </div>
              {r.strengths && <p style={{ margin: "4px 0", fontSize: 13 }}>+ {r.strengths}</p>}
              {r.weaknesses && <p style={{ margin: "4px 0", fontSize: 13 }}>- {r.weaknesses}</p>}
              {r.recommendation && <p style={{ margin: "4px 0", fontSize: 13, fontWeight: 600 }}>Recomendacion: {r.recommendation}</p>}
            </div>
          ))}
        </div>
      )}

      {seeData && player.playerStats && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Rendimiento (Data analyst)</h3>
          {player.playerStats.length === 0 && <p className="empty-state">Todavia no hay estadisticas cargadas para este jugador.</p>}
          {player.playerStats.map((s) => (
            <div className="activity-row" key={s.id}>
              <span className="hint-text" style={{ width: 80, flexShrink: 0 }}>
                {new Date(s.date).toLocaleDateString("es-AR")}
              </span>
              <span style={{ flexGrow: 1 }}>{s.matchInfo}</span>
              <span style={{ width: 70, flexShrink: 0 }}>{s.minutesPlayed ?? "-"}'</span>
              <span style={{ width: 90, flexShrink: 0, color: "var(--green)", fontWeight: 600 }}>
                {s.goals}G {s.assists}A
              </span>
              <span className="rating" style={{ width: 40, flexShrink: 0 }}>
                {s.rating ?? "-"}
              </span>
            </div>
          ))}
        </div>
      )}

      {seeFisicoMedico && player.medicalRecords && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Partes medicos</h3>
          {player.medicalRecords.length === 0 && <p className="empty-state">Todavia no hay partes medicos para este jugador.</p>}
          {player.medicalRecords.map((r) => (
            <div className="report-card" key={r.id}>
              <div className="report-meta">
                {r.type === "LESION" ? "Lesion" : r.type === "CONTROL_MEDICO" ? "Control medico" : "Alta medica"} ·{" "}
                {new Date(r.date).toLocaleDateString("es-AR")}
                {r.expectedReturn ? ` · retorno estimado ${new Date(r.expectedReturn).toLocaleDateString("es-AR")}` : ""}
              </div>
              <p style={{ margin: "4px 0", fontSize: 13 }}>
                <span
                  className={`pill ${r.status === "ALTA" ? "squad" : r.status === "RECUPERACION" ? "candidate" : "lesionado"}`}
                  style={{ marginRight: 8 }}
                >
                  {r.status === "ACTIVA" ? "Activa" : r.status === "RECUPERACION" ? "Recuperacion" : "Alta"}
                </span>
                {r.diagnosis}
              </p>
            </div>
          ))}
        </div>
      )}

      {seeFisicoMedico && player.physicalTests && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Tests fisicos</h3>
          {player.physicalTests.length === 0 && <p className="empty-state">Todavia no hay tests fisicos para este jugador.</p>}
          {player.physicalTests.map((t) => (
            <div className="activity-row" key={t.id}>
              <span className="hint-text" style={{ width: 80, flexShrink: 0 }}>
                {new Date(t.date).toLocaleDateString("es-AR")}
              </span>
              <span style={{ flexGrow: 1 }}>{t.testType}</span>
              <span style={{ width: 100, flexShrink: 0, fontWeight: 700, color: "var(--blue)" }}>
                {t.value} {t.unit}
              </span>
            </div>
          ))}
        </div>
      )}

      {seeEntrenamientos && player.trainingAttendance && (
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Asistencia a entrenamientos</h3>
          {player.trainingAttendance.length === 0 && <p className="empty-state">Todavia no hay asistencia cargada para este jugador.</p>}
          {player.trainingAttendance.map((a) => (
            <div className="activity-row" key={a.id}>
              <span
                className={`pill ${a.status === "PRESENTE" ? "squad" : a.status === "LESIONADO" ? "lesionado" : "candidate"}`}
                style={{ width: 90, textAlign: "center" }}
              >
                {a.status === "PRESENTE" ? "Presente" : a.status === "LESIONADO" ? "Lesionado" : "Ausente"}
              </span>
              <span style={{ flexGrow: 1 }}>
                {a.sessionTitle} ({a.sessionType})
                {a.load ? ` · RPE ${a.load}` : ""}
                {a.note ? ` · ${a.note}` : ""}
              </span>
              <span className="hint-text">{a.sessionDate ? new Date(a.sessionDate).toLocaleDateString("es-AR") : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
