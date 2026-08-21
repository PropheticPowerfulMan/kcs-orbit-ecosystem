import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const NEXUS = 'http://127.0.0.1:5000/api';
const EDUPAY = 'http://127.0.0.1:4000/api';
const SAVANEX = 'http://127.0.0.1:8001/api';
const runId = `QA-ECO-4F-${Date.now()}`;
const results = [];
const created = [];

function record(name, passed, details = {}) {
  results.push({ name, passed, details, at: new Date().toISOString() });
  console.log(`${passed ? 'PASS' : 'FAIL'} | ${name}`, details);
}

async function request(url, init = {}, expected = [200]) {
  let response;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await fetch(url, init);
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 750));
    }
  }
  if (!response) throw lastError;
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!expected.includes(response.status)) {
    throw new Error(`${init.method || 'GET'} ${url} -> ${response.status}: ${text.slice(0, 500)}`);
  }
  return body;
}

function readSavanexDirectoryInternally() {
  const python = resolve('SAVANEX Project', 'backend', '.venv311', 'Scripts', 'python.exe');
  const backend = resolve('SAVANEX Project', 'backend');
  const command = [
    'import json',
    'from apps.integration.orbit import fetch_shared_directory',
    'print("QA_JSON=" + json.dumps(fetch_shared_directory()))',
  ].join('; ');
  const output = execFileSync(python, ['manage.py', 'shell', '-c', command], {
    cwd: backend,
    encoding: 'utf8',
    timeout: 120000,
    env: {
      ...process.env,
      KCS_ORBIT_API_URL: 'http://127.0.0.1:4500',
      KCS_ORBIT_API_KEY: 'savanex-dev-key',
      KCS_ORBIT_ORGANIZATION_ID: 'cmosn5f2e0000wu1s8xano5e7',
    },
  });
  const line = output.split(/\r?\n/).find((entry) => entry.startsWith('QA_JSON='));
  if (!line) throw new Error(`Savanex internal directory did not return JSON: ${output.slice(-500)}`);
  return JSON.parse(line.slice('QA_JSON='.length));
}

const json = (body, token) => ({
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(body),
});

const families = [
  ['MUKENDI', 'KABAMBA', 'Alice', 'MUKENDI', 'KABAMBA', 'Junior', 'Grade 1', 'A', 'F'],
  ['ILUNGA', 'TSHILOMBO', 'Patrick', 'ILUNGA', 'TSHILOMBO', 'Esther', 'Grade 4', 'B', 'F'],
  ['KALALA', 'MULUMBA', 'Grâce', 'KALALA', 'MULUMBA', 'David', 'Grade 7', 'A', 'M'],
  ['NZITA', 'MBUYI', 'Chantal', 'NZITA', 'MBUYI', 'Samuel', 'Grade 10', 'C', 'M'],
].map(([parentLast, parentMiddle, parentFirst, studentLast, studentMiddle, studentFirst, grade, section, gender], index) => ({
  parent: {
    firstName: parentFirst,
    middleName: parentMiddle,
    lastName: `${parentLast}-${runId}`,
    email: `qa.parent.${index + 1}.${runId.toLowerCase()}@example.test`,
    phone: `+24381099${String(index + 1).padStart(3, '0')}`,
    relationship: 'Parent',
  },
  student: {
    firstName: studentFirst,
    middleName: studentMiddle,
    lastName: `${studentLast}-${runId}`,
    email: `qa.student.${index + 1}.${runId.toLowerCase()}@example.test`,
    studentNumber: `QA-${Date.now().toString().slice(-7)}-${index + 1}`,
    grade,
    section,
    gender,
  },
}));

let nexusToken = '';
let edupayToken = '';

