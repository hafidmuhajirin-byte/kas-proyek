import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken, type SessionUser } from "@/lib/session";

const publicPaths = ["/login"];

function homeForSession(session: SessionUser) {
  if (session.role === "MANDOR" && session.fotoOnly) return "/mandor/lokasi";
  if (session.role === "MANDOR") return "/mandor";
  if (session.role === "ADMIN") return "/admin/lpj";
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

  // Matcher sudah mengecualikan aset statis; guard ekstra untuk path internal
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
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

  if (session?.role === "MANDOR") {
    if (!pathname.startsWith("/mandor")) {
      const url = request.nextUrl.clone();
      url.pathname = homeForSession(session);
      return NextResponse.redirect(url);
    }
    // Mode hanya foto: blok beranda status & upload bukti
    if (
      session.fotoOnly &&
      (pathname === "/mandor" || pathname.startsWith("/mandor/upload"))
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/mandor/lokasi";
      return NextResponse.redirect(url);
    }
  }

  if (session?.role === "ADMIN") {
    const allowed =
      pathname.startsWith("/admin") ||
      pathname.startsWith("/api/") ||
      pathname.startsWith("/foto-proyek");
    // Admin: LPJ + foto proyek (+ API); tanpa kas/mutasi Owner
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
    // Sertakan /uploads/* agar rewrite ke API jalan; kecualikan aset build Next
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|css|js|map|txt|woff2?)$).*)",
  ],
};
