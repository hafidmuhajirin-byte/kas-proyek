import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "kas_session";

export type SessionRole = "OWNER" | "ADMIN" | "MANDOR";

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: SessionRole;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET belum diatur di .env");
  }
  return new TextEncoder().encode(secret);
}

function isSessionRole(role: unknown): role is SessionRole {
  return role === "OWNER" || role === "ADMIN" || role === "MANDOR";
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.id !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.name !== "string" ||
      !isSessionRole(payload.role)
    ) {
      return null;
    }
    return {
      id: payload.id,
      username: payload.username,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
