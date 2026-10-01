import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "clubos-demo-secret";

export interface AuthTokenPayload {
  userId: string;
  role: string;
  name: string;
  email: string;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}
