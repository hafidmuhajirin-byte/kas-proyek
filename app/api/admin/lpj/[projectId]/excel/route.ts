import { format } from "date-fns";
import { NextResponse } from "next/server";
import {
  assertProjectAccess,
  getSession,
  isAdmin,
  isAdminProyek,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadLpjBooks } from "@/lib/lpj/load-lpj-books";
import { buildLpjExcelWorkbook } from "@/lib/lpj/export-lpj-excel";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { projectId } = await ctx.params;
  if (isAdminProyek(session)) {
    if (!(await assertProjectAccess(session, projectId))) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  } else if (!isAdmin(session)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const books = await loadLpjBooks(projectId);
  if (!books) {
    return new NextResponse("Not found", { status: 404 });
  }

  const projectExtra = await prisma.project.findUnique({
    where: { id: projectId },
    select: { notes: true },
  });
  const projectTitle =
    (projectExtra?.notes ?? "").trim() || books.project.name;

  const buffer = await buildLpjExcelWorkbook({
    meta: {
      schoolName: books.project.name,
      projectTitle,
      location: books.project.location,
      kabKota: books.project.lpjKabKota,
      provinsi: books.project.lpjProvinsi,
      kepalaNama: books.project.lpjKepalaNama,
      kepalaNip: books.project.lpjKepalaNip,
      ketuaNama: books.project.lpjKetuaNama,
      ketuaNip: books.project.lpjKetuaNip,
      bendaharaNama: books.project.lpjBendaharaNama,
      bendaharaNip: books.project.lpjBendaharaNip,
    },
    bankBlocks: books.bankBlocks,
    bkuBlocks: books.bkuBlocks,
    bktBlocks: books.bktBlocks,
  });

  const stamp = format(new Date(), "yyyyMMdd");
  const safeName = books.project.name
    .trim()
    .replace(/[^\w\-]+/g, "_")
    .slice(0, 40);
  const filename = `LPJ-${safeName || "proyek"}-${stamp}.xlsx`;

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
