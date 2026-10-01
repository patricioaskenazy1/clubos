import { Router } from "express";
import {
  countActiveInjuries,
  countMedicalRecordsSince,
  countPlayerStatsSince,
  countPlayersByStatus,
  countScoutingReportsSince,
  countTrainingSessionsSince,
  countVideosSince,
  recentActivity,
} from "../db";
import { requireAuth } from "../middleware/auth";
import { ModuleKey, readableModules } from "../permissions";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

// El feed de actividad si tiene texto sensible (un diagnostico, una
// devolucion de scouting), asi que ese se filtra por sector. Los numeros de
// arriba son solo conteos -- son el "resumen general" del club y los ve
// cualquiera que haya iniciado sesion, sea cual sea su sector.
const ACTIVITY_TYPE_MODULE: Record<string, ModuleKey> = {
  GESTION: "gestion",
  SCOUTING: "scouting",
  VIDEO: "video",
  ENTRENAMIENTO: "entrenamientos",
  DATA: "data",
  MEDICO: "fisico_medico",
};

// GET /api/dashboard/summary -> lo que se ve en el wireframe de Dashboard:
// numeros clave + un feed que mezcla eventos de gestion, scouting, video,
// entrenamientos, data y fisico-medico, para mostrar la integracion en una
// sola pantalla.
dashboardRouter.get("/summary", (req, res) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const allowed = new Set(readableModules(req.user!.role));

  const activity = recentActivity(40)
    .filter((entry) => {
      const mod = ACTIVITY_TYPE_MODULE[entry.type];
      return !mod || allowed.has(mod);
    })
    .slice(0, 8);

  res.json({
    playersInSquad: countPlayersByStatus("SQUAD"),
    candidatesTracked: countPlayersByStatus("CANDIDATE"),
    reportsThisWeek: countScoutingReportsSince(sevenDaysAgo),
    clipsThisWeek: countVideosSince(sevenDaysAgo),
    sessionsThisWeek: countTrainingSessionsSince(sevenDaysAgo),
    statsThisWeek: countPlayerStatsSince(sevenDaysAgo),
    activeInjuries: countActiveInjuries(),
    medicalRecordsThisWeek: countMedicalRecordsSince(sevenDaysAgo),
    recentActivity: activity,
  });
});
