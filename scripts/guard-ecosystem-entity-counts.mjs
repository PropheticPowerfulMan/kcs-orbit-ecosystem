import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const checkedFiles = [
  "EduPay Smart System/index.html",
  "EduPay Smart System/edupay-standalone.js",
  "EduPay Smart System/apps/api/server-simple.ts",
  "EduPay Smart System/apps/web/src/services/api.ts",
  "EduPay Smart System/apps/ai-service/app/main.py",
];

const forbidden = [
  {
    pattern: /\b8\s+parents?\s+(?:n['’]ont pas pay|did not pay|have not paid)/i,
    message: "hard-coded unpaid parent count",
  },
  {
    pattern: /\b25\s+parents?\s+(?:have not paid|with remaining balances|n['’]ont pas pay)/i,
    message: "hard-coded unpaid parent count",
  },
  {
    pattern: /send reminder to\s+\d+\s+parents?/i,
    message: "hard-coded reminder parent volume",
  },
  {
    pattern: /escalate\s+\d+\s+high-risk parents?/i,
    message: "hard-coded escalation parent volume",
  },
  {
    pattern: /(?:revenu total|total revenue)[^.\n]*(?:240,000|142,500)/i,
    message: "hard-coded revenue in assistant/static copy",
  },
  {
    pattern: /(?:dette|debt)[^.\n]*(?:445,000|450000)/i,
    message: "hard-coded debt in assistant/static copy",
  },
  {
    pattern: /Grade 3[^.\n]*(?:highest debt|plus forte dette|unpaid|impay|dette)/i,
    message: "hard-coded class debt insight",
  },
];

const violations = [];

const requiredSnippets = [
  {
    file: "EduPay Smart System/apps/web/src/services/api.ts",
    snippets: [
      "const OFFICIAL_DEMO_COUNTS = { parents: 29, students: 44, employees: 10 };",
      "const DEMO_PARENTS_KEY = \"edupay_demo_parents_v3\";",
      "const DEMO_EMPLOYEES_KEY = \"edupay_demo_employees_v2\";",
      "storedParents.length < OFFICIAL_DEMO_COUNTS.parents",
      "storedStudentCount < OFFICIAL_DEMO_COUNTS.students"
    ]
  },
  {
    file: "EduPay Smart System/apps/api/server-simple.ts",
    snippets: [
      "const OFFICIAL_DEMO_COUNTS = { parents: 29, students: 44, employees: 10 };",
      "const mockStudents: any[] = unifiedDemoDirectory.students;",
      "let parentCounter = OFFICIAL_DEMO_COUNTS.parents;"
    ]
  },
  {
    file: "EduPay Smart System/index.html",
    snippets: ["var edupayParents = buildUnifiedDemoParents();"]
  },
  {
    file: "EduPay Smart System/edupay-standalone.js",
    snippets: ["let parents = buildUnifiedDemoParents();"]
  }
];

function countTupleEntries(source, constName) {
  const match = source.match(new RegExp(`(?:const|let|var)\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*(?:as const)?\\s*;`));
  if (!match) return null;
  return (match[1].match(/\[\s*["']/g) || []).length;
}

function countStringEntries(source, constName) {
  const match = source.match(new RegExp(`(?:const|let|var)\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*(?:as const)?\\s*;`));
  if (!match) return null;
  return (match[1].match(/["'][^"']+["']/g) || []).length;
}

for (const relativePath of checkedFiles) {
  const absolutePath = join(repoRoot, relativePath);
  const source = readFileSync(absolutePath, "utf8");
  for (const rule of forbidden) {
    const match = source.match(rule.pattern);
    if (match) {
      violations.push(`${relativePath}: ${rule.message}: "${match[0]}"`);
    }
  }
}

for (const requirement of requiredSnippets) {
  const source = readFileSync(join(repoRoot, requirement.file), "utf8");
  for (const snippet of requirement.snippets) {
    if (!source.includes(snippet)) {
      violations.push(`${requirement.file}: missing required unified demo guard: "${snippet}"`);
    }
  }
}

const webApiSource = readFileSync(join(repoRoot, "EduPay Smart System/apps/web/src/services/api.ts"), "utf8");
const serverSimpleSource = readFileSync(join(repoRoot, "EduPay Smart System/apps/api/server-simple.ts"), "utf8");
const staticSource = readFileSync(join(repoRoot, "EduPay Smart System/index.html"), "utf8");
const standaloneSource = readFileSync(join(repoRoot, "EduPay Smart System/edupay-standalone.js"), "utf8");

const countChecks = [
  ["web parent seed", countTupleEntries(webApiSource, "parentSeedNames"), 29],
  ["web student seed", countStringEntries(webApiSource, "studentGivenNames"), 44],
  ["api parent seed", countTupleEntries(serverSimpleSource, "unifiedParentNames"), 29],
  ["api student seed", countStringEntries(serverSimpleSource, "unifiedStudentGivenNames"), 44],
  ["static parent seed", countTupleEntries(staticSource, "parentNames"), 29],
  ["static student seed", countStringEntries(staticSource, "studentNames"), 44],
  ["standalone parent seed", countTupleEntries(standaloneSource, "parentNames"), 29],
  ["standalone student seed", countStringEntries(standaloneSource, "studentNames"), 44]
];

for (const [label, actual, expected] of countChecks) {
  if (actual !== expected) {
    violations.push(`${label}: expected ${expected}, found ${actual ?? "missing"}`);
  }
}

if (violations.length) {
  console.error("Entity-count guard failed. Counts must be derived from Orbit/SAVANEX/EduPay data, not static copy.");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Entity-count guard passed.");
