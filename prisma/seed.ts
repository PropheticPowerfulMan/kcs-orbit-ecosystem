import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin@12345", 10);

  await prisma.user.upsert({
    where: { email: "admin@kcs-orbit.local" },
    update: {},
    create: {
      fullName: "KCS Orbit Administrator",
      email: "admin@kcs-orbit.local",
      passwordHash,
      role: Role.ADMIN
    }
  });

  console.log("Seed completed.");
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
