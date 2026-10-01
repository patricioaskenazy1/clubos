import { AuthUser, ModuleKey } from "./api";

// Espejo liviano de la logica del backend (permissions.ts), solo para
// decidir que mostrar en la UI -- el limite real se aplica en la API
// (ver requireModule en el backend), esto es puramente cosmetico/UX.
export function canRead(user: AuthUser | null, module: ModuleKey): boolean {
  return !!user && user.modules.read.includes(module);
}

export function canWrite(user: AuthUser | null, module: ModuleKey): boolean {
  return !!user && user.modules.write.includes(module);
}

export const MODULE_LABELS: Record<ModuleKey, string> = {
  gestion: "Gestion",
  scouting: "Scouting",
  video: "Video",
  entrenamientos: "Entrenamientos",
  data: "Data analyst",
  fisico_medico: "Fisico-medico",
};
