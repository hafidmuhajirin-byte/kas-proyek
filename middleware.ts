import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken, type SessionUser } from "@/lib/session";

const publicPaths = ["/login"];

function homeForSession(session: SessionUser) {
  if (session.role === "ADM_FOTO") return "/mandor/lokasi";
  if (session.role === "MANDOR") return "/mandor";
  if (session.role === "ADMIN") return "/admin/lpj";
  if (session.role === "ADMIN_PROYEK") return "/admin-proyek";
  if (session.role === "LPJ_VIEWER") return "/admin/lpj";
  return "/dashboard";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // File unggahan: rewrite ke API agar file baru (setelah start) tetap bisa dibaca
  if (pathname.startsWith("/uploads/")) {
    const url = request.nextUrl.clone();
    url.pathname = `/api/uploads/${pathname.slice("/uploads/".length)}`;
    return NextResponse.rewrite(url);
  }

  // Matcher sudah mengecualikan aset statis; guard ekstra untuk path internal + PWA
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.webmanifest/"
  ) {
    return NextResponse.next();
  }

  const isPublic = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const token = request.cookies.get(COOKIE_NAME)?.value;

  // Tanpa cookie: jangan verifikasi JWT — redirect cepat
  if (!token) {
    if (isPublic) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const session = await verifySessionToken(token);

  if (!session && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = homeForSession(session);
    return NextResponse.redirect(url);
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = session ? homeForSession(session) : "/login";
    return NextResponse.redirect(url);
  }

  if (session?.role === "ADM_FOTO") {
    const allowed =
      pathname.startsWith("/mandor/lokasi") || pathname.startsWith("/api/");
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/mandor/lokasi";
      return NextResponse.redirect(url);
    }
  }

  if (session?.role === "MANDOR") {
    if (!pathname.startsWith("/mandor")) {
      const url = request.nextUrl.clone();
      url.pathname = homeForSession(session);
      return NextResponse.redirect(url);
    }
  }

  if (session?.role === "ADMIN") {
    const allowed =
      pathname.startsWith("/admin") ||
      pathname.startsWith("/api/") ||
      pathname.startsWith("/foto-proyek");
    // AdminOK: LPJ + foto proyek (+ API); tanpa kas/mutasi Owner
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/lpj";
      return NextResponse.redirect(url);
    }
  }

  if (session?.role === "ADMIN_PROYEK") {
    const allowed =
      pathname.startsWith("/admin-proyek") ||
      pathname.startsWith("/admin/lpj") ||
      pathname === "/transactions/project" ||
      pathname.startsWith("/transactions/project/") ||
      pathname === "/transactions/new" ||
      pathname.startsWith("/transactions/new/") ||
      pathname.startsWith("/foto-proyek") ||
      pathname.startsWith("/api/");
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin-proyek";
      return NextResponse.redirect(url);
    }
  }

  if (session?.role === "LPJ_VIEWER") {
    const allowed =
      pathname === "/admin/lpj" ||
      pathname.startsWith("/admin/lpj/") ||
      pathname.startsWith("/foto-proyek") ||
      pathname.startsWith("/api/foto-proyek/download") ||
      pathname.startsWith("/api/admin/lpj/") ||
      pathname.startsWith("/api/uploads/");
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/lpj";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Sertakan /uploads/* agar rewrite ke API jalan; kecualikan aset build + ikon PWA
    "/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:svg|css|js|map|txt|png|ico|webp|woff2?)$).*)",
  ],
};
