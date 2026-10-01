import { Router } from "express";
import bcrypt from "bcryptjs";
import { createUser, findUserByEmail, listUsers } from "../db";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { ROLE_DEFS, roleDef } from "../permissions";

export const usersRouter = Router();

usersRouter.use(requireAuth);

// GET /api/users -> lista de cuentas del club (solo el admin gestiona
// usuarios). No se manda el hash de la contrasena.
usersRouter.get("/", requireAdmin, (_req, res) => {
  const users = listUsers().map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    roleLabel: roleDef(u.role).label,
    createdAt: u.createdAt,
  }));
  res.json(users);
});

// GET /api/users/roles -> los roles disponibles y su etiqueta, para armar
// el selector en el formulario de alta sin hardcodear la lista en el front.
usersRouter.get("/roles", requireAdmin, (_req, res) => {
  const roles = Object.entries(ROLE_DEFS).map(([key, def]) => ({ key, label: def.label }));
  res.json(roles);
});

// POST /api/users -> da de alta a una persona real del club (cuerpo
// tecnico, preparador fisico, dirigencia, scout, u otro admin).
usersRouter.post("/", requireAdmin, async (req, res) => {
  const { email, name, role, password } = req.body ?? {};

  if (!email || !name || !role || !password) {
    return res.status(400).json({ error: "Faltan campos obligatorios (email, name, role, password)" });
  }
  if (!ROLE_DEFS[role]) {
    return res.status(400).json({ error: "Rol invalido" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "La contrasena tiene que tener al menos 6 caracteres" });
  }
  if (findUserByEmail(email)) {
    return res.status(409).json({ error: "Ya existe una cuenta con ese email" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = createUser({ email, name, role, passwordHash });

  res.status(201).json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roleLabel: roleDef(user.role).label,
    createdAt: user.createdAt,
  });
});
