import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { endOfDay, parseISO, startOfDay } from "date-fns";
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

function safeZipPart(raw: string): string {
  return raw
    .replace(/[^\w\-./]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

export async function GET(request: Request) {
  const session = await getSession();
  if (
    !session ||
    (!isOwner(session) && !isAdmin(session) && !isAdminProyek(session))
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = String(searchParams.get("projectId") ?? "").trim();
  const fromRaw = String(searchParams.get("from") ?? "").trim();
  const toRaw = String(searchParams.get("to") ?? "").trim();

  if (!projectId || !fromRaw || !toRaw) {
    return new Response("projectId, from, to wajib diisi.", { status: 400 });
  }
  if (!(await assertProjectAccess(session, projectId))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const from = startOfDay(parseISO(fromRaw));
  const to = endOfDay(parseISO(toRaw));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return new Response("Tanggal tidak valid.", { status: 400 });
  }
  if (from > to) {
    return new Response("Tanggal dari tidak boleh setelah sampai.", {
      status: 400,
    });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });
  if (!project) {
    return new Response("Proyek tidak ditemukan.", { status: 404 });
  }

  const videos = await prisma.projectSiteVideo.findMany({
    where: {
      projectId,
      takenAt: { gte: from, lte: to },
    },
    orderBy: [{ takenAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      videoUrl: true,
      sourceName: true,
      takenAt: true,
    },
  });

  if (videos.length === 0) {
    return new Response("Tidak ada video pada rentang tanggal itu.", {
      status: 404,
    });
  }

  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  const zip = new JSZip();
  const usedNames = new Set<string>();
  let added = 0;

  for (const video of videos) {
    if (!video.videoUrl.startsWith("/uploads/")) continue;
    const rel = video.videoUrl.replace(/^\//, "");
    const abs = path.join(process.cwd(), "public", rel);
    if (!abs.startsWith(uploadsRoot + path.sep)) continue;
    if (!existsSync(abs)) continue;

    const day = video.takenAt.toISOString().slice(0, 10);
    const base =
      safeZipPart(video.sourceName.replace(/\.[^.]+$/, ".mp4")) ||
      safeZipPart(path.basename(video.videoUrl)) ||
      `${video.id}.mp4`;
    let entry = `${day}/${base}`;
    if (usedNames.has(entry)) {
      entry = `${day}/${video.id}-${base}`;
    }
    usedNames.add(entry);
    zip.file(entry, await readFile(abs));
    added += 1;
  }

  if (added === 0) {
    return new Response("File video tidak ditemukan di server.", { status: 404 });
  }

  const projectSlug = safeZipPart(project.name) || "proyek";
  const filename = `video-${projectSlug}-${fromRaw}_${toRaw}.zip`;
  const body = await zip.generateAsync({
    type: "uint8array",
    compression: "STORE",
  });

  return new Response(Buffer.from(body), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
