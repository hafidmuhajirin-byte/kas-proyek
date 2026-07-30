import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildAssistantContext } from "@/lib/assistant/context";
import { localReplyEngine } from "@/lib/assistant/engine";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let message = "";
  try {
    const body = (await request.json()) as { message?: string };
    message = String(body.message ?? "").slice(0, 500);
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }

  const ctx = await buildAssistantContext();
  const reply = localReplyEngine(message || "pengingat", ctx);

  return NextResponse.json({
    reply,
    reminderCount: ctx.reminders.length,
  });
}
