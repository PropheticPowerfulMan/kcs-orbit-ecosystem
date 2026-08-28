import InternationalPhoneInput from "../components/InternationalPhoneInput";
import { BulkImportLink } from "../components/BulkImportLink";
import DateSelect from '../components/DateSelect';
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Edit3, Eye, FileSpreadsheet, FileText, KeyRound, Printer, Trash2, X } from "lucide-react";
import { SearchField } from "../components/SearchField";
import { schoolBranding } from "../config/branding";
import { api, getCachedApiResponse } from "../services/api";
import { exportWorkbook } from "../utils/financeExcel";
import { exportElementToPdf } from "../utils/pdfDocument";
import { printHtmlDocument } from "../utils/printDocument";
import { useI18n } from "../i18n";

type UiLanguage = "fr" | "en";

function localize(lang: UiLanguage, fr: string, en: string) {
  return lang === "fr" ? fr : en;
}

type SharedDirectoryStudent = {
  id: string;
  orbitId?: string;
  displayId?: string;
  studentNumber?: string;
  externalStudentId?: string;
  fullName: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  classId?: string;
  className?: string;
  createdAt?: string;
  parentId?: string;
  annualFee?: number;
  annualFeeDisplay?: number;
  originalAnnualFee?: number;
  reductionTotal?: number;
  paymentOptionType?: string | null;
  tuitionPlanName?: string;
};

type SharedDirectoryParent = {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  students?: SharedDirectoryStudent[];
};

type FinanceInstallment = {
  id: string;
  studentId?: string | null;
  label: string;
  periodKey?: string | null;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  status: string;
  isOverdue: boolean;
  createdAt?: string | null;
};

type FinanceReduction = {
  id: string;
  title: string;
  source?: string;
  amount: number;
  percentage?: number | null;
  studentId?: string | null;
  studentName?: string | null;
  effectiveDate?: string;
  scope?: string;
};

type FinanceAgreement = {
  id: string;
  title: string;
  status: string;
  customTotal: number;
  reductionAmount: number;
  balanceDue: number;
  paymentOptionType?: string;
  notes?: string | null;
  approvedAt?: string | null;
  createdAt: string;
};

type FinanceDebt = {
  id: string;
  title: string;
  reason?: string | null;
  originalAmount: number;
  amountRemaining: number;
  status: string;
  academicYearId: string;
  academicYearName?: string | null;
  carriedOverFromYearId?: string | null;
  carriedOverFromYearName?: string | null;
  dueDate?: string | null;
  settledAt?: string | null;
  createdAt: string;
};

type FinanceAlert = {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  status: string;
  createdAt: string;
};

type FinanceAllocationLine = {
  allocationId?: string;
  installmentId?: string;
  studentId?: string | null;
  studentName?: string;
  label: string;
  dueDate: string;
  allocated: number;
  outstandingAfter: number;
  createdAt?: string;
};

type FinancePaymentHistory = {
  id: string;
  transactionNumber: string;
  amount: number;
  reason: string;
  method: string;
  status: string;
  createdAt: string;
  receiptId?: string | null;
  receiptNumber?: string | null;
  allocationTrace?: {
    mode: string;
    totalReceived: number;
    allocatedTotal: number;
    advanceBalance: number;
    lines: FinanceAllocationLine[];
  } | null;
  students: Array<{ id: string; fullName: string }>;
};

type StudentFinanceRow = {
  id: string;
  fullName: string;
  className?: string | null;
  annualFee?: number;
  gradeGroup?: string;
  paymentOptionType?: string;
  paymentOptionLabel?: string;
  planName?: string;
  agreementId?: string | null;
  expectedTotal: number;
  reductionTotal: number;
  originalAmount?: number;
  installments?: FinanceInstallment[];
  paid: number;
  balance: number;
  overdueInstallments: number;
  completionRate: number;
  reductions?: FinanceReduction[];
  agreements?: FinanceAgreement[];
  debts?: FinanceDebt[];
};

type StudentFinanceSnapshot = {
  academicYear: { id: string; name: string; startDate: string; endDate: string };
  profile: {
    totalPaid: number;
    totalDebt: number;
    totalReduction: number;
    carriedOverDebt: number;
    overdueInstallments: number;
    pendingPaymentsTotal: number;
    failedPaymentsTotal: number;
    paymentBehaviorScore: number;
    lastPaymentAt: string | null;
    childrenLinkedToAccount: number;
    expectedNetRevenue: number;
    completionRate: number;
  };
  students: StudentFinanceRow[];
  installments?: FinanceInstallment[];
  reductions?: FinanceReduction[];
  debts?: FinanceDebt[];
  agreements?: FinanceAgreement[];
  alerts?: FinanceAlert[];
  paymentHistory?: FinancePaymentHistory[];
};

type SharedDirectoryResponse = {
  source: string;
  visibility: string;
  counts: { families: number; parents: number; students: number; teachers: number };
  parents: SharedDirectoryParent[];
  students: SharedDirectoryStudent[];
};

type SchoolClass = { id: string; name: string };

type TuitionPlan = {
  id: string;
  name: string;
  paymentOptionType: string;
  gradeGroup: string;
  finalAmount: number;
  originalAmount?: number;
  reductionAmount?: number;
};

type FinanceCatalog = {
  academicYear?: { name?: string };
  plans: TuitionPlan[];
};

type SpecialAgreementInstallmentMode = "ONE_TIME" | "TWO_INSTALLMENTS" | "THREE_INSTALLMENTS";
type SpecialAgreementDraft = {
  title: string;
  customTotal: string;
  reductionAmount: string;
  notes: string;
  installmentMode: SpecialAgreementInstallmentMode;
};

type StudentFormState = {
  lastName: string;
  middleName: string;
  firstName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  classId: string;
  parentId: string;
  annualFee: string;
  paymentOptionType: string;
  studentNumber: string;
  specialAgreement?: SpecialAgreementDraft;
};

const PAYMENT_OPTION_LABELS: Record<string, string> = {
  FULL_PRESEPTEMBER: "Paiement complet avant septembre",
  TWO_INSTALLMENTS: "Paiement en 2 tranches",
  THREE_INSTALLMENTS: "Paiement en 3 tranches",
  STANDARD_MONTHLY: "Paiement mensuel standard",
  SPECIAL_OWNER_AGREEMENT: "Arrangement avec l'école",
};

const EMPTY_SPECIAL_AGREEMENT: SpecialAgreementDraft = {
  title: "",
  customTotal: "",
  reductionAmount: "0",
  notes: "",
  installmentMode: "THREE_INSTALLMENTS",
};

function withSchoolArrangement(plans: TuitionPlan[]): TuitionPlan[] {
  return [...plans, { id: "school-arrangement", name: "Arrangement personnalisé avec l'école", paymentOptionType: "SPECIAL_OWNER_AGREEMENT", gradeGroup: plans[0]?.gradeGroup || "CUSTOM", finalAmount: 0 }];
}

function normalizeSpecialAgreementDraft(form: StudentFormState): SpecialAgreementDraft {
  const current = form.specialAgreement || EMPTY_SPECIAL_AGREEMENT;
  const studentName = [form.lastName, form.middleName, form.firstName].filter(Boolean).join(" ").trim();
  return {
    title: current.title || (studentName ? `Accord spécial - ${studentName}` : "Accord spécial parent-école"),
    customTotal: current.customTotal || "",
    reductionAmount: current.reductionAmount || "0",
    notes: current.notes || "",
    installmentMode: current.installmentMode || "THREE_INSTALLMENTS",
  };
}
function resolveStudentGradeGroup(className?: string) {
  const normalized = String(className || "").trim().toLowerCase();
  if (/^k\d?/.test(normalized) || normalized.includes("maternelle")) return "K";
  const match = normalized.match(/(?:grade|g)\s*(\d{1,2})/i);
  const grade = match ? Number(match[1]) : Number.NaN;
  if (grade <= 5) return "GRADE_1_5";
  if (grade <= 8) return "GRADE_6_8";
  if (grade <= 12) return "GRADE_9_12";
  return "CUSTOM";
}

function resolveStudentIdentity(student: SharedDirectoryStudent) {
  if (student.firstName || student.middleName || student.lastName) {
    return {
      lastName: student.lastName || "",
      middleName: student.middleName || "",
      firstName: student.firstName || "",
    };
  }

  const parts = student.fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { lastName: parts[0] || "", middleName: "", firstName: "" };
  return {
    lastName: parts[parts.length - 1],
    middleName: parts.slice(1, -1).join(" "),
    firstName: parts[0],
  };
}

