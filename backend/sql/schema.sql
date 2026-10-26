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

-- Datos externos (fase de ingesta). Todo lo que entra desde una plataforma
-- de afuera vive en tablas ext_* separadas de los datos propios del club
-- (players, player_stats, etc.), y cada fila guarda de que fuente vino
-- (source + externalId). Asi se puede reimportar sin duplicar, saber la
-- licencia/atribucion de cada dato y, si un proveedor cambia o corta el
-- acceso, quitar solo esa fuente sin tocar la informacion del club.
CREATE TABLE IF NOT EXISTS ext_competitions (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,      -- statsbomb-open | api-football
  externalId TEXT NOT NULL,
  name TEXT NOT NULL,
  season TEXT NOT NULL,
  country TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source, externalId)
);

CREATE TABLE IF NOT EXISTS ext_matches (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  externalId TEXT NOT NULL,
  competitionId TEXT NOT NULL REFERENCES ext_competitions(id),
  date TEXT,
  homeTeam TEXT NOT NULL,
  awayTeam TEXT NOT NULL,
  homeScore INTEGER,
  awayScore INTEGER,
  stage TEXT,
  detailLevel TEXT NOT NULL DEFAULT 'BASIC', -- BASIC (resultado) | EVENTS (con jugadores y tiros)
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source, externalId)
);

-- Una fila por jugador y partido, calculada al importar los eventos.
CREATE TABLE IF NOT EXISTS ext_player_matches (
  id TEXT PRIMARY KEY,
  matchId TEXT NOT NULL REFERENCES ext_matches(id),
  teamName TEXT NOT NULL,
  playerExternalId TEXT NOT NULL,
  playerName TEXT NOT NULL,
  position TEXT,
  jersey INTEGER,
  minutes INTEGER,
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  shots INTEGER NOT NULL DEFAULT 0,
  xg REAL NOT NULL DEFAULT 0,
  UNIQUE(matchId, playerExternalId)
);

-- Solo se guardan los tiros (con posicion y xG), no todos los eventos: es
-- lo que alimenta mapas de tiros y rankings de xG sin inflar la base.
CREATE TABLE IF NOT EXISTS ext_shots (
  id TEXT PRIMARY KEY,
  matchId TEXT NOT NULL REFERENCES ext_matches(id),
  minute INTEGER,
  teamName TEXT,
  playerName TEXT,
  x REAL,
  y REAL,
  xg REAL,
  outcome TEXT,
  bodyPart TEXT
);
CREATE INDEX IF NOT EXISTS idx_ext_shots_match ON ext_shots(matchId);
CREATE INDEX IF NOT EXISTS idx_ext_pm_match ON ext_player_matches(matchId);

CREATE TABLE IF NOT EXISTS import_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  scope TEXT NOT NULL,       -- ej. "La Liga 2015/2016" o "Liga Profesional 2024"
  status TEXT NOT NULL,      -- RUNNING | DONE | ERROR
  itemsDone INTEGER NOT NULL DEFAULT 0,
  itemsTotal INTEGER,
  message TEXT,
  startedById TEXT REFERENCES users(id),
  startedAt TEXT NOT NULL DEFAULT (datetime('now')),
  finishedAt TEXT
);
