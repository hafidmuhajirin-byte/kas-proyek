import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  COOKIE_NAME,
  createSessionToken,
  verifySessionToken,
  type SessionUser,
  type SessionRole,
} from "@/lib/session";
import { prisma } from "@/lib/prisma";

export type { SessionUser, SessionRole };
export { COOKIE_NAME, createSessionToken, verifySessionToken };

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireOwner(): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role !== "OWNER") {
    redirect(homePathForRole(session.role));
  }
  return session;
}

/** @deprecated Gunakan requireOwner — mutasi penuh hanya Owner */
export async function requireAdmin(): Promise<SessionUser> {
  return requireOwner();
}

export function isOwner(user: SessionUser): boolean {
  return user.role === "OWNER";
}

export function isAdmin(user: SessionUser): boolean {
  return user.role === "ADMIN";
}

export function isMandor(user: SessionUser): boolean {
  return user.role === "MANDOR";
}

export function canMutateCash(user: SessionUser): boolean {
  return user.role === "OWNER";
}

export function canManageUsers(user: SessionUser): boolean {
  return user.role === "OWNER";
}

export function canRecordDisbursement(user: SessionUser): boolean {
  return user.role === "OWNER";
}

export function homePathForRole(role: SessionRole): string {
  if (role === "MANDOR") return "/mandor";
  if (role === "ADMIN") return "/dashboard";
  return "/dashboard";
}

export async function getAccessibleProjectIds(
  user: SessionUser,
): Promise<string[] | "all"> {
  if (user.role === "OWNER" || user.role === "ADMIN") return "all";
  const rows = await prisma.projectAssignment.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });
  return rows.map((r) => r.projectId);
}

export async function assertProjectAccess(
  user: SessionUser,
  projectId: string,
): Promise<boolean> {
  const ids = await getAccessibleProjectIds(user);
  if (ids === "all") return true;
  return ids.includes(projectId);
}

export async function requireProjectAccess(
  user: SessionUser,
  projectId: string,
): Promise<void> {
  const ok = await assertProjectAccess(user, projectId);
  if (!ok) redirect(homePathForRole(user.role));
}
