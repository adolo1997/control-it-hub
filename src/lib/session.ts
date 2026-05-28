import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/lib/db";
import { sessionCookieName, verifySessionToken } from "@/lib/session-token";

export type CurrentSession = {
  user: {
    id: string;
    email: string;
    name: string;
    platformRole: "SUPER_ADMIN" | "USER";
    lastLoginAt: Date | null;
  };
  company: {
    id: string;
    name: string;
    slug: string;
    status: "ACTIVE" | "SUSPENDED" | "TRIAL";
    plan: string;
  };
  membership: {
    id: string;
    role: "OWNER" | "ADMIN" | "TECH" | "BILLING" | "VIEWER";
  };
  membershipRole: "OWNER" | "ADMIN" | "TECH" | "BILLING" | "VIEWER";
  platformRole: "SUPER_ADMIN" | "USER";
  token: {
    userId: string;
    companyId: string;
    issuedAt?: number;
    expiresAt?: number;
  };
};

export const getCurrentSession = cache(async (): Promise<CurrentSession | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = await verifySessionToken(token);
    const membership = await db.membership.findFirst({
      where: {
        userId: payload.userId,
        companyId: payload.companyId,
        user: { isActive: true },
        company: { status: { not: "SUSPENDED" } },
      },
      select: {
        id: true,
        role: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            platformRole: true,
            lastLoginAt: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            plan: true,
          },
        },
      },
    });

    if (!membership) {
      return null;
    }

    return {
      user: membership.user,
      company: membership.company,
      membership: {
        id: membership.id,
        role: membership.role,
      },
      membershipRole: membership.role,
      platformRole: membership.user.platformRole,
      token: {
        userId: payload.userId,
        companyId: payload.companyId,
        issuedAt: payload.iat,
        expiresAt: payload.exp,
      },
    };
  } catch {
    return null;
  }
});

export async function requireCurrentSession() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export function canManageCompany(role: string) {
  return ["OWNER", "ADMIN"].includes(role);
}
