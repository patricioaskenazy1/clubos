import React, { useEffect, useState } from "react";
import { api, Player, Video as VideoModel, VideoDetail } from "../api";
import { useAuth } from "../AuthContext";
import { canWrite } from "../permissions";

const emptyVideoForm = { playerId: "", title: "", videoUrl: "", matchInfo: "" };
const emptyTagForm = { minute: "", label: "Jugada clave", note: "" };

const TAG_LABELS = ["Gol", "Jugada clave", "Recuperacion", "Error", "Tarjeta", "Otro"];

export default function Video() {
  const { user } = useAuth();
  const canManage = canWrite(user, "video");

  const [videos, setVideos] = useState<VideoModel[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<VideoDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showVideoForm, setShowVideoForm] = useState(false);
  const [videoForm, setVideoForm] = useState(emptyVideoForm);
  const [savingVideo, setSavingVideo] = useState(false);

  const [tagForm, setTagForm] = useState(emptyTagForm);
  const [savingTag, setSavingTag] = useState(false);

  function loadVideos() {
    api
      .listVideos()
      .then((list) => {
        setVideos(list);
        if (!selectedId && list.length > 0) setSelectedId(list[0].id);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadVideos();
    Promise.all([api.listPlayers("SQUAD"), api.listPlayers("CANDIDATE")]).then(([squad, candidates]) =>
      setPlayers([...squad, ...candidates])
    );
  }, []);

  function loadDetail(id: string) {
    api.getVideo(id).then(setDetail).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId]);

  async function handleCreateVideo(e: React.FormEvent) {
    e.preventDefault();
    setSavingVideo(true);
    setError(null);
    try {
      const created = await api.createVideo({
        playerId: videoForm.playerId,
        title: videoForm.title,
        videoUrl: videoForm.videoUrl,
        matchInfo: videoForm.matchInfo || undefined,
      });
      setVideoForm(emptyVideoForm);
      setShowVideoForm(false);
      loadVideos();
      setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el clip");
    } finally {
      setSavingVideo(false);
    }
  }

  async function handleCreateTag(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSavingTag(true);
    setError(null);
    try {
      await api.createVideoTag(selectedId, {
        minute: Number(tagForm.minute),
        label: tagForm.label,
        note: tagForm.note || undefined,
      });
      setTagForm(emptyTagForm);
      loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar la marca");
    } finally {
      setSavingTag(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Videoanalisis</h2>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowVideoForm((v) => !v)}>
            {showVideoForm ? "Cancelar" : "Cargar clip"}
          </button>
        )}
      </div>

      {showVideoForm && canManage && (
        <form className="form-grid card" style={{ marginBottom: 18 }} onSubmit={handleCreateVideo}>
          <label>
            Jugador
            <select
              value={videoForm.playerId}
              onChange={(e) => setVideoForm({ ...videoForm, playerId: e.target.value })}
              required
            >
              <option value="" disabled>
                Elegir jugador...
              </option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} {p.status === "CANDIDATE" ? "(candidato)" : "(plantel)"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Titulo del clip
            <input value={videoForm.title} onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })} required />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Link del video
            <input
              value={videoForm.videoUrl}
              onChange={(e) => setVideoForm({ ...videoForm, videoUrl: e.target.value })}
              placeholder="https://..."
              required
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Partido
            <input value={videoForm.matchInfo} onChange={(e) => setVideoForm({ ...videoForm, matchInfo: e.target.value })} placeholder="vs. Rival - fecha - competencia" />
          </label>
          {error && <p className="error-text" style={{ gridColumn: "1 / -1" }}>{error}</p>}
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={savingVideo}>
              {savingVideo ? "Guardando..." : "Guardar clip"}
            </button>
          </div>
        </form>
      )}

      <div className="split">
        <div className="card" style={{ padding: 12 }}>
          <div className="stat-label" style={{ padding: "0 8px 8px" }}>
            Clips cargados
          </div>
          {videos.map((v) => (
            <div
              key={v.id}
              className={`candidate-list-item${v.id === selectedId ? " active" : ""}`}
              onClick={() => setSelectedId(v.id)}
            >
              <div className="candidate-name">{v.title}</div>
              <div className="candidate-meta">
                {v.playerFirstName} {v.playerLastName} · {v.tagCount ?? 0} marca{v.tagCount === 1 ? "" : "s"}
              </div>
            </div>
          ))}
          {videos.length === 0 && <p className="empty-state">Todavia no hay clips cargados.</p>}
        </div>

        <div>
          {detail && (
            <>
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="video-frame">
                  <div className="video-frame-play">&#9658;</div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: 14 }}>
                  <div>
                    <h3 style={{ fontSize: 18 }}>{detail.title}</h3>
                    <p className="hint-text" style={{ marginTop: 4 }}>
                      {detail.playerFirstName} {detail.playerLastName}
                      {detail.matchInfo ? ` · ${detail.matchInfo}` : ""}
                    </p>
                  </div>
                  <a className="btn btn-secondary" href={detail.videoUrl} target="_blank" rel="noreferrer">
                    Abrir video
                  </a>
                </div>
              </div>

              {canManage && (
                <form className="form-grid card" style={{ marginBottom: 14 }} onSubmit={handleCreateTag}>
                  <label>
                    Minuto
                    <input
                      type="number"
                      min={0}
                      value={tagForm.minute}
                      onChange={(e) => setTagForm({ ...tagForm, minute: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Etiqueta
                    <select value={tagForm.label} onChange={(e) => setTagForm({ ...tagForm, label: e.target.value })}>
                      {TAG_LABELS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ gridColumn: "1 / -1" }}>
                    Nota
                    <input value={tagForm.note} onChange={(e) => setTagForm({ ...tagForm, note: e.target.value })} />
                  </label>
                  {error && <p className="error-text" style={{ gridColumn: "1 / -1" }}>{error}</p>}
                  <div className="form-actions">
                    <button className="btn btn-primary" type="submit" disabled={savingTag}>
                      {savingTag ? "Guardando..." : "Agregar marca"}
                    </button>
                  </div>
                </form>
              )}

              <div className="card">
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>Linea de tiempo</h3>
                {detail.tags.length === 0 && <p className="empty-state">Todavia no hay marcas para este clip.</p>}
                {detail.tags.map((t) => (
                  <div className="activity-row" key={t.id}>
                    <span className="video-tag-minute">{t.minute}'</span>
                    <span className="tag" style={{ width: 110, color: "var(--dark-green)" }}>
                      {t.label}
                    </span>
                    <span style={{ flexGrow: 1 }}>{t.note}</span>
                    <span className="hint-text">{t.createdByName}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {!detail && videos.length > 0 && <p className="empty-state">Elegi un clip de la lista.</p>}
        </div>
      </div>
    </div>
  );
}
