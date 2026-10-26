import { Request, Response, Router } from "express";
import { createActivityLog, db, newId } from "../db";
import { requireAuth } from "../middleware/auth";
import { canWrite, ModuleKey } from "../permissions";
import { csvToRecords, parseDate, parseNumber } from "../ingest/csv";

// Importador de planillas del club (CSV exportado de Excel o Google Sheets).
// Cada tipo de planilla pertenece a un sector y exige permiso de CARGA en
// ese sector: el que no puede cargar jugadores a mano tampoco puede
// importarlos en bloque. La importacion es "todo o nada": si hay una fila
// con error no se guarda ninguna, y se devuelve la lista de errores por fila
// para corregir la planilla y volver a subirla.

export const importsRouter = Router();
importsRouter.use(requireAuth);

type Rec = Record<string, string>;

interface PlayerRef {
  id: string;
}

interface EntityDef {
  label: string;
  module: ModuleKey;
  template: { headers: string[]; example: string[] };
  // Valida una fila y devuelve la funcion que la inserta, o el error.
  prepare: (rec: Rec, ctx: Ctx) => { error: string } | { insert: () => void };
}

interface Ctx {
  userId: string;
  findPlayer: (rec: Rec) => PlayerRef | { error: string };
  playerExists: (first: string, last: string) => boolean;
}

function oneOf(value: string, allowed: string[]): string | null {
  const v = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/^EN_/, ""); // "en recuperacion" vale como "recuperacion"
  return allowed.includes(v) ? v : null;
}

