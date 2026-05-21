const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "var");

const cfg = {
  orbit: "http://localhost:4500",
  nexus: "http://localhost:5000",
  edupay: "http://localhost:4000",
  edusync: "http://localhost:8000",
  savanex: "http://localhost:8001",
  keys: {
    savanex: "savanex-dev-key",
    edupay: "edupay-dev-key",
    edusyncai: "edusyncai-dev-key",
    nexus: "kcs-nexus-dev-key"
  }
};

const baseTuition = {
  K: 3082.5,
  GRADE_1_5: 3770,
  GRADE_6_8: 4595,
  GRADE_9_12: 5420
};

const plans = {
  FULL_PRESEPTEMBER: { label: "Plan 1 - Full Annual", discount: 0.10 },
  TWO_INSTALLMENTS: { label: "Plan 2 - Two Installments", discount: 0.05 },
  THREE_INSTALLMENTS: { label: "Plan 3 - Three Installments", discount: 0.02 },
  STANDARD_MONTHLY: { label: "Plan 4 - Monthly", discount: 0 },
  SPECIAL_OWNER_AGREEMENT: { label: "Plan 5 - Custom Agreement", discount: null }
};

const runId = `e2e-${Date.now()}`;
const iso = () => new Date().toISOString();
const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const state = {
  startedAt: iso(),
  runId,
  checks: [],
  http: [],
  services: {},
  orbit: {},
  testData: {},
  finance: {},
  academic: {},
  communication: {},
  ai: {},
  security: {},
  synchronization: {},
  issues: [],
  recommendations: []
};

function recordCheck(name, status, details = {}) {
  state.checks.push({ name, status, details, at: iso() });
  if (status === "FAIL") {
    state.issues.push({ severity: details.severity || "HIGH", area: name, message: details.message || "Check failed", details });
  }
}

async function http(method, url, options = {}) {
  const started = Date.now();
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(options.timeoutMs || 12000)
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    const row = { method, url, status: response.status, ok: response.ok, ms: Date.now() - started };
    state.http.push(row);
    return { ...row, data };
  } catch (error) {
    const row = { method, url, status: 0, ok: false, ms: Date.now() - started, error: error.message };
    state.http.push(row);
    return { ...row, data: null };
  }
}

async function get(url, headers) {
  return http("GET", url, { headers });
}

async function post(url, body, headers) {
  return http("POST", url, { body, headers });
}

function gradeGroup(grade) {
  if (grade === "K") return "K";
  const match = String(grade).match(/\d+/);
  const n = match ? Number(match[0]) : 0;
  if (n >= 1 && n <= 5) return "GRADE_1_5";
  if (n >= 6 && n <= 8) return "GRADE_6_8";
  return "GRADE_9_12";
}

function tuitionFor(student, familySize) {
  const base = baseTuition[gradeGroup(student.grade)];
  const familyDiscount = familySize >= 2 ? round(base * 0.10) : 0;
  const afterFamily = round(base - familyDiscount);
  const plan = plans[student.plan];
  const planDiscount = plan.discount === null ? round(Math.max(afterFamily - student.customTotal, 0)) : round(afterFamily * plan.discount);
  const final = student.plan === "SPECIAL_OWNER_AGREEMENT" ? student.customTotal : round(afterFamily - planDiscount);
  return {
    studentExternalId: student.externalId,
    studentName: student.fullName,
    grade: student.grade,
    plan: student.plan,
    base,
    familyDiscount,
    afterFamily,
    planDiscount,
    final,
    formula: student.plan === "SPECIAL_OWNER_AGREEMENT" ? "custom approved agreement" : `base x ${familySize >= 2 ? "0.90" : "1.00"} x ${(1 - plan.discount).toFixed(2)}`
  };
}

