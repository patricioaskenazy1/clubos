import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  createActivityLog,
  createMedicalRecord,
  createPhysicalTest,
  createPlayer,
  createPlayerStat,
  createScoutingReport,
  createTrainingSession,
  createUser,
  createVideo,
  createVideoTag,
  findUserByEmail,
  migrate,
  upsertAttendance,
} from "./index";

async function main() {
  migrate();

  const passwordHash = await bcrypt.hash("clubos2026", 10);

  const admin = findUserByEmail("admin@clubos.demo") ?? createUser({
    email: "admin@clubos.demo",
    name: "Admin del Club",
    role: "ADMIN",
    passwordHash,
  });

  const scout = findUserByEmail("scout@clubos.demo") ?? createUser({
    email: "scout@clubos.demo",
    name: "Martina Gomez",
    role: "SCOUT",
    passwordHash,
  });

  // Roles pensados para el piloto real en el club: cada uno entra solo a su
  // sector (ver permissions.ts). admin/scout ya existian; estos tres son
  // nuevos.
  const dirigencia = findUserByEmail("dirigencia@clubos.demo") ?? createUser({
    email: "dirigencia@clubos.demo",
    name: "Roberto Diaz",
    role: "DIRIGENCIA",
    passwordHash,
  });

  const tecnico = findUserByEmail("tecnico@clubos.demo") ?? createUser({
    email: "tecnico@clubos.demo",
    name: "Walter Sosa",
    role: "CUERPO_TECNICO",
    passwordHash,
  });

  const fisico = findUserByEmail("fisico@clubos.demo") ?? createUser({
    email: "fisico@clubos.demo",
    name: "Ana Torres",
    role: "FISICO_MEDICO",
    passwordHash,
  });

  // Plantel (modulo Gestion)
  const squadData = [
    { firstName: "Juan", lastName: "Perez", position: "Delantero", dorsal: 9, contractUntil: "2027-12-31", marketValueUsd: 1200000 },
    { firstName: "Carlos", lastName: "Rodriguez", position: "Mediocampista", dorsal: 5, contractUntil: "2026-12-31", marketValueUsd: 650000 },
    { firstName: "Diego", lastName: "Martinez", position: "Defensor", dorsal: 4, contractUntil: "2027-06-30", marketValueUsd: 400000 },
    { firstName: "Sebastian", lastName: "Lopez", position: "Arquero", dorsal: 1, contractUntil: "2026-06-30", marketValueUsd: 300000 },
    { firstName: "Franco", lastName: "Gonzalez", position: "Defensor", dorsal: 2, contractUntil: "2028-12-31", marketValueUsd: 550000 },
  ];
  const squad = squadData.map((p) => createPlayer({ ...p, status: "SQUAD", nationality: "Argentina" }));

  // Candidatos en seguimiento (modulo Scouting) - mismos nombres que el wireframe de Scouting
  const candidateData = [
    { firstName: "Martin", lastName: "Diaz", position: "Extremo", originNotes: "Liga Nacional B" },
    { firstName: "Lucas", lastName: "Fernandez", position: "Volante central", originNotes: "Primera C" },
    { firstName: "Nicolas", lastName: "Romero", position: "Lateral izquierdo", originNotes: "Primera B" },
    { firstName: "Tomas", lastName: "Alvarez", position: "Delantero", originNotes: "Liga Uruguaya" },
  ];
  const candidates = candidateData.map((p) => createPlayer({ ...p, status: "CANDIDATE", nationality: "Argentina" }));

  // Informes de scouting sobre los primeros dos candidatos
  createScoutingReport({
    playerId: candidates[0].id,
    authorId: scout.id,
    matchInfo: "vs. Central Rojo - 14/09/2026 - Liga Nacional B, fecha 22",
    rating: 4,
    strengths: "Buena definicion al espacio, encara con las dos piernas.",
    weaknesses: "Falta consistencia defensiva en la marca del carril.",
    recommendation: "Seguir en las proximas 3 fechas.",
  });

  createScoutingReport({
    playerId: candidates[1].id,
    authorId: scout.id,
    matchInfo: "vs. Deportivo Sur - 08/09/2026 - Primera C, fecha 20",
    rating: 3,
    strengths: "Buena vision de pase, dirige el mediocampo.",
    weaknesses: "Ritmo de juego bajo, le cuesta el uno contra uno.",
    recommendation: "Ver un partido mas antes de decidir.",
  });

  // Clips de video (modulo Videoanalisis, fase 2) sobre un candidato y un
  // jugador del plantel, con marcas cargadas por el scout sobre la linea de
  // tiempo del clip.
  const clipCandidato = createVideo({
    playerId: candidates[0].id,
    title: "Primer tiempo completo",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    matchInfo: "vs. Central Rojo - 14/09/2026 - Liga Nacional B, fecha 22",
    uploadedById: scout.id,
  });
  createVideoTag({ videoId: clipCandidato.id, minute: 12, label: "Jugada clave", note: "Desborde por izquierda y centro atras.", createdById: scout.id });
  createVideoTag({ videoId: clipCandidato.id, minute: 34, label: "Gol", note: "Definicion cruzada dentro del area.", createdById: scout.id });
  createVideoTag({ videoId: clipCandidato.id, minute: 41, label: "Error", note: "Perdida en salida que genero contraataque.", createdById: scout.id });

  const clipPlantel = createVideo({
    playerId: squad[0].id,
    title: "Resumen ultima fecha",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    matchInfo: "vs. Atletico Norte - 20/09/2026 - Torneo local, fecha 8",
    uploadedById: scout.id,
  });
  createVideoTag({ videoId: clipPlantel.id, minute: 5, label: "Recuperacion", note: "Presion alta que corta la salida rival.", createdById: scout.id });
  createVideoTag({ videoId: clipPlantel.id, minute: 67, label: "Gol", note: "Cabezazo tras centro de esquina.", createdById: scout.id });

  // Entrenamientos (modulo Entrenamientos, fase 2): dos sesiones agendadas
  // por el cuerpo tecnico, con asistencia y carga de esfuerzo cargadas
  // sobre jugadores del plantel.
  const sesionFisica = createTrainingSession({
    date: "2026-09-21",
    title: "Pretemporada - trabajo aerobico",
    sessionType: "Fisico",
    notes: "Cancha auxiliar, 90 minutos.",
    createdById: tecnico.id,
  });
  const sesionTactica = createTrainingSession({
    date: "2026-09-23",
    title: "Trabajo tactico - salida desde el fondo",
    sessionType: "Tactico",
    notes: "Con arqueros.",
    createdById: tecnico.id,
  });

  upsertAttendance({ sessionId: sesionFisica.id, playerId: squad[0].id, status: "PRESENTE", load: 7, createdById: tecnico.id });
  upsertAttendance({ sessionId: sesionFisica.id, playerId: squad[1].id, status: "PRESENTE", load: 6, createdById: tecnico.id });
  upsertAttendance({ sessionId: sesionFisica.id, playerId: squad[2].id, status: "LESIONADO", note: "Molestia muscular, no participo.", createdById: tecnico.id });
  upsertAttendance({ sessionId: sesionFisica.id, playerId: squad[3].id, status: "AUSENTE", note: "Permiso personal.", createdById: tecnico.id });

  upsertAttendance({ sessionId: sesionTactica.id, playerId: squad[0].id, status: "PRESENTE", load: 5, createdById: tecnico.id });
  upsertAttendance({ sessionId: sesionTactica.id, playerId: squad[1].id, status: "PRESENTE", load: 5, createdById: tecnico.id });
  upsertAttendance({ sessionId: sesionTactica.id, playerId: squad[2].id, status: "LESIONADO", note: "Sigue en recuperacion.", createdById: tecnico.id });

  // Estadisticas (modulo Data analyst, fase 2): rendimiento partido a
  // partido de algunos jugadores del plantel.
  createPlayerStat({ playerId: squad[0].id, date: "2026-09-14", matchInfo: "vs. Atletico Norte", minutesPlayed: 90, goals: 2, assists: 0, rating: 8.1, createdById: tecnico.id });
  createPlayerStat({ playerId: squad[0].id, date: "2026-09-07", matchInfo: "vs. Deportivo Sur", minutesPlayed: 76, goals: 1, assists: 1, rating: 7.4, createdById: tecnico.id });
  createPlayerStat({ playerId: squad[1].id, date: "2026-09-14", matchInfo: "vs. Atletico Norte", minutesPlayed: 90, goals: 0, assists: 2, rating: 7.6, createdById: tecnico.id });
  createPlayerStat({ playerId: squad[1].id, date: "2026-09-07", matchInfo: "vs. Deportivo Sur", minutesPlayed: 90, goals: 0, assists: 0, rating: 6.5, createdById: tecnico.id });
  createPlayerStat({ playerId: squad[3].id, date: "2026-09-14", matchInfo: "vs. Atletico Norte", minutesPlayed: 90, goals: 0, assists: 0, rating: 6.8, createdById: tecnico.id });

  // Fisico-medico (fase 2, ultimo modulo del roadmap): partes medicos y
  // tests fisicos sobre jugadores del plantel, que se ven tambien en la
  // ficha unica de cada uno.
  createMedicalRecord({
    playerId: squad[2].id,
    type: "LESION",
    date: "2026-09-18",
    diagnosis: "Distension leve en isquiotibial derecho",
    status: "RECUPERACION",
    expectedReturn: "2026-10-05",
    notes: "Trabajo de recuperacion con el kinesiologo, sin carga de campo por ahora.",
    createdById: fisico.id,
  });
  createMedicalRecord({
    playerId: squad[0].id,
    type: "CONTROL_MEDICO",
    date: "2026-09-10",
    diagnosis: "Control medico de rutina de pretemporada",
    status: "ALTA",
    notes: "Apto para competir sin restricciones.",
    createdById: fisico.id,
  });

  createPhysicalTest({ playerId: squad[0].id, date: "2026-09-10", testType: "Peso", value: 78.4, unit: "kg", createdById: fisico.id });
  createPhysicalTest({ playerId: squad[0].id, date: "2026-09-10", testType: "Grasa corporal", value: 11.2, unit: "%", createdById: fisico.id });
  createPhysicalTest({ playerId: squad[0].id, date: "2026-09-10", testType: "Sprint 30m", value: 4.1, unit: "s", createdById: fisico.id });
  createPhysicalTest({ playerId: squad[1].id, date: "2026-09-10", testType: "VO2 max", value: 58.3, unit: "ml/kg/min", createdById: fisico.id });
  createPhysicalTest({ playerId: squad[1].id, date: "2026-09-10", testType: "Salto CMJ", value: 42.5, unit: "cm", createdById: fisico.id });

  // Actividad de gestion + scouting + video + entrenamientos + data + fisico-medico para el feed del dashboard
  createActivityLog({ type: "GESTION", message: `Se actualizo el contrato de ${squad[0].firstName} ${squad[0].lastName}`, playerId: squad[0].id });
  createActivityLog({ type: "SCOUTING", message: `Nuevo informe de scouting sobre ${candidates[0].firstName} ${candidates[0].lastName}`, playerId: candidates[0].id });
  createActivityLog({ type: "SCOUTING", message: `Nuevo informe de scouting sobre ${candidates[1].firstName} ${candidates[1].lastName}`, playerId: candidates[1].id });
  createActivityLog({ type: "GESTION", message: `${candidates[3].firstName} ${candidates[3].lastName} se agrego a seguimiento`, playerId: candidates[3].id });
  createActivityLog({ type: "VIDEO", message: `Nuevo clip de video cargado para ${candidates[0].firstName} ${candidates[0].lastName}`, playerId: candidates[0].id });
  createActivityLog({ type: "VIDEO", message: `Nuevo clip de video cargado para ${squad[0].firstName} ${squad[0].lastName}`, playerId: squad[0].id });
  createActivityLog({ type: "ENTRENAMIENTO", message: `Se agendo la sesion "${sesionFisica.title}" (${sesionFisica.sessionType})` });
  createActivityLog({ type: "ENTRENAMIENTO", message: `Se agendo la sesion "${sesionTactica.title}" (${sesionTactica.sessionType})` });
  createActivityLog({ type: "DATA", message: `Se cargo el rendimiento de ${squad[0].firstName} ${squad[0].lastName} vs. Atletico Norte`, playerId: squad[0].id });
  createActivityLog({ type: "MEDICO", message: `Nuevo parte medico de ${squad[2].firstName} ${squad[2].lastName}: Distension leve en isquiotibial derecho`, playerId: squad[2].id });
  createActivityLog({ type: "MEDICO", message: `Nuevo test fisico de ${squad[0].firstName} ${squad[0].lastName}: Sprint 30m 4.1s`, playerId: squad[0].id });

  console.log("Seed listo.");
  console.log("Usuarios demo:");
  console.log(`  admin@clubos.demo / clubos2026        (rol ${admin.role})`);
  console.log(`  dirigencia@clubos.demo / clubos2026   (rol ${dirigencia.role})`);
  console.log(`  tecnico@clubos.demo / clubos2026      (rol ${tecnico.role})`);
  console.log(`  fisico@clubos.demo / clubos2026       (rol ${fisico.role})`);
  console.log(`  scout@clubos.demo / clubos2026        (rol ${scout.role})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
