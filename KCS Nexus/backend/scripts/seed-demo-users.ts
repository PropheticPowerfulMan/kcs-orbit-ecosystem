import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const demoPassword = 'password123';

const demoUsers = [
  {
    email: 'admin@kcsnexus.edu',
    firstName: 'Sarah',
    lastName: 'Carter',
    role: UserRole.ADMIN,
  },
  {
    email: 'staff@kcsnexus.edu',
    firstName: 'Miriam',
    lastName: 'Office',
    role: UserRole.STAFF,
    staffFunction: 'Admissions Coordinator',
    permissions: ['admissions:read', 'registry:write', 'communications:send'],
  },
  {
    email: 'teacher@kcsnexus.edu',
    firstName: 'Daniel',
    lastName: 'Mukendi',
    role: UserRole.TEACHER,
  },
  {
    email: 'student@kcsnexus.edu',
    firstName: 'Grace',
    lastName: 'Mwamba',
    role: UserRole.STUDENT,
  },
  {
    email: 'parent@kcsnexus.edu',
    firstName: 'Rachel',
    lastName: 'Kabongo',
    role: UserRole.PARENT,
    phone: '+243 81 000 4101',
  },
];

async function upsertDemoUser(user: (typeof demoUsers)[number], passwordHash: string) {
  return prisma.user.upsert({
    where: { email: user.email },
    update: {
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      passwordHash,
      staffFunction: user.staffFunction,
      permissions: user.permissions ?? [],
      phone: user.phone,
    },
    create: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      passwordHash,
      staffFunction: user.staffFunction,
      permissions: user.permissions ?? [],
      phone: user.phone,
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  const createdUsers = new Map<string, Awaited<ReturnType<typeof upsertDemoUser>>>();
  for (const user of demoUsers) {
    const createdUser = await upsertDemoUser(user, passwordHash);
    createdUsers.set(user.email, createdUser);
  }

  const staff = createdUsers.get('staff@kcsnexus.edu');
  if (staff) {
    await prisma.staffProfile.upsert({
      where: { userId: staff.id },
      update: {
        employeeNumber: 'STAFF-DEMO-001',
        function: 'Admissions Coordinator',
        department: 'Administration',
        permissions: ['admissions:read', 'registry:write', 'communications:send'],
      },
      create: {
        userId: staff.id,
        employeeNumber: 'STAFF-DEMO-001',
        function: 'Admissions Coordinator',
        department: 'Administration',
        permissions: ['admissions:read', 'registry:write', 'communications:send'],
      },
    });
  }

  const teacher = createdUsers.get('teacher@kcsnexus.edu');
  if (teacher) {
    await prisma.teacherProfile.upsert({
      where: { userId: teacher.id },
      update: {
        employeeNumber: 'TCH-DEMO-001',
        department: 'STEM',
        qualification: 'M.Ed. Mathematics',
        yearsOfExperience: 8,
        bio: 'Demo teacher account for portal testing.',
      },
      create: {
        userId: teacher.id,
        employeeNumber: 'TCH-DEMO-001',
        department: 'STEM',
        qualification: 'M.Ed. Mathematics',
        yearsOfExperience: 8,
        bio: 'Demo teacher account for portal testing.',
      },
    });
  }

  const student = createdUsers.get('student@kcsnexus.edu');
  let studentProfileId: string | undefined;
  if (student) {
    const studentProfile = await prisma.studentProfile.upsert({
      where: { userId: student.id },
      update: {
        studentNumber: 'STU-DEMO-001',
        grade: 'Grade 10',
        section: 'A',
        status: 'active',
        gpa: 3.7,
        attendanceRate: 96,
      },
      create: {
        userId: student.id,
        studentNumber: 'STU-DEMO-001',
        grade: 'Grade 10',
        section: 'A',
        status: 'active',
        gpa: 3.7,
        attendanceRate: 96,
      },
    });
    studentProfileId = studentProfile.id;
  }

  const parent = createdUsers.get('parent@kcsnexus.edu');
  if (parent && studentProfileId) {
    await prisma.parentStudentLink.upsert({
      where: {
        parentId_studentId: {
          parentId: parent.id,
          studentId: studentProfileId,
        },
      },
      update: {
        relation: 'Mother',
      },
      create: {
        parentId: parent.id,
        studentId: studentProfileId,
        relation: 'Mother',
      },
    });
  }

  console.log('Comptes demo crees ou mis a jour:');
  for (const user of demoUsers) {
    console.log(`- ${user.role.toLowerCase()}: ${user.email} / ${demoPassword}`);
  }
  console.log('- super admin: superadmin@kcsnexus.com / SuperAdmin123! (script separe: npm run superadmin:upsert)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
