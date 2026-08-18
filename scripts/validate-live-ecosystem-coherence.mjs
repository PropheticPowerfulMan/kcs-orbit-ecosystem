const config = {
  organizationId: process.env.KCS_ORBIT_ORGANIZATION_ID || "cmosn5f2e0000wu1s8xano5e7",
  orbitUrl: process.env.KCS_ORBIT_API_URL || "http://localhost:4500",
  orbitKey: process.env.SAVANEX_INTEGRATION_KEY || "savanex-dev-key",
  edupayUrl: process.env.EDUPAY_API_URL || "http://localhost:4000",
  savanexUrl: process.env.SAVANEX_API_URL || "http://localhost:8001",
  nexusUrl: process.env.KCS_NEXUS_API_URL || "http://localhost:5000",
  edusyncUrl: process.env.EDUSYNC_AI_API_URL || "http://localhost:8000",
};

async function json(url, init = {}) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}

const authJson = (body) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const bearer = (token) => ({ headers: { authorization: `Bearer ${token}` } });
const unwrap = (value) => value?.data || value;

function identitySet(directory, key) {
  return new Set((Array.isArray(directory[key]) ? directory[key] : []).map((item) => String(item.id)));
}

function snapshot(name, directory) {
  return {
    name,
    source: directory.source,
    counts: {
      parents: identitySet(directory, "parents").size,
      students: identitySet(directory, "students").size,
      teachers: identitySet(directory, "teachers").size,
    },
    ids: {
      parents: identitySet(directory, "parents"),
      students: identitySet(directory, "students"),
      teachers: identitySet(directory, "teachers"),
    },
  };
}

function compare(reference, candidate) {
  const failures = [];
  for (const type of ["parents", "students", "teachers"]) {
    const missing = [...reference.ids[type]].filter((id) => !candidate.ids[type].has(id));
    const extra = [...candidate.ids[type]].filter((id) => !reference.ids[type].has(id));
    if (missing.length || extra.length) failures.push({ app: candidate.name, type, missing, extra });
  }
  return failures;
}

const orbit = await json(`${config.orbitUrl}/api/integration/read/shared-directory?organizationId=${encodeURIComponent(config.organizationId)}`, {
  headers: { "x-api-key": config.orbitKey, "x-app-slug": "SAVANEX" },
});

const eduLogin = await json(`${config.edupayUrl}/api/auth/login`, authJson({
  identifier: process.env.EDUPAY_ADMIN_EMAIL || "admin@school.com",
  password: process.env.EDUPAY_ADMIN_PASSWORD || "password123",
}));
const edupay = await json(`${config.edupayUrl}/api/shared-directory`, bearer(eduLogin.token));

const savLogin = await json(`${config.savanexUrl}/api/auth/login/`, authJson({
  username: process.env.SAVANEX_ADMIN_USERNAME || "admin",
  password: process.env.SAVANEX_ADMIN_PASSWORD || "admin123",
}));
const savanex = await json(`${config.savanexUrl}/api/integration/shared-directory/`, bearer(savLogin.access || savLogin.token || savLogin.access_token));

const nexusLogin = unwrap(await json(`${config.nexusUrl}/api/auth/login`, authJson({
  identifier: process.env.KCS_NEXUS_ADMIN_EMAIL || "superadmin@kcsnexus.com",
  password: process.env.KCS_NEXUS_ADMIN_PASSWORD || "SuperAdmin123!",
})));
const nexusResponse = unwrap(await json(`${config.nexusUrl}/api/registry/directory`, bearer(nexusLogin.accessToken || nexusLogin.token)));
const nexus = nexusResponse;

const syncLogin = await json(`${config.edusyncUrl}/api/v1/auth/login`, authJson({
  email: process.env.EDUSYNC_ADMIN_EMAIL || "admin@school.edu",
  password: process.env.EDUSYNC_ADMIN_PASSWORD || "Admin@123",
}));
const edusync = await json(`${config.edusyncUrl}/api/v1/directory/shared`, bearer(syncLogin.access_token || syncLogin.token || syncLogin.accessToken));

const snapshots = [
  snapshot("Orbit", orbit),
  snapshot("EduPay", edupay),
  snapshot("Savanex", savanex),
  snapshot("Nexus", nexus),
  snapshot("EduSync AI", edusync),
];
const failures = snapshots.slice(1).flatMap((candidate) => compare(snapshots[0], candidate));

console.log(JSON.stringify({
  status: failures.length ? "FAIL" : "PASS",
  organizationId: config.organizationId,
  applications: snapshots.map(({ name, source, counts }) => ({ name, source, counts })),
  failures,
}, null, 2));

if (failures.length) process.exit(1);