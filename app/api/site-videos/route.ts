import { mkdir, writeFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  assertProjectAccess,
  getSession,
  isAdmFoto,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeSourceName } from "@/lib/site-photo-name";
import {
  SITE_VIDEO_MAX_DURATION_SEC,
  SITE_VIDEO_MAX_OUTPUT_BYTES,
  SITE_VIDEO_MAX_SOURCE_BYTES,
  SITE_VIDEO_MAX_TOTAL_SEC,
  isAllowedVideoType,
  isGenericCameraVideoName,
} from "@/lib/site-video";
import {
  compressSiteVideo,
  probeVideoDurationSec,
  unlinkQuiet,
} from "@/lib/compress-site-video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function sourceNameForVideo(fileName: string, buf: Buffer): Promise<string> {
  const raw = normalizeSourceName(fileName || "");
  if (isGenericCameraVideoName(raw)) {
    const slice = buf.subarray(0, Math.min(buf.byteLength, 65536));
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new Uint8Array(slice),
    );
    const hash = Array.from(new Uint8Array(digest))
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `cam-${hash}.mp4`;
  }
  return raw || `video-${Date.now()}.mp4`;
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Login dulu." }, { status: 401 });
  }
  if (!isAdmFoto(user)) {
    return NextResponse.json(
      { error: "Hanya ADM Foto yang dapat mengunggah video." },
      { status: 403 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Gagal membaca unggahan. Coba file lebih kecil." },
      { status: 400 },
    );
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const dateRaw = String(formData.get("date") ?? "").trim();
  const file = formData.get("video");

  if (!projectId || !dateRaw) {
    return NextResponse.json(
      { error: "Proyek dan tanggal wajib diisi." },
      { status: 400 },
    );
  }
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json(
      { error: "Pilih video dulu." },
      { status: 400 },
    );
  }
  if (file.size > SITE_VIDEO_MAX_SOURCE_BYTES) {
    return NextResponse.json(
      { error: "Ukuran video asli maksimal 40 MB. Rekam maksimal 1 menit." },
      { status: 400 },
    );
  }
  if (!isAllowedVideoType(file)) {
    return NextResponse.json(
      { error: "Format video harus MP4, MOV, atau WEBM." },
      { status: 400 },
    );
  }

  if (!(await assertProjectAccess(user, projectId))) {
    return NextResponse.json({ error: "Tidak ada akses proyek ini." }, { status: 403 });
  }

  const takenAt = new Date(dateRaw);
  if (Number.isNaN(takenAt.getTime())) {
    return NextResponse.json({ error: "Tanggal tidak valid." }, { status: 400 });
  }

  const totals = await prisma.projectSiteVideo.aggregate({
    where: { projectId },
    _sum: { durationSec: true },
  });
  const used = totals._sum.durationSec ?? 0;
  if (used >= SITE_VIDEO_MAX_TOTAL_SEC) {
    return NextResponse.json(
      {
        error:
          "Total video proyek sudah 5 menit. Hapus klip lama atau pilih proyek lain.",
      },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const sourceName = await sourceNameForVideo(file.name || "", buf);
  const existing = await prisma.projectSiteVideo.findUnique({
    where: { projectId_sourceName: { projectId, sourceName } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Video ini sudah pernah diunggah." },
      { status: 400 },
    );
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "lokasi-video");
  await mkdir(uploadsDir, { recursive: true });
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const srcExt = path.extname(file.name || "").toLowerCase() || ".mp4";
  const srcPath = path.join(uploadsDir, `src-${stamp}${srcExt}`);
  const outName = `${stamp}.mp4`;
  const outPath = path.join(uploadsDir, outName);

  try {
    await writeFile(srcPath, buf);
    const duration = await probeVideoDurationSec(srcPath);
    if (duration > SITE_VIDEO_MAX_DURATION_SEC + 0.5) {
      await unlinkQuiet(srcPath);
      return NextResponse.json(
        { error: "Potong/rekam ulang, maksimal 1 menit." },
        { status: 400 },
      );
    }
    if (used + Math.ceil(duration) > SITE_VIDEO_MAX_TOTAL_SEC) {
      await unlinkQuiet(srcPath);
      return NextResponse.json(
        {
          error: `Sisa kuota video proyek ${SITE_VIDEO_MAX_TOTAL_SEC - used} detik. Rekam lebih pendek.`,
        },
        { status: 400 },
      );
    }

    await compressSiteVideo(srcPath, outPath);
    await unlinkQuiet(srcPath);

    const info = await stat(outPath);
    if (info.size > SITE_VIDEO_MAX_OUTPUT_BYTES) {
      await unlinkQuiet(outPath);
      return NextResponse.json(
        { error: "Hasil kompres masih terlalu besar. Rekam lebih pendek." },
        { status: 400 },
      );
    }

    const durationSec = Math.max(1, Math.round(duration));
    await prisma.projectSiteVideo.create({
      data: {
        projectId,
        createdById: user.id,
        takenAt,
        caption,
        videoUrl: `/uploads/lokasi-video/${outName}`,
        sourceName,
        durationSec,
        fileSize: info.size,
      },
    });
  } catch (e) {
    await unlinkQuiet(srcPath);
    await unlinkQuiet(outPath);
    const msg = e instanceof Error ? e.message : "Gagal unggah video.";
    if (/Unique constraint|sourceName/i.test(msg)) {
      return NextResponse.json(
        { error: "Video dengan nama itu sudah dipakai." },
        { status: 400 },
      );
    }
    if (/ENOENT|ffmpeg|ffprobe/i.test(msg)) {
      return NextResponse.json(
        { error: "Server belum siap mengompres video. Coba lagi nanti." },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  revalidatePath("/mandor/lokasi");
  revalidatePath("/foto-proyek");
  revalidatePath(`/projects/${projectId}`);

  return NextResponse.json({ success: true });
}
