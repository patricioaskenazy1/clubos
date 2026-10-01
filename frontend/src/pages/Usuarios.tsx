import React, { useEffect, useState } from "react";
import { api, ClubUser, RoleOption } from "../api";

const emptyForm = { email: "", name: "", role: "", password: "" };

export default function Usuarios() {
  const [users, setUsers] = useState<ClubUser[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    api.listUsers().then(setUsers).catch((e) => setError(e.message));
    api.listRoles().then((list) => {
      setRoles(list);
      setForm((f) => (f.role ? f : { ...f, role: list[0]?.key ?? "" }));
    });
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createUserAccount(form);
      setForm({ ...emptyForm, role: roles[0]?.key ?? "" });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el usuario");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Usuarios</h2>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancelar" : "Nuevo usuario"}
        </button>
      </div>

      <p className="hint-text" style={{ marginTop: -10, marginBottom: 18 }}>
        Cada persona del club entra solo a su sector segun el rol que le asignes aca.
      </p>

      {showForm && (
        <form className="form-grid card" style={{ marginBottom: 18 }} onSubmit={handleSubmit}>
          <label>
            Nombre
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label>
            Rol / sector
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Contrasena inicial
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Minimo 6 caracteres"
              required
            />
          </label>
          {error && <p className="error-text" style={{ gridColumn: "1 / -1" }}>{error}</p>}
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </form>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table className="player-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol / sector</th>
              <th>Alta</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.roleLabel}</td>
                <td>{new Date(u.createdAt).toLocaleDateString("es-AR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="empty-state" style={{ padding: 20 }}>Todavia no hay usuarios cargados.</p>}
      </div>
    </div>
  );
}
