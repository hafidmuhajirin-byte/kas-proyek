import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildAssistantContext } from "@/lib/assistant/context";
import {
  localReplyEngine,
  replyUnitInconsistency,
  suggestionsForRole,
  welcomeForRole,
} from "@/lib/assistant/engine";
import { buildAssistantGuards, checkDraftUnitAgainstMemory } from "@/lib/assistant/guards";
import { assertMenuHelpComplete } from "@/lib/assistant/catalog";
import { prisma } from "@/lib/prisma";
import type { SessionRole } from "@/lib/session";

assertMenuHelpComplete();

async function projectIdsForRole(
  role: SessionRole,
  userId: string,
): Promise<string[] | null> {
  if (role === "ADMIN" || role === "OWNER") return null; // all active
  const rows = await prisma.projectAssignment.findMany({
    where: { userId },
    select: { projectId: true },
  });
  return rows.map((r) => r.projectId);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let message = "";
  let checkUnit:
    | { projectId?: string; description: string; unit: string }
    | undefined;
  let bootstrap = false;
  try {
    const body = (await request.json()) as {
      message?: string;
      checkUnit?: { projectId?: string; description: string; unit: string };
      bootstrap?: boolean;
    };
    message = String(body.message ?? "").slice(0, 800);
    checkUnit = body.checkUnit;
    bootstrap = Boolean(body.bootstrap);
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }

  const role = session.role as SessionRole;

  // Fast path: unit consistency from form
  if (checkUnit?.description && checkUnit?.unit) {
    const result = await checkDraftUnitAgainstMemory({
      projectId: checkUnit.projectId,
      description: checkUnit.description,
      unit: checkUnit.unit,
    });
    if (result && !result.ok) {
      return NextResponse.json({
        reply: replyUnitInconsistency(result.message),
        openChat: true,
        reminderCount: 1,
        suggestions: suggestionsForRole(role),
        welcome: welcomeForRole(role),
      });
    }
    return NextResponse.json({
      reply: null,
      openChat: false,
      ok: true,
      suggestions: suggestionsForRole(role),
    });
  }

  const projectIds = await projectIdsForRole(role, session.id);
  const [ctx, guards] = await Promise.all([
    role === "OWNER" || role === "ADMIN"
      ? buildAssistantContext()
      : buildAssistantContext(), // same builder; guards scoped below
    buildAssistantGuards({ role, projectIds }),
  ]);

  // Scope owner project snaps for non-owner if needed — keep full for now for names
  const reply = localReplyEngine({
    message: message || (bootstrap ? "prioritas hari ini" : "bantuan"),
    role,
    ctx,
    guards,
  });

  const warnCount = guards.filter((g) => g.severity === "warn").length;

  return NextResponse.json({
    reply,
    reminderCount: Math.max(ctx.reminders.length, warnCount),
    openChat: Boolean(bootstrap && warnCount > 0),
    suggestions: suggestionsForRole(role),
    welcome: welcomeForRole(role),
    guardCount: guards.length,
  });
}
