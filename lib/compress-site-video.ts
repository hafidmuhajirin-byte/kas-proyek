import { spawn } from "child_process";
import { unlink } from "fs/promises";
import { SITE_VIDEO_MAX_DURATION_SEC } from "@/lib/site-video";

function runCommand(
  cmd: string,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("ffmpeg timeout"));
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.trim() || `${cmd} gagal (${code})`));
    });
  });
}

export async function probeVideoDurationSec(filePath: string): Promise<number> {
  const { stdout } = await runCommand(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ],
    20_000,
  );
  const n = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Tidak bisa membaca durasi video.");
  }
  return n;
}

/**
 * Kompres ke MP4 480p 15fps ~180 kbps video + 48 kbps audio.
 * Target ~1,5–2 MB per menit.
 */
export async function compressSiteVideo(inputPath: string, outputPath: string) {
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-i",
      inputPath,
      "-t",
      String(SITE_VIDEO_MAX_DURATION_SEC),
      "-vf",
      "scale=-2:480,fps=15",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-b:v",
      "180k",
      "-maxrate",
      "220k",
      "-bufsize",
      "440k",
      "-c:a",
      "aac",
      "-b:a",
      "48k",
      "-ac",
      "1",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    120_000,
  );
}

export async function unlinkQuiet(filePath: string) {
  try {
    await unlink(filePath);
  } catch {
    /* ignore */
  }
}