try {
  const nexusLogin = await request(`${NEXUS}/auth/login`, json({
    email: 'superadmin@kcsnexus.com',
    password: 'SuperAdmin123!',
  }));
  nexusToken = nexusLogin?.data?.token || '';
  record('Connexion Super Admin Nexus', Boolean(nexusToken), {
    role: nexusLogin?.data?.user?.role,
    accessCode: nexusLogin?.data?.user?.accessCode,
  });

  const eduLogin = await request(`${EDUPAY}/auth/login`, json({
    identifier: 'admin@school.com',
    password: 'password123',
  }));
  edupayToken = eduLogin?.token || '';
  record('Connexion administrateur EduPay', Boolean(edupayToken), {
    role: eduLogin?.role,
    accessCode: eduLogin?.accessCode,
  });

  const initialDirectory = await request(`${NEXUS}/registry/directory`, {
    headers: { authorization: `Bearer ${nexusToken}` },
  });
  record('État initial Nexus à zéro', initialDirectory?.data?.counts?.parents === 0 && initialDirectory?.data?.counts?.students === 0, initialDirectory?.data?.counts);

  for (const family of families) {
    const response = await request(`${NEXUS}/registry/families`, json(family, nexusToken), [201]);
    const data = response?.data;
    created.push({
      parentOrbitId: data?.parent?.orbitId,
      studentOrbitId: data?.student?.orbitId,
      parentAccessCode: data?.parent?.accessCode,
      studentAccessCode: data?.student?.accessCode,
      parentEmail: family.parent.email,
      studentNumber: family.student.studentNumber,
    });
    record(`Création famille ${family.student.studentNumber}`, Boolean(data?.parent?.orbitId && data?.student?.orbitId), {
      parentOrbitId: data?.parent?.orbitId,
      studentOrbitId: data?.student?.orbitId,
      parentAccessCode: data?.parent?.accessCode,
      studentAccessCode: data?.student?.accessCode,
    });
  }

  const nexusDirectory = await request(`${NEXUS}/registry/directory`, {
    headers: { authorization: `Bearer ${nexusToken}` },
  });
  const nexusCounts = nexusDirectory?.data?.counts || {};
  record('Propagation registre Nexus/Orbit', nexusCounts.parents === 4 && nexusCounts.students === 4, nexusCounts);
  record('Ordre administratif Nom Postnom Prénom', families.every((family) => {
    const found = nexusDirectory?.data?.parents?.find((parent) => parent.email === family.parent.email);
    return found?.fullName === `${family.parent.lastName} ${family.parent.middleName} ${family.parent.firstName}`;
  }), { sample: nexusDirectory?.data?.parents?.[0]?.fullName });

  const newPhone = '+243899000444';
  await request(`${NEXUS}/registry/entities/parent/${encodeURIComponent(created[0].parentOrbitId)}?identifierType=orbitId`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${nexusToken}` },
    body: JSON.stringify({ phone: newPhone, middleName: 'POSTNOM-MODIFIE' }),
  });
  const modifiedDirectory = await request(`${NEXUS}/registry/directory`, {
    headers: { authorization: `Bearer ${nexusToken}` },
  });
  const modifiedParent = modifiedDirectory?.data?.parents?.find((parent) => parent.id === created[0].parentOrbitId);
  record('Modification propagée dans le registre maître', modifiedParent?.phone === newPhone && modifiedParent?.middleName === 'POSTNOM-MODIFIE', {
    phone: modifiedParent?.phone,
    middleName: modifiedParent?.middleName,
  });

  const eduDirectory = await request(`${EDUPAY}/shared-directory`, {
    headers: { authorization: `Bearer ${edupayToken}` },
  });
  const eduParents = Array.isArray(eduDirectory?.parents) ? eduDirectory.parents : [];
  const eduStudents = Array.isArray(eduDirectory?.students) ? eduDirectory.students : [];
  record('Propagation EduPay', eduParents.length === 4 && eduStudents.length === 4, {
    parents: eduParents.length,
    students: eduStudents.length,
  });

  const financeResponse = await request(`${EDUPAY}/finance/overview`, {
    headers: { authorization: `Bearer ${edupayToken}` },
  });
  const finance = financeResponse?.data || financeResponse;
  record('Conséquence financière sans paiement', Number(finance?.totalPaid || 0) === 0, {
    totalPaid: finance?.totalPaid || 0,
    totalDebt: finance?.totalDebt || 0,
    parentCount: finance?.parentCount,
    studentCount: finance?.studentCount,
  });

  const savanexDirectory = readSavanexDirectoryInternally();
  const savanexParents = Array.isArray(savanexDirectory?.parents) ? savanexDirectory.parents : [];
  const savanexStudents = Array.isArray(savanexDirectory?.students) ? savanexDirectory.students : [];
  record('Propagation Savanex', savanexParents.length === 4 && savanexStudents.length === 4, {
    parents: savanexParents.length,
    students: savanexStudents.length,
  });
} catch (error) {
  record('Exécution principale', false, { error: String(error) });
} finally {
  for (const entity of [...created].reverse()) {
    if (entity.studentOrbitId) {
      try {
        await request(`${NEXUS}/registry/entities/student/${encodeURIComponent(entity.studentOrbitId)}?identifierType=orbitId`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${nexusToken}` },
        });
        record(`Suppression élève ${entity.studentNumber}`, true);
      } catch (error) {
        record(`Suppression élève ${entity.studentNumber}`, false, { error: String(error) });
      }
    }
    if (entity.parentOrbitId) {
      try {
        await request(`${NEXUS}/registry/entities/parent/${encodeURIComponent(entity.parentOrbitId)}?identifierType=orbitId`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${nexusToken}` },
        });
        record(`Suppression parent ${entity.parentEmail}`, true);
      } catch (error) {
        record(`Suppression parent ${entity.parentEmail}`, false, { error: String(error) });
      }
    }
  }

  try {
    const finalDirectory = await request(`${NEXUS}/registry/directory`, {
      headers: { authorization: `Bearer ${nexusToken}` },
    });
    record('Retour final Nexus/Orbit à zéro', finalDirectory?.data?.counts?.parents === 0 && finalDirectory?.data?.counts?.students === 0, finalDirectory?.data?.counts);
  } catch (error) {
    record('Retour final Nexus/Orbit à zéro', false, { error: String(error) });
  }

  try {
    const finalEdu = await request(`${EDUPAY}/shared-directory`, {
      headers: { authorization: `Bearer ${edupayToken}` },
    });
    record('Retour final EduPay à zéro', (finalEdu?.parents?.length || 0) === 0 && (finalEdu?.students?.length || 0) === 0, {
      parents: finalEdu?.parents?.length || 0,
      students: finalEdu?.students?.length || 0,
    });
  } catch (error) {
    record('Retour final EduPay à zéro', false, { error: String(error) });
  }

  try {
    const finalSavanex = readSavanexDirectoryInternally();
    record('Retour final Savanex à zéro', (finalSavanex?.parents?.length || 0) === 0 && (finalSavanex?.students?.length || 0) === 0, {
      parents: finalSavanex?.parents?.length || 0,
      students: finalSavanex?.students?.length || 0,
    });
  } catch (error) {
    record('Retour final Savanex à zéro', false, { error: String(error) });
  }

  const report = {
    runId,
    startedFor: 'Four-family ecosystem propagation and cleanup',
    completedAt: new Date().toISOString(),
    passed: results.filter((item) => item.passed).length,
    failed: results.filter((item) => !item.passed).length,
    results,
    created,
  };
  const directory = resolve('var', 'test-reports');
  await mkdir(directory, { recursive: true });
  const reportPath = resolve(directory, `${runId}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`REPORT_PATH=${reportPath}`);
  process.exitCode = report.failed ? 1 : 0;
}