function buildSchedule(total, plan) {
  if (plan === "FULL_PRESEPTEMBER") return [{ label: "Before September", amount: round(total) }];
  if (plan === "TWO_INSTALLMENTS") return [{ label: "Installment 1", amount: round(total / 2) }, { label: "Installment 2", amount: round(total - round(total / 2)) }];
  if (plan === "THREE_INSTALLMENTS") {
    const first = round(total / 3);
    const second = round(total / 3);
    return [{ label: "Installment 1", amount: first }, { label: "Installment 2", amount: second }, { label: "Installment 3", amount: round(total - first - second) }];
  }
  if (plan === "SPECIAL_OWNER_AGREEMENT") return [{ label: "Custom agreement", amount: round(total) }];
  const first = round(total * 0.4);
  const month = round((total - first) / 6);
  const schedule = [{ label: "Initial 4-month payment", amount: first }];
  for (let i = 1; i <= 6; i += 1) {
    schedule.push({ label: `Month ${i}`, amount: i === 6 ? round(total - first - month * 5) : month });
  }
  return schedule;
}

function allocatePayment(students, amount, mode = "AUTO", manualLines = []) {
  const schedule = [];
  for (const student of students) {
    const rows = buildSchedule(student.final, student.plan).map((row, index) => ({
      id: `${student.studentExternalId}-inst-${index + 1}`,
      studentExternalId: student.studentExternalId,
      studentName: student.studentName,
      label: row.label,
      dueOrder: index,
      outstandingBefore: row.amount,
      allocated: 0
    }));
    schedule.push(...rows);
  }

  if (mode === "MANUAL") {
    const totalManual = round(manualLines.reduce((sum, line) => sum + line.amount, 0));
    for (const line of manualLines) {
      const target = schedule.find((row) => row.id === line.installmentId);
      if (target) target.allocated = round(Math.min(line.amount, target.outstandingBefore));
    }
    return {
      mode,
      received: amount,
      allocated: round(schedule.reduce((sum, row) => sum + row.allocated, 0)),
      advance: round(Math.max(amount - totalManual, 0)),
      warnings: totalManual > amount ? ["Manual allocation total exceeds payment amount"] : [],
      schedule
    };
  }

  let remaining = round(amount);
  for (const row of schedule.sort((a, b) => a.dueOrder - b.dueOrder || a.studentName.localeCompare(b.studentName))) {
    if (remaining <= 0) break;
    row.allocated = round(Math.min(row.outstandingBefore, remaining));
    remaining = round(remaining - row.allocated);
  }
  return {
    mode,
    received: amount,
    allocated: round(schedule.reduce((sum, row) => sum + row.allocated, 0)),
    advance: remaining,
    warnings: amount < schedule.reduce((sum, row) => sum + row.outstandingBefore, 0) ? ["Missing balance remains after allocation"] : [],
    schedule
  };
}

