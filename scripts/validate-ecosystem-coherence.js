const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const files = {
  nexus: path.join(root, "KCS Nexus", "frontend", "src", "data", "schoolEcosystem.ts"),
  savanex: path.join(root, "SAVANEX Project", "frontend", "src", "data", "demoSchoolData.js"),
};

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function extractArrayBlock(source, exportName) {
  const marker = `export const ${exportName} = [`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${exportName}`);
  let cursor = start + marker.length - 1;
  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;

  for (; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      inString = true;
      quote = char;
      continue;
    }
    if (char === "[") depth += 1;
    if (char === "]") depth -= 1;
    if (depth === 0) return source.slice(start + marker.length - 1, cursor + 1);
  }
  throw new Error(`Could not parse ${exportName}`);
}

function countObjects(source, exportName) {
  return (extractArrayBlock(source, exportName).match(/\{\s*(?:id|name|student|family)\b/g) || []).length;
}

function extractNames(source, exportName) {
  const block = extractArrayBlock(source, exportName);
  return Array.from(block.matchAll(/name:\s*['"]([^'"]+)['"]/g)).map((match) => match[1]).sort();
}

function compareSet(label, left, right) {
  const missing = left.filter((item) => !right.includes(item));
  const extra = right.filter((item) => !left.includes(item));
  if (missing.length || extra.length) {
    throw new Error(`${label} mismatch. Missing in SAVANEX: ${missing.join(", ") || "none"}. Extra in SAVANEX: ${extra.join(", ") || "none"}.`);
  }
}

const nexus = read(files.nexus);
const savanex = read(files.savanex);

const checks = [
  ["students", countObjects(nexus, "students"), countObjects(savanex, "students")],
  ["parents", countObjects(nexus, "parents"), countObjects(savanex, "parents")],
  ["teachers", countObjects(nexus, "employees"), countObjects(savanex, "teachers")],
];

for (const [label, expected, actual] of checks) {
  if (expected !== actual) {
    throw new Error(`${label} count mismatch: Nexus=${expected}, SAVANEX=${actual}`);
  }
}

compareSet("Student names", extractNames(nexus, "students"), extractNames(savanex, "students"));
compareSet("Parent names", extractNames(nexus, "parents"), extractNames(savanex, "parents"));

const savanexDistributionTotal = Array.from(extractArrayBlock(savanex, "classDistribution").matchAll(/students:\s*(\d+)/g))
  .reduce((sum, match) => sum + Number(match[1]), 0);
if (savanexDistributionTotal !== checks[0][1]) {
  throw new Error(`SAVANEX class distribution total mismatch: expected ${checks[0][1]}, got ${savanexDistributionTotal}`);
}

console.log(JSON.stringify({
  status: "PASS",
  students: checks[0][1],
  parents: checks[1][1],
  teachers: checks[2][1],
  savanexClassDistributionTotal: savanexDistributionTotal,
}, null, 2));
