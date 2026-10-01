import React, { useEffect, useState } from "react";
import { api, MedicalRecord, Player, PhysicalTest } from "../api";
import { useAuth } from "../AuthContext";
import { canWrite } from "../permissions";

const emptyRecordForm = { type: "LESION", date: "", diagnosis: "", status: "ACTIVA", expectedReturn: "", notes: "" };
const emptyTestForm = { date: "", testType: "Peso", value: "", unit: "kg", notes: "" };

const RECORD_TYPES: Record<string, string> = { LESION: "Lesion", CONTROL_MEDICO: "Control medico", ALTA: "Alta medica" };
const STATUS_LABEL: Record<string, string> = { ACTIVA: "Activa", RECUPERACION: "Recuperacion", ALTA: "Alta" };
const TEST_UNITS: Record<string, string> = {
  Peso: "kg",
  "Grasa corporal": "%",
  "VO2 max": "ml/kg/min",
  "Sprint 30m": "s",
  "Salto CMJ": "cm",
};

export default function FisicoMedico() {
  const { user } = useAuth();
  const canManage = canWrite(user, "fisico_medico");

  const [squad, setSquad] = useState<Player[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [allRecords, setAllRecords] = useState<MedicalRecord[]>([]);
  const [tests, setTests] = useState<PhysicalTest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showRecordForm, setShowRecordForm] = useState(false);
  const [recordForm, setRecordForm] = useState(emptyRecordForm);
  const [savingRecord, setSavingRecord] = useState(false);

  const [showTestForm, setShowTestForm] = useState(false);
  const [testForm, setTestForm] = useState(emptyTestForm);
  const [savingTest, setSavingTest] = useState(false);

  useEffect(() => {
    api.listPlayers("SQUAD").then((list) => {
      setSquad(list);
      if (list.length > 0) setSelectedId(list[0].id);
    });
    api.listMedicalRecords().then(setAllRecords).catch((e) => setError(e.message));
  }, []);

  function loadPlayerData(id: string) {
    api.listMedicalRecords(id).then(setRecords).catch((e) => setError(e.message));
    api.listPhysicalTests(id).then(setTests).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (selectedId) loadPlayerData(selectedId);
  }, [selectedId]);

  const selectedPlayer = squad.find((p) => p.id === selectedId);
  const activeInjuryIds = new Set(
    allRecords.filter((r) => r.type === "LESION" && r.status !== "ALTA").map((r) => r.playerId)
  );

  async function handleCreateRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSavingRecord(true);
    setError(null);
    try {
      await api.createMedicalRecord({
        playerId: selectedId,
        type: recordForm.type,
        date: recordForm.date,
        diagnosis: recordForm.diagnosis,
        status: recordForm.status,
        expectedReturn: recordForm.expectedReturn || undefined,
        notes: recordForm.notes || undefined,
      });
      setRecordForm(emptyRecordForm);
      setShowRecordForm(false);
      loadPlayerData(selectedId);
      api.listMedicalRecords().then(setAllRecords);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el parte medico");
    } finally {
      setSavingRecord(false);
    }
  }

  async function handleCreateTest(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSavingTest(true);
    setError(null);
    try {
      await api.createPhysicalTest({
        playerId: selectedId,
        date: testForm.date,
        testType: testForm.testType,
        value: Number(testForm.value),
        unit: testForm.unit,
        notes: testForm.notes || undefined,
      });
      setTestForm(emptyTestForm);
      setShowTestForm(false);
      loadPlayerData(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el test");
    } finally {
      setSavingTest(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Fisico-medico</h2>
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
              <div className="candidate-name" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {p.firstName} {p.lastName}
                {activeInjuryIds.has(p.id) && <span className="pill lesionado">Lesionado</span>}
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
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary" onClick={() => setShowTestForm((v) => !v)}>
                    {showTestForm ? "Cancelar" : "Cargar test"}
                  </button>
                  <button className="btn btn-primary" onClick={() => setShowRecordForm((v) => !v)}>
                    {showRecordForm ? "Cancelar" : "Cargar parte medico"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {showRecordForm && canManage && (
            <form className="form-grid card" style={{ marginBottom: 14 }} onSubmit={handleCreateRecord}>
              <label>
                Tipo
                <select value={recordForm.type} onChange={(e) => setRecordForm({ ...recordForm, type: e.target.value })}>
                  {Object.entries(RECORD_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fecha
                <input type="date" value={recordForm.date} onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })} required />
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Diagnostico
                <input
                  value={recordForm.diagnosis}
                  onChange={(e) => setRecordForm({ ...recordForm, diagnosis: e.target.value })}
                  placeholder="Ej: Distension leve en isquiotibial derecho"
                  required
                />
              </label>
              <label>
                Estado
                <select value={recordForm.status} onChange={(e) => setRecordForm({ ...recordForm, status: e.target.value })}>
                  <option value="ACTIVA">Activa</option>
                  <option value="RECUPERACION">Recuperacion</option>
                  <option value="ALTA">Alta</option>
                </select>
              </label>
              <label>
                Retorno estimado
                <input
                  type="date"
                  value={recordForm.expectedReturn}
                  onChange={(e) => setRecordForm({ ...recordForm, expectedReturn: e.target.value })}
                />
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Notas
                <input value={recordForm.notes} onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })} />
              </label>
              {error && <p className="error-text" style={{ gridColumn: "1 / -1" }}>{error}</p>}
              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={savingRecord}>
                  {savingRecord ? "Guardando..." : "Guardar parte medico"}
                </button>
              </div>
            </form>
          )}

          {showTestForm && canManage && (
            <form className="form-grid card" style={{ marginBottom: 14 }} onSubmit={handleCreateTest}>
              <label>
                Test
                <select
                  value={testForm.testType}
                  onChange={(e) =>
                    setTestForm({ ...testForm, testType: e.target.value, unit: TEST_UNITS[e.target.value] ?? "" })
                  }
                >
                  {Object.keys(TEST_UNITS).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fecha
                <input type="date" value={testForm.date} onChange={(e) => setTestForm({ ...testForm, date: e.target.value })} required />
              </label>
              <label>
                Valor ({testForm.unit})
                <input
                  type="number"
                  step="0.1"
                  value={testForm.value}
                  onChange={(e) => setTestForm({ ...testForm, value: e.target.value })}
                  required
                />
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Notas
                <input value={testForm.notes} onChange={(e) => setTestForm({ ...testForm, notes: e.target.value })} />
              </label>
              {error && <p className="error-text" style={{ gridColumn: "1 / -1" }}>{error}</p>}
              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={savingTest}>
                  {savingTest ? "Guardando..." : "Guardar test"}
                </button>
              </div>
            </form>
          )}

          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, marginBottom: 8 }}>Partes medicos</h3>
            {records.length === 0 && <p className="empty-state">Todavia no hay partes medicos para este jugador.</p>}
            {records.map((r) => (
              <div className="report-card" key={r.id}>
                <div className="report-meta">
                  {RECORD_TYPES[r.type] ?? r.type} · {new Date(r.date).toLocaleDateString("es-AR")}
                  {r.expectedReturn ? ` · retorno estimado ${new Date(r.expectedReturn).toLocaleDateString("es-AR")}` : ""}
                </div>
                <p style={{ margin: "4px 0", fontSize: 13 }}>
                  <span
                    className={`pill ${r.status === "ALTA" ? "squad" : r.status === "RECUPERACION" ? "candidate" : "lesionado"}`}
                    style={{ marginRight: 8 }}
                  >
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                  {r.diagnosis}
                </p>
                {r.notes && <p style={{ margin: "4px 0", fontSize: 13, color: "var(--text-muted)" }}>{r.notes}</p>}
              </div>
            ))}
          </div>

          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 8 }}>Tests fisicos</h3>
            {tests.length === 0 && <p className="empty-state">Todavia no hay tests fisicos para este jugador.</p>}
            {tests.map((t) => (
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
        </div>
      </div>
    </div>
  );
}
