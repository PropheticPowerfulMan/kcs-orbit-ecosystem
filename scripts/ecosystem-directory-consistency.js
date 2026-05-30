const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const reportsDir = path.join(root, "var");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function findArraySource(source, declaration) {
  const start = source.indexOf(declaration);
  if (start < 0) return "";
  const bracketStart = source.indexOf("[", start);
  if (bracketStart < 0) return "";
  let depth = 0;
  for (let index = bracketStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth === 0) return source.slice(bracketStart, index + 1);
    }
  }
  return "";
}

function countObjectsInArray(source, declaration) {
  const arraySource = findArraySource(source, declaration);
  return (arraySource.match(/\{\s*(?:id|name|fullName|student_name|category)\s*:/g) || []).length;
}

function uniqueCount(values) {
  return new Set(values.filter(Boolean)).size;
}

async function main() {
  fs.mkdirSync(reportsDir, { recursive: true });

  const savanexData = await import(pathToFileURL(path.join(root, "SAVANEX Project/frontend/src/data/demoSchoolData.js")).href);
  const savanexParents = savanexData.parents.length;
  const savanexStudents = savanexData.students.length;
  const savanexEmployees = savanexData.teachers.length;
  const savanexStudentParents = uniqueCount(savanexData.students.map((student) => student.parent));

  const savanexApi = read("SAVANEX Project/frontend/src/services/api.js");
  const savanexOverviewDerived = [
    "total_students: demoStudents.length",
    "total_teachers: demoTeachers.length",
    "total_classes: demoClassDistribution.length"
  ].every((needle) => savanexApi.includes(needle));

  const edusyncApi = read("EduSync AI/frontend/src/services/api.js");
  const eduSyncDirectory = findArraySource(edusyncApi, "parents: [");
  const eduSyncStudentDirectory = findArraySource(edusyncApi, "students: [");
  const eduSyncTeacherDirectory = findArraySource(edusyncApi, "teachers: [");
  const eduSyncParents = (eduSyncDirectory.match(/displayId:/g) || []).length;
  const eduSyncStudents = (eduSyncStudentDirectory.match(/fullName:/g) || []).length;
  const eduSyncEmployees = (eduSyncTeacherDirectory.match(/employeeType:/g) || []).length;
  const eduSyncLinkedStudentIds = uniqueCount((eduSyncDirectory.match(/stu-[a-z]+/g) || []));
  const eduSyncStudentIds = uniqueCount((eduSyncStudentDirectory.match(/id: "stu-[a-z]+"/g) || []).map((row) => row.match(/stu-[a-z]+/)?.[0]));

  const nexusData = read("KCS Nexus/frontend/src/data/schoolEcosystem.ts");
  const nexusParents = countObjectsInArray(nexusData, "export const parents = [");
  const nexusStudents = countObjectsInArray(nexusData, "export const students = [");
  const nexusEmployees = countObjectsInArray(nexusData, "export const employees = [");
  const nexusStudentArray = findArraySource(nexusData, "export const students = [");
  const nexusParentArray = findArraySource(nexusData, "export const parents = [");
  const nexusStudentParentIds = [...new Set((nexusStudentArray.match(/parentId: '([^']+)'/g) || []).map((row) => row.match(/'([^']+)'/)?.[1]).filter(Boolean))];
  const nexusParentIds = new Set((nexusParentArray.match(/id: '([^']+)'/g) || []).map((row) => row.match(/'([^']+)'/)?.[1]).filter(Boolean));

  let eduPaySimulation = null;
  const eduPayReportPath = path.join(root, "EduPay Smart System/reports/edupay-full-test-report.json");
  if (fs.existsSync(eduPayReportPath)) {
    const report = JSON.parse(fs.readFileSync(eduPayReportPath, "utf8"));
    eduPaySimulation = {
      parents: Array.isArray(report.parents) ? report.parents.length : 0,
      students: Array.isArray(report.parents) ? report.parents.reduce((total, parent) => total + (parent.children?.length || 0), 0) : 0,
      employees: 0,
      scope: "financial simulation campaign, not the shared-directory demo seed"
    };
  }

  const directorySources = [
    { app: "SAVANEX demo directory", parents: savanexParents, students: savanexStudents, employees: savanexEmployees },
    { app: "EduSync AI demo shared-directory", parents: eduSyncParents, students: eduSyncStudents, employees: eduSyncEmployees },
    { app: "KCS Nexus demo ecosystem", parents: nexusParents, students: nexusStudents, employees: nexusEmployees }
  ];
  const canonical = directorySources[0];
  const consistencyChecks = [
    {
      name: "SAVANEX visible student parents match parent directory",
      pass: savanexStudentParents === savanexParents,
      expected: savanexParents,
      actual: savanexStudentParents
    },
    {
      name: "EduSync parent linked student ids exist in student directory",
      pass: eduSyncLinkedStudentIds === eduSyncStudentIds && eduSyncStudentIds === eduSyncStudents,
      expected: eduSyncLinkedStudentIds,
      actual: eduSyncStudentIds
    },
    {
      name: "KCS Nexus students reference known parent records",
      pass: nexusStudentParentIds.every((parentId) => nexusParentIds.has(parentId)),
      expected: [...nexusParentIds],
      actual: nexusStudentParentIds
    },
    {
      name: "SAVANEX demo overview derives from directory arrays",
      pass: savanexOverviewDerived,
      expected: true,
      actual: savanexOverviewDerived
    },
    ...directorySources.map((source) => ({
      name: `${source.app} matches canonical parent/student/employee counts`,
      pass: source.parents === canonical.parents && source.students === canonical.students && source.employees === canonical.employees,
      expected: { parents: canonical.parents, students: canonical.students, employees: canonical.employees },
      actual: { parents: source.parents, students: source.students, employees: source.employees }
    }))
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    canonicalSharedDirectoryCounts: {
      parents: canonical.parents,
      students: canonical.students,
      employees: canonical.employees
    },
    directorySources,
    eduPaySimulation,
    checks: consistencyChecks,
    status: consistencyChecks.every((check) => check.pass) ? "PASS" : "FAIL",
    note: "EduPay's generated 10-parent/22-student finance campaign is intentionally broader than the shared demo directory. Runtime production consistency should use Orbit shared-directory as source of truth."
  };

  fs.writeFileSync(path.join(reportsDir, "ecosystem-directory-consistency.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(reportsDir, "ecosystem-directory-consistency.md"), [
    "# Ecosystem Directory Consistency Report",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    `Status: **${report.status}**`,
    "",
    "## Canonical Shared Directory Counts",
    "",
    `- Parents: ${canonical.parents}`,
    `- Students/children: ${canonical.students}`,
    `- Employees/teachers: ${canonical.employees}`,
    "",
    "## Application Sources",
    "",
    ...directorySources.map((source) => `- ${source.app}: ${source.parents} parents, ${source.students} students, ${source.employees} employees`),
    eduPaySimulation ? `- EduPay finance simulation: ${eduPaySimulation.parents} parents, ${eduPaySimulation.students} students, ${eduPaySimulation.employees} employees (${eduPaySimulation.scope})` : "- EduPay finance simulation: report not found",
    "",
    "## Checks",
    "",
    ...consistencyChecks.map((check) => `- ${check.pass ? "PASS" : "FAIL"}: ${check.name}`)
  ].join("\n"));

  console.log(JSON.stringify({ status: report.status, canonical: report.canonicalSharedDirectoryCounts }, null, 2));
  if (report.status !== "PASS") process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
