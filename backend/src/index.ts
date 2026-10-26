import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { migrate } from "./db";
import { ensureAdminUser } from "./bootstrap";
import { authRouter } from "./routes/auth";
import { playersRouter } from "./routes/players";
import { scoutingRouter } from "./routes/scouting";
import { videosRouter } from "./routes/videos";
import { trainingRouter } from "./routes/training";
import { statsRouter } from "./routes/stats";
import { medicalRecordsRouter, physicalTestsRouter } from "./routes/medical";
import { usersRouter } from "./routes/users";
import { dashboardRouter } from "./routes/dashboard";
import { externalRouter } from "./routes/external";
import { importsRouter } from "./routes/imports";
import { failStaleRuns } from "./ingest/store";

migrate();
failStaleRuns();

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "clubos-backend" }));

app.use("/api/auth", authRouter);
app.use("/api/players", playersRouter);
app.use("/api/scouting-reports", scoutingRouter);
app.use("/api/videos", videosRouter);
app.use("/api/training-sessions", trainingRouter);
app.use("/api/player-stats", statsRouter);
app.use("/api/medical-records", medicalRecordsRouter);
app.use("/api/physical-tests", physicalTestsRouter);
app.use("/api/users", usersRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/external", externalRouter);
app.use("/api/imports", importsRouter);

// En produccion (Railway/Render), un solo servicio sirve todo: esta misma
// API y el build estatico del frontend (frontend/dist), para no tener que
// levantar dos servicios separados ni lidiar con CORS entre ellos -- el
// club entra a una sola URL. En desarrollo esto no se usa: el frontend
// corre aparte con Vite (ver frontend/vite.config.ts) y nunca llega a pisar
// esta ruta.
const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
  // eslint-disable-next-line no-console
  console.log("Sirviendo el frontend compilado desde", frontendDist);
}

const port = Number(process.env.PORT) || 4000;
ensureAdminUser().finally(() => {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`ClubOS backend escuchando en http://localhost:${port}`);
  });
});
