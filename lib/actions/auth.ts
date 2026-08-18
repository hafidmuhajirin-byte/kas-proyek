"use server";

import { compareSync } from "bcryptjs";
import { redirect } from "next/navigation";
import {
  clearSessionCookie,
  createSessionToken,
  homePathForUser,
  setSessionCookie,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionRole } from "@/lib/session";

export type AuthState = {
  error?: string;
};

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Username dan password wajib diisi." };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !compareSync(password, user.passwordHash)) {
    return { error: "Username atau password salah." };
  }

  const role = user.role as SessionRole;
  const sessionUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    role,
  };
  const token = await createSessionToken(sessionUser);
  await setSessionCookie(token);

  redirect(homePathForUser(sessionUser));
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
