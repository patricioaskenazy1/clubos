import { NextFunction, Request, Response } from "express";
import { AuthTokenPayload, verifyToken } from "../auth";
import { canRead, canWrite, ModuleKey } from "../permissions";

// La API es el unico punto que escribe en la base de datos (ver Arquitectura
// tecnica del estudio de mercado): todo pedido pasa por este middleware, que
// valida el token y adjunta quien es la persona que esta pidiendo el dato.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autenticado" });
  }
  const token = header.slice("Bearer ".length);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Token invalido o vencido" });
  }
}

// Control de acceso por sector (modulo), tal como lo planteamos en Seguridad
// y datos sensibles: cada rol del club lee y carga solo lo suyo -- un
// preparador fisico no puede ver informes de scouting, un scout no puede ver
// partes medicos, etc. El limite real se aplica aca, en el backend, no solo
// ocultando botones en el frontend.
export function requireModule(module: ModuleKey, access: "read" | "write" = "write") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });
    const ok = access === "read" ? canRead(req.user.role, module) : canWrite(req.user.role, module);
    if (!ok) {
      return res.status(403).json({ error: "No tenes acceso a este sector de la plataforma" });
    }
    next();
  };
}

// Gestionar usuarios (dar de alta al resto del club) no es un sector mas:
// es una capacidad exclusiva de quien administra la plataforma.
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Solo el administrador puede gestionar usuarios" });
  }
  next();
}
