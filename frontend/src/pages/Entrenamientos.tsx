import React, { useEffect, useState } from "react";
import { api, Player, TrainingSession, TrainingSessionDetail } from "../api";
import { useAuth } from "../AuthContext";
import { canWrite } from "../permissions";

const emptySessionForm = { date: "", title: "", sessionType: "Fisico", notes: "" };
const emptyAttendanceForm = { playerId: "", status: "PRESENTE", load: "", note: "" };

const SESSION_TYPES = ["Fisico", "Tactico", "Tecnico", "Recuperacion", "Partido"];
const STATUS_LABEL: Record<string, string> = { PRESENTE: "Presente", AUSENTE: "Ausente", LESIONADO: "Lesionado" };

export default function Entrenamientos() {
  const { user } = useAuth();
  const canManage = canWrite(user, "entrenamientos");

  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [squad, setSquad] = useState<Player[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TrainingSessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionForm, setSessionForm] = useState(emptySessionForm);
  const [savingSession, setSavingSession] = useState(false);

  const [attendanceForm, setAttendanceForm] = useState(emptyAttendanceForm);
  const [savingAttendance, setSavingAttendance] = useState(false);

  function loadSessions() {
    api
      .listTrainingSessions()
      .then((list) => {
        setSessions(list);
        if (!selectedId && list.length > 0) setSelectedId(list[0].id);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadSessions();
    api.listPlayers("SQUAD").then(setSquad);
  }, []);

  function loadDetail(id: string) {
    api.getTrainingSession(id).then(setDetail).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId]);

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    setSavingSession(true);
    setError(null);
    try {
      const created = await api.createTrainingSession({
        date: sessionForm.date,
        title: sessionForm.title,
        sessionType: sessionForm.sessionType,
        notes: sessionForm.notes || undefined,
      });
      setSessionForm(emptySessionForm);
      setShowSessionForm(false);
      loadSessions();
      setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agendar la sesion");
    } finally {
      setSavingSession(false);
    }
  }

  async function handleMarkAttendance(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSavingAttendance(true);
    setError(null);
    try {
      await api.markAttendance(selectedId, {
        playerId: attendanceForm.playerId,
        status: attendanceForm.status,
        load: attendanceForm.load ? Number(attendanceForm.load) : undefined,
        note: attendanceForm.note || undefined,
      });
      setAttendanceForm(emptyAttendanceForm);
      loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la asistencia");
    } finally {
      setSavingAttendance(false);
    }
  }

  const pendingPlayers = squad.filter((p) => !detail?.attendance.some((a) => a.playerId === p.id));

  return (
    <div className="page">
      <div className="page-header">
        <h2>Entrenamientos</h2>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowSessionForm((v) => !v)}>
            {showSessionForm ? "Cancelar" : "Agendar sesion"}
          </button>
        )}
      </div>

      {showSessionForm && canManage && (
        <form className="form-grid card" style={{ marginBottom: 18 }} onSubmit={handleCreateSession}>
          <label>
            Fecha
            <input type="date" value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })} required />
          </label>
          <label>
            Tipo
            <select value={sessionForm.sessionType} onChange={(e) => setSessionForm({ ...sessionForm, sessionType: e.target.value })}>
              {SESSION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Titulo
            <input value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })} placeholder="Ej: Trabajo tactico - salida desde el fondo" required />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Notas
            <input value={sessionForm.notes} onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })} />
          </label>
          {error && <p className="error-text" style={{ gridColumn: "1 / -1" }}>{error}</p>}
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={savingSession}>
              {savingSession ? "Guardando..." : "Guardar sesion"}
            </button>
          </div>
        </form>
      )}

      <div className="split">
        <div className="card" style={{ padding: 12 }}>
          <div className="stat-label" style={{ padding: "0 8px 8px" }}>
            Sesiones agendadas
          </div>
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`candidate-list-item${s.id === selectedId ? " active" : ""}`}
              onClick={() => setSelectedId(s.id)}
            >
              <div className="candidate-name">{s.title}</div>
              <div className="candidate-meta">
                {new Date(s.date).toLocaleDateString("es-AR")} · {s.sessionType} · {s.attendanceCount ?? 0} registro
                {s.attendanceCount === 1 ? "" : "s"}
              </div>
            </div>
          ))}
          {sessions.length === 0 && <p className="empty-state">Todavia no hay sesiones agendadas.</p>}
        </div>

        <div>
          {detail && (
            <>
              <div className="card" style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: 18 }}>{detail.title}</h3>
                <p className="hint-text" style={{ marginTop: 4 }}>
                  {new Date(detail.date).toLocaleDateString("es-AR")} · {detail.sessionType}
                  {detail.notes ? ` · ${detail.notes}` : ""}
                </p>
              </div>

              {canManage && (
                <form className="form-grid card" style={{ marginBottom: 14 }} onSubmit={handleMarkAttendance}>
                  <label>
                    Jugador
                    <select
                      value={attendanceForm.playerId}
                      onChange={(e) => setAttendanceForm({ ...attendanceForm, playerId: e.target.value })}
                      required
                    >
                      <option value="" disabled>
                        Elegir jugador...
                      </option>
                      {squad.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName}
                          {pendingPlayers.some((pp) => pp.id === p.id) ? "" : " (ya registrado)"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Estado
                    <select value={attendanceForm.status} onChange={(e) => setAttendanceForm({ ...attendanceForm, status: e.target.value })}>
                      <option value="PRESENTE">Presente</option>
                      <option value="AUSENTE">Ausente</option>
                      <option value="LESIONADO">Lesionado</option>
                    </select>
                  </label>
                  <label>
                    Carga (RPE 1-10)
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={attendanceForm.load}
                      onChange={(e) => setAttendanceForm({ ...attendanceForm, load: e.target.value })}
                    />
                  </label>
                  <label>
                    Nota
                    <input value={attendanceForm.note} onChange={(e) => setAttendanceForm({ ...attendanceForm, note: e.target.value })} />
                  </label>
                  {error && <p className="error-text" style={{ gridColumn: "1 / -1" }}>{error}</p>}
                  <div className="form-actions">
                    <button className="btn btn-primary" type="submit" disabled={savingAttendance}>
                      {savingAttendance ? "Guardando..." : "Cargar asistencia"}
                    </button>
                  </div>
                </form>
              )}

              <div className="card">
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>Asistencia</h3>
                {detail.attendance.length === 0 && <p className="empty-state">Todavia no hay asistencia cargada para esta sesion.</p>}
                {detail.attendance.map((a) => (
                  <div className="activity-row" key={a.id}>
                    <span
                      className={`pill ${a.status === "PRESENTE" ? "squad" : a.status === "LESIONADO" ? "lesionado" : "candidate"}`}
                      style={{ width: 90, textAlign: "center" }}
                    >
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                    <span style={{ flexGrow: 1 }}>
                      {a.playerFirstName} {a.playerLastName}
                      {a.load ? ` · RPE ${a.load}` : ""}
                      {a.note ? ` · ${a.note}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          {!detail && sessions.length > 0 && <p className="empty-state">Elegi una sesion de la lista.</p>}
        </div>
      </div>
    </div>
  );
}
