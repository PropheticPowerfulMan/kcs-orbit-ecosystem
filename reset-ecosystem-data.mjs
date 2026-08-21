import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const root = process.cwd();

function localPrisma(relativePackage, databaseUrl) {
  const require = createRequire(resolve(root, relativePackage, 'package.json'));
  const { PrismaClient } = require('@prisma/client');
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}

async function resetPostgres(label, client, targets, deleteUsersSql) {
  const before = {};
  for (const table of targets) {
    before[table] = Number((await client.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${table}"`))[0].count);
  }

  if (targets.length) {
    const identifiers = targets.map((table) => `"${table.replaceAll('"', '""')}"`).join(', ');
    await client.$executeRawUnsafe(`TRUNCATE TABLE ${identifiers} RESTART IDENTITY CASCADE`);
  }
  await client.$executeRawUnsafe(deleteUsersSql);

  const removed = Object.values(before).reduce((sum, count) => sum + count, 0);
  console.log(`[${label}] ${removed} enregistrement(s) métier supprimé(s), compte(s) administrateur conservé(s).`);
}

const orbit = localPrisma(
  'kcs-orbit-api',
  process.env.ORBIT_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kcs_orbit',
);
const nexus = localPrisma(
  'KCS Nexus/backend',
  process.env.KCS_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kcs_nexus',
);
const edupay = localPrisma(
  'EduPay Smart System/apps/api',
  process.env.EDUPAY_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/edupay?schema=public',
);

try {
  await resetPostgres(
    'Orbit',
    orbit,
    ['Parent', 'Teacher', 'Student', 'Payment', 'Grade', 'Attendance'],
    `DELETE FROM "User" WHERE role <> 'ADMIN'`,
  );
  await resetPostgres(
    'KCS Nexus',
    nexus,
    ['TeacherWorkspace', 'StaffProfile', 'StudentProfile', 'ParentStudentLink', 'TeacherProfile', 'Enrollment', 'AssignmentSubmission', 'Grade', 'AttendanceRecord', 'ReportCard', 'Transcript', 'FeeInvoice', 'FeePayment'],
    `DELETE FROM "User" WHERE role <> 'ADMIN'`,
  );
  await resetPostgres(
    'EduPay',
    edupay,
    ['Parent', 'Student', 'Payment', 'Receipt', 'NotificationLog', 'AIInsight', 'RiskScore', 'Budget', 'Expense', 'ExpenseApprovalStep', 'FinancialAttachment', 'EmployeeSalaryProfile', 'EmployeeCommunicationLog', 'EmployeeObligation', 'EmployeeRepayment', 'PayrollRun', 'PayrollItem', 'AccountingEntry', 'CashflowEntry', 'ParentFinancialProfile', 'ParentPlanAssignment', 'PaymentInstallment', 'PaymentAllocation', 'Discount', 'Debt', 'FinancialAgreement', 'FinancialReport', 'FinancialAlert'],
    `DELETE FROM "User" WHERE role IN ('PARENT', 'EMPLOYEE')`,
  );
} finally {
  await Promise.allSettled([orbit.$disconnect(), nexus.$disconnect(), edupay.$disconnect()]);
}
