import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const isWeakProductionSecret =
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_SECRET || ["dev_secret", "dev-secret", "CHANGE_ME"].some((marker) => JWT_SECRET.includes(marker)));

if (isWeakProductionSecret) {
  throw new Error("KCS Orbit production configuration is unsafe. Set a strong JWT_SECRET.");
}

export type JwtPayload = {
  userId: string;
  role: string;
  organizationId?: string | null;
};

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
