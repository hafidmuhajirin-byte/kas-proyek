import { existsSync } from "fs";
import { readFile, stat } from "fs/promises";
import path from "path";
import {
  assertProjectAccess,
  getSession,
  isAdmin,
  isAdminProyek,
  isOwner,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (
    !session ||
    (!isOwner(session) && !isAdmin(session) && !isAdminProyek(session))
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;
  const video = await prisma.projectSiteVideo.findUnique({
    where: { id },
    select: {
      id: true,
      videoUrl: true,
      sourceName: true,
      projectId: true,
    },
  });
  if (!video) {
    return new Response("Video tidak ditemukan.", { status: 404 });
  }
  if (!(await assertProjectAccess(session, video.projectId))) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!video.videoUrl.startsWith("/uploads/")) {
    return new Response("File tidak valid.", { status: 404 });
  }

  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  const rel = video.videoUrl.replace(/^\//, "");
  const abs = path.join(process.cwd(), "public", rel);
  if (!abs.startsWith(uploadsRoot + path.sep) || !existsSync(abs)) {
    return new Response("File video tidak ditemukan di server.", { status: 404 });
  }

  const info = await stat(abs);
  const buf = await readFile(abs);
  const base =
    (video.sourceName.replace(/\.[^.]+$/, "") || video.id).replace(
      /[^\w\-]+/g,
      "_",
    ) + ".mp4";

  return new Response(buf, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(info.size),
      "Content-Disposition": `attachment; filename="${base}"`,
      "Cache-Control": "no-store",
    },
  });
}
