import { Router } from "express";
import { createActivityLog, createVideo, createVideoTag, getPlayerById, getVideoById, listVideoTags, listVideos } from "../db";
import { requireAuth, requireModule } from "../middleware/auth";

export const videosRouter = Router();

videosRouter.use(requireAuth);

// GET /api/videos?playerId=... -> lista de clips, mas nuevo primero. Lo ven
// scouting y cuerpo tecnico (lectura), aunque solo scouting (y admin) puede
// cargar.
videosRouter.get("/", requireModule("video", "read"), (req, res) => {
  const playerId = typeof req.query.playerId === "string" ? req.query.playerId : undefined;
  res.json(listVideos(playerId));
});

// GET /api/videos/:id -> el clip con su linea de tiempo de marcas.
videosRouter.get("/:id", requireModule("video", "read"), (req, res) => {
  const video = getVideoById(req.params.id);
  if (!video) return res.status(404).json({ error: "Video no encontrado" });
  const tags = listVideoTags(video.id);
  res.json({ ...video, tags });
});

// POST /api/videos -> cargan un clip nuevo (link externo, no se sube el
// binario en este prototipo) asociado a un jugador.
videosRouter.post("/", requireModule("video", "write"), (req, res) => {
  const { playerId, title, videoUrl, matchInfo } = req.body ?? {};

  if (!playerId || !title || !videoUrl) {
    return res.status(400).json({ error: "Faltan campos obligatorios (playerId, title, videoUrl)" });
  }

  const player = getPlayerById(playerId);
  if (!player) return res.status(404).json({ error: "Jugador no encontrado" });

  const video = createVideo({
    playerId,
    title,
    videoUrl,
    matchInfo,
    uploadedById: req.user!.userId,
  });

  createActivityLog({
    type: "VIDEO",
    message: `Nuevo clip de video cargado para ${player.firstName} ${player.lastName}`,
    playerId,
  });

  res.status(201).json(video);
});

// POST /api/videos/:id/tags -> marca sobre la linea de tiempo mientras se
// mira el clip (minuto + etiqueta + nota).
videosRouter.post("/:id/tags", requireModule("video", "write"), (req, res) => {
  const video = getVideoById(req.params.id);
  if (!video) return res.status(404).json({ error: "Video no encontrado" });

  const { minute, label, note } = req.body ?? {};
  if (minute === undefined || minute === null || !label) {
    return res.status(400).json({ error: "Faltan campos obligatorios (minute, label)" });
  }

  const tag = createVideoTag({
    videoId: video.id,
    minute: Number(minute),
    label,
    note,
    createdById: req.user!.userId,
  });

  res.status(201).json(tag);
});
