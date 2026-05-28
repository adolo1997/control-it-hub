import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { createSessionToken, sessionCookieName } from "@/lib/session-token";

const sessionMaxAgeSeconds = 60 * 60 * 8;

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(8),
});

const attempts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const current = attempts.get(ip);

  if (!current || current.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }

  current.count += 1;
  return current.count > 10;
}

function shouldUseSecureCookie(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const appUrl = process.env.APP_URL;

  if (forwardedProto === "https") {
    return true;
  }

  if (appUrl) {
    try {
      return new URL(appUrl).protocol === "https:";
    } catch {
      return process.env.NODE_ENV === "production";
    }
  }

  return process.env.NODE_ENV === "production";
}

function loginJson(
  body: { ok: true; redirectTo: string } | { ok: false; error: string },
  status = 200,
) {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "none";
  const host = request.headers.get("host") ?? "unknown";

  try {
    if (isRateLimited(ip)) {
      console.warn("[auth:login] rate_limited", { ip, host, forwardedProto });
      return loginJson({ ok: false, error: "Demasiados intentos. Prueba de nuevo en unos minutos." }, 429);
    }

    const parsed = loginSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      console.warn("[auth:login] invalid_payload", { ip, host, forwardedProto });
      return loginJson({ ok: false, error: "Peticion de login no valida." }, 400);
    }

    const user = await db.user.findUnique({
      where: { email: parsed.data.email },
      include: {
        memberships: {
          include: { company: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const validPassword = user
      ? await bcrypt.compare(parsed.data.password, user.passwordHash)
      : false;
    const membership = user?.memberships.find((item) => item.company.status !== "SUSPENDED");

    if (!user || !user.isActive || !validPassword || !membership) {
      await db.auditLog.create({
        data: {
          action: "auth.login_failed",
          entity: "User",
          ipAddress: ip,
          userAgent: request.headers.get("user-agent"),
          metadata: { email: parsed.data.email },
        },
      });
      return loginJson({ ok: false, error: "Credenciales no validas, usuario inactivo o empresa sin acceso." }, 401);
    }

    const token = await createSessionToken({
      userId: user.id,
      companyId: membership.companyId,
      membershipRole: membership.role,
      platformRole: user.platformRole,
    });

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      db.auditLog.create({
        data: {
          action: "auth.login_success",
          entity: "User",
          entityId: user.id,
          userId: user.id,
          companyId: membership.companyId,
          ipAddress: ip,
          userAgent: request.headers.get("user-agent"),
        },
      }),
    ]);

    const secure = shouldUseSecureCookie(request);
    const response = loginJson({ ok: true, redirectTo: "/dashboard" });
    response.cookies.set({
      name: sessionCookieName,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: sessionMaxAgeSeconds,
    });

    return response;
  } catch (error) {
    console.error("[auth:login] unexpected_error", {
      error,
      ip,
      host,
      forwardedProto,
    });
    return loginJson({ ok: false, error: "Error interno al iniciar sesion." }, 500);
  }
}
