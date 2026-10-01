import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Player } from "../api";
import { useAuth } from "../AuthContext";
import { canWrite } from "../permissions";

const emptyForm = {
  firstName: "",
  lastName: "",
  position: "",
  dorsal: "",
  contractUntil: "",
  marketValueUsd: "",
};

export default function Plantilla() {
  const { user } = useAuth();
  const canManage = canWrite(user, "gestion");
  const [players, setPlayers] = useState<Player[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    api.listPlayers("SQUAD").then(setPlayers).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createPlayer({
        firstName: form.firstName,
        lastName: form.lastName,
        position: form.position,
        status: "SQUAD",
        dorsal: form.dorsal ? Number(form.dorsal) : undefined,
        contractUntil: form.contractUntil || undefined,
        marketValueUsd: form.marketValueUsd ? Number(form.marketValueUsd) : undefined,
      });
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Plantilla</h2>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancelar" : "Agregar jugador"}
          </button>
        )}
      </div>

      {showForm && canManage && (
        <form className="form-grid card" style={{ marginBottom: 18 }} onSubmit={handleSubmit}>
          <label>
            Nombre
            <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
          </label>
          <label>
            Apellido
            <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          </label>
          <label>
            Posicion
            <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} required />
          </label>
          <label>
            Dorsal
            <input value={form.dorsal} onChange={(e) => setForm({ ...form, dorsal: e.target.value })} type="number" />
          </label>
          <label>
            Contrato hasta
            <input value={form.contractUntil} onChange={(e) => setForm({ ...form, contractUntil: e.target.value })} type="date" />
          </label>
          <label>
            Valor de mercado (USD)
            <input value={form.marketValueUsd} onChange={(e) => setForm({ ...form, marketValueUsd: e.target.value })} type="number" />
          </label>
          {error && <p className="error-text" style={{ gridColumn: "1 / -1" }}>{error}</p>}
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table className="player-table">
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Posicion</th>
              <th>Dorsal</th>
              <th>Contrato hasta</th>
              <th>Valor de mercado</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/jugador/${p.id}`}>
                    {p.firstName} {p.lastName}
                  </Link>
                </td>
                <td>{p.position}</td>
                <td>{p.dorsal ?? "-"}</td>
                <td>{p.contractUntil ? new Date(p.contractUntil).toLocaleDateString("es-AR") : "-"}</td>
                <td>{p.marketValueUsd ? `USD ${p.marketValueUsd.toLocaleString("es-AR")}` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {players.length === 0 && <p className="empty-state" style={{ padding: 20 }}>Todavia no hay jugadores en la plantilla.</p>}
      </div>
    </div>
  );
}
