import bcrypt from "bcryptjs";
import { countUsers, createUser } from "./db";

// Arranque de un club real (no el seed de demo con jugadores falsos, ver
// db/seed.ts -- ese es solo para desarrollo). Si la base esta vacia, crea
// UN admin real a partir de variables de entorno, para que quien despliega
// la plataforma pueda entrar de una sin que nadie tenga que correrle un
// script. Desde ahi, ese admin da de alta al resto del cuerpo tecnico,
// dirigencia, etc. desde la pantalla de Usuarios -- no hay jugadores,
// candidatos ni datos de ejemplo cargados.
export async function ensureAdminUser() {
  if (countUsers() > 0) return;

  const email = process.env.ADMIN_EMAIL || "admin@clubos.demo";
  const password = process.env.ADMIN_PASSWORD || "clubos2026";
  const name = process.env.ADMIN_NAME || "Administrador";

  const passwordHash = await bcrypt.hash(password, 10);
  createUser({ email, name, role: "ADMIN", passwordHash });

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    // eslint-disable-next-line no-console
    console.warn(
      `[ClubOS] No configuraste ADMIN_EMAIL/ADMIN_PASSWORD: se creo ${email} con una contrasena por defecto. ` +
        "Cambiala apenas entres, o mejor, configura esas variables de entorno y volve a desplegar."
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(`[ClubOS] Admin inicial creado: ${email}`);
  }
}
