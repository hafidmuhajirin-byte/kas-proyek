import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/session";

const publicPaths = ["/login"];

function homeForRole(role: string) {
  if (role === "MANDOR") return "/mandor";
  if (role === "ADMIN") return "/dashboard";
  return "/dashboard";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Matcher sudah mengecualikan aset statis; guard ekstra untuk path internal
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname === "/favicon.ico"
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
    url.pathname = homeForRole(session.role);
    return NextResponse.redirect(url);
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = session ? homeForRole(session.role) : "/login";
    return NextResponse.redirect(url);
  }

  if (session?.role === "MANDOR" && !pathname.startsWith("/mandor")) {
    const url = request.nextUrl.clone();
    url.pathname = "/mandor";
    return NextResponse.redirect(url);
  }

  if (session?.role === "ADMIN") {
    const allowed =
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/projects") ||
      pathname.startsWith("/transactions") ||
      pathname.startsWith("/api/");
    const blockedWrite =
      pathname.startsWith("/transactions/new") ||
      (pathname.includes("/edit") && !pathname.startsWith("/projects")) ||
      pathname.startsWith("/users") ||
      pathname.startsWith("/sources") ||
      pathname.startsWith("/transfers") ||
      pathname.startsWith("/categories") ||
      pathname.startsWith("/reports") ||
      pathname.startsWith("/mandor");
    // Admin boleh baca Kas Proyek + pecah nota via server action di /projects & /transactions/project
    if (blockedWrite || !allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|uploads/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff2?)$).*)",
  ],
};
