import React, { useEffect, useState } from "react";
import { api, Player, PlayerStat, SquadStatsSummaryRow } from "../api";
import { useAuth } from "../AuthContext";
import { canWrite } from "../permissions";

const emptyForm = { date: "", matchInfo: "", minutesPlayed: "", goals: "0", assists: "0", rating: "" };

export default function DataAnalyst() {
  const { user } = useAuth();
  const canManage = canWrite(user, "data");

  const [summary, setSummary] = useState<SquadStatsSummaryRow[]>([]);
  const [squad, setSquad] = useState<Player[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function loadSummary() {
    api.getStatsSummary().then(setSummary).catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadSummary();
    api.listPlayers("SQUAD").then((list) => {
      setSquad(list);
      if (list.length > 0) setSelectedId(list[0].id);
    });
  }, []);

  function loadPlayerStats(id: string) {
    api.listPlayerStats(id).then(setStats).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (selectedId) loadPlayerStats(selectedId);
  }, [selectedId]);

  const selectedPlayer = squad.find((p) => p.id === selectedId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      await api.createPlayerStat({
        playerId: selectedId,
        date: form.date,
        matchInfo: form.matchInfo,
        minutesPlayed: form.minutesPlayed ? Number(form.minutesPlayed) : undefined,
        goals: form.goals ? Number(form.goals) : 0,
        assists: form.assists ? Number(form.assists) : 0,
        rating: form.rating ? Number(form.rating) : undefined,
      });
      setForm(emptyForm);
      setShowForm(false);
      loadPlayerStats(selectedId);
      loadSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el registro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Data analyst</h2>
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 18 }}>
        <table className="player-table">
          <thead>
            <tr>
              <th>Jugador</th>
              <th>PJ</th>
              <th>Minutos</th>
              <th>Goles</th>
              <th>Asistencias</th>
              <th>Rating prom.</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((row) => (
              <tr key={row.playerId}>
                <td>
                  {row.firstName} {row.lastName}
                </td>
                <td>{row.matchesPlayed}</td>
                <td>{row.totalMinutes}</td>
                <td style={{ fontWeight: 700, color: "var(--green)" }}>{row.totalGoals}</td>
                <td>{row.totalAssists}</td>
                <td>{row.avgRating ? row.avgRating.toFixed(1) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {summary.length === 0 && <p className="empty-state" style={{ padding: 20 }}>Todavia no hay estadisticas cargadas.</p>}
      </div>

      <div className="split">
        <div className="card" style={{ padding: 12 }}>
          <div className="stat-label" style={{ padding: "0 8px 8px" }}>
            Plantel
          </div>
          {squad.map((p) => (
            <div
              key={p.id}
              className={`candidate-list-item${p.id === selectedId ? " active" : ""}`}
              onClick={() => setSelectedId(p.id)}
            >
              <div className="candidate-name">
                {p.firstName} {p.lastName}
              </div>
              <div className="candidate-meta">{p.position}</div>
            </div>
          ))}
        </div>

        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 18 }}>
                {selectedPlayer ? `${selectedPlayer.firstName} ${selectedPlayer.lastName}` : "Elegi un jugador"}
              </h3>
              {canManage && selectedId && (
                <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
                  {showForm ? "Cancelar" : "Cargar partido"}
                </button>
              )}
            </div>
          </div>

          {showForm && canManage && (
            <form className="form-grid card" style={{ marginBottom: 14 }} onSubmit={handleSubmit}>
              <label>
                Fecha
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </label>
              <label>
                Rival
                <input value={form.matchInfo} onChange={(e) => setForm({ ...form, matchInfo: e.target.value })} placeholder="vs. Rival" required />
              </label>
              <label>
                Minutos jugados
                <input type="number" min={0} max={120} value={form.minutesPlayed} onChange={(e) => setForm({ ...form, minutesPlayed: e.target.value })} />
              </label>
              <label>
                Rating (1-10)
                <input type="number" min={1} max={10} step={0.1} value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} />
              </label>
              <label>
                Goles
                <input type="number" min={0} value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} />
              </label>
              <label>
                Asistencias
                <input type="number" min={0} value={form.assists} onChange={(e) => setForm({ ...form, assists: e.target.value })} />
              </label>
              {error && <p className="error-text" style={{ gridColumn: "1 / -1" }}>{error}</p>}
              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          )}

          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 8 }}>Partido a partido</h3>
            {stats.length === 0 && <p className="empty-state">Todavia no hay registros para este jugador.</p>}
            {stats.map((s) => (
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
        </div>
      </div>
    </div>
  );
}
