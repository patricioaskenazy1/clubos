// Control de acceso por sector, no solo por "quien puede escribir": cada rol
// del club ve (lee) y carga (escribe) solo los modulos que le corresponden.
// Esto es lo que Patricio pidio para el piloto real: "vamos a necesitar
// diferentes accesos para cada uno ya que todos no van a ingresar al mismo
// sector". La fuente de verdad vive aca (backend); el login le manda al
// frontend la lista de modulos que le tocan a ese usuario para que la UI
// se adapte, pero el limite real se aplica en cada endpoint (ver
// requireModule en middleware/auth.ts) -- lo mismo que ya haciamos con el
// scout y la carga de jugadores, ahora tambien para la lectura.

export type ModuleKey = "gestion" | "scouting" | "video" | "entrenamientos" | "data" | "fisico_medico";

export const ALL_MODULES: ModuleKey[] = ["gestion", "scouting", "video", "entrenamientos", "data", "fisico_medico"];

export interface RoleDef {
  label: string;
  read: ModuleKey[];
  write: ModuleKey[];
}

// Roles pensados para un club real (ver "Arquitectura tecnica" ->
// Seguridad y datos sensibles): cada uno entra solo a su sector. ADMIN
// queda como acceso total, para quien administra la plataforma (por
// ejemplo, el propio Patricio).
export const ROLE_DEFS: Record<string, RoleDef> = {
  ADMIN: { label: "Administrador", read: ALL_MODULES, write: ALL_MODULES },
  DIRIGENCIA: { label: "Dirigencia / Gestion del club", read: ["gestion"], write: ["gestion"] },
  CUERPO_TECNICO: { label: "Cuerpo tecnico / DT", read: ["entrenamientos", "data", "video"], write: ["entrenamientos", "data"] },
  FISICO_MEDICO: { label: "Preparador fisico / Kinesiologo", read: ["fisico_medico"], write: ["fisico_medico"] },
  SCOUT: { label: "Ojeador / Scout", read: ["scouting", "video"], write: ["scouting", "video"] },
};

export function roleDef(role: string): RoleDef {
  return ROLE_DEFS[role] ?? { label: role, read: [], write: [] };
}

export function canRead(role: string, module: ModuleKey): boolean {
  return roleDef(role).read.includes(module);
}

export function canWrite(role: string, module: ModuleKey): boolean {
  return roleDef(role).write.includes(module);
}

export function readableModules(role: string): ModuleKey[] {
  return roleDef(role).read;
}
