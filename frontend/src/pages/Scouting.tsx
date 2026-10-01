import React, { useEffect, useState } from "react";
import { api, Player, PlayerDetail } from "../api";
import { useAuth } from "../AuthContext";
import { canWrite } from "../permissions";

const emptyForm = { matchInfo: "", rating: "3", strengths: "", weaknesses: "", recommendation: "" };

export default function Scouting() {
  const { user } = useAuth();
  const canReport = canWrite(user, "scouting");
  const [candidates, setCandidates] = useState<Player[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.listPlayers("CANDIDATE").then((list) => {
      setCandidates(list);
      if (list.length > 0) setSelectedId(list[0].id);
    });
  }, []);

  function loadDetail(id: string) {
    api.getPlayer(id).then(setDetail).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      await api.createScoutingReport({
        playerId: selectedId,
        matchInfo: form.matchInfo || undefined,
        rating: Number(form.rating),
        strengths: form.strengths || undefined,
        weaknesses: form.weaknesses || undefined,
        recommendation: form.recommendation || undefined,
      });
      setForm(emptyForm);
      loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el informe");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Scouting</h2>
      </div>

      <div className="split">
        <div className="card" style={{ padding: 12 }}>
          <div className="stat-label" style={{ padding: "0 8px 8px" }}>
            Candidatos en seguimiento
          </div>
          {candidates.map((c) => (
            <div
              key={c.id}
              className={`candidate-list-item${c.id === selectedId ? " active" : ""}`}
              onClick={() => setSelectedId(c.id)}
            >
              <div className="candidate-name">
                {c.firstName} {c.lastName}
              </div>
              <div className="candidate-meta">
                {c.position} · {c.originNotes || "Sin club de origen cargado"}
              </div>
            </div>
          ))}
          {candidates.length === 0 && <p className="empty-state">No hay candidatos cargados.</p>}
        </div>

        <div>
          {detail && (
            <>
              <div className="card" style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: 18 }}>
                  {detail.firstName} {detail.lastName} · {detail.position}
                </h3>
                <p className="hint-text" style={{ marginTop: 4 }}>
                  {detail.originNotes || "Sin club de origen cargado"}
                </p>
              </div>

              {canReport && (
                <form className="form-grid card" style={{ marginBottom: 14 }} onSubmit={handleSubmit}>
                  <label style={{ gridColumn: "1 / -1" }}>
                    Partido observado
                    <input value={form.matchInfo} onChange={(e) => setForm({ ...form, matchInfo: e.target.value })} placeholder="vs. Rival - fecha - competencia" />
                  </label>
                  <label>
                    Puntaje (1 a 5)
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={form.rating}
                      onChange={(e) => setForm({ ...form, rating: e.target.value })}
                    />
                  </label>
                  <label>
                    Recomendacion
                    <input value={form.recommendation} onChange={(e) => setForm({ ...form, recommendation: e.target.value })} />
                  </label>
                  <label style={{ gridColumn: "1 / -1" }}>
                    Fortalezas
                    <textarea rows={2} value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} />
                  </label>
                  <label style={{ gridColumn: "1 / -1" }}>
                    Debilidades
                    <textarea rows={2} value={form.weaknesses} onChange={(e) => setForm({ ...form, weaknesses: e.target.value })} />
                  </label>
                  {error && <p className="error-text" style={{ gridColumn: "1 / -1" }}>{error}</p>}
                  <div className="form-actions">
                    <button className="btn btn-primary" type="submit" disabled={saving}>
                      {saving ? "Guardando..." : "Agregar informe"}
                    </button>
                  </div>
                </form>
              )}

              <div className="card">
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>Informes anteriores</h3>
                {(detail.scoutingReports ?? []).length === 0 && <p className="empty-state">Todavia no hay informes para este jugador.</p>}
                {(detail.scoutingReports ?? []).map((r) => (
                  <div className="report-card" key={r.id}>
                    <div className="report-meta">
                      {r.matchInfo || "Sin partido asociado"} · por {r.authorName} · <span className="rating">{r.rating}/5</span>
                    </div>
                    {r.strengths && <p style={{ margin: "4px 0", fontSize: 13 }}>+ {r.strengths}</p>}
                    {r.weaknesses && <p style={{ margin: "4px 0", fontSize: 13 }}>- {r.weaknesses}</p>}
                    {r.recommendation && (
                      <p style={{ margin: "4px 0", fontSize: 13, fontWeight: 600 }}>Recomendacion: {r.recommendation}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