const ENTITIES: Record<string, EntityDef> = {
  jugadores: {
    label: "Plantel / candidatos",
    module: "gestion",
    template: {
      headers: ["nombre", "apellido", "posicion", "estado", "dorsal", "nacionalidad", "fecha_nacimiento", "contrato_hasta", "valor_mercado_usd", "notas_origen"],
      example: ["Juan", "Perez", "Delantero", "plantel", "9", "Argentina", "15/03/2001", "31/12/2027", "1200000", ""],
    },
    prepare: (rec, ctx) => {
      if (!rec.nombre || !rec.apellido) return { error: "Faltan nombre y/o apellido" };
      if (!rec.posicion) return { error: "Falta la posicion" };
      const estadoRaw = rec.estado || "plantel";
      const estado = oneOf(estadoRaw, ["PLANTEL", "CANDIDATO"]);
      if (!estado) return { error: `Estado invalido "${estadoRaw}" (usar plantel o candidato)` };
      if (ctx.playerExists(rec.nombre, rec.apellido)) return { error: `${rec.nombre} ${rec.apellido} ya existe en ClubOS` };
      const dorsal = parseNumber(rec.dorsal ?? "");
      if (Number.isNaN(dorsal)) return { error: "Dorsal invalido" };
      const born = rec.fecha_nacimiento ? parseDate(rec.fecha_nacimiento) : null;
      if (rec.fecha_nacimiento && !born) return { error: "Fecha de nacimiento invalida (usar DD/MM/AAAA)" };
      const contract = rec.contrato_hasta ? parseDate(rec.contrato_hasta) : null;
      if (rec.contrato_hasta && !contract) return { error: "Fecha de fin de contrato invalida (usar DD/MM/AAAA)" };
      const value = parseNumber(rec.valor_mercado_usd ?? "");
      if (Number.isNaN(value)) return { error: "Valor de mercado invalido" };
      return {
        insert: () => {
          db.prepare(
            `INSERT INTO players (id, firstName, lastName, position, nationality, status, dorsal, birthDate, contractUntil, marketValueUsd, originNotes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            newId(), rec.nombre, rec.apellido, rec.posicion, rec.nacionalidad || null,
            estado === "PLANTEL" ? "SQUAD" : "CANDIDATE", dorsal, born, contract, value, rec.notas_origen || null
          );
        },
      };
    },
  },

  estadisticas: {
    label: "Estadisticas de partidos",
    module: "data",
    template: {
      headers: ["nombre", "apellido", "fecha", "rival", "minutos", "goles", "asistencias", "rating"],
      example: ["Juan", "Perez", "12/09/2026", "vs. Club Atletico X", "90", "1", "0", "7,5"],
    },
    prepare: (rec, ctx) => {
      const player = ctx.findPlayer(rec);
      if ("error" in player) return player;
      const date = parseDate(rec.fecha ?? "");
      if (!date) return { error: "Fecha invalida (usar DD/MM/AAAA)" };
      if (!rec.rival) return { error: "Falta el rival" };
      const minutes = parseNumber(rec.minutos ?? "");
      const goals = parseNumber(rec.goles ?? "");
      const assists = parseNumber(rec.asistencias ?? "");
      const rating = parseNumber(rec.rating ?? "");
      if ([minutes, goals, assists, rating].some((n) => Number.isNaN(n))) return { error: "Minutos, goles, asistencias o rating no son numeros" };
      if (rating !== null && (rating < 1 || rating > 10)) return { error: "El rating tiene que estar entre 1 y 10" };
      return {
        insert: () => {
          db.prepare(
            `INSERT INTO player_stats (id, playerId, date, matchInfo, minutesPlayed, goals, assists, rating, createdById)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(newId(), player.id, date, rec.rival, minutes, goals ?? 0, assists ?? 0, rating, ctx.userId);
        },
      };
    },
  },

  tests_fisicos: {
    label: "Tests fisicos",
    module: "fisico_medico",
    template: {
      headers: ["nombre", "apellido", "fecha", "test", "valor", "unidad", "notas"],
      example: ["Juan", "Perez", "01/09/2026", "Sprint 30m", "4,15", "s", ""],
    },
    prepare: (rec, ctx) => {
      const player = ctx.findPlayer(rec);
      if ("error" in player) return player;
      const date = parseDate(rec.fecha ?? "");
      if (!date) return { error: "Fecha invalida (usar DD/MM/AAAA)" };
      if (!rec.test) return { error: "Falta el nombre del test" };
      const value = parseNumber(rec.valor ?? "");
      if (value === null || Number.isNaN(value)) return { error: "El valor tiene que ser un numero" };
      if (!rec.unidad) return { error: "Falta la unidad" };
      return {
        insert: () => {
          db.prepare(
            `INSERT INTO physical_tests (id, playerId, date, testType, value, unit, notes, createdById) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(newId(), player.id, date, rec.test, value, rec.unidad, rec.notas || null, ctx.userId);
        },
      };
    },
  },

  partes_medicos: {
    label: "Partes medicos",
    module: "fisico_medico",
    template: {
      headers: ["nombre", "apellido", "tipo", "fecha", "diagnostico", "estado", "retorno_estimado", "notas"],
      example: ["Juan", "Perez", "lesion", "05/09/2026", "Esguince de tobillo grado 1", "recuperacion", "30/09/2026", ""],
    },
    prepare: (rec, ctx) => {
      const player = ctx.findPlayer(rec);
      if ("error" in player) return player;
      const type = oneOf(rec.tipo ?? "", ["LESION", "CONTROL_MEDICO", "ALTA"]);
      if (!type) return { error: `Tipo invalido "${rec.tipo ?? ""}" (lesion, control medico o alta)` };
      const status = oneOf(rec.estado ?? "", ["ACTIVA", "RECUPERACION", "ALTA"]);
      if (!status) return { error: `Estado invalido "${rec.estado ?? ""}" (activa, recuperacion o alta)` };
      const date = parseDate(rec.fecha ?? "");
      if (!date) return { error: "Fecha invalida (usar DD/MM/AAAA)" };
      if (!rec.diagnostico) return { error: "Falta el diagnostico" };
      const ret = rec.retorno_estimado ? parseDate(rec.retorno_estimado) : null;
      if (rec.retorno_estimado && !ret) return { error: "Retorno estimado invalido (usar DD/MM/AAAA)" };
      return {
        insert: () => {
          db.prepare(
            `INSERT INTO medical_records (id, playerId, type, date, diagnosis, status, expectedReturn, notes, createdById)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(newId(), player.id, type, date, rec.diagnostico, status, ret, rec.notas || null, ctx.userId);
        },
      };
    },
  },
};

function entityFor(req: Request, res: Response): { key: string; def: EntityDef } | null {
  const key = req.params.entity;
  const def = ENTITIES[key];
  if (!def) {
    res.status(404).json({ error: "Tipo de planilla desconocido" });
    return null;
  }
  if (!canWrite(req.user!.role, def.module)) {
    res.status(403).json({ error: "No tenes acceso a este sector de la plataforma" });
    return null;
  }
  return { key, def };
}

// GET /api/imports -> que planillas puede subir este usuario.
importsRouter.get("/", (req, res) => {
  const role = req.user!.role;
  res.json(
    Object.entries(ENTITIES)
      .filter(([, def]) => canWrite(role, def.module))
      .map(([key, def]) => ({ key, label: def.label, columns: def.template.headers }))
  );
});

// GET /api/imports/:entity/template -> CSV de ejemplo, con ";" y BOM para que
// Excel en español lo abra con las columnas y los acentos bien.
importsRouter.get("/:entity/template", (req, res) => {
  const found = entityFor(req, res);
  if (!found) return;
  const { headers, example } = found.def.template;
  const body = "﻿" + headers.join(";") + "\r\n" + example.join(";") + "\r\n";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="plantilla-${found.key}.csv"`);
  res.send(body);
});

const MAX_ROWS = 5000;

// POST /api/imports/:entity { csv, dryRun? }
importsRouter.post("/:entity", (req, res) => {
  const found = entityFor(req, res);
  if (!found) return;
  const { csv, dryRun } = req.body ?? {};
  if (typeof csv !== "string" || !csv.trim()) return res.status(400).json({ error: "El archivo esta vacio" });

  const { headers, records } = csvToRecords(csv);
  const missing = found.def.template.headers.filter((h) => ["nombre", "apellido"].includes(h) && !headers.includes(h));
  if (missing.length > 0) {
    return res.status(400).json({ error: `Faltan columnas obligatorias: ${missing.join(", ")}. Descarga la plantilla para ver el formato.` });
  }
  if (records.length === 0) return res.status(400).json({ error: "La planilla no tiene filas de datos" });
  if (records.length > MAX_ROWS) return res.status(400).json({ error: `Maximo ${MAX_ROWS} filas por archivo` });

  // Columnas que no reconocemos: se ignoran, pero se avisa para que no
  // pase desapercibido un encabezado mal escrito.
  const ignoredColumns = headers.filter((h) => h && !found.def.template.headers.includes(h));

  const players = db.prepare("SELECT id, firstName, lastName FROM players").all() as { id: string; firstName: string; lastName: string }[];
  const key = (f: string, l: string) => `${f.trim().toLowerCase()}|${l.trim().toLowerCase()}`;
  const byName = new Map<string, string[]>();
  for (const p of players) {
    const k = key(p.firstName, p.lastName);
    byName.set(k, [...(byName.get(k) ?? []), p.id]);
  }
  // Para planillas de jugadores nuevos, los nombres dentro del mismo archivo
  // tambien cuentan como existentes (evita duplicar filas del propio archivo).
  const seenInFile = new Set<string>();

  const ctx: Ctx = {
    userId: req.user!.userId,
    findPlayer: (rec) => {
      if (!rec.nombre || !rec.apellido) return { error: "Faltan nombre y/o apellido" };
      const ids = byName.get(key(rec.nombre, rec.apellido)) ?? [];
      if (ids.length === 0) return { error: `No existe el jugador ${rec.nombre} ${rec.apellido} en ClubOS` };
      if (ids.length > 1) return { error: `Hay mas de un jugador llamado ${rec.nombre} ${rec.apellido}` };
      return { id: ids[0] };
    },
    playerExists: (first, last) => {
      const k = key(first, last);
      if (byName.has(k) || seenInFile.has(k)) return true;
      seenInFile.add(k);
      return false;
    },
  };

  const errors: { row: number; message: string }[] = [];
  const inserts: (() => void)[] = [];
  records.forEach((rec, i) => {
    const result = found.def.prepare(rec, ctx);
    if ("error" in result) errors.push({ row: i + 2, message: result.error }); // +2: encabezado + base 1
    else inserts.push(result.insert);
  });

  if (errors.length > 0 || dryRun) {
    return res.json({ total: records.length, valid: inserts.length, errors, ignoredColumns, imported: 0, dryRun: !!dryRun });
  }

  db.transaction(() => inserts.forEach((run) => run()))();
  createActivityLog({ type: "GESTION", message: `Se importaron ${inserts.length} filas de "${found.def.label}" desde una planilla` });
  return res.json({ total: records.length, valid: inserts.length, errors: [], ignoredColumns, imported: inserts.length, dryRun: false });
});
