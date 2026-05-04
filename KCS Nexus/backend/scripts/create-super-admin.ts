import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPERADMIN_EMAIL || 'superadmin@kcsnexus.com';
  const password = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!';
  const firstName = process.env.SUPERADMIN_FIRSTNAME || 'Super';
  const lastName = process.env.SUPERADMIN_LASTNAME || 'Admin';
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        firstName,
        lastName,
        role: 'ADMIN',
      },
    });

    console.log('Super administrateur mis a jour:', email);
    console.log('Mot de passe:', password);
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      role: 'ADMIN',
    },
  });

  console.log('Super administrateur cree:', user.email);
  console.log('Mot de passe:', password);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