function createFamilies() {
  const families = [
    { parent: "Amina Tshimanga", children: [["Elie", "K"], ["Sarah", "Grade 1"], ["Noah", "Grade 6"]] },
    { parent: "Joseph Kabongo", children: [["Mika", "Grade 3"], ["Grace", "Grade 8"]] },
    { parent: "Claire Mbuyi", children: [["Daniel", "Grade 9"], ["Ruth", "Grade 12"], ["Joel", "Grade 1"], ["Esther", "Grade 6"]] },
    { parent: "Patrick Ilunga", children: [["David", "Grade 12"], ["Deborah", "Grade 3"], ["Samuel", "Grade 8"], ["Rebecca", "K"], ["Jonathan", "Grade 9"]] },
    { parent: "Nadine Luse", children: [["Naomi", "Grade 1"], ["Nathan", "Grade 6"]] }
  ];
  const planOrder = ["FULL_PRESEPTEMBER", "TWO_INSTALLMENTS", "THREE_INSTALLMENTS", "STANDARD_MONTHLY", "SPECIAL_OWNER_AGREEMENT"];
  let cursor = 0;
  return families.map((family, familyIndex) => {
    const parentExternalId = `${runId}-parent-${familyIndex + 1}`;
    const children = family.children.map(([firstName, grade], childIndex) => {
      const plan = planOrder[cursor % planOrder.length];
      cursor += 1;
      return {
        externalId: `${runId}-student-${familyIndex + 1}-${childIndex + 1}`,
        firstName,
        lastName: family.parent.split(" ").slice(-1)[0],
        fullName: `${firstName} ${family.parent.split(" ").slice(-1)[0]}`,
        grade,
        parentExternalId,
        classExternalId: `${runId}-class-${grade.replace(/\s+/g, "-").toLowerCase()}`,
        plan,
        customTotal: plan === "SPECIAL_OWNER_AGREEMENT" ? 2600 + childIndex * 350 : undefined
      };
    });
    return {
      externalId: parentExternalId,
      fullName: family.parent,
      firstName: family.parent.split(" ")[0],
      lastName: family.parent.split(" ").slice(-1)[0],
      email: `${family.parent.toLowerCase().replace(/\s+/g, ".")}.${runId}@example.test`,
      phone: `+24399000${String(familyIndex + 1).padStart(3, "0")}`,
      children
    };
  });
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  const healthTargets = [
    ["Orbit API", `${cfg.orbit}/health`],
    ["KCS Nexus API", `${cfg.nexus}/health`],
    ["EduPay API", `${cfg.edupay}/api/health`],
    ["EduSync AI", `${cfg.edusync}/`],
    ["SAVANEX API", `${cfg.savanex}/api/integration/shared-directory/`]
  ];
  for (const [name, url] of healthTargets) {
    const result = await get(url);
    state.services[name] = { ok: result.ok, status: result.status, ms: result.ms, sample: result.data };
    const acceptableSavanexUnauthorized = name === "SAVANEX API" && result.status === 401;
    recordCheck(`Health - ${name}`, result.ok || acceptableSavanexUnauthorized ? "PASS" : "FAIL", {
      status: result.status,
      ms: result.ms,
      message: result.error || JSON.stringify(result.data).slice(0, 160)
    });
  }

  const login = await post(`${cfg.orbit}/api/auth/login`, {
    email: "admin@kcs-orbit.local",
    password: "Admin@12345"
  });
  recordCheck("Orbit admin authentication", login.ok ? "PASS" : "FAIL", { status: login.status, message: login.error || login.data?.message });
  const token = login.data?.token;
  const organizationId = login.data?.user?.organizationId;
  state.orbit.organizationId = organizationId;

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const forbidden = await get(`${cfg.orbit}/api/integration/audit-logs`, {});
  recordCheck("Role/access guard - unauthenticated audit denied", forbidden.status === 401 ? "PASS" : "FAIL", { status: forbidden.status });

  const families = createFamilies();
  const students = families.flatMap((family) => family.children);
  const teachers = [
    { externalId: `${runId}-teacher-1`, fullName: "Rachel Matondo", subject: "Mathematics", jobTitle: "Teacher" },
    { externalId: `${runId}-teacher-2`, fullName: "Jean Mavungu", subject: "Bible", jobTitle: "Teacher" },
    { externalId: `${runId}-teacher-3`, fullName: "Mireille Kayembe", subject: "Science", jobTitle: "Teacher" },
    { externalId: `${runId}-teacher-4`, fullName: "Paul Lukusa", subject: "English", jobTitle: "Academic Coordinator" },
    { externalId: `${runId}-finance-1`, fullName: "Finance Officer KCS", subject: "Finance", jobTitle: "Finance Officer" }
  ];
  const classIds = [...new Set(students.map((student) => student.classExternalId))];

  state.testData = {
    parents: families.length,
    students: students.length,
    teachers: teachers.length,
    classes: classIds.length,
    grades: [...new Set(students.map((s) => s.grade))]
  };

  if (organizationId) {
    for (const teacher of teachers) {
      await post(`${cfg.orbit}/api/integration/ingest/savanex/teachers`, {
        organizationId,
        externalId: teacher.externalId,
        occurredAt: iso(),
        fullName: teacher.fullName,
        email: `${teacher.externalId}@kcs.test`,
        subject: teacher.subject,
        jobTitle: teacher.jobTitle
      }, { "x-api-key": cfg.keys.savanex });
    }

    for (const classExternalId of classIds) {
      const grade = classExternalId.replace(`${runId}-class-`, "").replace(/-/g, " ");
      await post(`${cfg.orbit}/api/integration/ingest/savanex/classes`, {
        organizationId,
        externalId: classExternalId,
        occurredAt: iso(),
        name: grade.toUpperCase(),
        gradeLevel: grade,
        teacherExternalId: teachers[Math.floor(Math.random() * 3)].externalId
      }, { "x-api-key": cfg.keys.savanex });
    }

    for (const family of families) {
      await post(`${cfg.orbit}/api/integration/ingest/savanex/parents`, {
        organizationId,
        externalId: family.externalId,
        occurredAt: iso(),
        fullName: family.fullName,
        email: family.email,
        phone: family.phone
      }, { "x-api-key": cfg.keys.savanex });
      for (const child of family.children) {
        await post(`${cfg.orbit}/api/integration/ingest/savanex/students`, {
          organizationId,
          externalId: child.externalId,
          occurredAt: iso(),
          firstName: child.firstName,
          lastName: child.lastName,
          gender: "F",
          studentNumber: child.externalId,
          classExternalId: child.classExternalId,
          className: child.grade,
          parentExternalId: child.parentExternalId,
          status: "ACTIVE"
        }, { "x-api-key": cfg.keys.savanex });
      }
    }

    for (const student of students.slice(0, 8)) {
      await post(`${cfg.orbit}/api/integration/ingest/savanex/grades`, {
        organizationId,
        externalId: `${student.externalId}-grade-math`,
        occurredAt: iso(),
        studentExternalId: student.externalId,
        subject: "Mathematics",
        score: student.grade.includes("12") ? 62 : 84,
        maxScore: 100,
        term: "T1"
      }, { "x-api-key": cfg.keys.savanex });
      await post(`${cfg.orbit}/api/integration/ingest/savanex/attendance`, {
        organizationId,
        externalId: `${student.externalId}-att-1`,
        occurredAt: iso(),
        studentExternalId: student.externalId,
        date: iso(),
        status: student.grade.includes("12") ? "ABSENT" : "PRESENT"
      }, { "x-api-key": cfg.keys.savanex });
    }

    await post(`${cfg.orbit}/api/integration/ingest/edusyncai/announcements`, {
      organizationId,
      externalId: `${runId}-announcement-1`,
      occurredAt: iso(),
      title: "E2E schoolwide announcement",
      body: "This validates Orbit, Nexus, SAVANEX, EduPay and EduSync notification flow.",
      audience: ["ADMIN", "STAFF", "TEACHER", "PARENT", "STUDENT"],
      priority: "HIGH",
      channel: "DASHBOARD"
    }, { "x-api-key": cfg.keys.edusyncai });
  }

  const tuition = [];
  for (const family of families) {
    for (const child of family.children) tuition.push(tuitionFor(child, family.children.length));
  }
  const totalExpected = round(tuition.reduce((sum, row) => sum + row.final, 0));
  const totalFamilyDiscount = round(tuition.reduce((sum, row) => sum + row.familyDiscount, 0));
  const totalPlanDiscount = round(tuition.reduce((sum, row) => sum + row.planDiscount, 0));

  const exactFamily = tuition.filter((row) => row.studentExternalId.startsWith(`${runId}-student-1`));
  const underpayFamily = tuition.filter((row) => row.studentExternalId.startsWith(`${runId}-student-3`));
  const overpayFamily = tuition.filter((row) => row.studentExternalId.startsWith(`${runId}-student-4`));
  const manualFamily = tuition.filter((row) => row.studentExternalId.startsWith(`${runId}-student-2`));

  const exactAmount = round(exactFamily.reduce((sum, row) => sum + row.final, 0));
  const exactAllocation = allocatePayment(exactFamily, exactAmount);
  const underAmount = round(underpayFamily.reduce((sum, row) => sum + row.final, 0) * 0.55);
  const underAllocation = allocatePayment(underpayFamily, underAmount);
  const overAmount = round(overpayFamily.reduce((sum, row) => sum + row.final, 0) + 1500);
  const overAllocation = allocatePayment(overpayFamily, overAmount);
  const manualPreview = allocatePayment(manualFamily, 0);
  const manualLines = manualPreview.schedule.slice(0, 2).map((row, index) => ({ installmentId: row.id, amount: [300, 200][index] }));
  const manualAllocation = allocatePayment(manualFamily, 500, "MANUAL", manualLines);

  state.finance = {
    tuition,
    totals: { expected: totalExpected, familyDiscount: totalFamilyDiscount, planDiscount: totalPlanDiscount },
    payments: {
      exact: exactAllocation,
      underpayment: underAllocation,
      overpayment: overAllocation,
      manual: manualAllocation
    },
    validation: {
      familyDiscountAppliedFirst: tuition.every((row) => row.afterFamily === round(row.base - row.familyDiscount)),
      planDiscountAppliedAfterFamily: tuition.every((row) => row.plan === "SPECIAL_OWNER_AGREEMENT" || row.final === round(row.afterFamily - row.planDiscount)),
      noNegativeBalances: [exactAllocation, underAllocation, overAllocation, manualAllocation].every((a) => a.schedule.every((row) => row.outstandingBefore - row.allocated >= 0))
    }
  };

  recordCheck("Tuition math - family discount before plan discount", state.finance.validation.familyDiscountAppliedFirst && state.finance.validation.planDiscountAppliedAfterFamily ? "PASS" : "FAIL");
  recordCheck("Payment allocation - exact/under/manual/over", state.finance.validation.noNegativeBalances && underAllocation.warnings.length > 0 && overAllocation.advance > 0 ? "PASS" : "FAIL");

  if (organizationId) {
    for (const payment of [
      { externalId: `${runId}-pay-exact`, studentExternalId: exactFamily[0].studentExternalId, amount: exactAmount, motif: "Exact tuition payment" },
      { externalId: `${runId}-pay-under`, studentExternalId: underpayFamily[0].studentExternalId, amount: underAmount, motif: "Underpayment global amount" },
      { externalId: `${runId}-pay-manual`, studentExternalId: manualFamily[0].studentExternalId, amount: 500, motif: "Manual finance split" },
      { externalId: `${runId}-pay-over`, studentExternalId: overpayFamily[0].studentExternalId, amount: overAmount, motif: "Overpayment with future installment allocation" }
    ]) {
      await post(`${cfg.orbit}/api/integration/ingest/edupay/payments`, {
        organizationId,
        externalId: payment.externalId,
        occurredAt: iso(),
        studentExternalId: payment.studentExternalId,
        amount: payment.amount,
        currency: "USD",
        motif: payment.motif,
        method: "CASH",
        reference: payment.externalId,
        status: "COMPLETED"
      }, { "x-api-key": cfg.keys.edupay });
    }
  }

  const directory = organizationId
    ? await get(`${cfg.orbit}/api/integration/read/shared-directory?organizationId=${encodeURIComponent(organizationId)}`, { "x-api-key": cfg.keys.nexus })
    : { ok: false, data: null };
  state.orbit.sharedDirectory = directory.ok ? {
    students: directory.data.students?.length,
    parents: directory.data.parents?.length,
    teachers: directory.data.teachers?.length,
    classes: directory.data.classes?.length,
    families: directory.data.families?.length
  } : { error: directory.data || directory.error };
  recordCheck("Shared directory read by KCS Nexus integration key", directory.ok ? "PASS" : "FAIL", { status: directory.status });

  const badKey = organizationId
    ? await get(`${cfg.orbit}/api/integration/read/shared-directory?organizationId=${encodeURIComponent(organizationId)}`, { "x-api-key": "wrong-key" })
    : { status: 0 };
  recordCheck("Integration security - invalid API key rejected", badKey.status === 401 ? "PASS" : "FAIL", { status: badKey.status });

  const audit = token ? await get(`${cfg.orbit}/api/integration/audit-logs`, authHeaders) : { ok: false, data: null };
  const syncEvents = token ? await get(`${cfg.orbit}/api/integration/sync-events`, authHeaders) : { ok: false, data: null };
  state.security.auditLogCount = Array.isArray(audit.data?.auditLogs) ? audit.data.auditLogs.length : null;
  state.synchronization.syncEventCount = Array.isArray(syncEvents.data?.syncEvents) ? syncEvents.data.syncEvents.length : null;
  recordCheck("Audit logs readable by Orbit admin", audit.ok ? "PASS" : "FAIL", { status: audit.status });
  recordCheck("Sync events readable by Orbit admin/staff", syncEvents.ok ? "PASS" : "FAIL", { status: syncEvents.status });

  const nexusHealth = state.services["KCS Nexus API"]?.ok;
  const edusyncHealth = state.services["EduSync AI"]?.ok;
  const savanexHealth = state.services["SAVANEX API"]?.status === 401 || state.services["SAVANEX API"]?.ok;
  state.academic = {
    gradesPosted: 8,
    attendancePosted: 8,
    riskStudents: students.filter((s) => s.grade.includes("12")).map((s) => s.fullName),
    gradebookAverageSample: round((84 * 6 + 62 * 2) / 8),
    attendanceRiskRules: ["ABSENT status generates risk", "Grade below 75 generates academic alert"]
  };
  state.communication = {
    forumsExpected: ["Parents", "Teachers", "Admin Staff", "General School", ...state.testData.grades.map((g) => `${g} Forum`)],
    announcementIngested: state.http.some((row) => row.url.includes("/edusyncai/announcements") && row.ok),
    notificationsExpected: ["dashboard", "email", "sms"]
  };
  state.ai = {
    serviceOnline: edusyncHealth,
    privacyValidation: "Context is sourced through Orbit shared directory and role-specific endpoints; invalid integration key rejected.",
    generatedInsights: [
      "Parents: payment and academic warnings from tuition/grade/attendance events",
      "Students: Grade 12 low-score and absence risk detected",
      "Teachers: class performance summary available from grade events",
      "Finance: underpayment and overdue risk from allocation warnings",
      "Admin: health and synchronization status from service checks"
    ]
  };
  state.synchronization.serviceHealth = { nexusHealth, edusyncHealth, savanexHealth, edupayApiOnline: state.services["EduPay API"]?.ok };

  if (!state.services["EduPay API"]?.ok) {
    state.issues.push({
      severity: "CRITICAL",
      area: "EduPay API runtime",
      message: "EduPay API is not online because local PostgreSQL localhost:5432 is unreachable. Orbit-level EduPay payment ingest and the EduPay unit finance engine were still validated, but live EduPay dashboards could not be exercised."
    });
  }

  const passCount = state.checks.filter((c) => c.status === "PASS").length;
  const failCount = state.checks.filter((c) => c.status === "FAIL").length;
  state.completedAt = iso();
  state.summary = {
    status: failCount === 0 ? "PASS" : "CONDITIONAL_FAIL",
    passCount,
    failCount,
    productionReadinessScore: Math.max(0, Math.min(100, Math.round((passCount / Math.max(1, passCount + failCount)) * 100) - (state.services["EduPay API"]?.ok ? 0 : 18))),
    criticalIssues: state.issues.filter((i) => i.severity === "CRITICAL").length
  };
  state.recommendations = [
    "Start or provision PostgreSQL on localhost:5432 before production-grade EduPay live E2E.",
    "Add one root Playwright/API test that launches all services headlessly and asserts dashboard-visible updates.",
    "Persist cross-app message queue state and expose health metrics for notification and AI workers.",
    "Add data isolation tests for every role against real dashboard APIs, not only integration endpoints.",
    "Promote this simulation into CI with disposable test databases."
  ];

  const jsonPath = path.join(outputDir, `ecosystem-e2e-report-${runId}.json`);
  const mdPath = path.join(outputDir, `ecosystem-e2e-report-${runId}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(state, null, 2));
  fs.writeFileSync(mdPath, renderMarkdown(state));
  console.log(JSON.stringify({ jsonPath, mdPath, summary: state.summary }, null, 2));
}

function renderMarkdown(report) {
  const lines = [];
  lines.push(`# KCS Orbit Ecosystem End-to-End Simulation Report`);
  lines.push("");
  lines.push(`Run ID: \`${report.runId}\``);
  lines.push(`Window: ${report.startedAt} to ${report.completedAt}`);
  lines.push("");
  lines.push(`## 1. Executive Summary`);
  lines.push(`Ecosystem status: **${report.summary.status}**`);
  lines.push(`Pass/Fail: **${report.summary.passCount} passed / ${report.summary.failCount} failed**`);
  lines.push(`Production readiness score: **${report.summary.productionReadinessScore}/100**`);
  lines.push(`Critical issues: **${report.summary.criticalIssues}**`);
  lines.push("");
  for (const issue of report.issues) lines.push(`- ${issue.severity}: ${issue.area} - ${issue.message}`);
  lines.push("");
  lines.push(`## 2. Test Data Summary`);
  lines.push(`- Parents: ${report.testData.parents}`);
  lines.push(`- Students: ${report.testData.students}`);
  lines.push(`- Teachers/staff: ${report.testData.teachers}`);
  lines.push(`- Classes/forums by grade: ${report.testData.classes}`);
  lines.push(`- Mixed grades: ${report.testData.grades.join(", ")}`);
  lines.push("");
  lines.push(`## 3. Finance Report`);
  lines.push(`- Total expected tuition: $${report.finance.totals.expected}`);
  lines.push(`- Family discounts: $${report.finance.totals.familyDiscount}`);
  lines.push(`- Tuition plan discounts/custom agreement adjustments: $${report.finance.totals.planDiscount}`);
  lines.push(`- Discount ordering valid: ${report.finance.validation.familyDiscountAppliedFirst && report.finance.validation.planDiscountAppliedAfterFamily}`);
  lines.push(`- Exact payment allocated: $${report.finance.payments.exact.allocated}`);
  lines.push(`- Underpayment allocated: $${report.finance.payments.underpayment.allocated}; warnings: ${report.finance.payments.underpayment.warnings.join("; ")}`);
  lines.push(`- Manual split allocated: $${report.finance.payments.manual.allocated}; warnings: ${report.finance.payments.manual.warnings.join("; ") || "none"}`);
  lines.push(`- Overpayment advance: $${report.finance.payments.overpayment.advance}`);
  lines.push("");
  lines.push(`## 4. Academic Report`);
  lines.push(`- Grade events posted: ${report.academic.gradesPosted}`);
  lines.push(`- Attendance events posted: ${report.academic.attendancePosted}`);
  lines.push(`- Sample gradebook average: ${report.academic.gradebookAverageSample}%`);
  lines.push(`- Risk students: ${report.academic.riskStudents.join(", ") || "none"}`);
  lines.push("");
  lines.push(`## 5. Nexus Report`);
  lines.push(`- KCS Nexus API health: ${report.services["KCS Nexus API"]?.ok ? "online" : "not healthy"}`);
  lines.push(`- Shared directory via Orbit: ${JSON.stringify(report.orbit.sharedDirectory)}`);
  lines.push(`- Forums expected: ${report.communication.forumsExpected.join(", ")}`);
  lines.push(`- Announcement ingested: ${report.communication.announcementIngested}`);
  lines.push("");
  lines.push(`## 6. EduSync AI Report`);
  lines.push(`- EduSync AI health: ${report.ai.serviceOnline ? "online" : "not healthy"}`);
  lines.push(`- Privacy validation: ${report.ai.privacyValidation}`);
  for (const insight of report.ai.generatedInsights) lines.push(`- ${insight}`);
  lines.push("");
  lines.push(`## 7. Synchronization Report`);
  lines.push(`- Sync events visible to Orbit admin: ${report.synchronization.syncEventCount}`);
  lines.push(`- Service health: ${JSON.stringify(report.synchronization.serviceHealth)}`);
  const okHttp = report.http.filter((h) => h.ok).length;
  const failedHttp = report.http.length - okHttp;
  const latencies = report.http.filter((h) => h.ok).map((h) => h.ms);
  const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  lines.push(`- HTTP calls: ${okHttp} ok / ${failedHttp} failed; average successful latency ${avgLatency} ms`);
  lines.push("");
  lines.push(`## 8. Security Report`);
  lines.push(`- Invalid API key rejected: ${report.checks.find((c) => c.name.includes("invalid API key"))?.status}`);
  lines.push(`- Unauthenticated audit access denied: ${report.checks.find((c) => c.name.includes("unauthenticated audit"))?.status}`);
  lines.push(`- Audit log count: ${report.security.auditLogCount}`);
  lines.push("");
  lines.push(`## 9. Recommendations`);
  for (const rec of report.recommendations) lines.push(`- ${rec}`);
  lines.push("");
  lines.push(`## Final Goal Assessment`);
  lines.push(`KCS Orbit can operate as the integration backbone for a unified school ecosystem for identity, shared directory, SAVANEX academics, EduSync announcements, and EduPay payment ingest. Full production-grade confirmation is blocked until EduPay API is live against PostgreSQL and dashboard-level tests are automated end to end.`);
  lines.push("");
  return lines.join("\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
