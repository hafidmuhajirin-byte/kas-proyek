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

/** Secure cookies require HTTPS. Override with AUTH_COOKIE_SECURE=false for HTTP IP access until SSL is ready. */
function cookieSecure(): boolean {
  const override = process.env.AUTH_COOKIE_SECURE;
  if (override === "false" || override === "0") return false;
  if (override === "true" || override === "1") return true;
  return process.env.NODE_ENV === "production";
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 0,
  });
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
    redirect(homePathForUser(session));
  }
  return session;
}

/** @deprecated Alias historis — tetap berarti OWNER (mutasi kas). Jangan ubah. */
export async function requireAdmin(): Promise<SessionUser> {
  return requireOwner();
}

/** Gate modul LPJ / Buku Kas — hanya role ADMIN. Tidak mengubah requireAdmin(). */
export async function requireRoleAdmin(): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role !== "ADMIN") {
    redirect(homePathForUser(session));
  }
  return session;
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

/** Login khusus foto proyek (tanpa status dana/bukti). */
export function isAdmFoto(user: SessionUser): boolean {
  return user.role === "ADM_FOTO";
}

/** Admin Proyek — 1 proyek mandiri (kas terpisah). */
export function isAdminProyek(user: SessionUser): boolean {
  return user.role === "ADMIN_PROYEK";
}

/** Mandor atau ADM Foto — shell foto / penugasan proyek. */
export function isMandorLike(user: SessionUser): boolean {
  return user.role === "MANDOR" || user.role === "ADM_FOTO";
}

export function canMutateCash(user: SessionUser): boolean {
  return user.role === "OWNER";
}

export function canManageUsers(user: SessionUser): boolean {
  return user.role === "OWNER";
}

export function canRecordDisbursement(user: SessionUser): boolean {
  return user.role === "OWNER" || user.role === "ADMIN_PROYEK";
}

/** Owner, AdminOK, dan Admin Proyek boleh memecah nota Mandor. */
export function canBreakDownMandorExpense(user: SessionUser): boolean {
  return (
    user.role === "OWNER" ||
    user.role === "ADMIN" ||
    user.role === "ADMIN_PROYEK"
  );
}

export async function requireBreakdownAccess(): Promise<SessionUser> {
  const session = await requireSession();
  if (!canBreakDownMandorExpense(session)) {
    redirect(homePathForUser(session));
  }
  return session;
}

export function homePathForRole(role: SessionRole): string {
  if (role === "ADM_FOTO") return "/mandor/lokasi";
  if (role === "MANDOR") return "/mandor";
  if (role === "ADMIN") return "/admin/lpj";
  if (role === "ADMIN_PROYEK") return "/admin-proyek";
  return "/dashboard";
}

export function homePathForUser(user: Pick<SessionUser, "role">): string {
  return homePathForRole(user.role);
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

/** Proyek tunggal Admin Proyek (atau null jika belum ditugaskan). */
export async function getAdminProyekProjectId(
  user: SessionUser,
): Promise<string | null> {
  if (user.role !== "ADMIN_PROYEK") return null;
  const ids = await getAccessibleProjectIds(user);
  if (ids === "all" || ids.length === 0) return null;
  return ids[0] ?? null;
}

/**
 * Owner atau Admin Proyek yang punya akses proyek.
 * Untuk mutasi buku proyek mandiri / umum (bukan kas besar).
 */
export async function requireProjectBookkeeper(
  projectId: string,
): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role === "OWNER") return session;
  if (session.role === "ADMIN_PROYEK") {
    await requireProjectAccess(session, projectId);
    return session;
  }
  redirect(homePathForUser(session));
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
  if (!ok) redirect(homePathForUser(user));
}
