import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ecosystemRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const checks = [
  {
    file: "kcs-orbit-api/src/services/shared-directory.service.ts",
    required: ["families: families.length", "parents: parents.length", "students: students.length", "teachers: teachers.length"],
  },
  {
    file: "EduPay Smart System/apps/api/src/modules/shared-directory/router.ts",
    required: ["families: parents.length", "parents: parents.length", "students: students.length", "teachers: teachers.length"],
  },
  {
    file: "SAVANEX Project/backend/apps/integration/views.py",
    required: ["'families': parents.count()", "'parents': parents.count()", "'students': students.count()", "'teachers': teachers.count()"],
  },
  {
    file: "KCS Nexus/backend/src/routes/registry.routes.ts",
    required: ["families: parentsMap.size", "parents: parentsMap.size", "students: students.length", "teachers: teachers.length"],
  },
  {
    file: "EduSync AI/backend/app/api/routes/directory.py",
    required: ["\"counts\"", "\"families\"", "\"parents\"", "\"students\"", "\"teachers\""],
  },
];

const failures = [];
for (const check of checks) {
  const source = readFileSync(join(ecosystemRoot, check.file), "utf8");
  for (const token of check.required) {
    if (!source.includes(token)) failures.push(`${check.file}: missing ${token}`);
  }
}

if (failures.length) {
  console.error("Entity-count contract failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Entity-count contract OK: Orbit, EduPay, Savanex, Nexus and EduSync expose coherent shared-directory counts.");
