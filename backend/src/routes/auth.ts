import { Router } from "express";
import bcrypt from "bcryptjs";
import { findUserByEmail } from "../db";
import { signToken } from "../auth";
import { roleDef } from "../permissions";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "Falta email o password" });
  }

  const user = findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: "Credenciales invalidas" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Credenciales invalidas" });
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  });

  const { label, read, write } = roleDef(user.role);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleLabel: label,
      modules: { read, write },
    },
  });
});
