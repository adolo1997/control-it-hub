import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@controlithub.local").toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Cambia-Esta-Clave-2026!";
  const companyName = process.env.SEED_COMPANY_NAME ?? "Control IT Hub";
  const passwordHash = await bcrypt.hash(password, 12);

  const company = await prisma.company.upsert({
    where: { slug: slugify(companyName) },
    update: {
      name: companyName,
      status: "ACTIVE",
    },
    create: {
      name: companyName,
      slug: slugify(companyName),
      status: "ACTIVE",
      plan: "starter",
    },
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, isActive: true, platformRole: "SUPER_ADMIN" },
    create: {
      email,
      name: "Administrador",
      passwordHash,
      platformRole: "SUPER_ADMIN",
    },
  });

  await prisma.membership.upsert({
    where: { userId_companyId: { userId: user.id, companyId: company.id } },
    update: { role: "OWNER" },
    create: { userId: user.id, companyId: company.id, role: "OWNER" },
  });

  const integrations = [
    {
      type: "PRTG" as const,
      name: "PRTG principal",
      baseUrl: "https://prtg.tuempresa.com",
    },
    {
      type: "BACKUP" as const,
      name: "Backup cloud",
      baseUrl: null,
    },
  ];

  for (const integration of integrations) {
    await prisma.integration.upsert({
      where: {
        companyId_type_name: {
          companyId: company.id,
          type: integration.type,
          name: integration.name,
        },
      },
      update: {
        baseUrl: integration.baseUrl,
      },
      create: {
        companyId: company.id,
        type: integration.type,
        name: integration.name,
        status: "DRAFT",
        baseUrl: integration.baseUrl,
      },
    });
  }

  const licenses = [
    {
      provider: "Microsoft",
      product: "Microsoft 365 Business Premium",
      seats: 25,
      status: "ACTIVE" as const,
      renewalDays: 45,
      costCents: 55000,
    },
    {
      provider: "PRTG",
      product: "PRTG 1000 sensors",
      seats: 1,
      status: "EXPIRING" as const,
      renewalDays: 20,
      costCents: 179900,
    },
  ];

  for (const license of licenses) {
    await prisma.license.upsert({
      where: {
        companyId_provider_product: {
          companyId: company.id,
          provider: license.provider,
          product: license.product,
        },
      },
      update: {
        seats: license.seats,
        status: license.status,
        renewalDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * license.renewalDays),
        costCents: license.costCents,
      },
      create: {
        companyId: company.id,
        provider: license.provider,
        product: license.product,
        seats: license.seats,
        status: license.status,
        renewalDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * license.renewalDays),
        costCents: license.costCents,
      },
    });
  }

  const recordCount = await prisma.operationalRecord.count({ where: { companyId: company.id } });
  if (recordCount === 0) {
    await prisma.operationalRecord.createMany({
      data: [
        {
          companyId: company.id,
          source: "backup",
          title: "Backup diario pendiente de configurar",
          detail: "Conecta el proveedor de backup para empezar a registrar trabajos y errores.",
          severity: "WARNING",
        },
        {
          companyId: company.id,
          source: "prtg",
          title: "Integracion PRTG preparada",
          detail: "Falta token de API y URL definitiva.",
          severity: "INFO",
        },
      ],
    });
  }

  console.log(`Seed listo: ${email} / ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
