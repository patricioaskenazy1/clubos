// Modulos/sectores de la plataforma. Cada usuario tiene, segun su rol, una
// lista de los que puede leer y una de los que puede cargar -- se la manda
// el backend al hacer login (ver permissions.ts del backend), asi que el
// frontend no tiene su propia copia de la matriz de permisos.
export type ModuleKey = "gestion" | "scouting" | "video" | "entrenamientos" | "data" | "fisico_medico";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "DIRIGENCIA" | "CUERPO_TECNICO" | "FISICO_MEDICO" | "SCOUT" | string;
  roleLabel: string;
  modules: { read: ModuleKey[]; write: ModuleKey[] };
}

export interface ClubUser {
  id: string;
  email: string;
  name: string;
  role: string;
  roleLabel: string;
  createdAt: string;
}

export interface RoleOption {
  key: string;
  label: string;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  nationality: string | null;
  status: "SQUAD" | "CANDIDATE" | string;
  dorsal: number | null;
  birthDate: string | null;
  // Estos dos solo vienen si el rol que pide tiene lectura de Gestion -- el
  // backend directamente no los manda para el resto, no es un tema de la UI.
  contractUntil?: string | null;
  marketValueUsd?: number | null;
  originNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerDetail extends Player {
  // Cada seccion solo viene si el rol tiene lectura de ese sector (ver
  // Arquitectura tecnica -> Seguridad y datos sensibles).
  scoutingReports?: ScoutingReport[];
  trainingAttendance?: TrainingAttendance[];
  playerStats?: PlayerStat[];
  medicalRecords?: MedicalRecord[];
  physicalTests?: PhysicalTest[];
}

export interface ScoutingReport {
  id: string;
  playerId: string;
  authorId: string;
  matchInfo: string | null;
  rating: number;
  strengths: string | null;
  weaknesses: string | null;
  recommendation: string | null;
  createdAt: string;
  authorName?: string;
  playerFirstName?: string;
  playerLastName?: string;
}

export interface ActivityLogEntry {
  id: string;
  type: "SCOUTING" | "GESTION" | string;
  message: string;
  playerId: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  playersInSquad: number;
  candidatesTracked: number;
  reportsThisWeek: number;
  clipsThisWeek: number;
  sessionsThisWeek: number;
  statsThisWeek: number;
  activeInjuries: number;
  medicalRecordsThisWeek: number;
  recentActivity: ActivityLogEntry[];
}

export interface MedicalRecord {
  id: string;
  playerId: string;
  type: "LESION" | "CONTROL_MEDICO" | "ALTA" | string;
  date: string;
  diagnosis: string;
  status: "ACTIVA" | "RECUPERACION" | "ALTA" | string;
  expectedReturn: string | null;
  notes: string | null;
  createdById: string;
  createdAt: string;
  playerFirstName?: string;
  playerLastName?: string;
}

export interface PhysicalTest {
  id: string;
  playerId: string;
  date: string;
  testType: string;
  value: number;
  unit: string;
  notes: string | null;
  createdById: string;
  createdAt: string;
  playerFirstName?: string;
  playerLastName?: string;
}

export interface PlayerStat {
  id: string;
  playerId: string;
  date: string;
  matchInfo: string;
  minutesPlayed: number | null;
  goals: number;
  assists: number;
  rating: number | null;
  createdById: string;
  createdAt: string;
  playerFirstName?: string;
  playerLastName?: string;
}

export interface SquadStatsSummaryRow {
  playerId: string;
  firstName: string;
  lastName: string;
  matchesPlayed: number;
  totalMinutes: number;
  totalGoals: number;
  totalAssists: number;
  avgRating: number | null;
}

export interface TrainingSession {
  id: string;
  date: string;
  title: string;
  sessionType: string;
  notes: string | null;
  createdById: string;
  createdAt: string;
  createdByName?: string;
  attendanceCount?: number;
}

export interface TrainingAttendance {
  id: string;
  sessionId: string;
  playerId: string;
  status: "PRESENTE" | "AUSENTE" | "LESIONADO" | string;
  load: number | null;
  note: string | null;
  createdById: string;
  createdAt: string;
  playerFirstName?: string;
  playerLastName?: string;
  sessionDate?: string;
  sessionTitle?: string;
  sessionType?: string;
}

export interface TrainingSessionDetail extends TrainingSession {
  attendance: TrainingAttendance[];
}

export interface VideoTag {
  id: string;
  videoId: string;
  minute: number;
  label: string;
  note: string | null;
  createdById: string;
  createdAt: string;
  createdByName?: string;
}

export interface Video {
  id: string;
  playerId: string;
  title: string;
  videoUrl: string;
  matchInfo: string | null;
  uploadedById: string;
  createdAt: string;
  playerFirstName?: string;
  playerLastName?: string;
  uploadedByName?: string;
  tagCount?: number;
}

export interface VideoDetail extends Video {
  tags: VideoTag[];
}

// ---------- Datos externos e importacion de planillas ----------

export interface ExtSource {
  key: string;
  label: string;
  attribution: string;
  configured: boolean;
  coverage: string;
}

export interface ExtCompetition {
  id: string;
  source: string;
  externalId: string;
  name: string;
  season: string;
  country: string | null;
  matchCount?: number;
}

export interface ExtCatalogEntry {
  externalId: string;
  name: string;
  season: string;
  country: string;
}

export interface ExtMatch {
  id: string;
  date: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  stage: string | null;
  detailLevel: "BASIC" | "EVENTS" | string;
}

export interface ExtPlayerRank {
  playerExternalId: string;
  playerName: string;
  teamName: string;
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  xg: number;
}

export interface ImportRun {
  id: string;
  source: string;
  scope: string;
  status: "RUNNING" | "DONE" | "ERROR";
  itemsDone: number;
  itemsTotal: number | null;
  message: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface CsvEntity {
  key: string;
  label: string;
  columns: string[];
}

export interface CsvImportResult {
  total: number;
  valid: number;
  errors: { row: number; message: string }[];
  ignoredColumns: string[];
  imported: number;
  dryRun: boolean;
}

const TOKEN_KEY = "clubos_token";
const USER_KEY = "clubos_user";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function storeSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  // Sesion vencida o invalida (por ejemplo, tras un redeploy o pasadas las
  // horas de vigencia del token): se limpia y se manda al login, en vez de
  // dejar la pantalla con un mensaje de error.
  if (res.status === 401 && token && path !== "/auth/login") {
    clearSession();
    window.location.href = "/login";
    throw new ApiError("Tu sesion vencio, volve a ingresar", 401);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error || "Error de red", res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  dashboardSummary: () => apiFetch<DashboardSummary>("/dashboard/summary"),

  listPlayers: (status?: "SQUAD" | "CANDIDATE") =>
    apiFetch<Player[]>(`/players${status ? `?status=${status}` : ""}`),

  getPlayer: (id: string) => apiFetch<PlayerDetail>(`/players/${id}`),

  createPlayer: (data: Partial<Player>) =>
    apiFetch<Player>("/players", { method: "POST", body: JSON.stringify(data) }),

  updatePlayer: (id: string, data: Partial<Player>) =>
    apiFetch<Player>(`/players/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  createScoutingReport: (data: Partial<ScoutingReport> & { playerId: string; rating: number }) =>
    apiFetch<ScoutingReport>("/scouting-reports", { method: "POST", body: JSON.stringify(data) }),

  listVideos: (playerId?: string) => apiFetch<Video[]>(`/videos${playerId ? `?playerId=${playerId}` : ""}`),

  getVideo: (id: string) => apiFetch<VideoDetail>(`/videos/${id}`),

  createVideo: (data: { playerId: string; title: string; videoUrl: string; matchInfo?: string }) =>
    apiFetch<Video>("/videos", { method: "POST", body: JSON.stringify(data) }),

  createVideoTag: (videoId: string, data: { minute: number; label: string; note?: string }) =>
    apiFetch<VideoTag>(`/videos/${videoId}/tags`, { method: "POST", body: JSON.stringify(data) }),

  listTrainingSessions: () => apiFetch<TrainingSession[]>("/training-sessions"),

  getTrainingSession: (id: string) => apiFetch<TrainingSessionDetail>(`/training-sessions/${id}`),

  createTrainingSession: (data: { date: string; title: string; sessionType: string; notes?: string }) =>
    apiFetch<TrainingSession>("/training-sessions", { method: "POST", body: JSON.stringify(data) }),

  markAttendance: (sessionId: string, data: { playerId: string; status: string; load?: number; note?: string }) =>
    apiFetch<TrainingAttendance>(`/training-sessions/${sessionId}/attendance`, { method: "POST", body: JSON.stringify(data) }),

  getStatsSummary: () => apiFetch<SquadStatsSummaryRow[]>("/player-stats/summary"),

  listPlayerStats: (playerId?: string) => apiFetch<PlayerStat[]>(`/player-stats${playerId ? `?playerId=${playerId}` : ""}`),

  createPlayerStat: (data: {
    playerId: string;
    date: string;
    matchInfo: string;
    minutesPlayed?: number;
    goals?: number;
    assists?: number;
    rating?: number;
  }) => apiFetch<PlayerStat>("/player-stats", { method: "POST", body: JSON.stringify(data) }),

  listMedicalRecords: (playerId?: string) =>
    apiFetch<MedicalRecord[]>(`/medical-records${playerId ? `?playerId=${playerId}` : ""}`),

  createMedicalRecord: (data: {
    playerId: string;
    type: string;
    date: string;
    diagnosis: string;
    status: string;
    expectedReturn?: string;
    notes?: string;
  }) => apiFetch<MedicalRecord>("/medical-records", { method: "POST", body: JSON.stringify(data) }),

  listPhysicalTests: (playerId?: string) =>
    apiFetch<PhysicalTest[]>(`/physical-tests${playerId ? `?playerId=${playerId}` : ""}`),

  createPhysicalTest: (data: { playerId: string; date: string; testType: string; value: number; unit: string; notes?: string }) =>
    apiFetch<PhysicalTest>("/physical-tests", { method: "POST", body: JSON.stringify(data) }),

  listExtSources: () => apiFetch<ExtSource[]>("/external/sources"),

  listExtCompetitions: () => apiFetch<ExtCompetition[]>("/external/competitions"),

  listExtMatches: (competitionId: string) => apiFetch<ExtMatch[]>(`/external/competitions/${competitionId}/matches`),

  listExtPlayers: (competitionId: string) => apiFetch<ExtPlayerRank[]>(`/external/competitions/${competitionId}/players`),

  extCatalog: (source: string) => apiFetch<ExtCatalogEntry[]>(`/external/catalog/${source}`),

  extImport: (data: { source: string; externalId: string; maxMatches?: number }) =>
    apiFetch<{ runId: string }>("/external/import", { method: "POST", body: JSON.stringify(data) }),

  listImportRuns: () => apiFetch<ImportRun[]>("/external/runs"),

  promoteExtPlayer: (data: { playerName: string; teamName?: string; position?: string; competition?: string }) =>
    apiFetch<Player>("/external/promote", { method: "POST", body: JSON.stringify(data) }),

  listCsvEntities: () => apiFetch<CsvEntity[]>("/imports"),

  csvTemplate: async (entity: string): Promise<Blob> => {
    const token = getStoredToken();
    const res = await fetch(`/api/imports/${entity}/template`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new ApiError("No se pudo descargar la plantilla", res.status);
    return res.blob();
  },

  importCsv: (entity: string, csv: string, dryRun: boolean) =>
    apiFetch<CsvImportResult>(`/imports/${entity}`, { method: "POST", body: JSON.stringify({ csv, dryRun }) }),

  listUsers: () => apiFetch<ClubUser[]>("/users"),

  listRoles: () => apiFetch<RoleOption[]>("/users/roles"),

  createUserAccount: (data: { email: string; name: string; role: string; password: string }) =>
    apiFetch<ClubUser>("/users", { method: "POST", body: JSON.stringify(data) }),
};

export { ApiError };
