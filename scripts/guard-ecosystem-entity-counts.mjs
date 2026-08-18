const orbitUrl = (process.env.KCS_ORBIT_API_URL || "http://localhost:4500").replace(/\/$/, "");
const organizationId = process.env.KCS_ORBIT_ORGANIZATION_ID;
const apiKey = process.env.SAVANEX_INTEGRATION_KEY || "savanex-dev-key";

if (!organizationId) {
  console.error("KCS_ORBIT_ORGANIZATION_ID is required. This check compares live records, not source-code tokens.");
  process.exit(2);
}

const response = await fetch(`${orbitUrl}/api/integration/read/shared-directory?organizationId=${encodeURIComponent(organizationId)}`, {
  headers: { "x-api-key": apiKey, "x-app-slug": "SAVANEX" },
});

if (!response.ok) {
  console.error(`Orbit directory request failed: HTTP ${response.status} ${await response.text()}`);
  process.exit(1);
}

const directory = await response.json();
const actual = {
  parents: Array.isArray(directory.parents) ? directory.parents.length : -1,
  students: Array.isArray(directory.students) ? directory.students.length : -1,
  teachers: Array.isArray(directory.teachers) ? directory.teachers.length : -1,
};
const advertised = directory.counts || {};
const mismatches = Object.entries(actual).filter(([key, value]) => advertised[key] !== value);

if (mismatches.length) {
  console.error(`Orbit directory count mismatch: ${JSON.stringify({ advertised, actual })}`);
  process.exit(1);
}

console.log(JSON.stringify({ status: "PASS", source: directory.source || "orbit", organizationId, counts: actual }, null, 2));