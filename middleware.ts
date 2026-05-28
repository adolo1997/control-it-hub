import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName, verifySessionToken } from "@/lib/session-token";

const protectedPaths = ["/dashboard", "/licencias", "/integraciones", "/registros", "/usuarios", "/empresas"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(sessionCookieName)?.value;
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname === "/login" && token) {
    try {
      await verifySessionToken(token);
      return NextResponse.next();
    } catch {
      const response = NextResponse.next();
      response.cookies.delete(sessionCookieName);
      return response;
    }
  }

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await verifySessionToken(token);
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(sessionCookieName);
    return response;
  }
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/licencias/:path*", "/integraciones/:path*", "/registros/:path*", "/usuarios/:path*", "/empresas/:path*"],
};
