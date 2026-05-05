import { AppSlug, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: "kcs-core" },
    update: {},
    create: {
      name: "KCS Core",
      slug: "kcs-core"
    }
  });

  const passwordHash = await bcrypt.hash("Admin@12345", 10);

  await prisma.user.upsert({
    where: { email: "admin@kcs-orbit.local" },
    update: {},
    create: {
      fullName: "KCS Orbit Administrator",
      email: "admin@kcs-orbit.local",
      passwordHash,
      role: Role.ADMIN,
      organizationId: organization.id
    }
  });

  await prisma.appConnection.upsert({
    where: {
      organizationId_appSlug: {
        organizationId: organization.id,
        appSlug: AppSlug.KCS_NEXUS
      }
    },
    update: {},
    create: {
      organizationId: organization.id,
      appSlug: AppSlug.KCS_NEXUS,
      baseUrl: "http://localhost:5000"
    }
  });

  console.log("Seed completed.");
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