function composeAdministrativeFullName(identity: Pick<StudentFormState, "lastName" | "middleName" | "firstName">) {
  return [identity.lastName, identity.middleName, identity.firstName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

const SCHOOL_SECTIONS: SchoolClass[] = [
  ...Array.from({ length: 3 }, (_v, index) => {
    const name = `K${index + 3}`;
    return { id: `section-${name.toLowerCase()}`, name };
  }),
  ...Array.from({ length: 12 }, (_v, index) => ({ id: `section-grade-${index + 1}`, name: `Grade ${index + 1}` }))
];

function getCanonicalSchoolClass(entry: SchoolClass): SchoolClass | null {
  const normalized = entry.name.trim().toLowerCase();
  const kindergarten = normalized.match(/\bk\s*([3-5])\b/) || entry.id.toLowerCase().match(/\bk\s*([3-5])\b/);
  if (kindergarten) return { ...entry, name: `K${kindergarten[1]}` };

  const grade = normalized.match(/\b(?:grade|g)\s*([1-9]|1[0-2])\b/) || entry.id.toLowerCase().match(/\b(?:grade|g)[-\s]*([1-9]|1[0-2])\b/);
  if (grade) return { ...entry, name: `Grade ${Number(grade[1])}` };

  return null;
}

function getSchoolClassOptions(classes: SchoolClass[]) {
  const byName = new Map<string, SchoolClass>();
  for (const fallbackClass of SCHOOL_SECTIONS) {
    const canonical = getCanonicalSchoolClass(fallbackClass);
    if (canonical) byName.set(canonical.name, canonical);
  }
  for (const classEntry of classes) {
    const canonical = getCanonicalSchoolClass(classEntry);
    if (canonical) byName.set(canonical.name, canonical);
  }

  return [...byName.values()].sort((a, b) => {
    const rank = (name: string) => {
      if (name.startsWith("K")) return Number(name.slice(1));
      const grade = name.match(/^Grade\s+([1-9]|1[0-2])$/);
      return grade ? 10 + Number(grade[1]) : 100;
    };
    return rank(a.name) - rank(b.name);
  });
}

function sortByFullName<T extends { fullName?: string; id?: string }>(items: T[] = []) {
  return [...items].sort((a, b) =>
    String(a.fullName || a.id || "").localeCompare(String(b.fullName || b.id || ""), "fr", { sensitivity: "base" })
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function normalizeDirectoryForUi(directory: SharedDirectoryResponse): SharedDirectoryResponse {
  const students = sortByFullName(directory.students ?? []);
  const parents = sortByFullName(directory.parents ?? []).map((parent) => ({
    ...parent,
    students: sortByFullName(parent.students ?? [])
  }));

  return {
    ...directory,
    parents,
    students,
    counts: {
      families: directory.counts?.families ?? parents.length,
      parents: directory.counts?.parents ?? parents.length,
      students: directory.counts?.students ?? students.length,
      teachers: directory.counts?.teachers ?? 0
    }
  };
}

function formatDateLabel(value?: string | null, lang: UiLanguage = "fr") {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US");
}

function formatDateTimeLabel(value?: string | null, lang: UiLanguage = "fr") {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(lang === "fr" ? "fr-FR" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatCurrency(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `$ ${value.toFixed(2)}` : "-";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "dossier-élève";
}

function getCodeLabel(value: string | null | undefined, lang: UiLanguage) {
  const code = String(value || "").toUpperCase();
  const labels: Record<string, [string, string]> = {
    PAID: ["Payé", "Paid"], PARTIALLY_PAID: ["Partiellement payé", "Partially paid"], PENDING: ["En attente", "Pending"],
    OPEN: ["Ouvert", "Open"], OVERDUE: ["En retard", "Overdue"], CLEARED: ["Soldé", "Cleared"], FAILED: ["Échoué", "Failed"],
    APPROVED: ["Approuvé", "Approved"], ACTIVE: ["Actif", "Active"], INACTIVE: ["Inactif", "Inactive"], CANCELLED: ["Annulé", "Cancelled"],
    CASH: ["Espèces", "Cash"], CARD: ["Carte", "Card"], BANK_TRANSFER: ["Virement bancaire", "Bank transfer"], MOBILE_MONEY: ["Mobile Money", "Mobile Money"],
    FULL_PRESEPTEMBER: ["Paiement complet avant septembre", "Full payment before September"], TWO_INSTALLMENTS: ["Paiement en 2 tranches", "Payment in 2 installments"],
    THREE_INSTALLMENTS: ["Paiement en 3 tranches", "Payment in 3 installments"], STANDARD_MONTHLY: ["Paiement mensuel standard", "Standard monthly payment"],
    SPECIAL_OWNER_AGREEMENT: ["Arrangement avec l’école", "Special school agreement"], HIGH: ["Élevée", "High"], MEDIUM: ["Moyenne", "Medium"], LOW: ["Faible", "Low"],
    SYNCED: ["Synchronisé", "Synced"], SKIPPED: ["Ignoré", "Skipped"]
  };
  return labels[code] ? labels[code][lang === "fr" ? 0 : 1] : (value || "-");
}

function getPaymentOptionLabel(value: string | null | undefined, lang: UiLanguage) {
  return getCodeLabel(value, lang);
}
function getInstallmentStatusTone(status: string, isOverdue: boolean) {
  if (isOverdue) return "border-red-500/30 bg-red-500/10 text-red-200";
  if (status === "PAID") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "PARTIALLY_PAID") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-slate-700 bg-slate-900/40 text-ink-dim";
}

function getDebtStatusTone(status: string) {
  if (status === "CLEARED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "PARTIALLY_PAID") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  if (status === "OVERDUE" || status === "OPEN") return "border-red-500/30 bg-red-500/10 text-red-200";
  return "border-slate-700 bg-slate-900/40 text-ink-dim";
}

function getStudentFinanceData(snapshot: StudentFinanceSnapshot | null, student: SharedDirectoryStudent) {
  const financeStudent = snapshot?.students.find((entry) => entry.id === student.id) ?? null;
  const installments = financeStudent?.installments?.length
    ? financeStudent.installments
    : (snapshot?.installments ?? []).filter((installment) => installment.studentId === student.id);
  const reductions = financeStudent?.reductions?.length
    ? financeStudent.reductions
    : (snapshot?.reductions ?? []).filter((reduction) => reduction.studentId === student.id || reduction.studentName === student.fullName);
  const debts = financeStudent?.debts?.length
    ? financeStudent.debts
    : (snapshot?.debts ?? []).filter((debt) => debt.title.includes(student.fullName) || (debt.reason ?? "").includes(student.fullName));
  const agreements = financeStudent?.agreements?.length
    ? financeStudent.agreements
    : (snapshot?.agreements ?? []).filter((agreement) => {
      if (financeStudent?.agreementId) return agreement.id === financeStudent.agreementId;
      return agreement.title.toLowerCase().includes(student.fullName.toLowerCase());
    });
  const paymentHistory = (snapshot?.paymentHistory ?? []).filter((payment) =>
    payment.students.some((entry) => entry.id === student.id)
      || payment.allocationTrace?.lines.some((line) => line.studentId === student.id)
      || payment.reason.toLowerCase().includes(student.fullName.toLowerCase())
  );
  const alerts = (snapshot?.alerts ?? []).filter((alert) =>
    alert.message.toLowerCase().includes(student.fullName.toLowerCase())
      || alert.title.toLowerCase().includes(student.fullName.toLowerCase())
      || (snapshot?.students.length ?? 0) === 1
  );

  return { financeStudent, installments, reductions, debts, agreements, paymentHistory, alerts };
}

function buildStudentReportHtml(input: {
  student: SharedDirectoryStudent;
  parent?: SharedDirectoryParent;
  snapshot: StudentFinanceSnapshot | null;
  lang: UiLanguage;
}) {
  const { student, parent, snapshot, lang } = input;
  const L = (fr: string, en: string) => localize(lang, fr, en);
  const r = lang === "fr" ? {
    administrativeRecord: "dossier administratif élève", reference: "Référence", financialRecord: "Dossier financier élève", student: "Élève", issued: "Émis le",
    identity: "Identité et rattachement", class: "Classe", parent: "Parent", parentPhone: "Téléphone parent", registration: "Inscription", summary: "Résumé financier",
    expected: "Total attendu", discount: "Réduction", paid: "Montant payé", balance: "Solde", plan: "Plan", option: "Option", overdue: "Échéances en retard", completion: "Taux de complétion",
    schedule: "Échéancier détaillé", installment: "Échéance", date: "Date", period: "Période", amountDue: "Montant dû", status: "Statut",
    payments: "Historique des paiements", transaction: "Transaction", reason: "Motif", method: "Méthode", amount: "Montant",
    reductions: "Réductions et remises", label: "Libellé", source: "Source", rate: "Taux", agreements: "Accords spéciaux", agreement: "Accord", total: "Total",
    debts: "Dettes et reports", line: "Ligne", initial: "Montant initial", remaining: "Reste à payer", alerts: "Alertes financières",
    schoolApproval: "Validation scolaire", studiesOffice: "Direction des études", financeApproval: "Visa financier", accounting: "Service comptable"
  } : {
    administrativeRecord: "student administrative record", reference: "Reference", financialRecord: "Student financial record", student: "Student", issued: "Issued on",
    identity: "Identity and links", class: "Class", parent: "Parent", parentPhone: "Parent phone", registration: "Registration", summary: "Financial summary",
    expected: "Expected total", discount: "Discount", paid: "Amount paid", balance: "Balance", plan: "Plan", option: "Option", overdue: "Overdue installments", completion: "Completion rate",
    schedule: "Detailed payment schedule", installment: "Installment", date: "Date", period: "Period", amountDue: "Amount due", status: "Status",
    payments: "Payment history", transaction: "Transaction", reason: "Reason", method: "Method", amount: "Amount",
    reductions: "Discounts and reductions", label: "Label", source: "Source", rate: "Rate", agreements: "Special agreements", agreement: "Agreement", total: "Total",
    debts: "Debts and carryovers", line: "Item", initial: "Initial amount", remaining: "Remaining balance", alerts: "Financial alerts",
    schoolApproval: "School approval", studiesOffice: "Studies office", financeApproval: "Financial approval", accounting: "Accounting department"
  };
  const brand = schoolBranding;

  const generatedAt = new Date();
  const documentReference = escapeHtml(`KCS-STU-${generatedAt.toISOString().slice(0, 10)}-${(student.displayId || student.studentNumber || student.id).replace(/[^A-Za-z0-9-]/g, "")}`);
  const logoSrc = escapeHtml(new URL(brand.logoSrc, window.location.href).toString());
  const { financeStudent, installments, reductions, debts, agreements, paymentHistory, alerts } = getStudentFinanceData(snapshot, student);

  const installmentRows = installments.length
    ? installments.map((installment) => `
      <tr>
        <td>${escapeHtml(installment.label)}</td>
        <td>${escapeHtml(formatDateLabel(installment.dueDate, lang))}</td>
        <td>${escapeHtml(installment.periodKey || "-")}</td>
        <td>${escapeHtml(formatCurrency(installment.amountDue))}</td>
        <td>${escapeHtml(formatCurrency(installment.amountPaid))}</td>
        <td>${escapeHtml(formatCurrency(installment.balance))}</td>
        <td>${escapeHtml(getCodeLabel(installment.status, lang))}</td>
      </tr>`).join("")
    : `<tr><td colspan="7">Aucune échéance générée.</td></tr>`;

  const paymentRows = paymentHistory.length
    ? paymentHistory.map((payment) => `
      <tr>
        <td>${escapeHtml(payment.transactionNumber)}</td>
        <td>${escapeHtml(payment.reason)}</td>
        <td>${escapeHtml(getCodeLabel(payment.method, lang))}</td>
        <td>${escapeHtml(getCodeLabel(payment.status, lang))}</td>
        <td>${escapeHtml(formatCurrency(payment.amount))}</td>
        <td>${escapeHtml(formatDateTimeLabel(payment.createdAt, lang))}</td>
      </tr>`).join("")
    : `<tr><td colspan="6">Aucun paiement rattaché à cet élève.</td></tr>`;

  const reductionRows = reductions.length
    ? reductions.map((reduction) => `
      <tr>
        <td>${escapeHtml(reduction.title)}</td>
        <td>${escapeHtml(reduction.source || reduction.scope || "-")}</td>
        <td>${escapeHtml(reduction.percentage ? `${reduction.percentage}%` : "-")}</td>
        <td>${escapeHtml(formatCurrency(reduction.amount))}</td>
        <td>${escapeHtml(formatDateLabel(reduction.effectiveDate, lang))}</td>
      </tr>`).join("")
    : `<tr><td colspan="5">Aucune réduction enregistrée.</td></tr>`;

  const debtRows = debts.length
    ? debts.map((debt) => `
      <tr>
        <td>${escapeHtml(debt.title)}</td>
        <td>${escapeHtml(debt.reason || "-")}</td>
        <td>${escapeHtml(formatCurrency(debt.originalAmount))}</td>
        <td>${escapeHtml(formatCurrency(debt.amountRemaining))}</td>
        <td>${escapeHtml(getCodeLabel(debt.status, lang))}</td>
        <td>${escapeHtml(formatDateLabel(debt.dueDate, lang))}</td>
      </tr>`).join("")
    : `<tr><td colspan="6">Aucune dette dédiée à cet élève.</td></tr>`;

  const agreementRows = agreements.length
    ? agreements.map((agreement) => `
      <tr>
        <td>${escapeHtml(agreement.title)}</td>
        <td>${escapeHtml(getPaymentOptionLabel(agreement.paymentOptionType, lang))}</td>
        <td>${escapeHtml(formatCurrency(agreement.customTotal))}</td>
        <td>${escapeHtml(formatCurrency(agreement.reductionAmount))}</td>
        <td>${escapeHtml(getCodeLabel(agreement.status, lang))}</td>
        <td>${escapeHtml(formatDateTimeLabel(agreement.approvedAt || agreement.createdAt, lang))}</td>
      </tr>`).join("")
    : `<tr><td colspan="6">Aucun accord spécial enregistré.</td></tr>`;

  const alertRows = alerts.length
    ? alerts.map((alert) => `
      <div class="alert alert-${escapeHtml(alert.severity.toLowerCase())}">
        <strong>${escapeHtml(alert.title)}</strong>
        <p>${escapeHtml(alert.message)}</p>
        <span>${escapeHtml(formatDateTimeLabel(alert.createdAt, lang))}</span>
      </div>`).join("")
    : `<div class="alert alert-neutral"><strong>Suivi</strong><p>Aucune alerte financière spécifique pour cet élève.</p><span>-</span></div>`;

  return `<!DOCTYPE html>
  <html lang="${lang}">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(brand.schoolName)} - ${escapeHtml(r.financialRecord)} - ${escapeHtml(student.fullName)}</title>
      <style>
        :root {
          --brand-primary: ${brand.colors.primary};
          --brand-secondary: ${brand.colors.secondary};
          --brand-accent: ${brand.colors.accent};
          --brand-surface: ${brand.colors.surface};
          --ink: #0f172a;
          --muted: #64748b;
          --line: #cbd5e1;
        }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 28px; font-family: "Segoe UI", Arial, sans-serif; color: var(--ink); background: linear-gradient(180deg, #fff, var(--brand-surface)); }
        .watermark { position: fixed; right: 18px; bottom: 28px; width: 220px; opacity: 0.06; filter: grayscale(100%); }
        .topbar { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:10px; color: var(--muted); font-size:10px; text-transform:uppercase; letter-spacing:0.16em; }
        .topbar strong { color: var(--brand-primary); }
        .header { display: flex; justify-content: space-between; gap: 24px; border-radius: 20px; padding: 20px 22px; color: white; background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary)); }
        .header-brand { display: flex; gap: 16px; align-items: center; }
        .header-logo { width: 76px; height: 76px; border-radius: 22px; background: white; padding: 8px; object-fit: contain; }
        .eyebrow { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,255,255,0.72); }
        .school-name { margin: 6px 0 0; font-size: 28px; font-weight: 800; }
        .school-meta { margin-top: 6px; font-size: 12px; color: rgba(255,255,255,0.88); }
        .report-box { min-width: 240px; border-radius: 16px; padding: 14px 16px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.16); }
        .report-box strong { display: block; margin-top: 8px; font-size: 20px; }
        .panel { margin-top: 18px; border: 1px solid rgba(148,163,184,0.28); border-radius: 18px; padding: 18px; background: rgba(255,255,255,0.94); }
        .panel h2 { margin: 0 0 12px; font-size: 15px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--brand-primary); }
        .summary-grid, .meta-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .meta-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .summary-grid div, .meta-grid div { border: 1px solid rgba(143,183,232,0.42); border-radius: 14px; padding: 12px; background: linear-gradient(180deg, rgba(248,251,255,0.98), rgba(232,241,252,0.88)); }
        .summary-grid span, .meta-grid span { display: block; font-size: 11px; text-transform: uppercase; color: var(--muted); }
        .summary-grid strong, .meta-grid strong { display: block; margin-top: 6px; font-size: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid var(--line); padding: 9px; text-align: left; font-size: 12px; vertical-align: top; }
        th { background: linear-gradient(180deg, rgba(11,46,89,0.08), rgba(31,79,143,0.04)); color: var(--brand-primary); text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em; }
        .alerts { display: grid; gap: 12px; }
        .alert { border-radius: 14px; padding: 14px; border: 1px solid var(--line); background: #f8fafc; }
        .alert strong { display: block; }
        .alert p { margin: 8px 0; font-size: 13px; }
        .alert span { color: var(--muted); font-size: 11px; }
        .alert-high { border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); }
        .alert-medium { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.08); }
        .footer { margin-top: 18px; display: flex; justify-content: space-between; gap: 12px; font-size: 11px; color: var(--muted); }
        .compliance { margin-top: 16px; border: 1px solid rgba(15, 118, 110, 0.2); border-left: 5px solid #0f766e; border-radius: 14px; background: rgba(240, 253, 250, 0.96); padding: 12px 14px; color: #134e4a; font-size: 11px; line-height: 1.5; }
        .signatures { margin-top: 16px; display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:16px; }
        .signature-box { min-height:82px; border:1px dashed rgba(11,46,89,0.24); border-radius:14px; background: rgba(255,255,255,0.88); padding:12px; }
        .signature-title { font-size:10px; text-transform:uppercase; letter-spacing:0.14em; font-weight:800; color:var(--muted); }
        .signature-line { margin-top:38px; border-top:1px solid rgba(11,46,89,0.24); padding-top:6px; font-size:11px; color:var(--brand-primary); font-weight:700; }
      </style>
    </head>
    <body>
      <img class="watermark" src="${logoSrc}" alt="" />
      <div class="topbar"><span><strong>${escapeHtml(brand.shortName)}</strong> · ${escapeHtml(r.administrativeRecord)}</span><span>${escapeHtml(r.reference)} ${documentReference}</span></div>
      <div class="header">
        <div class="header-brand">
          <img class="header-logo" src="${logoSrc}" alt="Logo ${escapeHtml(brand.schoolName)}" />
          <div>
            <div class="eyebrow">${escapeHtml(r.financialRecord)}</div>
            <div class="school-name">${escapeHtml(brand.schoolName)}</div>
            <div class="school-meta">${escapeHtml(brand.tagline)} · ${escapeHtml(brand.appName)} · ${escapeHtml(brand.shortName)}</div>
          </div>
        </div>
        <div class="report-box">
          <div class="eyebrow">${escapeHtml(r.student)}</div>
          <strong>${escapeHtml(student.fullName)}</strong>
          <div class="school-meta">ID ${escapeHtml(student.displayId || student.studentNumber || student.id)}</div>
          <div class="school-meta">${escapeHtml(r.issued)} ${escapeHtml(generatedAt.toLocaleString(lang === "fr" ? "fr-FR" : "en-US"))}</div>
        </div>
      </div>
      <section class="panel">
        <h2>${escapeHtml(r.identity)}</h2>
        <div class="meta-grid">
          <div><span>${escapeHtml(r.class)}</span><strong>${escapeHtml(student.className || student.classId || "-")}</strong></div>
          <div><span>${escapeHtml(r.parent)}</span><strong>${escapeHtml(parent?.fullName || "-")}</strong></div>
          <div><span>${escapeHtml(r.parentPhone)}</span><strong>${escapeHtml(parent?.phone || "-")}</strong></div>
          <div><span>${escapeHtml(r.registration)}</span><strong>${escapeHtml(formatDateTimeLabel(student.createdAt))}</strong></div>
        </div>
      </section>
      <section class="panel">
        <h2>${escapeHtml(r.summary)}</h2>
        <div class="summary-grid">
          <div><span>${escapeHtml(r.expected)}</span><strong>${escapeHtml(formatCurrency(financeStudent?.expectedTotal ?? student.annualFeeDisplay ?? student.annualFee ?? null))}</strong></div>
          <div><span>${escapeHtml(r.discount)}</span><strong>${escapeHtml(formatCurrency(financeStudent?.reductionTotal ?? student.reductionTotal ?? null))}</strong></div>
          <div><span>${escapeHtml(r.paid)}</span><strong>${escapeHtml(formatCurrency(financeStudent?.paid ?? 0))}</strong></div>
          <div><span>${escapeHtml(r.balance)}</span><strong>${escapeHtml(formatCurrency(financeStudent?.balance ?? 0))}</strong></div>
          <div><span>${escapeHtml(r.plan)}</span><strong>${escapeHtml(financeStudent?.planName || student.tuitionPlanName || "-")}</strong></div>
          <div><span>${escapeHtml(r.option)}</span><strong>${escapeHtml(financeStudent?.paymentOptionLabel || getPaymentOptionLabel(financeStudent?.paymentOptionType || student.paymentOptionType, lang))}</strong></div>
          <div><span>${escapeHtml(r.overdue)}</span><strong>${escapeHtml(String(financeStudent?.overdueInstallments ?? 0))}</strong></div>
          <div><span>${escapeHtml(r.completion)}</span><strong>${escapeHtml(`${(financeStudent?.completionRate ?? 0).toFixed(1)}%`)}</strong></div>
        </div>
      </section>
      <section class="panel"><h2>${escapeHtml(r.schedule)}</h2><table><thead><tr><th>${escapeHtml(r.installment)}</th><th>${escapeHtml(r.date)}</th><th>Période</th><th>${escapeHtml(r.amountDue)}</th><th>${escapeHtml(r.paid)}</th><th>${escapeHtml(r.balance)}</th><th>${escapeHtml(r.status)}</th></tr></thead><tbody>${installmentRows}</tbody></table></section>
      <section class="panel"><h2>${escapeHtml(r.payments)}</h2><table><thead><tr><th>${escapeHtml(r.transaction)}</th><th>${escapeHtml(r.reason)}</th><th>${escapeHtml(r.method)}</th><th>${escapeHtml(r.status)}</th><th>${escapeHtml(r.amount)}</th><th>${escapeHtml(r.date)}</th></tr></thead><tbody>${paymentRows}</tbody></table></section>
      <section class="panel"><h2>${escapeHtml(r.reductions)}</h2><table><thead><tr><th>${escapeHtml(r.label)}</th><th>${escapeHtml(r.source)}</th><th>${escapeHtml(r.rate)}</th><th>${escapeHtml(r.amount)}</th><th>${escapeHtml(r.date)}</th></tr></thead><tbody>${reductionRows}</tbody></table></section>
      <section class="panel"><h2>${escapeHtml(r.agreements)}</h2><table><thead><tr><th>${escapeHtml(r.agreement)}</th><th>${escapeHtml(r.option)}</th><th>${escapeHtml(r.total)}</th><th>${escapeHtml(r.discount)}</th><th>${escapeHtml(r.status)}</th><th>${escapeHtml(r.date)}</th></tr></thead><tbody>${agreementRows}</tbody></table></section>
      <section class="panel"><h2>${escapeHtml(r.debts)}</h2><table><thead><tr><th>${escapeHtml(r.line)}</th><th>${escapeHtml(r.reason)}</th><th>${escapeHtml(r.initial)}</th><th>${escapeHtml(r.remaining)}</th><th>${escapeHtml(r.status)}</th><th>${escapeHtml(r.installment)}</th></tr></thead><tbody>${debtRows}</tbody></table></section>
      <section class="panel"><h2>${escapeHtml(r.alerts)}</h2><div class="alerts">${alertRows}</div></section>
      <div class="compliance">Ce dossier reprend l'état académique et financier détaillé de l'élève tel qu'affiché dans EduPay. Il est édité selon la charte ${escapeHtml(brand.shortName)} pour contrôle, suivi et archivage.</div>
      <div class="signatures"><div class="signature-box"><div class="signature-title">${escapeHtml(r.schoolApproval)}</div><div class="signature-line">${escapeHtml(r.studiesOffice)}</div></div><div class="signature-box"><div class="signature-title">${escapeHtml(r.financeApproval)}</div><div class="signature-line">${escapeHtml(r.accounting)}</div></div></div>
      <div class="footer"><span>Document officiel ${escapeHtml(brand.appName)} généré pour ${escapeHtml(brand.schoolName)}.</span><span>Année académique ${escapeHtml(snapshot?.academicYear.name || "-")} · ${escapeHtml(generatedAt.toLocaleString(lang === "fr" ? "fr-FR" : "en-US"))}</span></div>
    </body>
  </html>`;
}

async function mountStudentReportFrame(student: SharedDirectoryStudent, parent: SharedDirectoryParent | undefined, snapshot: StudentFinanceSnapshot | null, lang: UiLanguage) {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "1024px";
  frame.style.height = "1px";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  frame.style.border = "0";
  document.body.appendChild(frame);

  return new Promise<HTMLIFrameElement>((resolve, reject) => {
    frame.onload = () => resolve(frame);
    frame.onerror = () => {
      frame.remove();
      reject(new Error("Impossible de préparer le document élève."));
    };
    frame.srcdoc = buildStudentReportHtml({ student, parent, snapshot, lang });
  });
}

async function exportStudentReportPdf(student: SharedDirectoryStudent, parent: SharedDirectoryParent | undefined, snapshot: StudentFinanceSnapshot | null, lang: UiLanguage) {
  const frame = await mountStudentReportFrame(student, parent, snapshot, lang);

  try {
    const body = frame.contentDocument?.body;
    if (!body) throw new Error("Document PDF élève introuvable.");

    await exportElementToPdf(body, {
      filename: `dossier-élève-${slugify(student.fullName)}-${new Date().toISOString().slice(0, 10)}.pdf`,
      backgroundColor: "#ffffff",
      width: Math.max(body.scrollWidth, 1024),
      height: body.scrollHeight,
      windowWidth: Math.max(body.scrollWidth, 1024),
      windowHeight: body.scrollHeight,
    });
  } finally {
    frame.remove();
  }
}

function printStudentReport(student: SharedDirectoryStudent, parent: SharedDirectoryParent | undefined, snapshot: StudentFinanceSnapshot | null, lang: UiLanguage) {
  printHtmlDocument(buildStudentReportHtml({ student, parent, snapshot, lang }));
}

function exportStudentReportExcel(student: SharedDirectoryStudent, parent: SharedDirectoryParent | undefined, snapshot: StudentFinanceSnapshot | null, lang: UiLanguage) {
  const L = (fr: string, en: string) => localize(lang, fr, en);
  const { financeStudent, installments, reductions, debts, agreements, paymentHistory, alerts } = getStudentFinanceData(snapshot, student);
  exportWorkbook(`dossier-élève-${slugify(student.fullName)}-${new Date().toISOString().slice(0, 10)}`, [
    {
      name: L("Résumé", "Summary"),
      rows: [{
        [L("ID Élève", "Student ID")]: student.displayId || student.studentNumber || student.id,
        [L("Nom complet", "Full name")]: student.fullName,
        [L("Classe", "Class")]: student.className || student.classId,
        [L("Parent", "Parent")]: parent?.fullName || "-",
        [L("Téléphone parent", "Parent phone")]: parent?.phone || "-",
        [L("Date inscription", "Registration date")]: formatDateTimeLabel(student.createdAt),
        [L("Plan", "Plan")]: financeStudent?.planName || student.tuitionPlanName || "-",
        [L("Option de paiement", "Payment option")]: financeStudent?.paymentOptionLabel || getPaymentOptionLabel(financeStudent?.paymentOptionType || student.paymentOptionType, lang),
        [L("Montant initial", "Initial amount")]: financeStudent?.originalAmount ?? student.originalAnnualFee ?? student.annualFee ?? null,
        [L("Total attendu", "Expected total")]: financeStudent?.expectedTotal ?? student.annualFeeDisplay ?? student.annualFee ?? null,
        [L("Réduction", "Discount")]: financeStudent?.reductionTotal ?? student.reductionTotal ?? null,
        [L("Payé", "Paid")]: financeStudent?.paid ?? 0,
        [L("Solde", "Balance")]: financeStudent?.balance ?? 0,
        [L("Échéances en retard", "Overdue installments")]: financeStudent?.overdueInstallments ?? 0,
        [L("Taux de complétion", "Completion rate")]: financeStudent?.completionRate ?? 0,
        [L("Année académique", "Academic year")]: snapshot?.academicYear.name ?? "-",
      }]
    },
    {
      name: L("Échéances", "Installments"),
      rows: installments.map((installment) => ({
        [L("Libellé", "Label")]: installment.label,
        [L("Période", "Period")]: installment.periodKey || "-",
        [L("Date échéance", "Due date")]: formatDateLabel(installment.dueDate),
        [L("Montant dû", "Amount due")]: installment.amountDue,
        [L("Montant payé", "Amount paid")]: installment.amountPaid,
        [L("Solde", "Balance")]: installment.balance,
        [L("Statut", "Status")]: getCodeLabel(installment.status, lang),
        [L("En retard", "Overdue")]: installment.isOverdue ? L("Oui", "Yes") : L("Non", "No"),
      }))
    },
    {
      name: L("Paiements", "Payments"),
      rows: paymentHistory.map((payment) => ({
        [L("Transaction", "Transaction")]: payment.transactionNumber,
        [L("Motif", "Reason")]: payment.reason,
        [L("Méthode", "Method")]: getCodeLabel(payment.method, lang),
        [L("Statut", "Status")]: getCodeLabel(payment.status, lang),
        [L("Montant", "Amount")]: payment.amount,
        [L("Date", "Date")]: formatDateTimeLabel(payment.createdAt),
        [L("Reçu", "Receipt")]: payment.receiptNumber || "-",
      }))
    },
    {
      name: L("Réductions", "Discounts"),
      rows: reductions.map((reduction) => ({
        [L("Libellé", "Label")]: reduction.title,
        [L("Source", "Source")]: reduction.source || reduction.scope || "-",
        [L("Pourcentage", "Percentage")]: reduction.percentage ?? null,
        [L("Montant", "Amount")]: reduction.amount,
        [L("Date", "Date")]: formatDateLabel(reduction.effectiveDate),
      }))
    },
    {
      name: L("Dettes", "Debts"),
      rows: debts.map((debt) => ({
        [L("Ligne", "Item")]: debt.title,
        [L("Motif", "Reason")]: debt.reason || "-",
        [L("Montant initial", "Initial amount")]: debt.originalAmount,
        [L("Reste à payer", "Remaining balance")]: debt.amountRemaining,
        [L("Statut", "Status")]: getCodeLabel(debt.status, lang),
        [L("Échéance", "Due date")]: formatDateLabel(debt.dueDate),
        [L("Créée le", "Created on")]: formatDateTimeLabel(debt.createdAt),
      }))
    },
    {
      name: L("Accords et alertes", "Agreements and alerts"),
      rows: [
        ...agreements.map((agreement) => ({
          [L("Type", "Type")]: "Accord",
          [L("Titre", "Title")]: agreement.title,
          [L("Détail", "Details")]: agreement.notes || agreement.paymentOptionType || "-",
          [L("Montant", "Amount")]: agreement.customTotal,
          [L("Statut", "Status")]: getCodeLabel(agreement.status, lang),
          [L("Date", "Date")]: formatDateTimeLabel(agreement.approvedAt || agreement.createdAt),
        })),
        ...alerts.map((alert) => ({
          [L("Type", "Type")]: "Alerte",
          [L("Titre", "Title")]: alert.title,
          [L("Détail", "Details")]: alert.message,
          [L("Montant", "Amount")]: null,
          [L("Statut", "Status")]: getCodeLabel(alert.severity, lang),
          [L("Date", "Date")]: formatDateTimeLabel(alert.createdAt),
        }))
      ]
    }
  ]);
}

function StudentDetailModal({ student, parent, resettingAccess, onResetAccess, onClose }: { student: SharedDirectoryStudent; parent?: SharedDirectoryParent; resettingAccess: boolean; onResetAccess: () => void; onClose: () => void }) {
  const { lang } = useI18n();
  const L = (fr: string, en: string) => localize(lang, fr, en);
  const displayedAnnualFee = typeof student.annualFeeDisplay === "number" ? student.annualFeeDisplay : student.annualFee;
  const originalAnnualFee = typeof student.originalAnnualFee === "number" ? student.originalAnnualFee : student.annualFee;
  const reductionTotal = typeof student.reductionTotal === "number" ? student.reductionTotal : 0;
  const registrationDate = student.createdAt
    ? new Date(student.createdAt).toLocaleString("fr-FR")
    : "Date non renseignée";
  const [financeSnapshot, setFinanceSnapshot] = useState<StudentFinanceSnapshot | null>(null);
  const [financeLoading, setFinanceLoading] = useState(Boolean(parent?.id));
  const [financeError, setFinanceError] = useState<string | null>(null);
  const [pdfExporting, setPdfExporting] = useState(false);

  useEffect(() => {
    if (!parent?.id) {
      setFinanceLoading(false);
      setFinanceSnapshot(null);
      setFinanceError("Aucun parent associé à cet élève.");
      return;
    }

    let active = true;
    setFinanceLoading(true);
    setFinanceError(null);
    void api<StudentFinanceSnapshot>(`/api/finance/parents/${parent.id}/profile`)
      .then((snapshot) => {
        if (!active) return;
        setFinanceSnapshot(snapshot);
      })
      .catch((error) => {
        if (!active) return;
        setFinanceError(error instanceof Error ? error.message : "Impossible de charger le dossier financier de l'élève.");
      })
      .finally(() => {
        if (active) setFinanceLoading(false);
      });

    return () => {
      active = false;
    };
  }, [parent?.id]);

  const { financeStudent, installments, reductions, debts, agreements, paymentHistory, alerts } = useMemo(
    () => getStudentFinanceData(financeSnapshot, student),
    [financeSnapshot, student]
  );
  const exportDisabled = financeLoading || Boolean(financeError) || !financeStudent || pdfExporting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-3 py-4 sm:px-5 sm:py-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="edupay-dialog-panel-xl relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-white/10 glass shadow-2xl animate-fadeInUp"
        onClick={(event) => event.stopPropagation()}
      >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-5 z-30 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-950/80 text-slate-300 shadow-lg backdrop-blur-xl transition-colors hover:bg-white/10 hover:text-white"
        aria-label={L("Fermer", "Close")}
      >
        <X className="h-5 w-5" />
      </button>
        <div className="sticky top-0 z-10 flex flex-col gap-4 border-b border-white/10 bg-slate-950/90 px-6 py-5 pr-14 backdrop-blur-xl sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-200">{L("Fiche élève", "Student record")}</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-white">{student.fullName}</h2>
            <p className="mt-1 text-sm text-slate-300">{L("Traçabilité complète du dossier financier, des échéances, des paiements et des alertes.", "Complete traceability of the financial record, installments, payments and alerts.")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onResetAccess}
              disabled={resettingAccess}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-400/20 disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" /> {resettingAccess ? L("Réinitialisation...", "Resetting...") : L("Réinitialiser le mot de passe", "Reset password")}
            </button>
            <button
              type="button"
              onClick={() => {
                setPdfExporting(true);
                void exportStudentReportPdf(student, parent, financeSnapshot, lang).finally(() => setPdfExporting(false));
              }}
              disabled={exportDisabled}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 text-sm font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileText className="h-4 w-4" /> {pdfExporting ? "PDF..." : "PDF"}
            </button>
            <button
              type="button"
              onClick={() => printStudentReport(student, parent, financeSnapshot, lang)}
              disabled={exportDisabled}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 text-sm font-semibold text-sky-100 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-4 w-4" /> {L("Impression", "Print")}
            </button>
            <button
              type="button"
              onClick={() => exportStudentReportExcel(student, parent, financeSnapshot, lang)}
              disabled={exportDisabled}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </button>
          </div>
        </div>
        <div className="edupay-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-sm text-slate-300">{L("ID élève", "Student ID")}</p>
            <p className="mt-1 break-words font-mono text-sm font-bold text-cyan-200">{student.displayId || student.studentNumber || student.id}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-sm text-slate-300">{L("Classe", "Class")}</p>
            <p className="mt-1 font-semibold text-white">{student.className || student.classId || L("Classe non renseignée", "Class not provided")}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-sm text-slate-300">{L("Date de naissance", "Date of birth")}</p>
            <p className="mt-1 font-semibold text-white">{formatDateLabel(student.dateOfBirth)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-sm text-slate-300">{L("Parent", "Parent")}</p>
            <p className="mt-1 font-semibold text-white">{parent?.fullName || L("Parent non retrouvé", "Parent not found")}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-sm text-slate-300">{L("Inscription", "Registration")}</p>
            <p className="mt-1 font-semibold text-white">{registrationDate}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-sm text-slate-300">{L("Frais annuels", "Annual tuition")}</p>
            <p className="mt-1 font-mono font-bold text-emerald-300">{typeof displayedAnnualFee === "number" ? `$ ${displayedAnnualFee.toFixed(2)}` : "-"}</p>
            {student.tuitionPlanName ? <p className="mt-1 text-sm text-cyan-200">{student.tuitionPlanName}</p> : null}
            {typeof originalAnnualFee === "number" && reductionTotal > 0 ? <p className="mt-1 text-sm text-amber-200">{L("Base $", "Base $")} {originalAnnualFee.toFixed(2)} {L("· Reduction $", "· Discount $")} {reductionTotal.toFixed(2)}</p> : null}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-sm text-slate-300">{L("Total attendu", "Expected total")}</p>
            <p className="mt-1 font-mono font-bold text-white">{formatCurrency(financeStudent?.expectedTotal ?? displayedAnnualFee ?? null)}</p>
            <p className="mt-1 text-sm text-slate-300">{L("Payé", "Paid")} {formatCurrency(financeStudent?.paid ?? 0)} {L("· Solde", "· Balance")} {formatCurrency(financeStudent?.balance ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-sm text-slate-300">{L("État du dossier", "Record status")}</p>
            <p className="mt-1 font-semibold text-white">{(financeStudent?.completionRate ?? 0).toFixed(1)}{L("% de completion", "% complete")}</p>
            <p className="mt-1 text-sm text-slate-300">{financeStudent?.overdueInstallments ?? 0} {L("échéance(s) en retard", "overdue installment(s)")}</p>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {financeLoading ? (
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6 text-sm text-cyan-100">{L("Chargement du dossier financier de l'élève...", "Loading the student financial record...")}</div>
          ) : financeError ? (
            <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">{financeError}</div>
          ) : !financeStudent ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">{L("Aucune ligne financière détaillée n'a été trouvée pour cet élève.", "No detailed financial record was found for this student.")}</div>
          ) : (
            <>
              <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.14em] text-cyan-200">{L("Échéancier détaillé", "Detailed payment schedule")}</p>
                      <p className="mt-1 text-sm text-slate-300">{L("Chaque échéance, son statut, son reste à payer et sa date limite.", "Each installment, its status, remaining balance and due date.")}</p>
                    </div>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-left text-sm uppercase tracking-[0.12em] text-slate-300">
                          <th className="px-3 py-3">{L("Libellé", "Label")}</th>
                          <th className="px-3 py-3">{L("Date", "Date")}</th>
                          <th className="px-3 py-3">{L("Montant dû", "Amount due")}</th>
                          <th className="px-3 py-3">{L("Payé", "Paid")}</th>
                          <th className="px-3 py-3">{L("Solde", "Balance")}</th>
                          <th className="px-3 py-3">{L("Statut", "Status")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {installments.length === 0 ? (
                          <tr><td colSpan={6} className="px-3 py-4 text-sm text-slate-300">{L("Aucune échéance enregistrée.", "No installments recorded.")}</td></tr>
                        ) : installments.map((installment) => (
                          <tr key={installment.id} className="border-b border-white/5">
                            <td className="px-3 py-3 text-white">{installment.label}<p className="mt-1 text-sm text-slate-300">{installment.periodKey || L("Période non renseignée", "Period not provided")}</p></td>
                            <td className="px-3 py-3 text-slate-300">{formatDateLabel(installment.dueDate)}</td>
                            <td className="px-3 py-3 font-mono text-white">{formatCurrency(installment.amountDue)}</td>
                            <td className="px-3 py-3 font-mono text-emerald-300">{formatCurrency(installment.amountPaid)}</td>
                            <td className="px-3 py-3 font-mono text-amber-200">{formatCurrency(installment.balance)}</td>
                            <td className="px-3 py-3"><span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${getInstallmentStatusTone(installment.status, installment.isOverdue)}`}>{getCodeLabel(installment.status, lang)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="space-y-5">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-bold uppercase tracking-[0.14em] text-cyan-200">{L("Traçabilité des paiements", "Payment traceability")}</p>
                    <div className="mt-4 space-y-3">
                      {paymentHistory.length === 0 ? (
                        <p className="text-sm text-slate-300">{L("Aucun paiement rattaché à cet élève.", "No payment linked to this student.")}</p>
                      ) : paymentHistory.map((payment) => (
                        <div key={payment.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">{payment.reason}</p>
                              <p className="mt-1 text-sm text-slate-300">{payment.transactionNumber} · {formatDateTimeLabel(payment.createdAt)}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-lg font-bold text-emerald-300">{formatCurrency(payment.amount)}</p>
                              <p className="mt-1 text-sm text-slate-300">{getCodeLabel(payment.method, lang)} · {getCodeLabel(payment.status, lang)}</p>
                            </div>
                          </div>
                          {payment.allocationTrace?.lines?.filter((line) => line.studentId === student.id).length ? (
                            <div className="mt-3 space-y-2 rounded-xl border border-white/5 bg-white/[0.03] p-3">
                              {payment.allocationTrace.lines.filter((line) => line.studentId === student.id).map((line, index) => (
                                <div key={`${payment.id}-${line.installmentId || index}`} className="flex items-center justify-between gap-3 text-sm text-slate-300">
                                  <span>{line.label} · {formatDateLabel(line.dueDate)}</span>
                                  <span className="font-mono text-cyan-200">{L("Alloué", "Allocated")} {formatCurrency(line.allocated)} {L("· Reste", "· Remaining")} {formatCurrency(line.outstandingAfter)}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-bold uppercase tracking-[0.14em] text-cyan-200">{L("Réductions et accords", "Discounts and agreements")}</p>
                    <div className="mt-4 space-y-3">
                      {reductions.map((reduction) => (
                        <div key={reduction.id} className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">{reduction.title}</p>
                              <p className="mt-1 text-sm text-slate-300">{reduction.source || reduction.scope || L("Remise", "Discount")} · {formatDateLabel(reduction.effectiveDate)}</p>
                            </div>
                            <p className="font-mono text-sm font-bold text-amber-200">{formatCurrency(reduction.amount)}</p>
                          </div>
                        </div>
                      ))}
                      {agreements.map((agreement) => (
                        <div key={agreement.id} className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
                          <p className="font-semibold text-white">{agreement.title}</p>
                          <p className="mt-1 text-sm text-slate-300">{agreement.paymentOptionType || L("Accord spécial", "Special agreement")} · {getCodeLabel(agreement.status, lang)}</p>
                          <p className="mt-2 text-sm text-cyan-100">{L("Total", "Total")} {formatCurrency(agreement.customTotal)} {L("· Réduction", "· Discount")} {formatCurrency(agreement.reductionAmount)} {L("· Solde", "· Balance")} {formatCurrency(agreement.balanceDue)}</p>
                        </div>
                      ))}
                      {reductions.length === 0 && agreements.length === 0 ? <p className="text-sm text-slate-300">{L("Aucune réduction ni accord spécial enregistré.", "No discount or special agreement recorded.")}</p> : null}
                    </div>
                  </div>
                </section>
              </div>

              <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-bold uppercase tracking-[0.14em] text-cyan-200">{L("Dettes et reports", "Debts and carryovers")}</p>
                  <div className="mt-4 space-y-3">
                    {debts.length === 0 ? (
                      <p className="text-sm text-slate-300">{L("Aucune dette spécifique trouvée pour cet élève.", "No student-specific debt found.")}</p>
                    ) : debts.map((debt) => (
                      <div key={debt.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{debt.title}</p>
                            <p className="mt-1 text-sm text-slate-300">{debt.reason || debt.academicYearName || debt.academicYearId}</p>
                          </div>
                          <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${getDebtStatusTone(debt.status)}`}>{getCodeLabel(debt.status, lang)}</span>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <div><p className="text-sm text-slate-300">{L("Montant initial", "Initial amount")}</p><p className="mt-1 font-mono font-bold text-white">{formatCurrency(debt.originalAmount)}</p></div>
                          <div><p className="text-sm text-slate-300">{L("Reste à payer", "Remaining balance")}</p><p className="mt-1 font-mono font-bold text-amber-200">{formatCurrency(debt.amountRemaining)}</p></div>
                          <div><p className="text-sm text-slate-300">{L("Échéance", "Due date")}</p><p className="mt-1 font-semibold text-white">{formatDateLabel(debt.dueDate)}</p></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-bold uppercase tracking-[0.14em] text-cyan-200">{L("Alertes et suivi", "Alerts and follow-up")}</p>
                  <div className="mt-4 space-y-3">
                    {alerts.length === 0 ? (
                      <p className="text-sm text-slate-300">{L("Aucune alerte spécifique pour cet élève.", "No specific alert for this student.")}</p>
                    ) : alerts.map((alert) => (
                      <div key={alert.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-full bg-amber-500/10 p-2 text-amber-200"><AlertCircle className="h-4 w-4" /></div>
                          <div>
                            <p className="font-semibold text-white">{alert.title}</p>
                            <p className="mt-1 text-sm text-slate-300">{alert.message}</p>
                            <p className="mt-2 text-sm text-slate-300">{getCodeLabel(alert.severity, lang)} · {formatDateTimeLabel(alert.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

function StudentEditModal({
  student,
  parent,
  parents,
  classes,
  catalog,
  saving,
  onSave,
  onClose,
  creating = false
}: {
  student: SharedDirectoryStudent;
  parent?: SharedDirectoryParent;
  parents: SharedDirectoryParent[];
  classes: SchoolClass[];
  catalog: FinanceCatalog | null;
  saving: boolean;
  onSave: (state: StudentFormState) => Promise<void>;
  onClose: () => void;
  creating?: boolean;
}) {
  const { lang } = useI18n();
  const L = (fr: string, en: string) => localize(lang, fr, en);
  const classOptions = useMemo(() => getSchoolClassOptions(classes), [classes]);
  const identity = resolveStudentIdentity(student);
  const [form, setForm] = useState<StudentFormState>({
    ...identity,
    email: student.email || '',
    phone: student.phone || '',
    dateOfBirth: student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '',
    gender: student.gender || '',
    classId: student.classId || "",
    parentId: parent?.id || student.parentId || "",
    annualFee: typeof student.annualFee === "number" ? String(student.annualFee) : "",
    paymentOptionType: student.paymentOptionType || "STANDARD_MONTHLY",
    studentNumber: student.studentNumber || student.displayId || student.externalStudentId || student.id || ""
  });
  const [specialAgreementOpen, setSpecialAgreementOpen] = useState(false);
  const selectedClassName = classOptions.find((item) => item.id === form.classId)?.name || "";
  const matchingPlans = useMemo(() => {
    const gradeGroup = resolveStudentGradeGroup(selectedClassName);
    return withSchoolArrangement((catalog?.plans ?? []).filter((plan) => plan.gradeGroup === gradeGroup && PAYMENT_OPTION_LABELS[plan.paymentOptionType]));
  }, [catalog, selectedClassName, form.annualFee]);

  useEffect(() => {
    if (!creating || !form.firstName.trim() || !form.lastName.trim()) return;
    const timer = window.setTimeout(() => {
      const fullName = composeAdministrativeFullName(form);
      void api<{ email: string }>("/api/students/school-email-preview", {
        method: "POST",
        body: JSON.stringify({ fullName, firstName: form.firstName.trim(), middleName: form.middleName.trim() || null, lastName: form.lastName.trim() }),
      }).then((result) => setForm((current) => ({ ...current, email: result.email })))
        .catch((error) => console.error("School email preview failed", error));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [creating, form.firstName, form.middleName, form.lastName]);
  const applyClass = (classId: string) => {
    const className = classOptions.find((item) => item.id === classId)?.name || "";
    const gradeGroup = resolveStudentGradeGroup(className);
    const plans = withSchoolArrangement((catalog?.plans ?? []).filter((plan) => plan.gradeGroup === gradeGroup && PAYMENT_OPTION_LABELS[plan.paymentOptionType]));
    const selected = plans.find((plan) => plan.paymentOptionType === form.paymentOptionType)
      || plans.find((plan) => plan.paymentOptionType === "STANDARD_MONTHLY")
      || plans[0];
    setForm((current) => ({
      ...current,
      classId,
      paymentOptionType: selected?.paymentOptionType || current.paymentOptionType,
      annualFee: selected ? String(selected.finalAmount) : current.annualFee,
    }));
  };

  const applyTuitionPlan = (paymentOptionType: string) => {
    if (paymentOptionType === "SPECIAL_OWNER_AGREEMENT") {
      setForm((current) => ({
        ...current,
        paymentOptionType,
        annualFee: "",
        specialAgreement: normalizeSpecialAgreementDraft({ ...current, annualFee: "" }),
      }));
      setSpecialAgreementOpen(true);
      return;
    }
    const selected = matchingPlans.find((plan) => plan.paymentOptionType === paymentOptionType);
    setForm((current) => ({ ...current, paymentOptionType, annualFee: selected ? String(selected.finalAmount) : current.annualFee }));
  };

  const updateSpecialAgreement = (key: keyof SpecialAgreementDraft, value: string) => {
    setForm((current) => {
      const specialAgreement = { ...normalizeSpecialAgreementDraft(current), [key]: value };
      return { ...current, paymentOptionType: "SPECIAL_OWNER_AGREEMENT", annualFee: specialAgreement.customTotal, specialAgreement };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-5">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="edupay-scrollbar relative h-[80dvh] w-[80vw] max-w-none overflow-y-auto rounded-2xl border border-white/10 glass p-6 shadow-2xl sm:p-8">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-lg p-2 text-slate-200 hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
        <h2 className="pr-10 font-display text-2xl font-bold text-white">{creating ? "Ajouter un élève" : "Modifier l'élève"}</h2>
        <form className="mt-6 grid gap-5" onSubmit={(event) => { event.preventDefault(); void onSave(form); }}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold text-slate-200">{L("Nom de famille *", "Last name *")}<input className="input text-base" value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} placeholder={L("Ex. Ilunga", "E.g. Ilunga")} required /></label>
            <label className="grid gap-1 text-sm font-semibold text-slate-200">{L("Postnom", "Middle name")}<input className="input text-base" value={form.middleName} onChange={(event) => setForm((current) => ({ ...current, middleName: event.target.value }))} placeholder={L("Ex. Kabongo", "E.g. Kabongo")} /></label>
            <label className="grid gap-1 text-sm font-semibold text-slate-200">{L("Prénom *", "First name *")}<input className="input text-base" value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} placeholder={L("Ex. Marie", "E.g. Marie")} required /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold text-slate-200">{L("Adresse e-mail scolaire", "School email address")}<input className="input text-base font-mono" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder={L("prenom.nom@ourkcs.org", "first.last@ourkcs.org")} readOnly={creating} /><span className="text-xs font-normal text-cyan-200">{creating ? "Attribuée automatiquement selon le nom, postnom et prénom." : "Adresse scolaire actuelle de l’élève."}</span></label>
            <label className="grid gap-1 text-sm font-semibold text-slate-200">{L("Téléphone de l’élève", "Student phone")}<InternationalPhoneInput value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} /></label>
            <label className="grid gap-1 text-sm font-semibold text-slate-200">{L("Date de naissance", "Date of birth")}<DateSelect className="input text-base" value={form.dateOfBirth} onChange={(event) => setForm((current) => ({ ...current, dateOfBirth: event.target.value }))} /></label>
            <label className="grid gap-1 text-sm font-semibold text-slate-200">{L("Genre", "Gender")}<select className="input text-base" value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}><option value="">{L("Sélectionner le genre", "Select gender")}</option><option value="F">{L("Fille", "Female")}</option><option value="M">{L("Garçon", "Male")}</option><option value="O">{L("Autre", "Other")}</option></select></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold text-slate-200">{L("Classe actuelle *", "Current class *")}<select className="input text-base" value={form.classId} onChange={(event) => applyClass(event.target.value)} required>
              <option value="">{L("Classe", "Class")}</option>
              <optgroup label="Maternelle">
                {classOptions.filter((item) => item.name.startsWith("K")).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </optgroup>
              <optgroup label="G1 - G12">
                {classOptions.filter((item) => item.name.startsWith("G")).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </optgroup>
            </select></label>
            <label className="grid gap-1 text-sm font-semibold text-slate-200">{L("Plan de scolarité *", "Tuition plan *")}<select className="input text-base" value={form.paymentOptionType} onChange={(event) => applyTuitionPlan(event.target.value)} disabled={!form.classId || matchingPlans.length === 0} required>
              {matchingPlans.length === 0 ? <option value={form.paymentOptionType}>{form.classId ? "Aucun plan compatible" : "Choisissez d'abord une classe"}</option> : matchingPlans.map((plan) => <option key={plan.id} value={plan.paymentOptionType}>{getPaymentOptionLabel(plan.paymentOptionType, lang) || plan.name}{plan.paymentOptionType === "SPECIAL_OWNER_AGREEMENT" ? " · À définir" : ` · $ ${Number(plan.finalAmount).toFixed(2)}`}</option>)}
            </select></label>
          </div>
          <div className="grid gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4 sm:grid-cols-[1fr_0.7fr] sm:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">{L("Frais calculés depuis le plan de scolarité", "Fees calculated from the tuition plan")}</p>
              <p className="mt-2 text-sm text-slate-200">{L("Le montant est automatiquement adapté à la classe et au plan sélectionnés.", "The amount is automatically adjusted to the selected class and plan.")}</p>
            </div>
            <label className="grid gap-1 text-sm font-semibold text-slate-200">{L("Frais scolaires annuels (USD)", "Annual tuition fees (USD)")}<input className="input text-base bg-slate-950/70 font-mono font-bold text-cyan-100" type="number" min="0" step="0.01" value={form.annualFee} readOnly required />{form.paymentOptionType === "SPECIAL_OWNER_AGREEMENT" ? <button type="button" onClick={() => setSpecialAgreementOpen(true)} className="mt-2 rounded-lg border border-amber-300/40 px-3 py-2 text-xs font-bold text-amber-200">{L("Ouvrir accord spécial", "Open special agreement")}</button> : null}</label>
          </div>
          <label className="grid gap-1 text-sm font-semibold text-slate-200">{L("Numéro élève / identifiant", "Student number / ID")}<input className="input text-base font-mono" value={form.studentNumber} onChange={(event) => setForm((current) => ({ ...current, studentNumber: event.target.value }))} placeholder={creating ? "Attribué automatiquement après création" : "Identifiant actuel"} readOnly={creating} /></label>
          <label className="grid gap-1 text-sm font-semibold text-slate-200">{L("Parent responsable *", "Responsible parent *")}<select className="input text-base" value={form.parentId} onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value }))} required>
            <option value="">{L("Parent", "Parent")}</option>
            {parents.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
          </select></label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-200 hover:text-white">{L("Annuler", "Cancel")}</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-400 disabled:opacity-60">
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
        {specialAgreementOpen && typeof document !== "undefined" ? createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <button type="button" className="absolute inset-0 cursor-default" onClick={() => setSpecialAgreementOpen(false)} aria-label={L("Fermer accord spécial", "Close special agreement")} />
            <div className="edupay-scrollbar relative max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-amber-300/20 bg-slate-950/95 p-6 shadow-2xl sm:p-7">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">{L("Accord spécial parent-école", "Special parent-school agreement")}</p><h3 className="mt-2 font-display text-2xl font-bold text-white">{composeAdministrativeFullName(form) || L("Nouvel élève", "New student")}</h3><p className="mt-2 text-sm text-slate-300">{L("Définissez le montant, la remise et les échéances propres à cet élève.", "Define the amount, discount and payment schedule for this student.")}</p></div><button type="button" onClick={() => setSpecialAgreementOpen(false)} className="text-slate-300 hover:text-white"><X className="h-5 w-5" /></button></div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold text-slate-200 md:col-span-2">{L("Nom du plan spécial", "Special plan name")}<input className="input" value={normalizeSpecialAgreementDraft(form).title} onChange={(event) => updateSpecialAgreement("title", event.target.value)} placeholder={L("Accord spécial parent-école", "Special parent-school agreement")} /></label>
                <label className="grid gap-1 text-sm font-semibold text-slate-200">{L("Montant convenu (USD)", "Agreed amount (USD)")}<input className="input" type="number" min="0" step="0.01" value={normalizeSpecialAgreementDraft(form).customTotal} onChange={(event) => updateSpecialAgreement("customTotal", event.target.value)} placeholder="650" /></label>
                <label className="grid gap-1 text-sm font-semibold text-slate-200">{L("Réduction spéciale (USD)", "Special discount (USD)")}<input className="input" type="number" min="0" step="0.01" value={normalizeSpecialAgreementDraft(form).reductionAmount} onChange={(event) => updateSpecialAgreement("reductionAmount", event.target.value)} placeholder="0" /></label>
                <div className="md:col-span-2"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">{L("Cadence de paiement", "Payment schedule")}</p><div className="mt-2 grid gap-3 sm:grid-cols-3">{([{ value: "ONE_TIME", label: "Versement unique" }, { value: "TWO_INSTALLMENTS", label: "2 tranches" }, { value: "THREE_INSTALLMENTS", label: "3 tranches" }] as const).map((option) => <button key={option.value} type="button" onClick={() => updateSpecialAgreement("installmentMode", option.value)} className={`rounded-2xl border px-4 py-3 text-left text-sm font-black ${normalizeSpecialAgreementDraft(form).installmentMode === option.value ? "border-amber-300 bg-amber-400/15 text-white" : "border-white/10 bg-slate-900/60 text-slate-300"}`}>{option.label}</button>)}</div></div>
                <label className="grid gap-1 text-sm font-semibold text-slate-200 md:col-span-2">{L("Notes internes", "Internal notes")}<textarea className="input min-h-24" value={normalizeSpecialAgreementDraft(form).notes} onChange={(event) => updateSpecialAgreement("notes", event.target.value)} placeholder={L("Accord approuvé par la direction, conditions particulières...", "Agreement approved by management, special terms...")} /></label>
              </div>
              <div className="mt-5 grid gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 sm:grid-cols-3"><div><p className="text-xs text-slate-300">{L("Montant convenu", "Agreed amount")}</p><p className="text-lg font-black text-white">{formatCurrency(Number(normalizeSpecialAgreementDraft(form).customTotal || 0))}</p></div><div><p className="text-xs text-slate-300">{L("Réduction", "Discount")}</p><p className="text-lg font-black text-emerald-300">{formatCurrency(Number(normalizeSpecialAgreementDraft(form).reductionAmount || 0))}</p></div><div><p className="text-xs text-slate-300">{L("Net à payer", "Net payable")}</p><p className="text-lg font-black text-cyan-200">{formatCurrency(Math.max(Number(normalizeSpecialAgreementDraft(form).customTotal || 0) - Number(normalizeSpecialAgreementDraft(form).reductionAmount || 0), 0))}</p></div></div>
              <div className="mt-5 flex gap-3"><button type="button" onClick={() => setSpecialAgreementOpen(false)} className="flex-1 rounded-lg border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-200">{L("Fermer", "Close")}</button><button type="button" disabled={Number(normalizeSpecialAgreementDraft(form).customTotal) <= 0} onClick={() => setSpecialAgreementOpen(false)} className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">{L("Valider accord spécial", "Confirm special agreement")}</button></div>
            </div>
          </div>
        , document.body) : null}
      </div>
    </div>
  );
}

function StudentDeleteModal({ student, deleting, onConfirm, onClose }: { student: SharedDirectoryStudent; deleting: boolean; onConfirm: () => Promise<void>; onClose: () => void }) {
  const { lang } = useI18n();
  const L = (fr: string, en: string) => localize(lang, fr, en);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="edupay-dialog-panel-sm relative w-full rounded-2xl border border-danger/30 glass p-6 shadow-2xl sm:p-7">
        <h2 className="font-display text-xl font-bold text-white">{L("Supprimer cet élève", "Delete student")}</h2>
        <p className="mt-3 text-sm text-ink-dim">{L("Cette action supprimera", "This action will remove")} {student.fullName} {L("de la liste des élèves.", "from the student list.")}</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-ink-dim hover:text-white">{L("Annuler", "Cancel")}</button>
          <button type="button" onClick={() => void onConfirm()} disabled={deleting} className="flex-1 rounded-xl bg-danger px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {deleting ? L("Suppression...", "Deleting...") : L("Supprimer", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StudentsDirectoryPage() {
  const { lang } = useI18n();
  const L = (fr: string, en: string) => localize(lang, fr, en);
  const cachedDirectory = getCachedApiResponse<SharedDirectoryResponse>("/api/shared-directory");
  const [directory, setDirectory] = useState<SharedDirectoryResponse | null>(() => cachedDirectory ? normalizeDirectoryForUi(cachedDirectory) : null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [catalog, setCatalog] = useState<FinanceCatalog | null>(null);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("ALL");
  const [parentFilter, setParentFilter] = useState("ALL");
  const [loading, setLoading] = useState(!cachedDirectory);
  const [apiError, setApiError] = useState<string | null>(null);
  const [mutationNotice, setMutationNotice] = useState<string | null>(null);
  const [creationNotice, setCreationNotice] = useState<string | null>(null);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const [resettingAccess, setResettingAccess] = useState(false);
  const [viewTarget, setViewTarget] = useState<SharedDirectoryStudent | null>(null);
  const [editTarget, setEditTarget] = useState<SharedDirectoryStudent | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SharedDirectoryStudent | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setApiError(null);
    }

    const [directoryResult, classesResult, catalogResult] = await Promise.allSettled([
      withTimeout(api<SharedDirectoryResponse>("/api/shared-directory"), 20000, "shared-directory"),
      api<SchoolClass[]>("/api/classes"),
      api<FinanceCatalog>("/api/finance/catalog")
    ]);

    if (directoryResult.status === "fulfilled") {
      setDirectory(normalizeDirectoryForUi(directoryResult.value));
    } else {
      const message = directoryResult.reason instanceof Error ? directoryResult.reason.message : "Impossible de charger l'annuaire des élèves.";
      if (!message.toLowerCase().includes("timeout")) {
        setApiError(message);
      }
    }

    setClasses(classesResult.status === "fulfilled" && classesResult.value.length ? classesResult.value : SCHOOL_SECTIONS);
    if (catalogResult.status === "fulfilled") setCatalog(catalogResult.value);
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    void load();
    const refresh = () => void load(true);
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const parentByStudentId = useMemo(() => {
    const lookup = new Map<string, SharedDirectoryParent>();
    for (const parent of directory?.parents ?? []) {
      for (const student of parent.students ?? []) {
        lookup.set(student.id, parent);
      }
    }
    return lookup;
  }, [directory]);

  const classOptions = useMemo(() => Array.from(new Set((directory?.students ?? []).map((student) => student.className || student.classId).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)), [directory]);
  const parentOptions = useMemo(() => (directory?.parents ?? []).slice().sort((a, b) => a.fullName.localeCompare(b.fullName)), [directory]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const students = directory?.students ?? [];

    return students.filter((student) => {
      const parent = parentByStudentId.get(student.id);
      if (classFilter !== "ALL" && (student.className || student.classId) !== classFilter) return false;
      if (parentFilter !== "ALL" && parent?.id !== parentFilter) return false;
      if (!query) return true;
      const haystack = [
        student.fullName,
        student.displayId,
        student.studentNumber,
        student.externalStudentId,
        student.className,
        student.classId,
        parent?.fullName,
        parent?.phone,
        parent?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [classFilter, directory, parentByStudentId, parentFilter, search]);

  const handleUpdateStudent = async (state: StudentFormState) => {
    if (!editTarget) return;
    try {
      setSaving(true);
      setApiError(null);
      const fullName = composeAdministrativeFullName(state);
      const updated = await api<{ notificationStatus?: { dashboard?: string; email?: string; sms?: string; adminEmail?: string } }>(`/api/students/${editTarget.id}`, {
        method: "PUT",
        body: JSON.stringify({
          fullName,
          lastName: state.lastName.trim(),
          middleName: state.middleName.trim() || null,
          firstName: state.firstName.trim(),
          email: state.email.trim() || null,
          phone: state.phone.trim() || null,
          dateOfBirth: state.dateOfBirth || null,
          gender: state.gender || null,
          classId: state.classId,
          className: getSchoolClassOptions(classes).find((item) => item.id === state.classId)?.name || "",
          parentId: state.parentId,
          annualFee: Number(state.annualFee),
          studentNumber: state.studentNumber.trim() || null
        })
      });
      setMutationNotice([
        `Le dossier élève de ${fullName} a été modifié avec succès.`,
        "EduPay a synchronisé le registre partagé quand il est actif.",
        `Compte parent : ${updated.notificationStatus?.dashboard ?? "OPEN"}`,
        `E-mail parent : ${updated.notificationStatus?.email ?? "SKIPPED"}`,
        `SMS parent : ${updated.notificationStatus?.sms ?? "SKIPPED"}`,
        `E-mail administrateur : ${updated.notificationStatus?.adminEmail ?? "SKIPPED"}`,
      ].join("\n"));
      setEditTarget(null);
      void load(true);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Impossible de modifier l'élève.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateStudent = async (state: StudentFormState) => {
    try {
      setSaving(true);
      setApiError(null);
      const fullName = composeAdministrativeFullName(state);
      const created = await api<{ propagatedToOrbit?: boolean; localSetupStatus?: string; financeStatus?: string; notificationStatus?: { dashboard?: string } }>("/api/students", {
        method: "POST",
        body: JSON.stringify({
          fullName,
          lastName: state.lastName.trim(),
          middleName: state.middleName.trim() || null,
          firstName: state.firstName.trim(),
          email: state.email.trim() || null,
          phone: state.phone.trim() || null,
          dateOfBirth: state.dateOfBirth || null,
          gender: state.gender || null,
          parentId: state.parentId,
          classId: state.classId,
          annualFee: Number(state.annualFee),
          paymentOptionType: state.paymentOptionType,
          specialAgreement: state.paymentOptionType === "SPECIAL_OWNER_AGREEMENT" ? state.specialAgreement : undefined,
        }),
      });
      setCreateOpen(false);
      setCreationNotice([
        `L'élève ${fullName} a été ajouté avec succès.`,
        created.propagatedToOrbit
          ? "Son identité, sa date de naissance et son rattachement ont été propagés immédiatement dans l'écosystème."
          : "L'élève a été enregistré dans EduPay ; le registre partagé était indisponible au moment de l'ajout.",
        `Tuition plan : ${PAYMENT_OPTION_LABELS[state.paymentOptionType] || state.paymentOptionType}`,
        `Frais annuels : $ ${Number(state.annualFee).toFixed(2)}`,
        `Dossier EduPay : ${created.localSetupStatus ?? "SYNCED"}`,
        `Plan financier : ${created.financeStatus ?? "SYNCED"}`,
        `Notification parent : ${created.notificationStatus?.dashboard ?? "OPEN"}`,
      ].join("\n"));
      try {
        await load();
      } catch (refreshError) {
        console.error("Student created successfully; directory refresh will retry on the next load", refreshError);
      }
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Impossible de créer l'élève.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!deleteTarget) return;
    const removedStudent = deleteTarget;
    setDeleting(true);
    setApiError(null);
    setDeleteTarget(null);
    setDirectory((current) => current ? { ...current, students: current.students.filter((student) => student.id !== removedStudent.id) } : current);
    try {
      await api(`/api/students/${removedStudent.id}`, { method: "DELETE" });
    } catch (error) {
      setDirectory((current) => current && !current.students.some((student) => student.id === removedStudent.id) ? { ...current, students: [...current.students, removedStudent] } : current);
      setApiError(error instanceof Error ? error.message : "Impossible de supprimer l'élève.");
    } finally {
      setDeleting(false);
    }
  };

  const handleResetStudentAccess = async (student: SharedDirectoryStudent) => {
    try {
      setResettingAccess(true);
      setApiError(null);
      const result = await api<{ username?: string; accessCode?: string; temporaryPassword: string }>(`/api/shared-directory/reset-access/student/${encodeURIComponent(student.orbitId || student.id)}`, { method: "POST" });
      setAccessNotice([
        `Accès de ${student.fullName} réinitialisé avec succès.`,
        `Identifiant : ${result.username || student.studentNumber || student.displayId || student.id}`,
        `Code d'accès : ${result.accessCode || "Non renseigné"}`,
        `Mot de passe temporaire : ${result.temporaryPassword}`,
        "Ce mot de passe devra être changé à la prochaine connexion.",
      ].join("\n"));
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Impossible de réinitialiser l'accès de l'élève.");
    } finally {
      setResettingAccess(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {accessNotice && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md" role="dialog" aria-modal="true">
          <section className="w-full max-w-xl rounded-3xl border border-amber-300/30 bg-slate-950 p-7 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">{L("Accès réinitialisé", "Access reset")}</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-white">{L("Nouveaux identifiants temporaires", "New temporary credentials")}</h2>
            <pre className="mt-5 whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm leading-6 text-amber-50">{accessNotice}</pre>
            <button type="button" onClick={() => setAccessNotice(null)} className="mt-6 w-full rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-slate-950">{L("Compris", "Got it")}</button>
          </section>
        </div>
      )}
      {creationNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={L("Confirmation ajout", "Addition confirmation")} onClick={() => setCreationNotice(null)}>
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" />
          <section className="relative w-full max-w-xl rounded-3xl border border-cyan-300/30 bg-slate-950 p-7 text-center shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/15 text-3xl text-emerald-300">✓</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">{L("Ajout synchronisé", "Addition synchronized")}</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-white">{L("Élève enregistré", "Student registered")}</h2>
            <pre className="mt-5 whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-left text-sm leading-6 text-cyan-50">{creationNotice}</pre>
            <button type="button" onClick={() => setCreationNotice(null)} className="mt-6 w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-200">{L("Continuer", "Continue")}</button>
          </section>
        </div>
      )}
      {mutationNotice && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={() => setMutationNotice(null)}>
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
          <section className="relative w-full max-w-lg rounded-2xl border border-emerald-400/30 bg-slate-950 p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">{L("Modification synchronisée", "Update synchronized")}</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-white">{L("Notification envoyée", "Notification sent")}</h2>
            <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-white/10 bg-slate-900/70 p-4 text-sm text-emerald-50">{mutationNotice}</pre>
            <button type="button" onClick={() => setMutationNotice(null)} className="mt-5 w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950">{L("Compris", "Got it")}</button>
          </section>
        </div>
      )}
      {viewTarget && <StudentDetailModal student={viewTarget} parent={parentByStudentId.get(viewTarget.id)} resettingAccess={resettingAccess} onResetAccess={() => void handleResetStudentAccess(viewTarget)} onClose={() => setViewTarget(null)} />}
      {editTarget && (
        <StudentEditModal
          student={editTarget}
          parent={parentByStudentId.get(editTarget.id)}
          parents={directory?.parents ?? []}
          classes={classes}
          catalog={catalog}
          saving={saving}
          onSave={handleUpdateStudent}
          onClose={() => setEditTarget(null)}
        />
      )}
      {createOpen && (
        <StudentEditModal
          student={{ id: "", fullName: "", classId: "", annualFee: 0 } as SharedDirectoryStudent}
          parents={directory?.parents ?? []}
          classes={classes}
          catalog={catalog}
          saving={saving}
          onSave={handleCreateStudent}
          onClose={() => setCreateOpen(false)}
          creating
        />
      )}
      {deleteTarget && <StudentDeleteModal student={deleteTarget} deleting={deleting} onConfirm={handleDeleteStudent} onClose={() => setDeleteTarget(null)} />}

      <div className="flex flex-wrap items-start justify-between gap-4 animate-fadeInDown">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">{L("Annuaire des élèves", "Student directory")}</h1>
          <p className="mt-1 text-ink-dim">
            {L("Liste centralisée des élèves venant du registre partage Orbit via Savanex, comme pour les parents.", "Centralized student list from the shared Orbit registry via Savanex, as with parents.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <BulkImportLink entity="STUDENT" label={L("Importer élèves Excel / CSV", "Import students Excel / CSV")} />
          <button type="button" onClick={() => setCreateOpen(true)} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 hover:bg-cyan-300">
            {L("Ajouter un élève", "Add student")}
          </button>
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-right">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">{L("Source", "Source")}</p>
          <p className="mt-1 text-sm font-semibold text-white">{directory?.source ?? L("Chargement...", "Loading...")}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 animate-fadeInUp">
        <div className="card">
          <p className="text-xs uppercase tracking-[0.1em] text-ink-dim">{L("Élèves", "Students")}</p>
          <p className="mt-1 font-display text-3xl font-bold text-cyan-300">{directory?.counts.students ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-[0.1em] text-ink-dim">{L("Parents", "Parents")}</p>
          <p className="mt-1 font-display text-3xl font-bold text-brand-300">{directory?.counts.parents ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-[0.1em] text-ink-dim">{L("Familles", "Families")}</p>
          <p className="mt-1 font-display text-3xl font-bold text-emerald-300">{directory?.counts.families ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-[0.1em] text-ink-dim">{L("Résultats", "Results")}</p>
          <p className="mt-1 font-display text-3xl font-bold text-white">{filteredStudents.length}</p>
        </div>
      </div>

      <div className="grid gap-3 animate-fadeInUp lg:grid-cols-[minmax(0,1.4fr)_220px_260px]">
        <SearchField value={search} onChange={(event) => setSearch(event.target.value)} placeholder={L("Rechercher nom, ID, e-mail, téléphone, classe ou parent...", "Search name, ID, email, phone, class or parent...")} />
        <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} aria-label={L("Filtrer par classe", "Filter by class")} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white">
          <option value="ALL">{L("Toutes les classes", "All classes")}</option>
          {classOptions.map((className) => <option key={className} value={className}>{className}</option>)}
        </select>
        <select value={parentFilter} onChange={(event) => setParentFilter(event.target.value)} aria-label={L("Filtrer par parent", "Filter by parent")} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white">
          <option value="ALL">{L("Tous les parents", "All parents")}</option>
          {parentOptions.map((parent) => <option key={parent.id} value={parent.id}>{parent.fullName} · {parent.id}</option>)}
        </select>
      </div>

      {apiError && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {apiError}
        </div>
      )}

      <div className="card !p-0 overflow-hidden animate-fadeInUp">
        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-500" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-ink-dim">{L("Aucun élève trouvé.", "No students found.")}</div>
        ) : (
          <div className="edupay-scrollbar overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-900/40">
                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.1em] text-ink-dim">{L("ID élève", "Student ID")}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.1em] text-ink-dim">{L("Nom complet", "Full name")}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.1em] text-ink-dim">{L("Classe", "Class")}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.1em] text-ink-dim">{L("Parent", "Parent")}</th>
                  <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-[0.1em] text-ink-dim">{L("Frais annuels", "Annual tuition")}</th>
                  <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-[0.1em] text-ink-dim">{L("Actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, index) => {
                  const parent = parentByStudentId.get(student.id);
                  const displayedAnnualFee = typeof student.annualFeeDisplay === "number" ? student.annualFeeDisplay : student.annualFee;
                  return (
                    <tr key={student.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors" style={{ animationDelay: `${index * 0.03}s` }}>
                      <td className="px-5 py-4">
                        <span className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 font-mono text-xs font-bold text-cyan-200">
                          {student.displayId || student.studentNumber || student.id}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white">{student.fullName}</p>
                        <p className="text-xs text-ink-dim">{L("Inscrit le", "Registered on")} {student.createdAt ? new Date(student.createdAt).toLocaleString("fr-FR") : "-"}</p>
                        <p className="text-xs text-ink-dim">{student.externalStudentId || student.id}</p>
                      </td>
                      <td className="px-5 py-4 text-ink-dim">{student.className || student.classId || L("Classe non renseignée", "Class not provided")}</td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-white">{parent?.fullName || L("Parent non retrouvé", "Parent not found")}</p>
                        <p className="text-xs text-ink-dim">{parent?.phone || parent?.email || L("Aucun contact", "No contact")}</p>
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-bold text-emerald-300">
                        {typeof displayedAnnualFee === "number" ? `$ ${displayedAnnualFee.toFixed(2)}` : "-"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button type="button" onClick={() => setViewTarget(student)} className="rounded-lg bg-slate-700/50 p-2 text-ink-dim transition-all hover:bg-slate-600/50 hover:text-white" title={L("Voir", "View")}>
                            <Eye aria-hidden="true" strokeWidth={2.5} className="block h-5 w-5 shrink-0 text-white" />
                          </button>
                          <button type="button" onClick={() => setEditTarget(student)} className="rounded-lg bg-brand-500/20 p-2 text-brand-300 transition-all hover:bg-brand-500/30" title={L("Modifier", "Edit")}>
                            <Edit3 aria-hidden="true" strokeWidth={2.5} className="block h-5 w-5 shrink-0 text-brand-200" />
                          </button>
                          <button type="button" onClick={() => setDeleteTarget(student)} className="rounded-lg bg-danger/20 p-2 text-danger transition-all hover:bg-danger/30" title={L("Supprimer", "Delete")}>
                            <Trash2 aria-hidden="true" strokeWidth={2.5} className="block h-5 w-5 shrink-0 text-red-300" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
