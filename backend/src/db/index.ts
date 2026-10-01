import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const dbPath = process.env.DATABASE_FILE || path.join(__dirname, "..", "..", "dev.db");
export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function migrate() {
  const schemaPath = path.join(__dirname, "..", "..", "sql", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  db.exec(schema);
}

export function newId() {
  return randomUUID();
}

// ---------- Tipos ----------

export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: string;
  createdAt: string;
}

export interface PlayerRow {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  nationality: string | null;
  status: string;
  dorsal: number | null;
  birthDate: string | null;
  contractUntil: string | null;
  marketValueUsd: number | null;
  originNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScoutingReportRow {
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

export interface ActivityLogRow {
  id: string;
  type: string;
  message: string;
  playerId: string | null;
  createdAt: string;
  playerFirstName?: string | null;
  playerLastName?: string | null;
}

// ---------- Usuarios ----------

export function findUserByEmail(email: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
}

export function createUser(data: { email: string; passwordHash: string; name: string; role: string }): UserRow {
  const id = newId();
  db.prepare(
    "INSERT INTO users (id, email, passwordHash, name, role) VALUES (@id, @email, @passwordHash, @name, @role)"
  ).run({ id, ...data });
  return findUserByEmail(data.email)!;
}

export function countUsers(): number {
  const row = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
  return row.c;
}

export function listUsers(): UserRow[] {
  return db.prepare("SELECT * FROM users ORDER BY createdAt ASC").all() as UserRow[];
}

// ---------- Jugadores ----------

export function listPlayers(status?: string): PlayerRow[] {
  if (status) {
    return db.prepare("SELECT * FROM players WHERE status = ? ORDER BY lastName ASC").all(status) as PlayerRow[];
  }
  return db.prepare("SELECT * FROM players ORDER BY lastName ASC").all() as PlayerRow[];
}

export function getPlayerById(id: string): PlayerRow | undefined {
  return db.prepare("SELECT * FROM players WHERE id = ?").get(id) as PlayerRow | undefined;
}

export function createPlayer(data: Partial<PlayerRow> & { firstName: string; lastName: string; position: string; status: string }): PlayerRow {
  const id = newId();
  db.prepare(
    `INSERT INTO players (id, firstName, lastName, position, nationality, status, dorsal, birthDate, contractUntil, marketValueUsd, originNotes)
     VALUES (@id, @firstName, @lastName, @position, @nationality, @status, @dorsal, @birthDate, @contractUntil, @marketValueUsd, @originNotes)`
  ).run({
    id,
    firstName: data.firstName,
    lastName: data.lastName,
    position: data.position,
    nationality: data.nationality ?? null,
    status: data.status,
    dorsal: data.dorsal ?? null,
    birthDate: data.birthDate ?? null,
    contractUntil: data.contractUntil ?? null,
    marketValueUsd: data.marketValueUsd ?? null,
    originNotes: data.originNotes ?? null,
  });
  return getPlayerById(id)!;
}

export function updatePlayer(id: string, data: Partial<PlayerRow>): PlayerRow | undefined {
  const existing = getPlayerById(id);
  if (!existing) return undefined;
  const merged = { ...existing, ...data, updatedAt: new Date().toISOString() };
  db.prepare(
    `UPDATE players SET firstName=@firstName, lastName=@lastName, position=@position, nationality=@nationality,
     status=@status, dorsal=@dorsal, birthDate=@birthDate, contractUntil=@contractUntil,
     marketValueUsd=@marketValueUsd, originNotes=@originNotes, updatedAt=@updatedAt WHERE id=@id`
  ).run(merged);
  return getPlayerById(id);
}

// ---------- Informes de scouting ----------

export function listScoutingReports(playerId?: string): ScoutingReportRow[] {
  const base = `
    SELECT sr.*, u.name as authorName, p.firstName as playerFirstName, p.lastName as playerLastName
    FROM scouting_reports sr
    JOIN users u ON u.id = sr.authorId
    JOIN players p ON p.id = sr.playerId
  `;
  if (playerId) {
    return db.prepare(`${base} WHERE sr.playerId = ? ORDER BY sr.createdAt DESC`).all(playerId) as ScoutingReportRow[];
  }
  return db.prepare(`${base} ORDER BY sr.createdAt DESC`).all() as ScoutingReportRow[];
}

export function createScoutingReport(data: {
  playerId: string;
  authorId: string;
  matchInfo?: string;
  rating: number;
  strengths?: string;
  weaknesses?: string;
  recommendation?: string;
}): ScoutingReportRow {
  const id = newId();
  db.prepare(
    `INSERT INTO scouting_reports (id, playerId, authorId, matchInfo, rating, strengths, weaknesses, recommendation)
     VALUES (@id, @playerId, @authorId, @matchInfo, @rating, @strengths, @weaknesses, @recommendation)`
  ).run({
    id,
    playerId: data.playerId,
    authorId: data.authorId,
    matchInfo: data.matchInfo ?? null,
    rating: data.rating,
    strengths: data.strengths ?? null,
    weaknesses: data.weaknesses ?? null,
    recommendation: data.recommendation ?? null,
  });
  return db.prepare("SELECT * FROM scouting_reports WHERE id = ?").get(id) as ScoutingReportRow;
}

export function countScoutingReportsSince(sinceISO: string): number {
  const row = db.prepare("SELECT COUNT(*) as c FROM scouting_reports WHERE createdAt >= ?").get(sinceISO) as { c: number };
  return row.c;
}

// ---------- Actividad (feed del dashboard) ----------

export function createActivityLog(data: { type: string; message: string; playerId?: string | null }) {
  const id = newId();
  db.prepare("INSERT INTO activity_log (id, type, message, playerId) VALUES (@id, @type, @message, @playerId)").run({
    id,
    type: data.type,
    message: data.message,
    playerId: data.playerId ?? null,
  });
}

export function recentActivity(limit = 8): ActivityLogRow[] {
  return db
    .prepare(
      `SELECT a.*, p.firstName as playerFirstName, p.lastName as playerLastName
       FROM activity_log a
       LEFT JOIN players p ON p.id = a.playerId
       ORDER BY a.createdAt DESC, a.rowid DESC
       LIMIT ?`
    )
    .all(limit) as ActivityLogRow[];
}

export function countPlayersByStatus(status: string): number {
  const row = db.prepare("SELECT COUNT(*) as c FROM players WHERE status = ?").get(status) as { c: number };
  return row.c;
}

// ---------- Video (fase 2: videoanalisis) ----------

export interface VideoRow {
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

export interface VideoTagRow {
  id: string;
  videoId: string;
  minute: number;
  label: string;
  note: string | null;
  createdById: string;
  createdAt: string;
  createdByName?: string;
}

export function listVideos(playerId?: string): VideoRow[] {
  const base = `
    SELECT v.*, p.firstName as playerFirstName, p.lastName as playerLastName, u.name as uploadedByName,
      (SELECT COUNT(*) FROM video_tags vt WHERE vt.videoId = v.id) as tagCount
    FROM videos v
    JOIN players p ON p.id = v.playerId
    JOIN users u ON u.id = v.uploadedById
  `;
  if (playerId) {
    return db.prepare(`${base} WHERE v.playerId = ? ORDER BY v.createdAt DESC`).all(playerId) as VideoRow[];
  }
  return db.prepare(`${base} ORDER BY v.createdAt DESC`).all() as VideoRow[];
}

export function getVideoById(id: string): VideoRow | undefined {
  return db
    .prepare(
      `SELECT v.*, p.firstName as playerFirstName, p.lastName as playerLastName, u.name as uploadedByName
       FROM videos v
       JOIN players p ON p.id = v.playerId
       JOIN users u ON u.id = v.uploadedById
       WHERE v.id = ?`
    )
    .get(id) as VideoRow | undefined;
}

export function createVideo(data: { playerId: string; title: string; videoUrl: string; matchInfo?: string; uploadedById: string }): VideoRow {
  const id = newId();
  db.prepare(
    `INSERT INTO videos (id, playerId, title, videoUrl, matchInfo, uploadedById)
     VALUES (@id, @playerId, @title, @videoUrl, @matchInfo, @uploadedById)`
  ).run({
    id,
    playerId: data.playerId,
    title: data.title,
    videoUrl: data.videoUrl,
    matchInfo: data.matchInfo ?? null,
    uploadedById: data.uploadedById,
  });
  return getVideoById(id)!;
}

export function listVideoTags(videoId: string): VideoTagRow[] {
  return db
    .prepare(
      `SELECT vt.*, u.name as createdByName
       FROM video_tags vt
       JOIN users u ON u.id = vt.createdById
       WHERE vt.videoId = ?
       ORDER BY vt.minute ASC`
    )
    .all(videoId) as VideoTagRow[];
}

export function createVideoTag(data: { videoId: string; minute: number; label: string; note?: string; createdById: string }): VideoTagRow {
  const id = newId();
  db.prepare(
    `INSERT INTO video_tags (id, videoId, minute, label, note, createdById)
     VALUES (@id, @videoId, @minute, @label, @note, @createdById)`
  ).run({
    id,
    videoId: data.videoId,
    minute: data.minute,
    label: data.label,
    note: data.note ?? null,
    createdById: data.createdById,
  });
  return db
    .prepare(`SELECT vt.*, u.name as createdByName FROM video_tags vt JOIN users u ON u.id = vt.createdById WHERE vt.id = ?`)
    .get(id) as VideoTagRow;
}

export function countVideosSince(sinceISO: string): number {
  const row = db.prepare("SELECT COUNT(*) as c FROM videos WHERE createdAt >= ?").get(sinceISO) as { c: number };
  return row.c;
}

// ---------- Entrenamientos (fase 2) ----------

export interface TrainingSessionRow {
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

export interface TrainingAttendanceRow {
  id: string;
  sessionId: string;
  playerId: string;
  status: string;
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

export function listTrainingSessions(): TrainingSessionRow[] {
  return db
    .prepare(
      `SELECT ts.*, u.name as createdByName,
        (SELECT COUNT(*) FROM training_attendance ta WHERE ta.sessionId = ts.id) as attendanceCount
       FROM training_sessions ts
       JOIN users u ON u.id = ts.createdById
       ORDER BY ts.date DESC, ts.createdAt DESC`
    )
    .all() as TrainingSessionRow[];
}

export function getTrainingSessionById(id: string): TrainingSessionRow | undefined {
  return db
    .prepare(
      `SELECT ts.*, u.name as createdByName FROM training_sessions ts JOIN users u ON u.id = ts.createdById WHERE ts.id = ?`
    )
    .get(id) as TrainingSessionRow | undefined;
}

export function createTrainingSession(data: { date: string; title: string; sessionType: string; notes?: string; createdById: string }): TrainingSessionRow {
  const id = newId();
  db.prepare(
    `INSERT INTO training_sessions (id, date, title, sessionType, notes, createdById)
     VALUES (@id, @date, @title, @sessionType, @notes, @createdById)`
  ).run({
    id,
    date: data.date,
    title: data.title,
    sessionType: data.sessionType,
    notes: data.notes ?? null,
    createdById: data.createdById,
  });
  return getTrainingSessionById(id)!;
}

export function listSessionAttendance(sessionId: string): TrainingAttendanceRow[] {
  return db
    .prepare(
      `SELECT ta.*, p.firstName as playerFirstName, p.lastName as playerLastName
       FROM training_attendance ta
       JOIN players p ON p.id = ta.playerId
       WHERE ta.sessionId = ?
       ORDER BY p.lastName ASC`
    )
    .all(sessionId) as TrainingAttendanceRow[];
}

export function listPlayerAttendance(playerId: string): TrainingAttendanceRow[] {
  return db
    .prepare(
      `SELECT ta.*, ts.date as sessionDate, ts.title as sessionTitle, ts.sessionType as sessionType
       FROM training_attendance ta
       JOIN training_sessions ts ON ts.id = ta.sessionId
       WHERE ta.playerId = ?
       ORDER BY ts.date DESC`
    )
    .all(playerId) as TrainingAttendanceRow[];
}

export function upsertAttendance(data: {
  sessionId: string;
  playerId: string;
  status: string;
  load?: number;
  note?: string;
  createdById: string;
}): TrainingAttendanceRow {
  const existing = db
    .prepare("SELECT id FROM training_attendance WHERE sessionId = ? AND playerId = ?")
    .get(data.sessionId, data.playerId) as { id: string } | undefined;
  const id = existing?.id ?? newId();
  db.prepare(
    `INSERT INTO training_attendance (id, sessionId, playerId, status, load, note, createdById)
     VALUES (@id, @sessionId, @playerId, @status, @load, @note, @createdById)
     ON CONFLICT(sessionId, playerId) DO UPDATE SET status=excluded.status, load=excluded.load, note=excluded.note`
  ).run({
    id,
    sessionId: data.sessionId,
    playerId: data.playerId,
    status: data.status,
    load: data.load ?? null,
    note: data.note ?? null,
    createdById: data.createdById,
  });
  return db.prepare("SELECT * FROM training_attendance WHERE id = ?").get(id) as TrainingAttendanceRow;
}

export function countTrainingSessionsSince(sinceISO: string): number {
  const row = db.prepare("SELECT COUNT(*) as c FROM training_sessions WHERE createdAt >= ?").get(sinceISO) as { c: number };
  return row.c;
}

// ---------- Data analyst (fase 2) ----------

export interface PlayerStatRow {
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

export function listPlayerStats(playerId?: string): PlayerStatRow[] {
  const base = `
    SELECT ps.*, p.firstName as playerFirstName, p.lastName as playerLastName
    FROM player_stats ps
    JOIN players p ON p.id = ps.playerId
  `;
  if (playerId) {
    return db.prepare(`${base} WHERE ps.playerId = ? ORDER BY ps.date DESC`).all(playerId) as PlayerStatRow[];
  }
  return db.prepare(`${base} ORDER BY ps.date DESC`).all() as PlayerStatRow[];
}

export function createPlayerStat(data: {
  playerId: string;
  date: string;
  matchInfo: string;
  minutesPlayed?: number;
  goals?: number;
  assists?: number;
  rating?: number;
  createdById: string;
}): PlayerStatRow {
  const id = newId();
  db.prepare(
    `INSERT INTO player_stats (id, playerId, date, matchInfo, minutesPlayed, goals, assists, rating, createdById)
     VALUES (@id, @playerId, @date, @matchInfo, @minutesPlayed, @goals, @assists, @rating, @createdById)`
  ).run({
    id,
    playerId: data.playerId,
    date: data.date,
    matchInfo: data.matchInfo,
    minutesPlayed: data.minutesPlayed ?? null,
    goals: data.goals ?? 0,
    assists: data.assists ?? 0,
    rating: data.rating ?? null,
    createdById: data.createdById,
  });
  return db
    .prepare(
      `SELECT ps.*, p.firstName as playerFirstName, p.lastName as playerLastName FROM player_stats ps JOIN players p ON p.id = ps.playerId WHERE ps.id = ?`
    )
    .get(id) as PlayerStatRow;
}

export function squadStatsSummary(): SquadStatsSummaryRow[] {
  return db
    .prepare(
      `SELECT p.id as playerId, p.firstName, p.lastName,
        COUNT(ps.id) as matchesPlayed,
        COALESCE(SUM(ps.minutesPlayed), 0) as totalMinutes,
        COALESCE(SUM(ps.goals), 0) as totalGoals,
        COALESCE(SUM(ps.assists), 0) as totalAssists,
        AVG(ps.rating) as avgRating
       FROM players p
       JOIN player_stats ps ON ps.playerId = p.id
       WHERE p.status = 'SQUAD'
       GROUP BY p.id
       ORDER BY totalGoals DESC, totalAssists DESC`
    )
    .all() as SquadStatsSummaryRow[];
}

export function countPlayerStatsSince(sinceISO: string): number {
  const row = db.prepare("SELECT COUNT(*) as c FROM player_stats WHERE createdAt >= ?").get(sinceISO) as { c: number };
  return row.c;
}

// ---------- Fisico-medico (fase 2, ultimo modulo) ----------

export interface MedicalRecordRow {
  id: string;
  playerId: string;
  type: string;
  date: string;
  diagnosis: string;
  status: string;
  expectedReturn: string | null;
  notes: string | null;
  createdById: string;
  createdAt: string;
  playerFirstName?: string;
  playerLastName?: string;
}

export interface PhysicalTestRow {
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

export function listMedicalRecords(playerId?: string): MedicalRecordRow[] {
  const base = `
    SELECT mr.*, p.firstName as playerFirstName, p.lastName as playerLastName
    FROM medical_records mr
    JOIN players p ON p.id = mr.playerId
  `;
  if (playerId) {
    return db.prepare(`${base} WHERE mr.playerId = ? ORDER BY mr.date DESC`).all(playerId) as MedicalRecordRow[];
  }
  return db.prepare(`${base} ORDER BY mr.date DESC`).all() as MedicalRecordRow[];
}

export function createMedicalRecord(data: {
  playerId: string;
  type: string;
  date: string;
  diagnosis: string;
  status: string;
  expectedReturn?: string;
  notes?: string;
  createdById: string;
}): MedicalRecordRow {
  const id = newId();
  db.prepare(
    `INSERT INTO medical_records (id, playerId, type, date, diagnosis, status, expectedReturn, notes, createdById)
     VALUES (@id, @playerId, @type, @date, @diagnosis, @status, @expectedReturn, @notes, @createdById)`
  ).run({
    id,
    playerId: data.playerId,
    type: data.type,
    date: data.date,
    diagnosis: data.diagnosis,
    status: data.status,
    expectedReturn: data.expectedReturn ?? null,
    notes: data.notes ?? null,
    createdById: data.createdById,
  });
  return db
    .prepare(
      `SELECT mr.*, p.firstName as playerFirstName, p.lastName as playerLastName FROM medical_records mr JOIN players p ON p.id = mr.playerId WHERE mr.id = ?`
    )
    .get(id) as MedicalRecordRow;
}

export function countActiveInjuries(): number {
  const row = db.prepare("SELECT COUNT(*) as c FROM medical_records WHERE type = 'LESION' AND status != 'ALTA'").get() as {
    c: number;
  };
  return row.c;
}

export function countMedicalRecordsSince(sinceISO: string): number {
  const row = db.prepare("SELECT COUNT(*) as c FROM medical_records WHERE createdAt >= ?").get(sinceISO) as { c: number };
  return row.c;
}

export function listPhysicalTests(playerId?: string): PhysicalTestRow[] {
  const base = `
    SELECT pt.*, p.firstName as playerFirstName, p.lastName as playerLastName
    FROM physical_tests pt
    JOIN players p ON p.id = pt.playerId
  `;
  if (playerId) {
    return db.prepare(`${base} WHERE pt.playerId = ? ORDER BY pt.date DESC`).all(playerId) as PhysicalTestRow[];
  }
  return db.prepare(`${base} ORDER BY pt.date DESC`).all() as PhysicalTestRow[];
}

export function createPhysicalTest(data: {
  playerId: string;
  date: string;
  testType: string;
  value: number;
  unit: string;
  notes?: string;
  createdById: string;
}): PhysicalTestRow {
  const id = newId();
  db.prepare(
    `INSERT INTO physical_tests (id, playerId, date, testType, value, unit, notes, createdById)
     VALUES (@id, @playerId, @date, @testType, @value, @unit, @notes, @createdById)`
  ).run({
    id,
    playerId: data.playerId,
    date: data.date,
    testType: data.testType,
    value: data.value,
    unit: data.unit,
    notes: data.notes ?? null,
    createdById: data.createdById,
  });
  return db
    .prepare(
      `SELECT pt.*, p.firstName as playerFirstName, p.lastName as playerLastName FROM physical_tests pt JOIN players p ON p.id = pt.playerId WHERE pt.id = ?`
    )
    .get(id) as PhysicalTestRow;
}

export function countPhysicalTestsSince(sinceISO: string): number {
  const row = db.prepare("SELECT COUNT(*) as c FROM physical_tests WHERE createdAt >= ?").get(sinceISO) as { c: number };
  return row.c;
}
