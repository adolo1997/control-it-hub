"use server";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireCurrentSession } from "@/lib/session";

const companyStatuses = ["ACTIVE", "SUSPENDED", "TRIAL"] as const;
const licenseStatuses = ["ACTIVE", "EXPIRING", "EXPIRED", "CANCELLED"] as const;
const membershipRoles = ["OWNER", "ADMIN", "TECH", "BILLING", "VIEWER"] as const;

function requireRole(role: string, allowed: readonly string[]) {
  if (!allowed.includes(role)) {
    throw new Error("No tienes permisos para realizar esta accion.");
  }
}

function requirePlatformAdmin(platformRole: string) {
  if (platformRole !== "SUPER_ADMIN") {
    throw new Error("Solo un administrador de plataforma puede realizar esta accion.");
  }
}

function optionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function optionalDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function eurosToCents(value: string | null | undefined) {
  const normalized = value?.replace(",", ".").trim();
  if (!normalized) {
    return null;
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueCompanySlug(name: string) {
  const base = slugify(name) || "empresa";
  let slug = base;
  let index = 2;

  while (await db.company.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${index}`;
    index += 1;
  }

  return slug;
}

async function audit(action: string, entity: string, entityId?: string, metadata?: Prisma.InputJsonObject) {
  const session = await requireCurrentSession();

  await db.auditLog.create({
    data: {
      action,
      entity,
      entityId,
      userId: session.user.id,
      companyId: session.company.id,
      metadata,
    },
  });
}

const createLicenseSchema = z.object({
  provider: z.string().trim().min(2, "Proveedor obligatorio."),
  product: z.string().trim().min(2, "Producto obligatorio."),
  seats: z.coerce.number().int().min(1).default(1),
  status: z.enum(licenseStatuses).default("ACTIVE"),
  purchaseDate: z.string().optional(),
  renewalDate: z.string().optional(),
  cost: z.string().optional(),
  currency: z.string().trim().min(3).max(3).default("EUR"),
  vendorAccount: z.string().optional(),
  notes: z.string().optional(),
});

export async function createLicense(formData: FormData) {
  const session = await requireCurrentSession();
  requireRole(session.membershipRole, ["OWNER", "ADMIN", "BILLING"]);

  const data = createLicenseSchema.parse(Object.fromEntries(formData));
  const license = await db.license.create({
    data: {
      companyId: session.company.id,
      provider: data.provider,
      product: data.product,
      seats: data.seats,
      status: data.status,
      purchaseDate: optionalDate(data.purchaseDate),
      renewalDate: optionalDate(data.renewalDate),
      costCents: eurosToCents(data.cost),
      currency: data.currency.toUpperCase(),
      vendorAccount: optionalText(data.vendorAccount),
      notes: optionalText(data.notes),
    },
  });

  await audit("license.create", "License", license.id, {
    provider: license.provider,
    product: license.product,
  });

  revalidatePath("/licencias");
  revalidatePath("/dashboard");
}

export async function deleteLicense(formData: FormData) {
  const session = await requireCurrentSession();
  requireRole(session.membershipRole, ["OWNER", "ADMIN", "BILLING"]);

  const id = z.string().min(1).parse(formData.get("id"));
  const license = await db.license.findFirst({
    where: { id, companyId: session.company.id },
    select: { id: true, provider: true, product: true },
  });

  if (!license) {
    throw new Error("Licencia no encontrada.");
  }

  await db.license.delete({ where: { id: license.id } });
  await audit("license.delete", "License", license.id, {
    provider: license.provider,
    product: license.product,
  });

  revalidatePath("/licencias");
  revalidatePath("/dashboard");
}

const createCompanySchema = z.object({
  name: z.string().trim().min(2, "Nombre obligatorio."),
  taxId: z.string().optional(),
  status: z.enum(companyStatuses).default("ACTIVE"),
  plan: z.string().trim().min(2).default("starter"),
});

export async function createCompany(formData: FormData) {
  const session = await requireCurrentSession();
  requirePlatformAdmin(session.platformRole);

  const data = createCompanySchema.parse(Object.fromEntries(formData));
  const company = await db.company.create({
    data: {
      name: data.name,
      slug: await uniqueCompanySlug(data.name),
      taxId: optionalText(data.taxId),
      status: data.status,
      plan: data.plan,
    },
  });

  await audit("company.create", "Company", company.id, {
    name: company.name,
    status: company.status,
  });

  revalidatePath("/empresas");
  revalidatePath("/dashboard");
}

export async function deleteCompany(formData: FormData) {
  const session = await requireCurrentSession();
  requirePlatformAdmin(session.platformRole);

  const id = z.string().min(1).parse(formData.get("id"));
  if (id === session.company.id) {
    throw new Error("No puedes eliminar la empresa de tu sesion actual.");
  }

  const company = await db.company.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!company) {
    throw new Error("Empresa no encontrada.");
  }

  await db.company.delete({ where: { id: company.id } });
  await audit("company.delete", "Company", company.id, { name: company.name });

  revalidatePath("/empresas");
  revalidatePath("/dashboard");
}

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Nombre obligatorio."),
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres."),
  companyId: z.string().min(1),
  role: z.enum(membershipRoles).default("VIEWER"),
  platformRole: z.enum(["SUPER_ADMIN", "USER"]).default("USER"),
});

export async function createUserWithMembership(formData: FormData) {
  const session = await requireCurrentSession();
  requireRole(session.membershipRole, ["OWNER", "ADMIN"]);

  const data = createUserSchema.parse(Object.fromEntries(formData));
  const canUseTargetCompany = session.platformRole === "SUPER_ADMIN" || data.companyId === session.company.id;

  if (!canUseTargetCompany) {
    throw new Error("No puedes crear usuarios en otra empresa.");
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await db.user.upsert({
    where: { email: data.email },
    update: {
      name: data.name,
      passwordHash,
      isActive: true,
      platformRole: session.platformRole === "SUPER_ADMIN" ? data.platformRole : "USER",
    },
    create: {
      email: data.email,
      name: data.name,
      passwordHash,
      platformRole: session.platformRole === "SUPER_ADMIN" ? data.platformRole : "USER",
    },
  });

  const membership = await db.membership.upsert({
    where: {
      userId_companyId: {
        userId: user.id,
        companyId: data.companyId,
      },
    },
    update: { role: data.role },
    create: {
      userId: user.id,
      companyId: data.companyId,
      role: data.role,
    },
  });

  await audit("user.upsert_with_membership", "User", user.id, {
    email: user.email,
    companyId: data.companyId,
    membershipId: membership.id,
    role: membership.role,
  });

  revalidatePath("/usuarios");
}

export async function removeMembership(formData: FormData) {
  const session = await requireCurrentSession();
  requireRole(session.membershipRole, ["OWNER", "ADMIN"]);

  const id = z.string().min(1).parse(formData.get("id"));
  const membership = await db.membership.findFirst({
    where: {
      id,
      companyId: session.platformRole === "SUPER_ADMIN" ? undefined : session.company.id,
    },
    select: {
      id: true,
      role: true,
      userId: true,
      companyId: true,
      user: { select: { email: true } },
    },
  });

  if (!membership) {
    throw new Error("Acceso de usuario no encontrado.");
  }

  if (membership.userId === session.user.id && membership.companyId === session.company.id) {
    throw new Error("No puedes quitar tu propio acceso a la empresa actual.");
  }

  await db.membership.delete({ where: { id: membership.id } });
  await audit("membership.delete", "Membership", membership.id, {
    email: membership.user.email,
    companyId: membership.companyId,
    role: membership.role,
  });

  revalidatePath("/usuarios");
}
