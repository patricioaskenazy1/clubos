-- ClubOS MVP - modelo de datos
-- Fase 1 del roadmap: Gestion de club + Scouting, unidos por la ficha unica del jugador.
-- En produccion se recomienda Postgres (ver Arquitectura tecnica); SQLite se usa aca
-- porque no requiere infraestructura externa para correr el prototipo.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- ADMIN | SCOUT | MANAGER
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  position TEXT NOT NULL,
  nationality TEXT,
  status TEXT NOT NULL, -- SQUAD | CANDIDATE
  dorsal INTEGER,
  birthDate TEXT,
  contractUntil TEXT,
  marketValueUsd REAL,
  originNotes TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scouting_reports (
  id TEXT PRIMARY KEY,
  playerId TEXT NOT NULL REFERENCES players(id),
  authorId TEXT NOT NULL REFERENCES users(id),
  matchInfo TEXT,
  rating INTEGER NOT NULL,
  strengths TEXT,
  weaknesses TEXT,
  recommendation TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- SCOUTING | GESTION | VIDEO
  message TEXT NOT NULL,
  playerId TEXT REFERENCES players(id),
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fase 2 del roadmap: primer modulo agregado sobre el MVP inicial.
-- Un clip es un link a un video (no se sube el binario en este prototipo,
-- ver Arquitectura tecnica -> Datos/video/integraciones) asociado a un
-- jugador. video_tags son las marcas sobre la linea de tiempo del clip,
-- que es lo que un analista/scout carga mientras lo mira.
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  playerId TEXT NOT NULL REFERENCES players(id),
  title TEXT NOT NULL,
  videoUrl TEXT NOT NULL,
  matchInfo TEXT,
  uploadedById TEXT NOT NULL REFERENCES users(id),
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS video_tags (
  id TEXT PRIMARY KEY,
  videoId TEXT NOT NULL REFERENCES videos(id),
  minute INTEGER NOT NULL,
  label TEXT NOT NULL, -- Gol | Jugada clave | Recuperacion | Error | Tarjeta | Otro
  note TEXT,
  createdById TEXT NOT NULL REFERENCES users(id),
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Segundo modulo de la fase 2: Entrenamientos. Una sesion es un evento del
-- calendario (fecha + tipo); la asistencia queda registrada por jugador,
-- con la carga de trabajo de esa sesion, y se ve tambien en la ficha unica
-- del jugador (junto a scouting y video).
CREATE TABLE IF NOT EXISTS training_sessions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  sessionType TEXT NOT NULL, -- Fisico | Tactico | Tecnico | Recuperacion | Partido
  notes TEXT,
  createdById TEXT NOT NULL REFERENCES users(id),
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS training_attendance (
  id TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL REFERENCES training_sessions(id),
  playerId TEXT NOT NULL REFERENCES players(id),
  status TEXT NOT NULL, -- PRESENTE | AUSENTE | LESIONADO
  load INTEGER, -- percepcion de esfuerzo (RPE), 1 a 10
  note TEXT,
  createdById TEXT NOT NULL REFERENCES users(id),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(sessionId, playerId)
);

-- Tercer modulo de la fase 2: Data analyst. Una fila por partido jugado por
-- un jugador (minutos, goles, asistencias, rating). El resumen del plantel
-- (goles/asistencias acumulados, promedio de rating) se calcula agregando
-- estas filas, sin un pipeline de datos aparte (ver Datos/video/integraciones
-- en la Arquitectura tecnica para la version con proveedores externos).
CREATE TABLE IF NOT EXISTS player_stats (
  id TEXT PRIMARY KEY,
  playerId TEXT NOT NULL REFERENCES players(id),
  date TEXT NOT NULL,
  matchInfo TEXT NOT NULL,
  minutesPlayed INTEGER,
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  rating REAL,
  createdById TEXT NOT NULL REFERENCES users(id),
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cuarto y ultimo modulo de la fase 2: Fisico-medico. Dos tipos de registro
-- por jugador: partes medicos (lesiones, controles, altas) y resultados de
-- tests fisicos (peso, grasa corporal, velocidad, salto, etc.). Los dos se
-- ven tambien en la ficha unica del jugador, junto a scouting, video,
-- entrenamientos y data analyst -- lo que hoy suele vivir en una carpeta
-- del cuerpo medico, separada del resto.
CREATE TABLE IF NOT EXISTS medical_records (
  id TEXT PRIMARY KEY,
  playerId TEXT NOT NULL REFERENCES players(id),
  type TEXT NOT NULL, -- LESION | CONTROL_MEDICO | ALTA
  date TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  status TEXT NOT NULL, -- ACTIVA | RECUPERACION | ALTA
  expectedReturn TEXT,
  notes TEXT,
  createdById TEXT NOT NULL REFERENCES users(id),
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS physical_tests (
  id TEXT PRIMARY KEY,
  playerId TEXT NOT NULL REFERENCES players(id),
  date TEXT NOT NULL,
  testType TEXT NOT NULL, -- Peso | Grasa corporal | VO2 max | Sprint 30m | Salto CMJ
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  notes TEXT,
  createdById TEXT NOT NULL REFERENCES users(id),
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
