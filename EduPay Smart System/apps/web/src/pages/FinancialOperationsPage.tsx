import InternationalPhoneInput from "../components/InternationalPhoneInput";
import DateSelect from '../components/DateSelect';
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  ChevronRight,
  CheckCircle2,
  CircleDollarSign,
  Download,
  Eye,
  FilePlus2,
  Landmark,
  Pencil,
  Printer,
  ReceiptText,
  Trash2,
  UserPlus,
  Users,
  WalletCards,
  X
} from "lucide-react";
import { schoolBranding } from "../config/branding";
import { SearchField } from "../components/SearchField";
import { api } from "../services/api";
import { useI18n } from "../i18n";
import { useAuthStore } from "../store/auth";
import { exportWorkbook, type WorkbookSheet } from "../utils/financeExcel";
import { printHtmlDocument as sharedPrintHtmlDocument } from "../utils/printDocument";

type ExpenseAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  notes?: string;
};

type ExpenseCategory = {
  id: string;
  name: string;
  type: string;
  accountCode?: string | null;
  accountClass?: number | null;
  parentCategoryId: string | null;
  ownerApprovalRequired?: boolean;
};

type Vendor = {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
};

type Budget = {
  id: string;
  name: string;
  department: string;
  plannedAmount: number;
  consumedAmount: number;
  remainingAmount: number;
  utilization: number;
  status: string;
  alertThreshold?: number;
  notes?: string;
  category?: { id: string; name: string } | null;
  period?: { id: string; name: string } | null;
};

type Expense = {
  id: string;
  title: string;
  department: string;
  amount: number;
  currency: string;
  paymentMethod?: string;
  cashAccountCode?: string | null;
  metadata?: {
    debitAccountCode?: string;
    creditAccountCode?: string;
    debitEffect?: string;
    creditEffect?: string;
    cancelledAt?: string;
    cancellationReason?: string;
  } | null;
  supplierName?: string;
  status: string;
  financialPeriodLabel: string;
  expenseDate: string;
  comments?: string;
  category: { id: string; name: string; type: string; parentCategoryId: string | null; accountCode?: string | null; accountClass?: number | null };
  vendor?: Vendor | null;
  budget?: Budget | null;
  attachments?: ExpenseAttachment[];
  approvalSteps: Array<{ stage: number; role: string; status: string; comments?: string }>;
};

type DocumentEntry = ExpenseAttachment & {
  expenseId: string;
  expenseTitle: string;
  department: string;
  status: string;
  expenseDate: string;
};

type SalaryProfile = {
  id: string;
  employeeCode: string;
  fullName: string;
  department: string;
  position: string;
  baseSalary: number;
  currency: string;
  frequency: string;
  defaultBonus: number;
  defaultDeduction: number;
  debtRecoveryRate: number;
  notes?: string;
  isActive: boolean;
};

type EmployeeRepayment = {
  id: string;
  method: string;
  expectedAmount: number;
  paidAmount: number;
  currency: string;
  dueDate: string;
  paidAt?: string | null;
  status: string;
  reference?: string | null;
  notes?: string | null;
};

type EmployeeObligation = {
  id: string;
  salaryProfileId: string;
  type: string;
  title: string;
  principalAmount: number;
  amountPaid: number;
  balance: number;
  currency: string;
  repaymentMethod: string;
  installmentAmount: number;
  startDate: string;
  dueDate: string;
  status: string;
  riskLevel: string;
  riskScore: number;
  notes?: string | null;
  receipt?: { receiptNumber: string; fileUrl?: string; mimeType?: string } | null;
  salaryProfile?: Pick<SalaryProfile, "id" | "employeeCode" | "fullName" | "department" | "position"> | null;
  repayments: EmployeeRepayment[];
};

type PayrollRun = {
  id: string;
  title: string;
  department?: string;
  frequency: string;
  status: string;
  totalGross: number;
  totalBonuses: number;
  totalDeductions: number;
  totalNet: number;
  notes?: string;
  processedAt: string | null;
  period?: { id: string; name: string } | null;
  items: Array<{
    id: string;
    baseSalary: number;
    bonuses: number;
    deductions: number;
    advancesRecovered: number;
    debtRecovered: number;
    netSalary: number;
    salarySlipNumber: string;
    salaryProfile: SalaryProfile;
  }>;
};

type AccountingEntry = {
  id: string;
  entryType: string;
  direction: string;
  title: string;
  amount: number;
  currency: string;
  entryDate: string;
  department?: string | null;
  createdAt?: string;
  metadata?: { debitAccountCode?: string; debitAccountLabel?: string; creditAccountCode?: string; accountingFramework?: string } | null;
  expense?: { id: string; title: string; department?: string | null; status?: string | null } | null;
  payrollRun?: { id: string; title: string; department?: string | null; status?: string | null } | null;
  payrollItem?: {
    id: string;
    salarySlipNumber?: string | null;
    netSalary: number;
    salaryProfile: { id: string; fullName: string; employeeCode: string; department?: string | null; position?: string | null };
  } | null;
};

type CashflowEntry = {
  id: string;
  direction: string;
  sourceType: string;
  amount: number;
  currency: string;
  method?: string | null;
  référenceDate: string;
  notes?: string | null;
  createdAt?: string;
  expense?: { id: string; title: string; department?: string | null; status?: string | null } | null;
  payrollRun?: { id: string; title: string; department?: string | null; status?: string | null } | null;
  payrollItem?: {
    id: string;
    salarySlipNumber?: string | null;
    netSalary: number;
    salaryProfile: { id: string; fullName: string; employeeCode: string; department?: string | null; position?: string | null };
  } | null;
};

type ExpenseOverview = {
  expenses: {
    totalExpenses: number;
    approvedExpenses: number;
    pendingExpenses: number;
    rejectedExpenses: number;
    pendingApprovalSteps: number;
  };
  payroll: {
    activeProfiles: number;
    runCount: number;
    totalPayroll: number;
    salaryLiability: number;
  };
  cashflow: {
    availableCash: number;
    profitLoss: number;
  };
  liabilities: {
    supplierDebt: number;
    payrollLiability: number;
    institutionalObligations: number;
  };
};

type ExpenseFormState = {
  title: string;
  categoryId: string;
  vendorId: string;
  budgetId: string;
  department: string;
  amount: string;
  paymentMethod: string;
  debitAccountCode: string;
  creditAccountCode: string;
  expenseDate: string;
  supplierName: string;
  beneficiaryName: string;
  beneficiaryContact: string;
  beneficiaryAccount: string;
  beneficiaryRéférence: string;
  comments: string;
  attachmentName: string;
  attachmentUrl: string;
};

type BudgetFormState = {
  name: string;
  department: string;
  plannedAmount: string;
  categoryId: string;
  alertThreshold: string;
  notes: string;
};

type VendorFormState = {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

type SalaryFormState = {
  employeeCode: string;
  fullName: string;
  department: string;
  position: string;
  baseSalary: string;
  frequency: string;
  defaultBonus: string;
  defaultDeduction: string;
  debtRecoveryRate: string;
  notes: string;
};

type PayrollFormState = {
  title: string;
  department: string;
  frequency: string;
  notes: string;
};

type EmployeeObligationFormState = {
  salaryProfileId: string;
  type: string;
  title: string;
  principalAmount: string;
  currency: string;
  disbursementMethod: string;
  repaymentMethod: string;
  installmentAmount: string;
  startDate: string;
  dueDate: string;
  notes: string;
};

type EmployeeRepaymentFormState = {
  repaymentId: string;
  paidAmount: string;
  paymentMethod: string;
  reference: string;
  notes: string;
};

const EMPTY_EXPENSE_OVERVIEW: ExpenseOverview = {
  expenses: {
    totalExpenses: 0,
    approvedExpenses: 0,
    pendingExpenses: 0,
    rejectedExpenses: 0,
    pendingApprovalSteps: 0,
  },
  payroll: {
    activeProfiles: 0,
    runCount: 0,
    totalPayroll: 0,
    salaryLiability: 0,
  },
  cashflow: {
    availableCash: 0,
    profitLoss: 0,
  },
  liabilities: {
    supplierDebt: 0,
    payrollLiability: 0,
    institutionalObligations: 0,
  }
};

const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "MPESA", "AIRTEL_MONEY", "ORANGE_MONEY", "CHEQUE", "INTERNAL_TRANSFER"];
const SCHOOL_ACCOUNT_CLASSES = [
  ["1", "Ressources durables / capitaux", "Fonds associatifs, réserves, résultat"],
  ["2", "Immobilisations", "Terrains, bâtiments, mobilier, ordinateurs, bus"],
  ["3", "Stocks", "Fournitures scolaires, entretien, uniformes"],
  ["4", "Tiers", "Élèves/parents, fournisseurs, personnel, État"],
  ["5", "Trésorerie", "Caisse, banques, mobile money"],
  ["6", "Charges", "Salaires, fournitures, eau, électricité, transport"],
  ["7", "Produits", "Frais scolaires, inscriptions, dons, subventions"],
  ["8", "Autres charges et produits", "Éléments exceptionnels"],
  ["9", "Comptabilité analytique / budgétaire", "Activités et départements"]
] as const;
const SCHOOL_KEY_ACCOUNTS = [
  ["Classe 4 - Élèves et parents", ["411 - Élèves/parents débiteurs", "4111 - Frais scolaires à recevoir", "4112 - Frais d'inscription à recevoir", "4113 - Transport scolaire à recevoir", "4114 - Cantine à recevoir", "419 - Avances et acomptes reçus des parents"]],
  ["Classe 5 - Trésorerie", ["521 - Banque", "5211 - Equity Bank", "5212 - Autres banques", "571 - Caisse principale", "572 - Caisses secondaires", "58 - Virements internes"]],
  ["Classe 6 - Charges", ["601 - Achats de fournitures", "602 - Fournitures scolaires", "603 - Produits d'entretien", "605 - Autres achats", "61 - Transports", "62 - Services extérieurs", "63 - Impôts et taxes", "64 - Charges de personnel", "65 - Autres charges", "66 - Charges financières", "68 - Dotations aux amortissements"]],
  ["Classe 7 - Produits", ["701 - Frais scolaires", "702 - Frais d'inscription", "703 - Frais de réinscription", "704 - Transport scolaire", "705 - Cantine", "706 - Activités scolaires", "71 - Subventions d'exploitation", "72 - Dons et contributions", "75 - Autres produits", "77 - Produits financiers"]]
] as const;
const SCHOOL_ACCOUNT_OPTIONS = [
  {
    group: "Classes générales",
    accounts: SCHOOL_ACCOUNT_CLASSES.map(([code, label]) => ({ code, label }))
  },
  ...SCHOOL_KEY_ACCOUNTS.map(([group, accounts]) => ({
    group,
    accounts: accounts.map((account) => {
      const [code, ...labelParts] = account.split(" - ");
      return { code, label: labelParts.join(" - ") };
    })
  }))
];
const ALL_SCHOOL_ACCOUNTS = SCHOOL_ACCOUNT_OPTIONS.flatMap((group) => group.accounts);

function expenseDebitAccountCode(expense: Expense) {
  return expense.metadata?.debitAccountCode || expense.category.accountCode || "";
}

function expenseCreditAccountCode(expense: Expense) {
  return expense.metadata?.creditAccountCode || expense.cashAccountCode || "";
}
const PAYROLL_FREQUENCIES = ["MONTHLY", "BI_MONTHLY", "QUARTERLY", "ANNUAL"];
const PERIOD_FILTERS = [
  { value: "ALL", label: "Toute periode" },
  { value: "TODAY", label: "Aujourd'hui" },
  { value: "WEEK", label: "Cette semaine" },
  { value: "MONTH", label: "Ce mois" },
  { value: "QUARTER", label: "Ce trimestre" },
  { value: "YEAR", label: "Cette année" },
  { value: "CUSTOM", label: "Intervalle precis" }
];
type OperationTab = "expenses" | "budgets" | "payroll" | "accounting" | "cashflow" | "documents";
type OperationSubDialog = "expense-create" | "vendor-create" | "vendor-registry" | "budget-create" | "salary-profile-create" | "payroll-run-create" | "payslip-preview" | "employee-advance-create" | "employee-debt-create" | "employee-repayment-create";

const EMPTY_EXPENSE_FORM: ExpenseFormState = {
  title: "",
  categoryId: "",
  vendorId: "",
  budgetId: "",
  department: "",
  amount: "",
  paymentMethod: "",
  debitAccountCode: "",
  creditAccountCode: "",
  expenseDate: "",
  supplierName: "",
  beneficiaryName: "",
  beneficiaryContact: "",
  beneficiaryAccount: "",
  beneficiaryRéférence: "",
  comments: "",
  attachmentName: "",
  attachmentUrl: ""
};

const EMPTY_VENDOR_FORM: VendorFormState = {
  name: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  notes: ""
};

const EMPTY_BUDGET_FORM: BudgetFormState = {
  name: "",
  department: "",
  plannedAmount: "",
  categoryId: "",
  alertThreshold: "",
  notes: ""
};

const EMPTY_SALARY_FORM: SalaryFormState = {
  employeeCode: "",
  fullName: "",
  department: "",
  position: "",
  baseSalary: "",
  frequency: "",
  defaultBonus: "",
  defaultDeduction: "",
  debtRecoveryRate: "",
  notes: ""
};

const EMPTY_PAYROLL_FORM: PayrollFormState = {
  title: "",
  department: "",
  frequency: "MONTHLY",
  notes: ""
};

const EMPTY_EMPLOYEE_OBLIGATION_FORM: EmployeeObligationFormState = {
  salaryProfileId: "",
  type: "SALARY_ADVANCE",
  title: "",
  principalAmount: "",
  currency: "USD",
  disbursementMethod: "CASH",
  repaymentMethod: "SALARY_DEDUCTION",
  installmentAmount: "",
  startDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  notes: ""
};

const EMPTY_EMPLOYEE_REPAYMENT_FORM: EmployeeRepaymentFormState = {
  repaymentId: "",
  paidAmount: "",
  paymentMethod: "CASH",
  reference: "",
  notes: ""
};

function SectionCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="card glass min-w-0 border border-white/10 shadow-lg">
      <div className="min-w-0">
        <h2 className="font-display text-xl font-bold text-white sm:text-2xl">{title}</h2>
        <p className="mt-1 text-sm text-ink-dim">{subtitle}</p>
      </div>
      <div className="mt-5 min-w-0">{children}</div>
    </section>
  );
}

function ActionNodeCard({
  title,
  subtitle,
  detail,
  icon: Icon,
  tone,
  onClick
}: {
  title: string;
  subtitle: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/36 p-4 text-left transition hover:border-brand-300/30 hover:bg-white/[0.06]"
    >
      <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-start justify-between gap-3">
          <span className="font-semibold text-white">{title}</span>
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-dim transition group-hover:translate-x-0.5 group-hover:text-brand-100" />
        </span>
        <span className="mt-1 block text-sm text-ink-dim">{subtitle}</span>
        <span className="mt-3 inline-flex max-w-full rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-brand-100">
          {detail}
        </span>
      </span>
    </button>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

const FINANCIAL_EN = new Map<string, string>(String.raw`
/ Crédit|||/ Credit
· Crédit|||· Credit
• Net|||• Net
Actions du journal|||Ledger actions
Actions trésorerie|||Cash-flow actions
Adresse|||Address
Afficher les comptes clés du plan scolaire|||Show key accounts in the school chart of accounts
Ajouter le fournisseur|||Add vendor
Ajouter le profil salarial|||Add salary profile
Ajoutez des justificatifs depuis l'onglet Dépenses avec un vrai upload de fichiers ou une référence URL.|||Add supporting documents from the Expenses tab using a file upload or URL reference.
Annulée|||Cancelled
Annuler|||Cancel
Annuler l'opération|||Cancel operation
Approved|||Approved
Arborescence budgétaire|||Budget actions
Arborescence des actions|||Action menu
Arborescence paie|||Payroll actions
Aucun beneficiaire existant|||No existing beneficiary
Aucun budget li?|||No linked budget
Aucun flux pour le filtre actuel.|||No cash flow matches the current filter.
Aucun fournisseur ne correspond a cette recherche.|||No vendor matches this search.
Aucun mouvement de trésorerie disponible pour le filtre actuel.|||No cash movement is available for the current filter.
Aucun run de paie généré pour l'instant.|||No payroll run has been generated yet.
Aucune avance, dette ou échéance employé n'est encore enregistrée.|||No employee advance, debt or installment has been recorded yet.
Aucune dépense ne correspond au filtre actuel.|||No expense matches the current filter.
Aucune écriture comptable disponible pour le filtre actuel.|||No accounting entry is available for the current filter.
Aucune écriture pour le filtre actuel.|||No entry matches the current filter.
Aucune piece justificative indexee pour le moment.|||No supporting document is indexed yet.
Autre dette|||Other debt
Avance sur salaire|||Salary advance
Avances récupérées|||Recovered advances
Balance disponible|||Available balance
Base fournisseurs|||Vendor directory
Beneficiaire|||Beneficiary
Beneficiaire libre|||Custom beneficiary
Beneficiaire repertorie|||Registered beneficiary
Bonus par défaut|||Default bonus
Budget|||Budget
Budget associe|||Linked budget
Budget workspace|||Budget workspace
Bulletin de paie|||Payslip
Bulletin de paie officiel|||Official payslip
Bulletins|||Payslips
Cardinal du journal comptable actif.|||Number of entries in the active accounting ledger.
Catégorie associée|||Linked category
Catégorie de dépense|||Expense category
Catégorisation et suivi|||Categorization and monitoring
Champs clés|||Key fields
Chargement des données opérationnelles en arrière-plan. La page reste disponible pendant la synchronisation.|||Operational data is loading in the background. The page remains available during synchronization.
Cheque, facture, transaction|||Check, invoice or transaction
Choisir la catégorie analytique|||Select an analytical category
Choisir le compte à créditer|||Select the account to credit
Choisir le compte à débiter|||Select the account to debit
Choisir une catégorie principale|||Select a main category
Code employé|||Employee code
Commentaires|||Comments
Compte / wallet|||Account / wallet
Compte à créditer — soustraire|||Account to credit — subtract
Compte à débiter — ajouter|||Account to debit — add
Consomme|||Used
Contact beneficiaire|||Beneficiary contact
Contexte, période couverte, justification, limites ou remarques de gestion|||Context, covered period, justification, limits or management notes
Convention EduPay : débiter ajoute le montant au compte ; créditer soustrait le montant du compte.|||EduPay convention: a debit adds the amount to the account; a credit subtracts it from the account.
Couverture cash|||Cash coverage
Couverture documentaire|||Document coverage
Crédit · −|||Credit · −
Créer une enveloppe budgétaire propre et traçable|||Create a clear and traceable budget envelope
CSV|||CSV
Date de la depense|||Expense date
Date debut depenses|||Expense start date
Date début trésorerie|||Cash-flow start date
Date fin depenses|||Expense end date
Date fin trésorerie|||Cash-flow end date
Débit|||Debit
Débit · +|||Debit · +
Déclenche une alerte visuelle lorsque la consommation approche la limite.|||Triggers a visual alert when usage approaches the limit.
Déduction par défaut|||Default deduction
Déduction sur salaire|||Payroll deduction
Deductions|||Deductions
Définissez clairement le nom, le département et le volume financier prévu.|||Clearly define the name, department and planned financial amount.
Departement|||Department
Département|||Department
Département concerné|||Relevant department
Département dominant|||Leading department
Departements touches|||Departments involved
depense(s)|||expense(s)
Depense:|||Expense:
Dépenses|||Expenses
Dépenses approuvées sur l'ensemble du pipeline.|||Expenses approved across the entire workflow.
Dépenses documentees|||Documented expenses
Dépenses liées|||Linked expenses
Depot documentaire|||Document repository
Dette employé|||Employee debt
Dette envers l'école|||Debt owed to the school
Dettes récupérées|||Recovered debts
Documents indexes|||Indexed documents
du volume comptable total.|||of total accounting volume.
du volume de trésorerie.|||of total cash-flow volume.
Échéance|||Due date
Échéance à encaisser|||Installment to collect
Écriture comptable|||Accounting entry
écriture(s) • moyenne|||entry/entries • average
Email|||Email
Employé|||Employee
Encaisse encore disponible après les sorties enregistrées.|||Cash still available after recorded outflows.
Encaisser et générer le reçu|||Collect and generate receipt
Enregistrer|||Save
Enregistrer et générer le reçu|||Save and generate receipt
Enregistrer le budget|||Save budget
Ex : Paie Août 2026|||Example: August 2026 payroll
Ex: 15|||Example: 15
Ex: 25|||Example: 25
Ex: 2500|||Example: 2500
Ex: 450|||Example: 450
Ex: 5|||Example: 5
Ex: 80|||Example: 80
Ex: Académique|||Example: Academic
Ex: Achat de fournitures|||Example: Purchase of supplies
Ex: Administration, Académique, Transport|||Example: Administration, Academic, Transport
Ex: Administration, Transport, Academique|||Example: Administration, Transport, Academic
Ex: Budget transport T3 2026|||Example: Q3 2026 transport budget
Ex: EMP-ACAD-004|||Example: EMP-ACAD-004
Ex: Enseignant de mathématiques|||Example: Mathematics teacher
Ex: Facture, bon de livraison|||Example: Invoice, delivery note
Ex: Grâce Mukendi|||Example: Grace Mukendi
Export Excel|||Export to Excel
Exporter Excel|||Export to Excel
Fermer|||Close
Fermer la boite de dialogue|||Close dialog
Fermer le sous-dialogue|||Close sub-dialog
Fiche fournisseur|||Vendor profile
Fiche:|||Payslip:
Fiches de paie disponibles|||Available payslips
Finance employé|||Employee finance
Flux sortants consolidés du journal de trésorerie.|||Consolidated outflows from the cash ledger.
Fréquence|||Frequency
Fréquence de paie|||Pay frequency
Générer la paie|||Generate payroll
IBAN, compte, MPESA, Airtel...|||IBAN, account, MPESA, Airtel...
Identité du budget|||Budget identity
Imprimer / enregistrer en PDF|||Print / save as PDF
Imprimer / PDF|||Print / PDF
Imprimer le journal|||Print ledger
imputés à la masse salariale.|||allocated to payroll.
Informations principales|||Main information
Informations utiles sur ce profil salarial|||Useful information about this salary profile
Intitulé de la paie|||Payroll title
Journal de cashflow|||Cash-flow ledger
Journal general|||General ledger
Justificatifs|||Supporting documents
Laisser le système appliquer le mensuel par défaut|||Let the system apply the monthly default
Lancer une paie|||Run payroll
Lecture comptable|||Accounting overview
ligne(s)|||line(s)
ligne(s) • moyenne|||line(s) • average
Lignes de trésorerie|||Cash-flow entries
Mixte|||Mixed
Mode / etape|||Method / step
Mode de paiement|||Payment method
Modification fournisseur|||Edit vendor
Modifier|||Edit
Montant|||Amount
Montant en USD|||Amount in USD
Montant payé|||Amount paid
Montant planifié|||Planned amount
Montant total prévu pour l'enveloppe, en USD.|||Total amount planned for the envelope, in USD.
Motif, periode concernee, validation attendue...|||Reason, relevant period, expected approval...
Moyenne = volume comptabilisé / nombre d'écritures.|||Average = accounting volume / number of entries.
Moyenne des opérations classées OUTFLOW.|||Average of operations classified as OUTFLOW.
Net|||Net
Net à payer|||Net payable
Nom complet|||Full name
Nom de la personne, societe ou compte paye|||Name of person, company or account paid
Nom de la piece|||Document name
Nom du budget|||Budget name
Nom fournisseur|||Vendor name
Nom lisible dans les journaux, les tableaux et les exports.|||A clear name used in ledgers, tables and exports.
Nom, département, montant, catégorie, seuil d'alerte.|||Name, department, amount, category and alert threshold.
Nombre d'enregistrements utilisés pour la lecture de cashflow.|||Number of records used for the cash-flow analysis.
Non précisé|||Not specified
Notes|||Notes
Notes budgétaires|||Budget notes
Notes de caisse ou observation|||Cash desk notes or comments
Notes de validation, motif ou référence interne|||Approval notes, reason or internal reference
Notes du run|||Payroll run notes
Notes fournisseur|||Vendor notes
Notes RH|||HR notes
Nouveau budget|||New budget
Nouveau fournisseur|||New vendor
Nouvelle depense|||New expense
Operations|||Operations
Ouvrir|||Open
Paie|||Payroll
Paie:|||Payroll:
Paiement hors salaire|||Payment outside payroll
Part paie|||Payroll share
Pending|||Pending
Periodicite appliquee:|||Applied frequency:
Permet d'ancrer le budget dans une famille de dépenses.|||Links the budget to an expense category.
Personne contact|||Contact person
Piece:|||Document:
Pièces jointes présentes sur les dépenses source.|||Attachments available on source expenses.
Pieces justificatives|||Supporting documents
Pilotage|||Management
Pilotage budgetaire|||Budget management
Plan comptable scolaire|||School chart of accounts
Poste|||Position
Préparez le budget pour le suivi analytique et les alertes de consommation.|||Prepare the budget for analytical monitoring and usage alerts.
Prévisualisation de l'écriture|||Entry preview
Prevu|||Planned
Profil de rémunération|||Compensation profile
Profil salarial|||Salary profile
Profils actifs|||Active profiles
Ratio = cash disponible / sorties consolidées.|||Ratio = available cash / consolidated outflows.
Recherche fine...|||Detailed search...
Recherche fournisseur, contact, telephone, email, departement, montant ou note|||Search vendor, contact, phone, email, department, amount or note
Recherche precise: motif, beneficiaire, service, mode...|||Detailed search: reason, beneficiary, department, method...
Rechercher une écriture, un département ou une source...|||Search an entry, department or source...
Référence document|||Document reference
Référence paiement|||Payment reference
Rejected|||Rejected
Rejeter|||Reject
Remboursement|||Repayment
Remboursement employé|||Employee repayment
Renseignez explicitement les champs utiles. Les éléments optionnels laissés vides seront gérés par défaut côté système.|||Complete the relevant fields explicitly. Optional fields left empty will use system defaults.
Renseignez manuellement chaque champ important pour éviter les budgets implicites, mal catégorisés ou mal ventilés.|||Complete each important field manually to avoid implicit, incorrectly categorized or poorly allocated budgets.
Répartition par département|||Breakdown by department
Répartition par source|||Breakdown by source
Reste|||Remaining
Résultat attendu|||Expected result
Retenues ordinaires|||Regular deductions
Run:|||Run:
Salaire brut|||Gross salary
Salaire de base|||Base salary
salarié(s) actif(s) seront inclus et recevront chacun une fiche de paie.|||active employee(s) will be included and each will receive a payslip.
Sélectionner un profil salarial|||Select a salary profile
Sélectionner une échéance|||Select an installment
Sélectionnez un fournisseur pour afficher sa fiche détaillée.|||Select a vendor to view its detailed profile.
Service ou unité qui consommera ce budget.|||Department or unit that will use this budget.
Seuil d'alerte (%)|||Alert threshold (%)
Somme scientifique de toutes les écritures enregistrées.|||Exact sum of all recorded entries.
Sorties cumulees|||Cumulative outflows
sortis pour la paie.|||paid out for payroll.
Soumettre la depense|||Submit expense
Source dominante|||Leading source
Supprimer|||Delete
Taux d'approbation|||Approval rate
Taux de recouvrement (%)|||Recovery rate (%)
Télécharger|||Download
Telephone, email ou contact|||Phone, email or contact
Ticket moyen|||Average amount
Ticket moyen sortie|||Average outflow
Titre de l'opération|||Operation title
Titre ou motif de la depense|||Expense title or reason
Total ecritures|||Total entries
Tous les départements|||All departments
Tous les statuts|||All statuses
Toutes les sources|||All sources
Trésorerie|||Cash flow
Type|||Type
Un budget exploitable immédiatement dans le suivi des dépenses.|||A budget ready for immediate use in expense monitoring.
URL, numéro ou référence interne|||URL, number or internal reference
Utilisation:|||Usage:
Valider l'etape|||Approve step
Visible pour garder une trace de la logique budgétaire choisie.|||Visible to preserve the rationale behind the selected budget.
Voir|||View
Volume comptabilisé|||Accounting volume
Votre role est en lecture seule. Les formulaires de création restent masques, mais les journaux et statuts restent consultables.|||Your role is read-only. Creation forms remain hidden, while ledgers and statuses remain available.
Workflow des depenses|||Expense workflow
Workflow principal: consulter, filtrer, valider ou rejeter les demandes.|||Main workflow: review, filter, approve or reject requests.
`.trim().split("\n").map((line) => {
  const [fr, en] = line.split("|||");
  return [fr, en] as const;
}));

function F(fr: string, lang: "fr" | "en") {
  return lang === "fr" ? fr : FINANCIAL_EN.get(fr) ?? fr;
}
const FINANCIAL_EXPORT_EN: Record<string, string> = {
  "Synthese": "Summary", "Synthèse": "Summary", "Repartition departements": "Breakdown by department", "Repartition sources": "Breakdown by source", "Journal comptable": "Accounting ledger", "Journal trésorerie": "Cash-flow ledger", "Registre depenses": "Expense register",
  "Date": "Date", "Type": "Type", "Direction": "Direction", "Titre": "Title", "Titre ou motif": "Title or reason", "Departement": "Department", "Département": "Department", "Montant": "Amount", "Devise": "Currency", "Source": "Source", "Méthode": "Method", "Référence": "Reference", "Notes": "Notes",
  "Ecritures filtrées": "Filtered entries", "Volume comptabilisé": "Accounting volume", "Ticket moyen": "Average amount", "Part paie %": "Payroll share %", "Couverture documentaire %": "Document coverage %", "Taux approbation %": "Approval rate %", "Ecritures": "Entries", "Volume": "Volume", "Moyenne": "Average", "Poids %": "Weight %",
  "Lignes filtrées": "Filtered lines", "Sorties cumulées": "Cumulative outflows", "Ticket moyen sortie": "Average outflow", "Couverture cash": "Cash coverage", "Variation nette": "Net change", "Lignes": "Lines",
  "Dépenses filtrées": "Filtered expenses", "Période": "Period", "Statut": "Status", "Total": "Total", "Approuvees": "Approved", "En attente": "Pending", "Beneficiaire": "Beneficiary", "Contact beneficiaire": "Beneficiary contact", "Categorie": "Category", "Compte débité": "Debited account", "Classe": "Class", "Compte crédité": "Credited account", "Mode": "Method", "Budget": "Budget", "Commentaires": "Comments", "Pieces": "Documents",
  "Bulletin de paie": "Payslip", "Numero de fiche": "Payslip number", "Run": "Run", "Employe": "Employee", "Code employe": "Employee code", "Poste": "Position", "Frequence": "Frequency", "Salaire de base": "Base salary", "Primes et bonus": "Allowances and bonuses", "Salaire brut": "Gross salary", "Retenues ordinaires": "Regular deductions", "Avances recuperees": "Recovered advances", "Dettes recuperees": "Recovered debts", "Total des retenues": "Total deductions", "Net a payer": "Net payable", "Statut du run": "Run status",
  "Dépenses": "Expenses", "Budgets": "Budgets", "Paies": "Payroll runs", "Comptabilité": "Accounting", "Trésorerie": "Cash flow", "Documents": "Documents", "Cash disponible": "Available cash", "Nom": "Name", "Planifie": "Planned", "Consomme": "Used", "Reste": "Remaining", "Utilisation %": "Usage %", "Fournisseur": "Vendor", "Bulletins": "Payslips", "Deductions": "Deductions"
};
function financialExportText(value: string, lang: "fr" | "en") {
  if (lang === "fr") return value;
  return FINANCIAL_EXPORT_EN[value] ?? FINANCIAL_EN.get(value) ?? dynamicFinancialLabel(value, lang);
}
const DYNAMIC_FINANCIAL_LABELS: Record<string, { fr: string; en: string }> = {
  APPROVED: { fr: "Approuvé", en: "Approved" }, PENDING: { fr: "En attente", en: "Pending" }, REJECTED: { fr: "Rejeté", en: "Rejected" }, CANCELLED: { fr: "Annulé", en: "Cancelled" },
  PAID: { fr: "Payé", en: "Paid" }, PARTIALLY_PAID: { fr: "Partiellement payé", en: "Partially paid" }, OPEN: { fr: "Ouvert", en: "Open" }, CLOSED: { fr: "Clôturé", en: "Closed" },
  DRAFT: { fr: "Brouillon", en: "Draft" }, EXCEEDED: { fr: "Dépassé", en: "Exceeded" }, ACTIVE: { fr: "Actif", en: "Active" }, INACTIVE: { fr: "Inactif", en: "Inactive" },
  DEBIT: { fr: "Débit", en: "Debit" }, CREDIT: { fr: "Crédit", en: "Credit" }, INFLOW: { fr: "Entrée", en: "Inflow" }, OUTFLOW: { fr: "Sortie", en: "Outflow" },
  EXPENSE: { fr: "Dépense", en: "Expense" }, PAYROLL: { fr: "Paie", en: "Payroll" }, PAYROLL_RUN: { fr: "Cycle de paie", en: "Payroll run" }, PAYROLL_ITEM: { fr: "Fiche de paie", en: "Payslip" },
  SALARY_ADVANCE: { fr: "Avance sur salaire", en: "Salary advance" }, SCHOOL_DEBT: { fr: "Dette envers l’école", en: "Debt owed to the school" }, OTHER_DEBT: { fr: "Autre dette", en: "Other debt" },
  SALARY_DEDUCTION: { fr: "Déduction sur salaire", en: "Payroll deduction" }, EXTERNAL_PAYMENT: { fr: "Paiement hors salaire", en: "Payment outside payroll" }, MIXED: { fr: "Mixte", en: "Mixed" },
  CASH: { fr: "Espèces", en: "Cash" }, BANK_TRANSFER: { fr: "Virement bancaire", en: "Bank transfer" }, MOBILE_MONEY: { fr: "Mobile Money", en: "Mobile Money" }, CHEQUE: { fr: "Chèque", en: "Check" },
  MONTHLY: { fr: "Mensuel", en: "Monthly" }, BI_MONTHLY: { fr: "Bimensuel", en: "Twice monthly" }, QUARTERLY: { fr: "Trimestriel", en: "Quarterly" }, ANNUAL: { fr: "Annuel", en: "Annual" }
};
function dynamicFinancialLabel(value: string | null | undefined, lang: "fr" | "en") {
  if (!value) return "";
  return DYNAMIC_FINANCIAL_LABELS[value]?.[lang] ?? value.replace(/_/g, " ").toLowerCase().replace(/^./, (letter: string) => letter.toUpperCase());
}
function StatusBadge({ value }: { value: string }) {
  const { lang } = useI18n();
  const tone = value === "APPROVED" || value === "PAID"
    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
    : value === "REJECTED" || value === "EXCEEDED" || value === "CANCELLED"
      ? "border-red-500/25 bg-red-500/10 text-red-200"
      : value === "PENDING" || value === "DRAFT"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
        : "border-brand-500/25 bg-brand-500/10 text-brand-100";
  return <span className={`inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{dynamicFinancialLabel(value, lang)}</span>;
}

function OperationsDialog({
  title,
  subtitle,
  children,
  onClose
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const { lang } = useI18n();
  return (
    <div className="edupay-operations-dialog fixed inset-0 z-50 flex items-end justify-center px-3 py-4 sm:items-center sm:px-5">
      <button aria-label={F("Fermer", lang)} className="absolute inset-0 bg-slate-950/78 backdrop-blur-md" onClick={onClose} />
      <section className="edupay-operations-modal relative flex max-h-[98vh] w-full max-w-8xl flex-col overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950/95 shadow-2xl">
        <header className="flex flex-col gap-4 border-b border-white/10 bg-white/[0.04] px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-200">{F("Operations", lang)}</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-white">{title}</h2>
            <p className="mt-1 text-sm text-ink-dim">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-ink-dim hover:border-brand-300/30 hover:text-white"
            aria-label={F("Fermer la boite de dialogue", lang)}
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="edupay-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {children}
        </div>
      </section>
    </div>
  );
}

function OperationsSubDialog({
  title,
  subtitle,
  children,
  onClose
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const { lang } = useI18n();
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/78 p-4 backdrop-blur-md sm:p-6">
      <button aria-label={F("Fermer le sous-dialogue", lang)} className="fixed inset-0 cursor-default" onClick={onClose} />
      <section className="edupay-operations-submodal relative my-auto flex max-h-[98vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950 shadow-2xl shadow-cyan-950/30">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-slate-950/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-200">{F("Paie", lang)}</p>
            <h3 className="mt-1 font-display text-xl font-bold text-white sm:text-2xl">{title}</h3>
            <p className="mt-1 text-sm text-ink-dim">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-ink-dim hover:border-brand-300/30 hover:text-white"
            aria-label={F("Fermer le sous-dialogue", lang)}
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="edupay-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </div>
      </section>
    </div>
  );
}

function labelizeFrequency(value: string, lang: "fr" | "en") {
  return dynamicFinancialLabel(value, lang);
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPercent(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

function ratioPercent(part: number, total: number) {
  if (!total) return 0;
  return (part / total) * 100;
}

function getPeriodRange(period: string, from: string, to: string) {
  if (period === "CUSTOM") {
    return {
      start: from ? new Date(`${from}T00:00:00`) : null,
      end: to ? new Date(`${to}T23:59:59`) : null
    };
  }
  if (period === "ALL") return { start: null, end: null };

  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (period === "TODAY") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "WEEK") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    start.setHours(0, 0, 0, 0);
  } else if (period === "MONTH") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (period === "QUARTER") {
    start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
    start.setHours(0, 0, 0, 0);
  } else if (period === "YEAR") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

function isWithinPeriod(value: string, period: string, from: string, to: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const { start, end } = getPeriodRange(period, from, to);
  return (!start || date >= start) && (!end || date <= end);
}

function periodLabel(period: string, from: string, to: string, lang: "fr" | "en") {
  if (period === "CUSTOM") {
    const start = from ? new Date(from).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US") : lang === "fr" ? "début libre" : "open start";
    const end = to ? new Date(to).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US") : lang === "fr" ? "fin libre" : "open end";
    return `${start} - ${end}`;
  }
  const label = PERIOD_FILTERS.find((item) => item.value === period)?.label;
  if (lang === "en") return ({ TODAY: "Today", LAST_7_DAYS: "Last 7 days", CURRENT_MONTH: "Current month", CURRENT_QUARTER: "Current quarter", CURRENT_YEAR: "Current year", ALL: "All periods" } as Record<string, string>)[period] ?? label ?? "All periods";
  return label ?? "Toute période";
}

function buildBeneficiaryNotes(form: ExpenseFormState) {
  const rows = [
    form.beneficiaryName && `Beneficiaire: ${form.beneficiaryName}`,
    form.beneficiaryContact && `Contact beneficiaire: ${form.beneficiaryContact}`,
    form.beneficiaryAccount && `Compte / wallet beneficiaire: ${form.beneficiaryAccount}`,
    form.beneficiaryRéférence && `Référence paiement: ${form.beneficiaryRéférence}`
  ].filter(Boolean);

  return [form.comments.trim(), rows.join("\n")].filter(Boolean).join("\n\n");
}

export function FinancialOperationsPage() {
  const { lang } = useI18n();
  const role = useAuthStore((state) => state.role);
  const canWrite = role !== "AUDITOR" && role !== "PARENT";
  const currency = useMemo(() => new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", { style: "currency", currency: "USD" }), [lang]);
  const L = (fr: string, en: string) => lang === "fr" ? fr : en;
  const exportLocalizedWorkbook = (filename: string, sheets: WorkbookSheet[]) => {
    const englishFilename = filename
      .replace("bulletin-de-paie", "payslip")
      .replace("journal-comptable", "accounting-ledger")
      .replace("journal-trésorerie", "cash-flow-ledger")
      .replace("registre-depenses", "expense-register")
      .replace("pack-financier-opérations", "financial-operations-pack");
    exportWorkbook(lang === "fr" ? filename : englishFilename, sheets.map((sheet) => ({
      name: financialExportText(sheet.name, lang),
      rows: sheet.rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [
        financialExportText(key, lang),
        typeof value === "string" && DYNAMIC_FINANCIAL_LABELS[value] ? dynamicFinancialLabel(value, lang) : value
      ])))
    })));
  };

  const [activeTab, setActiveTab] = useState<OperationTab>("expenses");
  const [activeDialog, setActiveDialog] = useState<OperationTab | null>(null);
  const [activeSubDialog, setActiveSubDialog] = useState<OperationSubDialog | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [salaryProfiles, setSalaryProfiles] = useState<SalaryProfile[]>([]);
  const [employeeObligations, setEmployeeObligations] = useState<EmployeeObligation[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [accountingEntries, setAccountingEntries] = useState<AccountingEntry[]>([]);
  const [cashflowEntries, setCashflowEntries] = useState<CashflowEntry[]>([]);
  const [overview, setOverview] = useState<ExpenseOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expensePeriodFilter, setExpensePeriodFilter] = useState("ALL");
  const [expenseDateFrom, setExpenseDateFrom] = useState("");
  const [expenseDateTo, setExpenseDateTo] = useState("");
  const [accountingSearch, setAccountingSearch] = useState("");
  const [accountingDepartmentFilter, setAccountingDepartmentFilter] = useState("ALL");
  const [cashflowSearch, setCashflowSearch] = useState("");
  const [cashflowSourceFilter, setCashflowSourceFilter] = useState("ALL");
  const [cashflowPeriodFilter, setCashflowPeriodFilter] = useState("ALL");
  const [cashflowDateFrom, setCashflowDateFrom] = useState("");
  const [cashflowDateTo, setCashflowDateTo] = useState("");
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(EMPTY_EXPENSE_FORM);
  const [pendingAttachments, setPendingAttachments] = useState<ExpenseAttachment[]>([]);
  const [vendorForm, setVendorForm] = useState<VendorFormState>(EMPTY_VENDOR_FORM);
  const [vendorSearch, setVendorSearch] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [vendorEditForm, setVendorEditForm] = useState<VendorFormState>(EMPTY_VENDOR_FORM);
  const [budgetForm, setBudgetForm] = useState<BudgetFormState>(EMPTY_BUDGET_FORM);
  const [salaryForm, setSalaryForm] = useState<SalaryFormState>(EMPTY_SALARY_FORM);
  const [payrollForm, setPayrollForm] = useState<PayrollFormState>(EMPTY_PAYROLL_FORM);
  const [selectedPayslip, setSelectedPayslip] = useState<{ run: PayrollRun; item: PayrollRun["items"][number] } | null>(null);
  const [employeeObligationForm, setEmployeeObligationForm] = useState<EmployeeObligationFormState>(EMPTY_EMPLOYEE_OBLIGATION_FORM);
  const [employeeRepaymentForm, setEmployeeRepaymentForm] = useState<EmployeeRepaymentFormState>(EMPTY_EMPLOYEE_REPAYMENT_FORM);
  const availableCash = overview?.cashflow.availableCash ?? 0;
  const safeOverview = overview ?? EMPTY_EXPENSE_OVERVIEW;

  useEffect(() => {
    let active = true;
    Promise.all([
      api<ExpenseCategory[]>("/api/expenses/categories"),
      api<Vendor[]>("/api/expenses/vendors"),
      api<Budget[]>("/api/expenses/budgets"),
      api<Expense[]>("/api/expenses"),
      api<SalaryProfile[]>("/api/expenses/payroll/profiles"),
      api<EmployeeObligation[]>("/api/expenses/employee-finance/obligations"),
      api<PayrollRun[]>("/api/expenses/payroll/runs"),
      api<AccountingEntry[]>("/api/expenses/accounting-entries"),
      api<CashflowEntry[]>("/api/expenses/cashflow-entries"),
      api<ExpenseOverview>("/api/expenses/overview")
    ])
      .then(([nextCategories, nextVendors, nextBudgets, nextExpenses, nextSalaryProfiles, nextEmployeeObligations, nextPayrollRuns, nextAccountingEntries, nextCashflowEntries, nextOverview]) => {
        if (!active) return;
        setCategories(nextCategories);
        setVendors(nextVendors);
        setBudgets(nextBudgets);
        setExpenses(nextExpenses);
        setSalaryProfiles(nextSalaryProfiles);
        setEmployeeObligations(nextEmployeeObligations);
        setPayrollRuns(nextPayrollRuns);
        setAccountingEntries(nextAccountingEntries);
        setCashflowEntries(nextCashflowEntries);
        setOverview(nextOverview);
        setError(null);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : L("Impossible de charger les opérations financières.", "Unable to load financial operations."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const leafCategories = useMemo(() => {
    const parentIds = new Set(categories.map((category) => category.parentCategoryId).filter(Boolean));
    return categories
      .filter((category) => !parentIds.has(category.id) && Boolean(category.accountCode) && [2, 3, 6, 8].includes(Number(category.accountClass)))
      .sort((left, right) => String(left.accountCode).localeCompare(String(right.accountCode), "fr", { numeric: true }));
  }, [categories]);
  const selectedExpenseCategory = useMemo(() => leafCategories.find((category) => category.id === expenseForm.categoryId), [expenseForm.categoryId, leafCategories]);
  const selectedDebitAccount = useMemo(() => ALL_SCHOOL_ACCOUNTS.find((account) => account.code === expenseForm.debitAccountCode), [expenseForm.debitAccountCode]);
  const selectedCreditAccount = useMemo(() => ALL_SCHOOL_ACCOUNTS.find((account) => account.code === expenseForm.creditAccountCode), [expenseForm.creditAccountCode]);
  const activeSalaryProfiles = useMemo(() => salaryProfiles.filter((profile) => profile.isActive), [salaryProfiles]);
  const payrollDepartments = useMemo(() => Array.from(new Set(activeSalaryProfiles.map((profile) => profile.department).filter(Boolean))).sort((left, right) => left.localeCompare(right, "fr")), [activeSalaryProfiles]);
  const eligiblePayrollProfiles = useMemo(() => activeSalaryProfiles.filter((profile) => !payrollForm.department || profile.department === payrollForm.department), [activeSalaryProfiles, payrollForm.department]);

  const expenseStats = useMemo(() => ({
    pending: expenses.filter((expense) => expense.status === "PENDING").length,
    approved: expenses.filter((expense) => expense.status === "APPROVED").length,
    rejected: expenses.filter((expense) => expense.status === "REJECTED").length
  }), [expenses]);

  const accountingMetrics = useMemo(() => {
    const totalVolume = accountingEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const expenseVolume = accountingEntries.filter((entry) => entry.entryType === "EXPENSE").reduce((sum, entry) => sum + entry.amount, 0);
    const payrollVolume = accountingEntries.filter((entry) => entry.entryType === "PAYROLL").reduce((sum, entry) => sum + entry.amount, 0);
    const averageEntry = accountingEntries.length ? totalVolume / accountingEntries.length : 0;
    const departmentTotals = accountingEntries.reduce<Record<string, number>>((acc, entry) => {
      const key = entry.department || "Non renseigne";
      acc[key] = (acc[key] ?? 0) + entry.amount;
      return acc;
    }, {});
    const topDepartment = Object.entries(departmentTotals).sort((left, right) => right[1] - left[1])[0];
    const documentedExpenses = expenses.filter((expense) => (expense.attachments?.length ?? 0) > 0).length;
    const documentationCoverage = ratioPercent(documentedExpenses, expenses.length);
    const approvalCoverage = ratioPercent(expenseStats.approved, expenses.length);

    return {
      totalVolume,
      expenseVolume,
      payrollVolume,
      averageEntry,
      payrollWeight: ratioPercent(payrollVolume, totalVolume),
      expenseWeight: ratioPercent(expenseVolume, totalVolume),
      topDepartmentName: topDepartment?.[0] ?? "N/A",
      topDepartmentWeight: ratioPercent(topDepartment?.[1] ?? 0, totalVolume),
      documentationCoverage,
      approvalCoverage
    };
  }, [accountingEntries, expenseStats.approved, expenses]);

  const cashflowMetrics = useMemo(() => {
    const totalOutflow = cashflowEntries.filter((entry) => entry.direction === "OUTFLOW").reduce((sum, entry) => sum + entry.amount, 0);
    const totalInflow = cashflowEntries.filter((entry) => entry.direction === "INFLOW").reduce((sum, entry) => sum + entry.amount, 0);
    const outflowCount = cashflowEntries.filter((entry) => entry.direction === "OUTFLOW").length;
    const averageOutflow = outflowCount ? totalOutflow / outflowCount : 0;
    const payrollOutflow = cashflowEntries.filter((entry) => entry.sourceType === "PAYROLL").reduce((sum, entry) => sum + entry.amount, 0);
    const expenseOutflow = cashflowEntries.filter((entry) => entry.sourceType === "EXPENSE").reduce((sum, entry) => sum + entry.amount, 0);
    const sourceTotals = cashflowEntries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.sourceType] = (acc[entry.sourceType] ?? 0) + entry.amount;
      return acc;
    }, {});
    const dominantSource = Object.entries(sourceTotals).sort((left, right) => right[1] - left[1])[0];

    return {
      totalOutflow,
      totalInflow,
      averageOutflow,
      payrollOutflow,
      expenseOutflow,
      payrollShare: ratioPercent(payrollOutflow, totalOutflow),
      expenseShare: ratioPercent(expenseOutflow, totalOutflow),
      coverageRatio: totalOutflow ? availableCash / totalOutflow : 0,
      netMovement: totalInflow - totalOutflow,
      dominantSourceName: dominantSource?.[0] ?? "N/A",
      dominantSourceWeight: ratioPercent(dominantSource?.[1] ?? 0, totalOutflow || totalInflow)
    };
  }, [availableCash, cashflowEntries]);

  const accountingDepartmentOptions = useMemo(
    () => Array.from(new Set(accountingEntries.map((entry) => entry.department || "Non renseigne"))).sort((left, right) => left.localeCompare(right)),
    [accountingEntries]
  );

  const filteredAccountingEntries = useMemo(() => {
    const needle = accountingSearch.trim().toLowerCase();
    return accountingEntries.filter((entry) => {
      const department = entry.department || "Non renseigne";
      const matchesDepartment = accountingDepartmentFilter === "ALL" || department === accountingDepartmentFilter;
      const matchesSearch = !needle
        || entry.title.toLowerCase().includes(needle)
        || department.toLowerCase().includes(needle)
        || entry.entryType.toLowerCase().includes(needle)
        || (entry.expense?.title || entry.payrollRun?.title || entry.payrollItem?.salarySlipNumber || "").toLowerCase().includes(needle);
      return matchesDepartment && matchesSearch;
    });
  }, [accountingDepartmentFilter, accountingEntries, accountingSearch]);

  const accountingBreakdown = useMemo(() => {
    const grouped = filteredAccountingEntries.reduce<Record<string, { count: number; volume: number }>>((acc, entry) => {
      const key = entry.department || "Non renseigne";
      const current = acc[key] ?? { count: 0, volume: 0 };
      current.count += 1;
      current.volume += entry.amount;
      acc[key] = current;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([department, data]) => ({
        department,
        count: data.count,
        volume: data.volume,
        average: data.count ? data.volume / data.count : 0,
        weight: ratioPercent(data.volume, accountingMetrics.totalVolume)
      }))
      .sort((left, right) => right.volume - left.volume);
  }, [accountingMetrics.totalVolume, filteredAccountingEntries]);

  const cashflowSourceOptions = useMemo(
    () => Array.from(new Set(cashflowEntries.map((entry) => entry.sourceType))).sort((left, right) => left.localeCompare(right)),
    [cashflowEntries]
  );

  const filteredCashflowEntries = useMemo(() => {
    const needle = cashflowSearch.trim().toLowerCase();
    return cashflowEntries.filter((entry) => {
      const référence = entry.expense?.title || entry.payrollRun?.title || entry.payrollItem?.salarySlipNumber || "";
      const matchesSource = cashflowSourceFilter === "ALL" || entry.sourceType === cashflowSourceFilter;
      const matchesPeriod = isWithinPeriod(entry.référenceDate, cashflowPeriodFilter, cashflowDateFrom, cashflowDateTo);
      const matchesSearch = !needle
        || entry.sourceType.toLowerCase().includes(needle)
        || entry.direction.toLowerCase().includes(needle)
        || (entry.method || "").toLowerCase().includes(needle)
        || référence.toLowerCase().includes(needle)
        || (entry.expense?.department || entry.payrollRun?.department || entry.payrollItem?.salaryProfile.department || "").toLowerCase().includes(needle)
        || (entry.notes || "").toLowerCase().includes(needle);
      return matchesSource && matchesPeriod && matchesSearch;
    });
  }, [cashflowDateFrom, cashflowDateTo, cashflowEntries, cashflowPeriodFilter, cashflowSearch, cashflowSourceFilter]);

  const cashflowBreakdown = useMemo(() => {
    const grouped = filteredCashflowEntries.reduce<Record<string, { count: number; volume: number }>>((acc, entry) => {
      const current = acc[entry.sourceType] ?? { count: 0, volume: 0 };
      current.count += 1;
      current.volume += entry.amount;
      acc[entry.sourceType] = current;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([sourceType, data]) => ({
        sourceType,
        count: data.count,
        volume: data.volume,
        average: data.count ? data.volume / data.count : 0,
        weight: ratioPercent(data.volume, cashflowMetrics.totalOutflow || data.volume)
      }))
      .sort((left, right) => right.volume - left.volume);
  }, [cashflowMetrics.totalOutflow, filteredCashflowEntries]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesStatus = statusFilter === "ALL" || expense.status === statusFilter;
      const matchesPeriod = isWithinPeriod(expense.expenseDate, expensePeriodFilter, expenseDateFrom, expenseDateTo);
      const needle = search.trim().toLowerCase();
      const matchesSearch = !needle
        || expense.title.toLowerCase().includes(needle)
        || expense.department.toLowerCase().includes(needle)
        || expense.category.name.toLowerCase().includes(needle)
        || expenseDebitAccountCode(expense).toLowerCase().includes(needle)
        || expenseCreditAccountCode(expense).toLowerCase().includes(needle)
        || expense.status.toLowerCase().includes(needle)
        || (expense.paymentMethod ?? "").toLowerCase().includes(needle)
        || (expense.supplierName ?? "").toLowerCase().includes(needle)
        || (expense.vendor?.name ?? "").toLowerCase().includes(needle)
        || (expense.vendor?.contactName ?? "").toLowerCase().includes(needle)
        || (expense.vendor?.phone ?? "").toLowerCase().includes(needle)
        || (expense.vendor?.email ?? "").toLowerCase().includes(needle)
        || (expense.comments ?? "").toLowerCase().includes(needle);
      return matchesStatus && matchesPeriod && matchesSearch;
    });
  }, [expenseDateFrom, expenseDateTo, expensePeriodFilter, expenses, search, statusFilter]);

  const vendorUsage = useMemo(() => {
    return expenses.reduce<Record<string, { count: number; total: number; departments: Set<string>; lastExpenseDate?: string }>>((acc, expense) => {
      const vendorId = expense.vendor?.id;
      if (!vendorId) return acc;
      const current = acc[vendorId] ?? { count: 0, total: 0, departments: new Set<string>() };
      current.count += 1;
      current.total += expense.amount;
      current.departments.add(expense.department || "Non renseigne");
      if (!current.lastExpenseDate || new Date(expense.expenseDate).getTime() > new Date(current.lastExpenseDate).getTime()) {
        current.lastExpenseDate = expense.expenseDate;
      }
      acc[vendorId] = current;
      return acc;
    }, {});
  }, [expenses]);

  const filteredVendors = useMemo(() => {
    const needle = vendorSearch.trim().toLowerCase();
    return vendors.filter((vendor) => {
      const usage = vendorUsage[vendor.id];
      const haystack = [
        vendor.name,
        vendor.contactName,
        vendor.phone,
        vendor.email,
        vendor.address,
        vendor.notes,
        usage ? Array.from(usage.departments).join(" ") : "",
        usage ? String(usage.count) : "",
        usage ? String(usage.total) : ""
      ].filter(Boolean).join(" ").toLowerCase();
      return !needle || haystack.includes(needle);
    });
  }, [vendorSearch, vendorUsage, vendors]);
  const selectedVendor = vendors.find((vendor) => vendor.id === selectedVendorId) ?? null;

  const activeEmployeeObligations = useMemo(
    () => employeeObligations.filter((obligation) => !["PAID", "CANCELLED", "WRITTEN_OFF"].includes(obligation.status)),
    [employeeObligations]
  );

  const openEmployeeRepayments = useMemo(() => {
    return activeEmployeeObligations.flatMap((obligation) =>
      (obligation.repayments ?? [])
        .filter((repayment) => repayment.status !== "PAID")
        .map((repayment) => ({ obligation, repayment }))
    );
  }, [activeEmployeeObligations]);

  const employeeFinanceTotals = useMemo(() => {
    return activeEmployeeObligations.reduce((acc, obligation) => {
      const balance = Number(obligation.balance || 0);
      acc.totalBalance += balance;
      if (obligation.type === "SALARY_ADVANCE") acc.advances += balance;
      if (obligation.type === "SCHOOL_DEBT" || obligation.type === "OTHER_DEBT") acc.debts += balance;
      return acc;
    }, { totalBalance: 0, advances: 0, debts: 0 });
  }, [activeEmployeeObligations]);

  const documentEntries = useMemo<DocumentEntry[]>(() => {
    return expenses
      .flatMap((expense) =>
        (expense.attachments ?? []).map((attachment) => ({
          ...attachment,
          expenseId: expense.id,
          expenseTitle: expense.title,
          department: expense.department,
          status: expense.status,
          expenseDate: expense.expenseDate
        }))
      )
      .sort((left, right) => new Date(right.expenseDate).getTime() - new Date(left.expenseDate).getTime());
  }, [expenses]);

  async function refreshOverview() {
    const nextOverview = await api<ExpenseOverview>("/api/expenses/overview");
    setOverview(nextOverview);
  }

  async function refreshLedgers() {
    const [nextAccountingEntries, nextCashflowEntries] = await Promise.all([
      api<AccountingEntry[]>("/api/expenses/accounting-entries"),
      api<CashflowEntry[]>("/api/expenses/cashflow-entries")
    ]);
    setAccountingEntries(nextAccountingEntries);
    setCashflowEntries(nextCashflowEntries);
  }

  async function refreshEmployeeObligations() {
    const nextObligations = await api<EmployeeObligation[]>("/api/expenses/employee-finance/obligations");
    setEmployeeObligations(nextObligations);
  }

  function openOperationsModule(module: OperationTab) {
    setActiveTab(module);
    setActiveDialog(module);
    setActiveSubDialog(null);
  }

  function openEmployeeObligationDialog(type: "SALARY_ADVANCE" | "SCHOOL_DEBT" | "OTHER_DEBT") {
    const firstProfile = salaryProfiles[0];
    setActiveTab("payroll");
    setActiveDialog("payroll");
    setActionError(null);
    setSuccess(null);
    setEmployeeObligationForm({
      ...EMPTY_EMPLOYEE_OBLIGATION_FORM,
      salaryProfileId: firstProfile?.id ?? "",
      type,
      title: type === "SALARY_ADVANCE" ? "Avance sur salaire" : type === "SCHOOL_DEBT" ? "Dette envers l'école" : "Dette employé",
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      repaymentMethod: type === "SALARY_ADVANCE" ? "SALARY_DEDUCTION" : "EXTERNAL_PAYMENT"
    });
    setActiveSubDialog(type === "SALARY_ADVANCE" ? "employee-advance-create" : "employee-debt-create");
  }

  function openEmployeeRepaymentDialog() {
    const firstOpenRepayment = openEmployeeRepayments[0];
    setActiveTab("payroll");
    setActiveDialog("payroll");
    setActionError(null);
    setSuccess(null);
    setEmployeeRepaymentForm({
      ...EMPTY_EMPLOYEE_REPAYMENT_FORM,
      repaymentId: firstOpenRepayment?.repayment.id ?? "",
      paidAmount: firstOpenRepayment ? String(Math.max(Number(firstOpenRepayment.repayment.expectedAmount || 0) - Number(firstOpenRepayment.repayment.paidAmount || 0), 0)) : "",
      reference: `EMP-PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`
    });
    setActiveSubDialog("employee-repayment-create");
  }

  function printHtmlDocument(html: string) {
    setActionError(null);
    sharedPrintHtmlDocument(html);
  }

  function openPayslipPreview(run: PayrollRun, item: PayrollRun["items"][number]) {
    setSelectedPayslip({ run, item });
    setActiveSubDialog("payslip-preview");
  }

  function printSalarySlip(run: PayrollRun, item: PayrollRun["items"][number]) {
    const brand = schoolBranding;
    const logoSrc = escapeHtml(new URL(brand.logoSrc, window.location.href).toString());
    const generatedAt = new Date();
    const grossSalary = Number(item.baseSalary || 0) + Number(item.bonuses || 0);
    const totalDeductions = Number(item.deductions || 0) + Number(item.advancesRecovered || 0) + Number(item.debtRecovered || 0);
    const documentReference = escapeHtml(`KCS-PAYROLL-${generatedAt.toISOString().slice(0, 10)}-${item.salarySlipNumber}`);
    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <title>Bulletin de paie ${item.salarySlipNumber}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body { position: relative; font-family: Arial, Helvetica, sans-serif; background: #f8fafc; color: #0f172a; padding: 24px; }
    .watermark-text { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 96px; font-weight: 900; letter-spacing: 16px; color: rgba(11,46,89,0.05); transform: rotate(-22deg); pointer-events: none; user-select: none; }
    .watermark-logo { position: fixed; left: 50%; top: 50%; width: 320px; height: 320px; opacity: 0.08; transform: translate(-50%, -50%); object-fit: contain; filter: grayscale(100%) contrast(1.05); pointer-events: none; user-select: none; }
    .sheet { position: relative; z-index: 2; max-width: 780px; margin: 0 auto; background: white; border: 1px solid #cbd5e1; border-radius: 18px; overflow: hidden; box-shadow: 0 20px 60px rgba(15,23,42,0.08); }
    .topbar { display:flex; justify-content:space-between; align-items:center; gap:12px; padding: 0 4px 10px; color:#64748b; font-size:10px; text-transform:uppercase; letter-spacing:0.16em; }
    .topbar strong { color:#0b2e59; }
    .hero { padding: 28px; background: linear-gradient(135deg, #082f49, #1f4f8f); color: white; display:flex; justify-content:space-between; gap:20px; align-items:flex-start; }
    .hero-main { display:flex; align-items:center; gap:16px; }
    .hero-logo { width: 64px; height: 64px; object-fit: contain; border-radius: 999px; background: white; padding: 6px; border: 1px solid rgba(255,255,255,0.2); }
    .hero h1 { margin: 8px 0 0; font-size: 28px; }
    .hero p { margin: 6px 0 0; color: #cbd5e1; }
    .hero-meta { text-align:right; font-size:12px; color: rgba(255,255,255,0.86); }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; padding: 24px 28px 12px; }
    .card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; }
    .value { margin-top: 8px; font-size: 18px; font-weight: 700; color: #0b2e59; }
    .table-wrap { padding: 0 28px 28px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 12px 10px; text-align: left; font-size: 13px; }
    th { color: #475569; text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em; }
    .compliance { margin: 0 28px 18px; border: 1px solid rgba(15,118,110,0.2); border-left: 5px solid #0f766e; border-radius: 14px; background: rgba(240,253,250,0.96); padding: 12px 14px; color: #134e4a; font-size: 11px; line-height: 1.5; }
    .signatures { display:grid; grid-template-columns: 1fr 1fr; gap:16px; padding: 0 28px 20px; }
    .signature-box { min-height: 82px; border:1px dashed rgba(11,46,89,0.24); border-radius:14px; background: rgba(255,255,255,0.88); padding:12px; }
    .signature-title { font-size:10px; text-transform:uppercase; letter-spacing:0.14em; font-weight:800; color:#64748b; }
    .signature-line { margin-top:38px; border-top:1px solid rgba(11,46,89,0.24); padding-top:6px; font-size:11px; color:#0b2e59; font-weight:700; }
    .foot { padding: 0 28px 28px; font-size: 12px; color: #475569; display:flex; justify-content:space-between; gap:12px; border-top: 1px solid #e2e8f0; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="watermark-text">${escapeHtml(brand.shortName)}</div>
  <img class="watermark-logo" src="${logoSrc}" alt="" />
  <div class="topbar"><span><strong>${escapeHtml(brand.shortName)}</strong> · bulletin de paie officiel</span><span>Référence ${documentReference}</span></div>
  <div class="sheet">
    <div class="hero">
      <div class="hero-main">
        <img class="hero-logo" src="${logoSrc}" alt="Logo ${escapeHtml(brand.schoolName)}" />
        <div>
          <div class="label" style="color:${escapeHtml(brand.colors.accent)}">${escapeHtml(brand.appName)}</div>
          <h1>${L("Bulletin de paie", "Payslip")}</h1>
          <p>${item.salaryProfile.fullName} • ${item.salaryProfile.position} • ${run.period?.name ?? "Période active"}</p>
        </div>
      </div>
      <div class="hero-meta">
        <div style="font-weight:700;">${escapeHtml(brand.schoolName)}</div>
        <div style="margin-top:4px;">${escapeHtml(brand.tagline)}</div>
        <div style="margin-top:10px;">${escapeHtml(generatedAt.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US"))}</div>
        <div>${escapeHtml(generatedAt.toLocaleTimeString(lang === "fr" ? "fr-FR" : "en-US"))}</div>
      </div>
    </div>
    <div class="grid">
      <div class="card"><div class="label">${L("Numéro de fiche", "Payslip number")}</div><div class="value">${item.salarySlipNumber}</div></div>
      <div class="card"><div class="label">${L("Cycle de paie", "Payroll run")}</div><div class="value">${run.title}</div></div>
      <div class="card"><div class="label">${L("Employé", "Employee")}</div><div class="value">${item.salaryProfile.fullName}</div></div>
      <div class="card"><div class="label">${L("Code employé", "Employee code")}</div><div class="value">${item.salaryProfile.employeeCode}</div></div>
      <div class="card"><div class="label">${L("Département", "Department")}</div><div class="value">${item.salaryProfile.department}</div></div>
      <div class="card"><div class="label">${L("Net à payer", "Net payable")}</div><div class="value">${currency.format(item.netSalary)}</div></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>${L("Élément", "Item")}</th><th>${L("Valeur", "Value")}</th></tr>
        </thead>
        <tbody>
          <tr><td>${L("Salaire de base", "Base salary")}</td><td>${currency.format(item.baseSalary)}</td></tr>
          <tr><td>${L("Primes et bonus", "Allowances and bonuses")}</td><td>${currency.format(item.bonuses)}</td></tr>
          <tr><td>${L("Salaire brut", "Gross salary")}</td><td>${currency.format(grossSalary)}</td></tr>
          <tr><td>${L("Retenues ordinaires", "Regular deductions")}</td><td>${currency.format(item.deductions)}</td></tr>
          <tr><td>${L("Avances récupérées", "Recovered advances")}</td><td>${currency.format(item.advancesRecovered)}</td></tr>
          <tr><td>${L("Dettes récupérées", "Recovered debts")}</td><td>${currency.format(item.debtRecovered)}</td></tr>
          <tr><td>${L("Total des retenues", "Total deductions")}</td><td>${currency.format(totalDeductions)}</td></tr>
          <tr><td><strong>${L("Net à payer", "Net payable")}</strong></td><td><strong>${currency.format(item.netSalary)}</strong></td></tr>
          <tr><td>${L("Fréquence", "Frequency")}</td><td>${labelizeFrequency(item.salaryProfile.frequency, lang)}</td></tr>
          <tr><td>${L("Statut du cycle", "Run status")}</td><td>${run.status}</td></tr>
        </tbody>
      </table>
    </div>
    <div class="compliance">Ce bulletin de paie est édité selon la charte ${escapeHtml(brand.shortName)} pour consultation, archivage et validation interne. Le montant net correspond au run de paie affiché sur ce document.</div>
    <div class="signatures">
      <div class="signature-box"><div class="signature-title">Validation RH</div><div class="signature-line">Ressources humaines</div></div>
      <div class="signature-box"><div class="signature-title">Visa financier</div><div class="signature-line">Service paie / comptabilité</div></div>
    </div>
    <div class="foot"><span>Document généré par ${escapeHtml(brand.appName)} pour ${escapeHtml(brand.schoolName)}.</span><span>${escapeHtml(generatedAt.toLocaleString(lang === "fr" ? "fr-FR" : "en-US"))}</span></div>
  </div>
</body>
</html>`;

  printHtmlDocument(html);
  }

  function exportSalarySlipExcel(run: PayrollRun, item: PayrollRun["items"][number]) {
    exportLocalizedWorkbook(`bulletin-de-paie-${item.salarySlipNumber}`, [
      {
        name: "Bulletin de paie",
        rows: [{
          "Numero de fiche": item.salarySlipNumber,
          "Run": run.title,
          "Période": run.period?.name ?? "Période active",
          "Employe": item.salaryProfile.fullName,
          "Code employe": item.salaryProfile.employeeCode,
          "Departement": item.salaryProfile.department,
          "Poste": item.salaryProfile.position,
          "Frequence": labelizeFrequency(item.salaryProfile.frequency, lang),
          "Salaire de base": item.baseSalary,
          "Primes et bonus": item.bonuses,
          "Salaire brut": Number(item.baseSalary || 0) + Number(item.bonuses || 0),
          "Retenues ordinaires": item.deductions,
          "Avances recuperees": item.advancesRecovered,
          "Dettes recuperees": item.debtRecovered,
          "Total des retenues": Number(item.deductions || 0) + Number(item.advancesRecovered || 0) + Number(item.debtRecovered || 0),
          "Net a payer": item.netSalary,
          "Statut du run": run.status
        }]
      }
    ]);
  }

  function findExpenseForAttachment(file: ExpenseAttachment | DocumentEntry) {
    if ("expenseId" in file) {
      return expenses.find((expense) => expense.id === file.expenseId) ?? null;
    }
    return expenses.find((expense) =>
      (expense.attachments ?? []).some((attachment) =>
        attachment.id === file.id ||
        (attachment.fileName === file.fileName && attachment.fileUrl === file.fileUrl)
      )
    ) ?? null;
  }

  function buildExpenseSupportDocumentHtml(file: ExpenseAttachment | DocumentEntry) {
    const expense = findExpenseForAttachment(file);
    const brand = schoolBranding;
    const logoSrc = escapeHtml(new URL(brand.logoSrc, window.location.href).toString());
    const generatedAt = new Date();
    const documentReference = `KCS-EXP-${generatedAt.toISOString().slice(0, 10)}-${expense?.id ?? ("expenseId" in file ? file.expenseId : "UNLINKED")}-${file.id}`.replace(/[^A-Z0-9-]/gi, "-");
    const sourceIsImage = /^data:image\//i.test(file.fileUrl) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.fileUrl.split("?")[0] ?? "");
    const sourceIsPdf = /^data:application\/pdf/i.test(file.fileUrl) || /\.pdf$/i.test(file.fileUrl.split("?")[0] ?? "");
    const sourceLabel = file.fileUrl?.startsWith("data:")
      ? "Fichier charge dans EduPay"
      : (file.fileUrl || "Reference non renseignee");
    const approvalRows = (expense?.approvalSteps ?? []).map((step) => `
      <tr>
        <td>${escapeHtml(step.stage)}</td>
        <td>${escapeHtml(step.role)}</td>
        <td>${escapeHtml(step.status)}</td>
        <td>${escapeHtml(step.comments || "-")}</td>
      </tr>
    `).join("");
    const sourcePreview = sourceIsImage
      ? `<img class="attachment-preview" src="${escapeHtml(file.fileUrl)}" alt="Piece justificative ${escapeHtml(file.fileName)}" />`
      : sourceIsPdf
        ? `<iframe class="attachment-frame" src="${escapeHtml(file.fileUrl)}" title="Piece justificative ${escapeHtml(file.fileName)}"></iframe>`
        : `<div class="source-box"><div class="label">Source / reference</div><div class="source-text">${escapeHtml(sourceLabel)}</div></div>`;

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <title>Piece justificative ${escapeHtml(file.fileName)}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { position: relative; margin: 0; background: #f8fafc; color: #0f172a; font-family: Arial, Helvetica, sans-serif; padding: 22px; }
    .watermark-text { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 86px; font-weight: 900; letter-spacing: 14px; color: rgba(11,46,89,0.055); transform: rotate(-22deg); pointer-events: none; user-select: none; }
    .watermark-logo { position: fixed; left: 50%; top: 50%; width: 300px; height: 300px; opacity: 0.075; transform: translate(-50%, -50%); object-fit: contain; filter: grayscale(100%) contrast(1.05); pointer-events: none; user-select: none; }
    .topbar { display:flex; justify-content:space-between; gap:12px; padding: 0 2px 10px; color:#64748b; font-size:10px; text-transform:uppercase; letter-spacing:0.14em; }
    .topbar strong { color:#0b2e59; }
    .sheet { position: relative; z-index: 2; max-width: 820px; margin: 0 auto; background: white; border: 1px solid #cbd5e1; border-radius: 18px; overflow: hidden; box-shadow: 0 20px 60px rgba(15,23,42,0.08); }
    .hero { padding: 26px; background: linear-gradient(135deg, #082f49, #1f4f8f); color: white; display:flex; justify-content:space-between; gap:20px; align-items:flex-start; }
    .hero-main { display:flex; align-items:center; gap:15px; min-width: 0; }
    .hero-logo { width: 62px; height: 62px; object-fit: contain; border-radius: 999px; background: white; padding: 6px; border: 1px solid rgba(255,255,255,0.2); }
    .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.13em; color: #64748b; font-weight: 800; }
    .hero .label { color: ${escapeHtml(brand.colors.accent)}; }
    h1 { margin: 7px 0 0; font-size: 27px; line-height: 1.12; }
    .hero p { margin: 6px 0 0; color: #dbeafe; overflow-wrap: anywhere; }
    .hero-meta { text-align:right; font-size:12px; color: rgba(255,255,255,0.88); min-width: 180px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; padding: 22px 26px 12px; }
    .card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; min-width: 0; }
    .value { margin-top: 8px; font-size: 16px; font-weight: 800; color: #0b2e59; overflow-wrap: anywhere; }
    .amount { color: #0f766e; font-size: 19px; }
    .table-wrap { padding: 8px 26px 22px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 12px; vertical-align: top; }
    th { color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.08em; }
    .attachment { margin: 0 26px 18px; border: 1px solid #dbeafe; border-radius: 16px; overflow: hidden; background: #f8fafc; }
    .attachment-head { padding: 12px 14px; border-bottom: 1px solid #dbeafe; display:flex; justify-content:space-between; gap:12px; color:#0b2e59; font-weight:800; }
    .attachment-preview { display:block; width: 100%; max-height: 420px; object-fit: contain; background:white; }
    .attachment-frame { display:block; width: 100%; height: 430px; border:0; background:white; }
    .source-box { padding: 16px; }
    .source-text { margin-top:8px; color:#0f172a; font-weight:700; overflow-wrap:anywhere; }
    .compliance { margin: 0 26px 18px; border: 1px solid rgba(15,118,110,0.22); border-left: 5px solid #0f766e; border-radius: 14px; background: rgba(240,253,250,0.96); padding: 12px 14px; color: #134e4a; font-size: 11px; line-height: 1.5; }
    .signatures { display:grid; grid-template-columns: 1fr 1fr; gap:14px; padding: 0 26px 20px; }
    .signature-box { min-height: 74px; border:1px dashed rgba(11,46,89,0.24); border-radius:14px; background: rgba(255,255,255,0.88); padding:12px; }
    .signature-title { font-size:10px; text-transform:uppercase; letter-spacing:0.14em; font-weight:800; color:#64748b; }
    .signature-line { margin-top:32px; border-top:1px solid rgba(11,46,89,0.24); padding-top:6px; font-size:11px; color:#0b2e59; font-weight:700; }
    .foot { padding: 14px 26px 24px; font-size: 11px; color: #475569; display:flex; justify-content:space-between; gap:12px; border-top: 1px solid #e2e8f0; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .sheet { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="watermark-text">${escapeHtml(brand.shortName)}</div>
  <img class="watermark-logo" src="${logoSrc}" alt="" />
  <div class="topbar"><span><strong>${escapeHtml(brand.shortName)}</strong> · piece justificative officielle</span><span>Reference ${escapeHtml(documentReference)}</span></div>
  <div class="sheet">
    <div class="hero">
      <div class="hero-main">
        <img class="hero-logo" src="${logoSrc}" alt="Logo ${escapeHtml(brand.schoolName)}" />
        <div>
          <div class="label">${escapeHtml(brand.appName)}</div>
          <h1>${L("Pièce justificative de dépense", "Expense supporting document")}</h1>
          <p>${escapeHtml(file.fileName)} · ${escapeHtml(expense?.title ?? ("expenseTitle" in file ? file.expenseTitle : "Depense non liee"))}</p>
        </div>
      </div>
      <div class="hero-meta">
        <div style="font-weight:700;">${escapeHtml(brand.schoolName)}</div>
        <div style="margin-top:4px;">${escapeHtml(brand.tagline)}</div>
        <div style="margin-top:10px;">${escapeHtml(generatedAt.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US"))}</div>
        <div>${escapeHtml(generatedAt.toLocaleTimeString(lang === "fr" ? "fr-FR" : "en-US"))}</div>
      </div>
    </div>
    <div class="grid">
      <div class="card"><div class="label">${L("Référence du document", "Document reference")}</div><div class="value">${escapeHtml(documentReference)}</div></div>
      <div class="card"><div class="label">${L("Statut du workflow", "Workflow status")}</div><div class="value">${escapeHtml(expense?.status ?? ("status" in file ? file.status : "Non renseigne"))}</div></div>
      <div class="card"><div class="label">${L("Dépense", "Expense")}</div><div class="value">${escapeHtml(expense?.title ?? ("expenseTitle" in file ? file.expenseTitle : "-"))}</div></div>
      <div class="card"><div class="label">${L("Montant", "Amount")}</div><div class="value amount">${escapeHtml(expense ? currency.format(expense.amount) : "-")}</div></div>
      <div class="card"><div class="label">${L("Département", "Department")}</div><div class="value">${escapeHtml(expense?.department ?? ("department" in file ? file.department : "-"))}</div></div>
      <div class="card"><div class="label">${L("Bénéficiaire", "Beneficiary")}</div><div class="value">${escapeHtml(expense?.vendor?.name ?? expense?.supplierName ?? "-")}</div></div>
      <div class="card"><div class="label">${L("Catégorie", "Category")}</div><div class="value">${escapeHtml(expense?.category?.name ?? "-")}</div></div>
      <div class="card"><div class="label">${L("Date de la dépense", "Expense date")}</div><div class="value">${escapeHtml(new Date(expense?.expenseDate ?? ("expenseDate" in file ? file.expenseDate : Date.now())).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US"))}</div></div>
    </div>
    <div class="attachment">
      <div class="attachment-head"><span>Piece source</span><span>${escapeHtml(file.mimeType || "type non precise")}</span></div>
      ${sourcePreview}
    </div>
    <div class="table-wrap">
      <div class="label">Workflow de validation</div>
      <table>
        <thead><tr><th>Etape</th><th>Role</th><th>Statut</th><th>Commentaire</th></tr></thead>
        <tbody>${approvalRows || `<tr><td colspan="4">Aucune etape de validation renseignee.</td></tr>`}</tbody>
      </table>
    </div>
    <div class="compliance">Ce document encapsule la piece justificative et le contexte de depense dans le format administratif ${escapeHtml(brand.shortName)}. La reference, le statut, le montant et le workflow permettent de verifier la trace sans dependre uniquement du fichier brut.</div>
    <div class="signatures">
      <div class="signature-box"><div class="signature-title">Controle operationnel</div><div class="signature-line">Responsable departement</div></div>
      <div class="signature-box"><div class="signature-title">Visa finance</div><div class="signature-line">Comptabilite / Direction</div></div>
    </div>
    <div class="foot"><span>Document officiel ${escapeHtml(brand.appName)} genere pour ${escapeHtml(brand.schoolName)}.</span><span>${escapeHtml(generatedAt.toLocaleString(lang === "fr" ? "fr-FR" : "en-US"))}</span></div>
  </div>
</body>
</html>`;
  }

  function openExpenseSupportDocument(file: ExpenseAttachment | DocumentEntry) {
    const html = buildExpenseSupportDocumentHtml(file);
    const opened = window.open("", "_blank");
    if (!opened) {
      printHtmlDocument(html);
      return;
    }
    opened.opener = null;
    opened.document.open();
    opened.document.write(html);
    opened.document.close();
  }

  function downloadExpenseSupportDocument(file: ExpenseAttachment | DocumentEntry) {
    const html = buildExpenseSupportDocumentHtml(file);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `piece-justificative-${file.fileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-]+/gi, "-") || file.id}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  function readFileAsAttachment(file: File) {
    return new Promise<ExpenseAttachment>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          reject(new Error("Format de fichier non pris en charge."));
          return;
        }
        resolve({
          id: `pending-${Date.now()}-${file.name}`,
          fileName: file.name,
          fileUrl: reader.result,
          mimeType: file.type || "application/octet-stream"
        });
      };
      reader.onerror = () => reject(new Error(`Impossible de charger ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }

  async function handleAttachmentSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    try {
      const attachments = await Promise.all(files.map((file) => readFileAsAttachment(file)));
      setPendingAttachments((current) => [...current, ...attachments]);
      setActionError(null);
    } catch (uploadError) {
      setActionError(uploadError instanceof Error ? uploadError.message : "Impossible de charger les justificatifs.");
    } finally {
      event.target.value = "";
    }
  }

  function removePendingAttachment(attachmentId: string) {
    setPendingAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  }

  function escapeCsv(value: string | number | null | undefined) {
    const normalized = String(value ?? "").replace(/"/g, '""');
    return `"${normalized}"`;
  }

  function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
    const localizedHeaders = headers.map((header) => financialExportText(header, lang));
    const localizedRows = rows.map((row) => row.map((cell) => typeof cell === "string" && DYNAMIC_FINANCIAL_LABELS[cell] ? dynamicFinancialLabel(cell, lang) : cell));
    const content = [localizedHeaders, ...localizedRows]
      .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
      .join("\n");

    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = lang === "fr" ? filename : filename.replace("journal-comptable", "accounting-ledger").replace("journal-trésorerie", "cash-flow-ledger");
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  function printLedgerReport(
    title: string,
    subtitle: string,
    headers: string[],
    rows: Array<Array<string | number | null | undefined>>,
    metrics: Array<{ label: string; value: string; detail: string }>
  ) {
    const brand = schoolBranding;
    const logoSrc = escapeHtml(new URL(brand.logoSrc, window.location.href).toString());
    const primary = brand.colors.primary;
    const secondary = brand.colors.secondary;
    const accent = brand.colors.accent;
    const surface = brand.colors.surface;
    const generatedAt = new Date();
    const documentReference = escapeHtml(`KCS-LEDGER-${generatedAt.toISOString().slice(0, 10)}-${String(rows.length).padStart(4, "0")}`);
    const localizedTitle = financialExportText(title, lang);
    const localizedSubtitle = financialExportText(subtitle, lang);
    const headHtml = headers.map((header) => `<th>${escapeHtml(financialExportText(header, lang))}</th>`).join("");
    const rowsHtml = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
    const metricHtml = metrics.map((metric) => `
      <div class="metric-card">
        <div class="metric-label">${escapeHtml(financialExportText(metric.label, lang))}</div>
        <div class="metric-value">${escapeHtml(metric.value)}</div>
        <div class="metric-detail">${escapeHtml(financialExportText(metric.detail, lang))}</div>
      </div>
    `).join("");
    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <title>${localizedTitle}</title>
  <style>
    @page { size: landscape; margin: 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: ${surface}; }
    .watermark-text { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 112px; font-weight: 900; letter-spacing: 16px; color: rgba(11,46,89,0.05); transform: rotate(-22deg); pointer-events: none; user-select: none; }
    .watermark-logo { position: fixed; left: 50%; top: 50%; width: 360px; height: 360px; opacity: 0.08; transform: translate(-50%, -50%); object-fit: contain; filter: grayscale(100%) contrast(1.05); pointer-events: none; user-select: none; }
    .topbar { display:flex; justify-content:space-between; align-items:center; gap:12px; padding: 0 2px 10px; font-size:10px; text-transform:uppercase; letter-spacing:0.16em; color:#64748b; }
    .topbar strong { color:${primary}; }
    .sheet { position: relative; z-index: 2; background: white; border: 1px solid #cbd5e1; border-radius: 18px; overflow: hidden; box-shadow: 0 20px 60px rgba(15,23,42,0.08); }
    .hero { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; background: linear-gradient(135deg, ${primary}, ${secondary}); color: white; padding: 24px 28px; }
    .hero-main { display:flex; align-items:center; gap:16px; }
    .hero-logo { width: 62px; height: 62px; object-fit: contain; border-radius: 999px; background: white; padding: 5px; border: 1px solid rgba(255,255,255,0.18); }
    .hero h1 { margin: 4px 0 0; font-size: 28px; }
    .hero p { margin: 8px 0 0; color: rgba(255,255,255,0.82); }
    .hero-meta { text-align:right; font-size:12px; color: rgba(255,255,255,0.86); }
    .metrics { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; padding: 22px 28px 8px; }
    .metric-card { border: 1px solid #dbeafe; border-radius: 16px; background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); padding: 14px; }
    .metric-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; font-weight: 700; }
    .metric-value { margin-top: 8px; color: ${primary}; font-size: 18px; font-weight: 800; }
    .metric-detail { margin-top: 6px; font-size: 11px; color: #475569; }
    .table-wrap { padding: 18px 28px 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; font-size: 12px; }
    th { background: #eff6ff; color: ${primary}; text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; }
    tr:nth-child(even) td { background: #fbfdff; }
    .compliance { margin: 0 28px 18px; border: 1px solid rgba(15,118,110,0.2); border-left: 5px solid #0f766e; border-radius: 14px; background: rgba(240,253,250,0.96); padding: 12px 14px; color: #134e4a; font-size: 11px; line-height: 1.5; }
    .signatures { display:grid; grid-template-columns: 1fr 1fr; gap:16px; padding: 0 28px 20px; }
    .signature-box { min-height: 82px; border:1px dashed rgba(11,46,89,0.24); border-radius:14px; background: rgba(255,255,255,0.88); padding:12px; }
    .signature-title { font-size:10px; text-transform:uppercase; letter-spacing:0.14em; font-weight:800; color:#64748b; }
    .signature-line { margin-top:38px; border-top:1px solid rgba(11,46,89,0.24); padding-top:6px; font-size:11px; color:${primary}; font-weight:700; }
    .foot { padding: 0 28px 24px; color: #475569; font-size: 12px; border-top: 1px solid #e2e8f0; margin-top: 4px; display:flex; justify-content:space-between; gap:12px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="topbar"><span><strong>${escapeHtml(brand.shortName)}</strong> · rapport financier officiel</span><span>Référence ${documentReference}</span></div>
  <div class="watermark-text">${escapeHtml(brand.shortName)}</div>
  <img class="watermark-logo" src="${logoSrc}" alt="" />
  <div class="sheet">
    <div class="hero">
      <div class="hero-main">
        <img class="hero-logo" src="${logoSrc}" alt="Logo ${escapeHtml(brand.schoolName)}" />
        <div>
          <div style="font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:${accent};">${escapeHtml(brand.shortName)} Financial Report</div>
          <h1>${escapeHtml(localizedTitle)}</h1>
          <p>${escapeHtml(localizedSubtitle)}</p>
        </div>
      </div>
      <div class="hero-meta">
        <div style="font-weight:700;">${escapeHtml(brand.schoolName)}</div>
        <div style="margin-top:4px;">${escapeHtml(brand.tagline)}</div>
        <div style="margin-top:10px;">${generatedAt.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US")}</div>
        <div>${generatedAt.toLocaleTimeString(lang === "fr" ? "fr-FR" : "en-US")}</div>
      </div>
    </div>
    <div class="metrics">${metricHtml}</div>
    <div class="table-wrap">
      <table>
        <thead><tr>${headHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    <div class="compliance">Ce journal financier est édité selon la charte ${escapeHtml(brand.shortName)} pour audit, pilotage et archivage. Les indicateurs de synthèse et le tableau détaillé correspondent aux lignes visibles dans l'interface au moment de l'impression.</div>
    <div class="signatures"><div class="signature-box"><div class="signature-title">Contrôle comptable</div><div class="signature-line">Service financier</div></div><div class="signature-box"><div class="signature-title">Visa de direction</div><div class="signature-line">Direction administrative</div></div></div>
    <div class="foot"><span>Document officiel ${escapeHtml(brand.appName)} généré pour ${escapeHtml(brand.schoolName)}.</span><span>${generatedAt.toLocaleString(lang === "fr" ? "fr-FR" : "en-US")}</span></div>
  </div>
</body>
</html>`;

    printHtmlDocument(html);
  }

  function exportAccountingCsv() {
    downloadCsv(
      `journal-comptable-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Date", "Type", "Direction", "Titre", "Departement", "Montant", "Devise", "Source"],
      filteredAccountingEntries.map((entry) => [
        new Date(entry.entryDate).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US"),
        entry.entryType,
        entry.direction,
        entry.title,
        entry.department || "",
        entry.amount,
        entry.currency,
        entry.expense?.title || entry.payrollRun?.title || entry.payrollItem?.salarySlipNumber || ""
      ])
    );
  }

  function exportAccountingExcel() {
    exportLocalizedWorkbook(`journal-comptable-${new Date().toISOString().slice(0, 10)}`, [
      {
        name: "Synthese",
        rows: [{
          "Ecritures filtrées": filteredAccountingEntries.length,
          "Volume comptabilisé": accountingMetrics.totalVolume,
          "Ticket moyen": Number(accountingMetrics.averageEntry.toFixed(2)),
          "Part paie %": Number(accountingMetrics.payrollWeight.toFixed(2)),
          "Couverture documentaire %": Number(accountingMetrics.documentationCoverage.toFixed(2)),
          "Taux approbation %": Number(accountingMetrics.approvalCoverage.toFixed(2))
        }]
      },
      {
        name: "Repartition departements",
        rows: accountingBreakdown.map((entry) => ({
          "Departement": entry.department,
          "Ecritures": entry.count,
          "Volume": entry.volume,
          "Moyenne": entry.average,
          "Poids %": Number(entry.weight.toFixed(2))
        }))
      },
      {
        name: "Journal comptable",
        rows: filteredAccountingEntries.map((entry) => ({
          "Date": new Date(entry.entryDate).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US"),
          "Type": entry.entryType,
          "Direction": entry.direction,
          "Titre": entry.title,
          "Departement": entry.department || "",
          "Montant": entry.amount,
          "Devise": entry.currency,
          "Source": entry.expense?.title || entry.payrollRun?.title || entry.payrollItem?.salarySlipNumber || ""
        }))
      }
    ]);
  }

  function exportCashflowCsv() {
    downloadCsv(
      `journal-trésorerie-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Date", "Source", "Direction", "Méthode", "Montant", "Devise", "Référence", "Notes"],
      filteredCashflowEntries.map((entry) => [
        new Date(entry.référenceDate).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US"),
        entry.sourceType,
        entry.direction,
        entry.method || "",
        entry.amount,
        entry.currency,
        entry.expense?.title || entry.payrollRun?.title || entry.payrollItem?.salarySlipNumber || "",
        entry.notes || ""
      ])
    );
  }

  function exportCashflowExcel() {
    exportLocalizedWorkbook(`journal-trésorerie-${new Date().toISOString().slice(0, 10)}`, [
      {
        name: "Synthese",
        rows: [{
          "Lignes filtrées": filteredCashflowEntries.length,
          "Sorties cumulées": cashflowMetrics.totalOutflow,
          "Ticket moyen sortie": Number(cashflowMetrics.averageOutflow.toFixed(2)),
          "Part paie %": Number(cashflowMetrics.payrollShare.toFixed(2)),
          "Couverture cash": Number(cashflowMetrics.coverageRatio.toFixed(2)),
          "Variation nette": cashflowMetrics.netMovement
        }]
      },
      {
        name: "Repartition sources",
        rows: cashflowBreakdown.map((entry) => ({
          "Source": entry.sourceType,
          "Lignes": entry.count,
          "Volume": entry.volume,
          "Moyenne": entry.average,
          "Poids %": Number(entry.weight.toFixed(2))
        }))
      },
      {
        name: "Journal trésorerie",
        rows: filteredCashflowEntries.map((entry) => ({
          "Date": new Date(entry.référenceDate).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US"),
          "Source": entry.sourceType,
          "Direction": entry.direction,
          "Méthode": entry.method || "",
          "Montant": entry.amount,
          "Devise": entry.currency,
          "Référence": entry.expense?.title || entry.payrollRun?.title || entry.payrollItem?.salarySlipNumber || "",
          "Notes": entry.notes || ""
        }))
      }
    ]);
  }

  function exportExpensesExcel() {
    exportLocalizedWorkbook(`registre-depenses-${new Date().toISOString().slice(0, 10)}`, [
      {
        name: "Synthese",
        rows: [{
          "Dépenses filtrées": filteredExpenses.length,
          "Période": periodLabel(expensePeriodFilter, expenseDateFrom, expenseDateTo, lang),
          "Statut": statusFilter === "ALL" ? "Tous" : statusFilter,
          "Total": filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0),
          "Approuvees": filteredExpenses.filter((expense) => expense.status === "APPROVED").length,
          "En attente": filteredExpenses.filter((expense) => expense.status === "PENDING").length
        }]
      },
      {
        name: "Registre depenses",
        rows: filteredExpenses.map((expense) => ({
          "Date": new Date(expense.expenseDate).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US"),
          "Titre ou motif": expense.title,
          "Beneficiaire": expense.vendor?.name || expense.supplierName || "",
          "Contact beneficiaire": expense.vendor?.phone || expense.vendor?.email || expense.vendor?.contactName || "",
          "Departement": expense.department,
          "Categorie": expense.category.name,
          "Compte débité": expenseDebitAccountCode(expense),
          "Classe": expense.category.accountClass || "",
          "Compte crédité": expenseCreditAccountCode(expense),
          "Statut": expense.status,
          "Mode": expense.paymentMethod || "",
          "Montant": expense.amount,
          "Devise": expense.currency,
          "Budget": expense.budget?.name || "",
          "Commentaires": expense.comments || "",
          "Pieces": expense.attachments?.length || 0
        }))
      }
    ]);
  }

  function printExpensesReport() {
    printLedgerReport(
      "Registre des depenses",
      `Recherche strategique des depenses filtrées. Période: ${periodLabel(expensePeriodFilter, expenseDateFrom, expenseDateTo, lang)}.`,
      ["Date", "Titre ou motif", "Beneficiaire", "Departement", "Compte débité", "Compte crédité", "Statut", "Montant"],
      filteredExpenses.map((expense) => [
        new Date(expense.expenseDate).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US"),
        expense.title,
        expense.vendor?.name || expense.supplierName || "",
        expense.department,
        expenseDebitAccountCode(expense) || "-",
        expenseCreditAccountCode(expense) || "-",
        expense.status,
        currency.format(expense.amount)
      ]),
      [
        { label: "Dépenses filtrées", value: String(filteredExpenses.length), detail: `Statut: ${statusFilter === "ALL" ? "Tous" : statusFilter}` },
        { label: "Volume filtre", value: currency.format(filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)), detail: "Somme des depenses correspondant aux critères" },
        { label: "Période", value: periodLabel(expensePeriodFilter, expenseDateFrom, expenseDateTo, lang), detail: "Intervalle d'analyse applique au registre" },
        { label: "Taux approuve", value: formatPercent(ratioPercent(filteredExpenses.filter((expense) => expense.status === "APPROVED").length, filteredExpenses.length)), detail: "Dépenses approuvees / lignes filtrées" }
      ]
    );
  }

  function printAccountingReport() {
    printLedgerReport(
      "Journal comptable",
      "Vue consolidee des ecritures issues des depenses et de la paie.",
      ["Date", "Type", "Direction", "Titre", "Departement", "Montant", "Source"],
      filteredAccountingEntries.map((entry) => [
        new Date(entry.entryDate).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US"),
        entry.entryType,
        entry.direction,
        entry.title,
        entry.department || "",
        currency.format(entry.amount),
        entry.expense?.title || entry.payrollRun?.title || entry.payrollItem?.salarySlipNumber || ""
      ]),
      [
        { label: "Volume comptabilisé", value: currency.format(accountingMetrics.totalVolume), detail: "Somme totale des écritures reconnues" },
        { label: "Ticket moyen", value: currency.format(accountingMetrics.averageEntry), detail: "Moyenne = volume / nombre d'écritures" },
        { label: "Part paie", value: formatPercent(accountingMetrics.payrollWeight), detail: `Paie ${currency.format(accountingMetrics.payrollVolume)}` },
        { label: "Couverture documentaire", value: formatPercent(accountingMetrics.documentationCoverage), detail: `Dépenses documentées et traçables` }
      ]
    );
  }

  function printCashflowReport() {
    printLedgerReport(
      "Journal de trésorerie",
      `Vue consolidée des sorties et références de cash liées aux opérations financières. Période : ${periodLabel(cashflowPeriodFilter, cashflowDateFrom, cashflowDateTo, lang)}.`,
      ["Date", "Source", "Direction", "Méthode", "Montant", "Référence", "Notes"],
      filteredCashflowEntries.map((entry) => [
        new Date(entry.référenceDate).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US"),
        entry.sourceType,
        entry.direction,
        entry.method || "",
        currency.format(entry.amount),
        entry.expense?.title || entry.payrollRun?.title || entry.payrollItem?.salarySlipNumber || "",
        entry.notes || ""
      ]),
      [
        { label: "Sorties cumulées", value: currency.format(cashflowMetrics.totalOutflow), detail: "Somme des flux sortants enregistrés" },
        { label: "Ticket moyen sortie", value: currency.format(cashflowMetrics.averageOutflow), detail: "Moyenne des lignes OUTFLOW" },
        { label: "Part paie", value: formatPercent(cashflowMetrics.payrollShare), detail: `Paie ${currency.format(cashflowMetrics.payrollOutflow)}` },
        { label: "Couverture cash", value: `${cashflowMetrics.coverageRatio.toFixed(2)}x`, detail: "Cash disponible / sorties journalisées" }
      ]
    );
  }

  function printOperationsReport() {
    if (!overview) return;
    printLedgerReport(
      "Rapport général des opérations",
      "Document officiel EduPay consolidant dépenses, budgets, paie, comptabilité, trésorerie et pièces justificatives.",
      ["Module", "Lignes", "Volume / indicateur", "Observation"],
      [
        ["Dépenses", String(expenses.length), currency.format(overview.expenses.totalExpenses), `${expenseStats.pending} en attente`],
        ["Budgets", String(budgets.length), currency.format(budgets.reduce((sum, budget) => sum + budget.plannedAmount, 0)), `${budgets.filter((budget) => budget.status === "EXCEEDED").length} depassement(s)`],
        ["Paie", String(payrollRuns.length), currency.format(overview.payroll.totalPayroll), `${salaryProfiles.length} profil(s)`],
        ["Comptabilité", String(accountingEntries.length), currency.format(accountingMetrics.totalVolume), accountingMetrics.topDepartmentName],
        ["Trésorerie", String(cashflowEntries.length), currency.format(overview.cashflow.availableCash), `Variation ${currency.format(cashflowMetrics.netMovement)}`],
        ["Documents", String(documentEntries.length), String(documentEntries.length), "Pieces justificatives indexees"]
      ],
      [
        { label: "Cash disponible", value: currency.format(overview.cashflow.availableCash), detail: "Solde opérationnel après charges reconnues" },
        { label: "Passifs", value: currency.format(overview.liabilities.supplierDebt + overview.liabilities.payrollLiability), detail: "Fournisseurs et paie non soldes" },
        { label: "Approbations", value: String(overview.expenses.pendingApprovalSteps), detail: "Etapes de validation en attente" },
        { label: "Profit / perte", value: currency.format(overview.cashflow.profitLoss), detail: "Lecture consolidee EduPay" }
      ]
    );
  }

  function exportOperationsWorkbook() {
    if (!overview) return;
    exportLocalizedWorkbook(`pack-financier-opérations-${new Date().toISOString().slice(0, 10)}`, [
      {
        name: "Synthese",
        rows: [{
          "Dépenses": overview.expenses.totalExpenses,
          "Budgets": budgets.length,
          "Paies": payrollRuns.length,
          "Comptabilité": accountingEntries.length,
          "Trésorerie": cashflowEntries.length,
          "Documents": documentEntries.length,
          "Cash disponible": overview.cashflow.availableCash
        }]
      },
      {
        name: "Dépenses",
        rows: expenses.map((expense) => ({
          "Date": new Date(expense.expenseDate).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US"),
          "Titre": expense.title,
          "Departement": expense.department,
          "Categorie": expense.category.name,
          "Compte débité": expenseDebitAccountCode(expense),
          "Compte crédité": expenseCreditAccountCode(expense),
          "Statut": expense.status,
          "Montant": expense.amount,
          "Budget": expense.budget?.name || "",
          "Fournisseur": expense.vendor?.name || expense.supplierName || "",
          "Pieces": expense.attachments?.length || 0
        }))
      },
      {
        name: "Budgets",
        rows: budgets.map((budget) => ({
          "Nom": budget.name,
          "Departement": budget.department,
          "Planifie": budget.plannedAmount,
          "Consomme": budget.consumedAmount,
          "Reste": budget.remainingAmount,
          "Utilisation %": Number(budget.utilization.toFixed(2)),
          "Statut": budget.status
        }))
      },
      {
        name: "Paie",
        rows: payrollRuns.map((run) => ({
          "Run": run.title,
          "Departement": run.department || "Tous",
          "Frequence": run.frequency,
          "Statut": run.status,
          "Net": run.totalNet,
          "Deductions": run.totalDeductions,
          "Bulletins": run.items.length
        }))
      },
      {
        name: "Comptabilité",
        rows: accountingEntries.map((entry) => ({
          "Date": new Date(entry.entryDate).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US"),
          "Type": entry.entryType,
          "Direction": entry.direction,
          "Titre": entry.title,
          "Departement": entry.department || "",
          "Montant": entry.amount,
          "Source": entry.expense?.title || entry.payrollRun?.title || entry.payrollItem?.salarySlipNumber || ""
        }))
      },
      {
        name: "Trésorerie",
        rows: cashflowEntries.map((entry) => ({
          "Date": new Date(entry.référenceDate).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US"),
          "Source": entry.sourceType,
          "Direction": entry.direction,
          "Montant": entry.amount,
          "Méthode": entry.method || "",
          "Référence": entry.expense?.title || entry.payrollRun?.title || entry.payrollItem?.salarySlipNumber || "",
          "Notes": entry.notes || ""
        }))
      },
      {
        name: "Documents",
        rows: documentEntries.map((entry) => ({
          "Date": new Date(entry.expenseDate).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US"),
          "Document": entry.fileName,
          "Depense": entry.expenseTitle,
          "Departement": entry.department,
          "Statut": entry.status,
          "Type MIME": entry.mimeType || ""
        }))
      }
    ]);
  }

  async function handleCreateVendor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);
    setSuccess(null);
    setSubmittingKey("vendor");
    try {
      const created = await api<Vendor>("/api/expenses/vendors", { method: "POST", body: JSON.stringify(vendorForm) });
      setVendors((current) => [created, ...current]);
      setVendorForm(EMPTY_VENDOR_FORM);
      setActiveSubDialog(null);
      setSuccess("Fournisseur ajouté.");
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "Impossible de creer le fournisseur.");
    } finally {
      setSubmittingKey(null);
    }
  }

  function beginVendorEdit(vendor: Vendor) {
    setSelectedVendorId(vendor.id);
    setEditingVendorId(vendor.id);
    setVendorEditForm({
      name: vendor.name,
      contactName: vendor.contactName ?? "",
      phone: vendor.phone ?? "",
      email: vendor.email ?? "",
      address: vendor.address ?? "",
      notes: vendor.notes ?? ""
    });
  }

  async function handleUpdateVendor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingVendorId) return;
    setActionError(null);
    setSuccess(null);
    setSubmittingKey("vendor-update");
    try {
      const updated = await api<Vendor>(`/api/expenses/vendors/${editingVendorId}`, {
        method: "PUT",
        body: JSON.stringify(vendorEditForm)
      });
      setVendors((current) => current.map((vendor) => vendor.id === updated.id ? updated : vendor).sort((left, right) => left.name.localeCompare(right.name)));
      setSelectedVendorId(updated.id);
      setEditingVendorId(null);
      setVendorEditForm(EMPTY_VENDOR_FORM);
      setSuccess("Fournisseur modifié.");
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "Impossible de modifier le fournisseur.");
    } finally {
      setSubmittingKey(null);
    }
  }

  async function handleDeleteVendor(vendor: Vendor) {
    const usage = vendorUsage[vendor.id];
    const confirmed = window.confirm(`Supprimer ${vendor.name} ?${usage?.count ? ` ${usage.count} depense(s) seront conservees mais detachees de ce fournisseur.` : ""}`);
    if (!confirmed) return;
    setActionError(null);
    setSuccess(null);
    setSubmittingKey(`vendor-delete-${vendor.id}`);
    try {
      await api(`/api/expenses/vendors/${vendor.id}`, { method: "DELETE" });
      setVendors((current) => current.filter((item) => item.id !== vendor.id));
      setExpenses((current) => current.map((expense) => expense.vendor?.id === vendor.id ? { ...expense, vendor: null } : expense));
      if (selectedVendorId === vendor.id) setSelectedVendorId(null);
      if (editingVendorId === vendor.id) setEditingVendorId(null);
      setSuccess("Fournisseur supprimé sans effacer les dépenses historiques.");
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "Impossible de supprimer le fournisseur.");
    } finally {
      setSubmittingKey(null);
    }
  }

  async function handleCreateBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);
    setSuccess(null);
    setSubmittingKey("budget");
    try {
      const created = await api<Budget>("/api/expenses/budgets", {
        method: "POST",
        body: JSON.stringify({
          name: budgetForm.name,
          department: budgetForm.department,
          plannedAmount: Number(budgetForm.plannedAmount || 0),
          categoryId: budgetForm.categoryId || undefined,
          alertThreshold: Number(budgetForm.alertThreshold || 80),
          notes: budgetForm.notes
        })
      });
      setBudgets((current) => [created, ...current]);
      setBudgetForm(EMPTY_BUDGET_FORM);
      setActiveSubDialog(null);
      setSuccess("Budget enregistré.");
      await refreshOverview();
      await refreshLedgers();
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "Impossible de creer le budget.");
    } finally {
      setSubmittingKey(null);
    }
  }

  function openBudgetDialog() {
    setBudgetForm(EMPTY_BUDGET_FORM);
    setActiveSubDialog("budget-create");
  }

  async function handleCreateExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);
    setSuccess(null);
    setSubmittingKey("expense");
    try {
      const created = await api<Expense>("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          categoryId: expenseForm.categoryId,
          vendorId: expenseForm.vendorId || undefined,
          budgetId: expenseForm.budgetId || undefined,
          title: expenseForm.title,
          department: expenseForm.department,
          amount: Number(expenseForm.amount || 0),
          paymentMethod: expenseForm.paymentMethod,
          debitAccountCode: expenseForm.debitAccountCode,
          creditAccountCode: expenseForm.creditAccountCode,
          cashAccountCode: expenseForm.creditAccountCode,
          expenseDate: expenseForm.expenseDate,
          supplierName: expenseForm.beneficiaryName || expenseForm.supplierName,
          comments: buildBeneficiaryNotes(expenseForm),
          attachments: [
            ...(expenseForm.attachmentName && expenseForm.attachmentUrl
              ? [{ kind: "EXPENSE_SUPPORT", fileName: expenseForm.attachmentName, fileUrl: expenseForm.attachmentUrl }]
              : []),
            ...pendingAttachments.map((attachment) => ({
              kind: "EXPENSE_SUPPORT",
              fileName: attachment.fileName,
              fileUrl: attachment.fileUrl,
              mimeType: attachment.mimeType,
              notes: attachment.notes
            }))
          ]
        })
      });
      setExpenses((current) => [created, ...current]);
      setExpenseForm(EMPTY_EXPENSE_FORM);
      setPendingAttachments([]);
      setActiveSubDialog(null);
      setSuccess("Dépense soumise au workflow d'approbation.");
      await refreshOverview();
      await refreshLedgers();
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "Impossible de soumettre la depense.");
    } finally {
      setSubmittingKey(null);
    }
  }

  async function handleApproval(expenseId: string, status: "APPROVED" | "REJECTED") {
    setActionError(null);
    setSuccess(null);
    setSubmittingKey(`approval-${expenseId}-${status}`);
    try {
      const updated = await api<Expense>(`/api/expenses/${expenseId}/approval`, {
        method: "POST",
        body: JSON.stringify({ status })
      });
      setExpenses((current) => current.map((expense) => expense.id === expenseId ? updated : expense));
      setSuccess(status === "APPROVED" ? "Étape d'approbation validée." : "Dépense rejetée.");
      await refreshOverview();
      await refreshLedgers();
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "Impossible de traiter l'approbation.");
    } finally {
      setSubmittingKey(null);
    }
  }

  async function handleCancelExpense(expense: Expense) {
    const reason = window.prompt(
      expense.status === "APPROVED"
        ? "Motif de l'annulation. Une écriture inverse sera créée automatiquement :"
        : "Motif de l'annulation de cette opération :",
      "Annulation demandée"
    );
    if (reason === null) return;

    setActionError(null);
    setSuccess(null);
    setSubmittingKey(`cancel-${expense.id}`);
    try {
      const updated = await api<Expense>(`/api/expenses/${expense.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() || "Annulation demandée" })
      });
      setExpenses((current) => current.map((item) => item.id === expense.id ? updated : item));
      setSuccess(expense.status === "APPROVED"
        ? "Opération annulée : le débit et le crédit ont été inversés dans le journal."
        : "Opération annulée avant approbation.");
      await refreshOverview();
      await refreshLedgers();
    } catch (cancelError) {
      setActionError(cancelError instanceof Error ? cancelError.message : "Impossible d'annuler cette opération.");
    } finally {
      setSubmittingKey(null);
    }
  }

  async function handleCreateSalaryProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);
    setSuccess(null);
    setSubmittingKey("salary");
    try {
      const created = await api<SalaryProfile>("/api/expenses/payroll/profiles", {
        method: "POST",
        body: JSON.stringify({
          employeeCode: salaryForm.employeeCode,
          fullName: salaryForm.fullName,
          department: salaryForm.department,
          position: salaryForm.position,
          baseSalary: Number(salaryForm.baseSalary || 0),
          frequency: salaryForm.frequency || undefined,
          defaultBonus: salaryForm.defaultBonus === "" ? undefined : Number(salaryForm.defaultBonus),
          defaultDeduction: salaryForm.defaultDeduction === "" ? undefined : Number(salaryForm.defaultDeduction),
          debtRecoveryRate: salaryForm.debtRecoveryRate === "" ? undefined : Number(salaryForm.debtRecoveryRate),
          notes: salaryForm.notes
        })
      });
      setSalaryProfiles((current) => [created, ...current]);
      setSalaryForm(EMPTY_SALARY_FORM);
      setActiveSubDialog(null);
      setSuccess("Profil salarial ajouté.");
      await refreshOverview();
      await refreshLedgers();
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "Impossible de creer le profil salarial.");
    } finally {
      setSubmittingKey(null);
    }
  }

  function openSalaryProfileDialog() {
    setActiveTab("payroll");
    setActiveDialog("payroll");
    setActionError(null);
    setSuccess(null);
    setSalaryForm(EMPTY_SALARY_FORM);
    setActiveSubDialog("salary-profile-create");
  }

  function openPayrollRunDialog() {
    const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date());
    setActionError(null);
    setSuccess(null);
    setPayrollForm({
      ...EMPTY_PAYROLL_FORM,
      title: `Paie ${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)}`
    });
    setActiveSubDialog("payroll-run-create");
  }

  async function handleCreatePayrollRun(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);
    setSuccess(null);
    if (!activeSalaryProfiles.length) {
      setActionError("Ajoutez d'abord au moins un profil salarial actif avant de lancer la paie.");
      return;
    }
    if (!eligiblePayrollProfiles.length) {
      setActionError("Aucun profil salarial actif ne correspond au département sélectionné.");
      return;
    }
    setSubmittingKey("payroll");
    try {
      const created = await api<PayrollRun>("/api/expenses/payroll/runs", {
        method: "POST",
        body: JSON.stringify({
          title: payrollForm.title.trim(),
          department: payrollForm.department || undefined,
          frequency: payrollForm.frequency || undefined,
          notes: payrollForm.notes.trim() || undefined
        })
      });
      setPayrollRuns((current) => [created, ...current]);
      setPayrollForm(EMPTY_PAYROLL_FORM);
      if (created.items.length > 0) {
        setSelectedPayslip({ run: created, item: created.items[0] });
        setActiveSubDialog("payslip-preview");
      } else {
        setActiveSubDialog(null);
      }
      setSuccess(`${created.items.length} bulletin(s) de paie généré(s).`);
      await Promise.allSettled([refreshOverview(), refreshLedgers()]);
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "Impossible de lancer la paie.");
    } finally {
      setSubmittingKey(null);
    }
  }

  async function handleCreateEmployeeObligation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);
    setSuccess(null);
    if (!salaryProfiles.length) {
      setActionError("Ajoutez d'abord un profil salarial avant d'enregistrer une avance ou une dette.");
      return;
    }
    if (!employeeObligationForm.salaryProfileId) {
      setActionError("Selectionnez l'employe concerne par cette operation.");
      return;
    }
    setSubmittingKey("employee-obligation");
    try {
      const created = await api<EmployeeObligation>("/api/expenses/employee-finance/obligations", {
        method: "POST",
        body: JSON.stringify({
          salaryProfileId: employeeObligationForm.salaryProfileId,
          type: employeeObligationForm.type,
          title: employeeObligationForm.title,
          principalAmount: Number(employeeObligationForm.principalAmount || 0),
          currency: employeeObligationForm.currency || "USD",
          disbursementMethod: employeeObligationForm.disbursementMethod,
          repaymentMethod: employeeObligationForm.repaymentMethod,
          installmentAmount: Number(employeeObligationForm.installmentAmount || employeeObligationForm.principalAmount || 0),
          startDate: employeeObligationForm.startDate,
          dueDate: employeeObligationForm.dueDate,
          notes: employeeObligationForm.notes
        })
      });
      setEmployeeObligations((current) => [created, ...current]);
      setEmployeeObligationForm(EMPTY_EMPLOYEE_OBLIGATION_FORM);
      setActiveSubDialog(null);
      setSuccess(`Opération employé enregistrée. Reçu : ${created.receipt?.receiptNumber ?? "généré"}.`);
      await refreshOverview();
      await refreshLedgers();
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "Impossible d'enregistrer l'opération employé.");
    } finally {
      setSubmittingKey(null);
    }
  }

  async function handleRecordEmployeeRepayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);
    setSuccess(null);
    if (!openEmployeeRepayments.length) {
      setActionError("Aucune echeance ouverte n'est disponible pour un remboursement.");
      return;
    }
    if (!employeeRepaymentForm.repaymentId) {
      setActionError("Selectionnez l'echeance a encaisser.");
      return;
    }
    setSubmittingKey("employee-repayment");
    try {
      const updated = await api<EmployeeRepayment & { receipt?: { receiptNumber: string } | null }>(`/api/expenses/employee-finance/repayments/${employeeRepaymentForm.repaymentId}/pay`, {
        method: "POST",
        body: JSON.stringify({
          paidAmount: Number(employeeRepaymentForm.paidAmount || 0),
          paymentMethod: employeeRepaymentForm.paymentMethod,
          reference: employeeRepaymentForm.reference,
          notes: employeeRepaymentForm.notes
        })
      });
      await refreshEmployeeObligations();
      setEmployeeRepaymentForm(EMPTY_EMPLOYEE_REPAYMENT_FORM);
      setActiveSubDialog(null);
      setSuccess(`Remboursement enregistré. Reçu : ${updated.receipt?.receiptNumber ?? "généré"}.`);
      await refreshOverview();
      await refreshLedgers();
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "Impossible d'enregistrer le remboursement.");
    } finally {
      setSubmittingKey(null);
    }
  }

  if (error && !overview) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center px-4">
        <div className="glass max-w-xl rounded-2xl border border-red-500/20 p-8 text-center shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">{L("Opérations indisponibles", "Operations unavailable")}</p>
          <h1 className="mt-3 font-display text-3xl font-bold text-white">{L("Les opérations financières ne sont pas disponibles", "Financial Operations are unavailable")}</h1>
          <p className="mt-3 text-sm text-ink-dim">{error ?? L("Aucune donnée n'a été renvoyée.", "No data was returned.")}</p>
        </div>
      </div>
    );
  }

  const operationModules: Array<{
    value: OperationTab;
    title: string;
    description: string;
    count: number;
    metric: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: string;
  }> = [
    {
      value: "expenses",
      title: L("Dépenses", "Expenses"),
      description: L("Demandes, justificatifs, fournisseurs et validations.", "Requests, supporting documents, vendors and approvals."),
      count: expenses.length,
      metric: L(`${expenseStats.pending} en attente`, `${expenseStats.pending} pending`),
      icon: ReceiptText,
      tone: "border-red-400/20 bg-red-500/10 text-red-200"
    },
    {
      value: "budgets",
      title: L("Budgets", "Budgets"),
      description: L("Enveloppes par departement, seuils et consommation.", "Department envelopes, thresholds and usage."),
      count: budgets.length,
      metric: L(`${budgets.filter((budget) => budget.status === "EXCEEDED").length} dépassement(s)`, `${budgets.filter((budget) => budget.status === "EXCEEDED").length} overrun(s)`),
      icon: Landmark,
      tone: "border-cyan-400/20 bg-cyan-500/10 text-cyan-200"
    },
    {
      value: "payroll",
      title: L("Paie", "Payroll"),
      description: L("Profils salariaux, runs, bulletins et export.", "Salary profiles, runs, payslips and exports."),
      count: payrollRuns.length,
      metric: loading ? L("Chargement...", "Loading...") : currency.format(safeOverview.payroll.totalPayroll),
      icon: Users,
      tone: "border-brand-300/20 bg-brand-500/10 text-brand-100"
    },
    {
      value: "accounting",
      title: L("Comptabilité", "Accounting"),
      description: L("Journal général des charges et pièces sources.", "General expense ledger and source documents."),
      count: accountingEntries.length,
      metric: L("Écritures générées", "Generated entries"),
      icon: Landmark,
      tone: "border-violet-300/20 bg-violet-500/10 text-violet-100"
    },
    {
      value: "cashflow",
      title: L("Trésorerie", "Cash flow"),
      description: L("Mouvements de trésorerie, méthodes et solde disponible.", "Cash movements, methods and available balance."),
      count: cashflowEntries.length,
      metric: loading ? L("Chargement...", "Loading...") : currency.format(safeOverview.cashflow.availableCash),
      icon: CircleDollarSign,
      tone: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
    },
    {
      value: "documents",
      title: L("Documents", "Documents"),
      description: L("Pièces justificatives, ouverture et téléchargement.", "Supporting documents, opening and downloads."),
      count: documentEntries.length,
      metric: L(`${expenses.filter((expense) => (expense.attachments?.length ?? 0) > 0).length} dossier(s)`, `${expenses.filter((expense) => (expense.attachments?.length ?? 0) > 0).length} file(s)`),
      icon: BriefcaseBusiness,
      tone: "border-amber-300/20 bg-amber-500/10 text-amber-100"
    }
  ];
  const activeModule = operationModules.find((module) => module.value === activeDialog);
  const handleCloseOperationsDialog = () => {
    setActiveSubDialog(null);

    // When supporting documents are opened from the Expenses branch,
    // closing should return to Expenses instead of leaving Operations entirely.
    if (activeDialog === "expenses" && activeTab === "documents") {
      setActiveTab("expenses");
      return;
    }

    setActiveDialog(null);
  };

  return (
    <div className="edupay-operations space-y-6 pb-10 animate-fadeInUp">
      {loading && (
        <div className="rounded-2xl border border-brand-300/20 bg-brand-500/10 px-4 py-3 text-sm text-brand-100">
          {F("Chargement des données opérationnelles en arrière-plan. La page reste disponible pendant la synchronisation.", lang)}
        </div>
      )}
      <section className="glass min-w-0 border border-brand-300/15 px-4 py-5 shadow-xl sm:px-6 sm:py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">{L("Opérations financières EduPay", "EduPay Financial Operations")}</p>
            <h1 className="mt-2 font-display text-2xl font-bold text-white sm:text-3xl">{L("Centre opérationnel des dépenses, des budgets et de la paie", "Operational center for expenses, budgets and payroll")}</h1>
            <p className="mt-3 text-sm text-ink-dim">
              {L(
                "Cet espace complète le tableau financier avec les opérations exécutables : création de dépenses, fournisseurs, budgets, profils salariaux, cycles de paie et validation des sorties de trésorerie.",
                "This area complements the ERP cockpit with executable operations: expense creation, vendors, budgets, salary profiles, payroll runs and cash-out validation."
              )}
            </p>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:w-[380px]">
            <div className="min-w-0 rounded-2xl border border-brand-500/25 bg-brand-500/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-ink-dim">{L("Cash disponible", "Available cash")}</p>
              <p className="mt-1 font-display text-xl font-bold text-white sm:text-2xl">{currency.format(safeOverview.cashflow.availableCash)}</p>
            </div>
            <div className="min-w-0 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-ink-dim">{L("Étapes en attente", "Pending steps")}</p>
              <p className="mt-1 font-display text-xl font-bold text-white sm:text-2xl">{safeOverview.expenses.pendingApprovalSteps}</p>
            </div>
            <button onClick={printOperationsReport} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-300/25 bg-brand-500/10 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-500/20">
              <Printer className="h-4 w-4" /> {L("PDF / Imprimer", "PDF / Print")}
            </button>
            <button onClick={exportOperationsWorkbook} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-400/20">
              <Download className="h-4 w-4" /> {L("Exporter le pack Excel", "Export Excel pack")}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card glass border border-white/10 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-dim">{L("Dépenses", "Expenses")}</p>
              <p className="mt-3 font-display text-2xl font-bold text-white">{currency.format(safeOverview.expenses.totalExpenses)}</p>
              <p className="mt-2 text-xs text-ink-dim">{L(`${expenseStats.approved} approuvée(s), ${expenseStats.pending} en attente`, `${expenseStats.approved} approved, ${expenseStats.pending} pending`)}</p>
            </div>
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-red-300"><ReceiptText className="h-5 w-5" /></div>
          </div>
        </div>
        <div className="card glass border border-white/10 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-dim">{L("Budgets", "Budgets")}</p>
              <p className="mt-3 font-display text-2xl font-bold text-white">{budgets.length}</p>
              <p className="mt-2 text-xs text-ink-dim">{L(`${budgets.filter((budget) => budget.status === "EXCEEDED").length} en dépassement`, `${budgets.filter((budget) => budget.status === "EXCEEDED").length} over budget`)}</p>
            </div>
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-cyan-300"><Landmark className="h-5 w-5" /></div>
          </div>
        </div>
        <div className="card glass border border-white/10 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-dim">{L("Profils salariaux", "Salary profiles")}</p>
              <p className="mt-3 font-display text-2xl font-bold text-white">{salaryProfiles.length}</p>
              <p className="mt-2 text-xs text-ink-dim">{L(`${currency.format(safeOverview.payroll.totalPayroll)} de masse salariale`, `${currency.format(safeOverview.payroll.totalPayroll)} payroll mass`)}</p>
            </div>
            <div className="rounded-2xl border border-brand-500/30 bg-brand-500/10 p-3 text-brand-100"><Users className="h-5 w-5" /></div>
          </div>
        </div>
        <div className="card glass border border-white/10 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-dim">{L("Passifs", "Liabilities")}</p>
              <p className="mt-3 font-display text-2xl font-bold text-white">{currency.format(safeOverview.liabilities.supplierDebt + safeOverview.liabilities.payrollLiability)}</p>
              <p className="mt-2 text-xs text-ink-dim">{L("Obligations salariales et fournisseurs", "Payroll and supplier obligations")}</p>
            </div>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300"><AlertTriangle className="h-5 w-5" /></div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {operationModules.map((module) => {
          const Icon = module.icon;
          return (
            <button
              key={module.value}
              type="button"
              onClick={() => {
                openOperationsModule(module.value);
              }}
              className="group min-w-0 rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-left shadow-lg transition hover:border-brand-300/30 hover:bg-white/[0.075]"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${module.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center justify-between gap-3">
                    <span className="font-display text-xl font-bold text-white">{module.title}</span>
                    <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-ink-dim">{module.count}</span>
                  </span>
                  <span className="mt-2 block text-sm text-ink-dim">{module.description}</span>
                  <span className="mt-4 flex min-w-0 items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-brand-100">
                    <span>{module.metric}</span>
                    <span className="rounded-full border border-white/10 px-3 py-1 normal-case tracking-normal text-white group-hover:border-brand-300/30">{L("Ouvrir", "Open")}</span>
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </section>

      {!canWrite && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {F("Votre role est en lecture seule. Les formulaires de création restent masques, mais les journaux et statuts restent consultables.", lang)}
        </div>
      )}

      {actionError && <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{actionError}</div>}
      {success && <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</div>}

      {activeDialog && activeModule && (
        <OperationsDialog title={activeModule.title} subtitle={activeModule.description} onClose={handleCloseOperationsDialog}>
      {activeTab === "expenses" && (
        <div className="space-y-6">
          <SectionCard title={F("Plan comptable scolaire", lang)} subtitle="Référentiel complet des classes 1 à 9. Le compte débité ajoute le montant ; le compte crédité le soustrait, selon la convention EduPay.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {SCHOOL_ACCOUNT_CLASSES.map(([code, title, examples]) => (
                <div key={code} className={`rounded-2xl border p-4 ${["2", "3", "5", "6", "8"].includes(code) ? "border-brand-300/25 bg-brand-500/10" : "border-white/10 bg-slate-950/35"}`}>
                  <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 font-mono text-lg font-black text-white">{code}</span><div><p className="font-semibold text-white">{title}</p><p className="mt-1 text-xs text-ink-dim">{examples}</p></div></div>
                </div>
              ))}
            </div>
            <details className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <summary className="cursor-pointer font-semibold text-white">{F("Afficher les comptes clés du plan scolaire", lang)}</summary>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">{SCHOOL_KEY_ACCOUNTS.map(([group, accounts]) => <div key={group} className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><p className="font-semibold text-brand-100">{group}</p><div className="mt-3 flex flex-wrap gap-2">{accounts.map((account) => <span key={account} className="rounded-lg bg-slate-950/60 px-2.5 py-1.5 text-xs text-ink-dim">{account}</span>)}</div></div>)}</div>
            </details>
          </SectionCard>
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionCard title={F("Workflow des depenses", lang)} subtitle="Recherche, suivi de statut et traitement des approbations en cours.">
              <div className="grid gap-3 xl:grid-cols-[minmax(220px,0.9fr)_auto_auto_auto]">
                <SearchField value={search} onChange={(event) => setSearch(event.target.value)} placeholder={F("Recherche precise: motif, beneficiaire, service, mode...", lang)} />
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input min-w-[180px]">
                  <option value="ALL">{F("Tous les statuts", lang)}</option>
                  <option value="PENDING">{F("Pending", lang)}</option>
                  <option value="APPROVED">{F("Approved", lang)}</option>
                  <option value="REJECTED">{F("Rejected", lang)}</option>
                  <option value="CANCELLED">{F("Annulée", lang)}</option>
                </select>
                <select value={expensePeriodFilter} onChange={(event) => setExpensePeriodFilter(event.target.value)} className="input min-w-[180px]">
                  {PERIOD_FILTERS.map((period) => <option key={period.value} value={period.value}>{period.label}</option>)}
                </select>
                <div className="flex flex-wrap gap-2">
                  <button onClick={printExpensesReport} className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-300/25 bg-brand-500/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500/20">
                    <Printer className="h-4 w-4" /> PDF
                  </button>
                  <button onClick={exportExpensesExcel} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20">
                    <Download className="h-4 w-4" /> Excel
                  </button>
                </div>
              </div>
              {expensePeriodFilter === "CUSTOM" && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <DateSelect className="input"  value={expenseDateFrom} onChange={(event) => setExpenseDateFrom(event.target.value)} aria-label={F("Date debut depenses", lang)} />
                  <DateSelect className="input"  value={expenseDateTo} onChange={(event) => setExpenseDateTo(event.target.value)} aria-label={F("Date fin depenses", lang)} />
                </div>
              )}

              <div className="mt-5 space-y-3">
                {filteredExpenses.map((expense) => {
                  const currentStep = expense.approvalSteps.find((step) => step.status === "PENDING");
                  return (
                    <article key={expense.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{expense.title}</p>
                          <p className="mt-1 text-xs text-ink-dim">{expense.department} • {expense.category.accountCode || "-"} - {expense.category.name} • {new Date(expense.expenseDate).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US")}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge value={expense.status} />
                          <span className="font-mono text-sm font-bold text-white">{currency.format(expense.amount)}</span>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
                        <div>
                          <p className="text-ink-dim">{F("Écriture comptable", lang)}</p>
                          <p className="font-semibold text-white">{F("Débit", lang)} {expenseDebitAccountCode(expense) || "-"} {F("/ Crédit", lang)} {expenseCreditAccountCode(expense) || "-"}</p>
                        </div>
                        <div>
                          <p className="text-ink-dim">{F("Budget", lang)}</p>
                          <p className="font-semibold text-white">{expense.budget?.name ?? "Hors budget"}</p>
                        </div>
                        <div>
                          <p className="text-ink-dim">{F("Beneficiaire", lang)}</p>
                          <p className="font-semibold text-white">{expense.vendor?.name ?? expense.supplierName ?? "Non précisé"}</p>
                        </div>
                        <div>
                          <p className="text-ink-dim">{F("Mode / etape", lang)}</p>
                          <p className="font-semibold text-white">{expense.paymentMethod || "Mode non precise"} - {currentStep ? `${currentStep.role} / stage ${currentStep.stage}` : "Workflow termine"}</p>
                        </div>
                      </div>
                      {expense.comments && <p className="mt-3 text-sm text-ink-dim">{expense.comments}</p>}
                      {!!expense.attachments?.length && (
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-dim">
                          {expense.attachments.map((attachment) => (
                            <button
                              key={attachment.id}
                              onClick={() => openExpenseSupportDocument(attachment)}
                              className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 hover:border-brand-300/25 hover:text-white"
                            >
                              {F("Piece:", lang)} {attachment.fileName}
                            </button>
                          ))}
                        </div>
                      )}
                      {currentStep && canWrite && (
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            onClick={() => void handleApproval(expense.id, "APPROVED")}
                            disabled={submittingKey === `approval-${expense.id}-APPROVED`}
                            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {F("Valider l'etape", lang)}
                          </button>
                          <button
                            onClick={() => void handleApproval(expense.id, "REJECTED")}
                            disabled={submittingKey === `approval-${expense.id}-REJECTED`}
                            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-60"
                          >
                            {F("Rejeter", lang)}
                          </button>
                        </div>
                      )}
                      {canWrite && (expense.status === "PENDING" || expense.status === "APPROVED") && (
                        <div className="mt-4">
                          <button
                            onClick={() => void handleCancelExpense(expense)}
                            disabled={submittingKey === `cancel-${expense.id}`}
                            className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-60"
                          >
                            {F("Annuler l'opération", lang)}
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
                {!filteredExpenses.length && <p className="text-sm text-ink-dim">{F("Aucune dépense ne correspond au filtre actuel.", lang)}</p>}
              </div>
            </SectionCard>

            <SectionCard title={F("Arborescence des actions", lang)} subtitle="Choisissez une branche, puis travaillez dans une boite de dialogue dédiée.">
              <div className="grid gap-3">
                <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
                    <div>
                      <p className="font-semibold text-white">{F("Dépenses", lang)}</p>
                      <p className="mt-1 text-sm text-ink-dim">{F("Workflow principal: consulter, filtrer, valider ou rejeter les demandes.", lang)}</p>
                    </div>
                  </div>
                </div>
                {canWrite && (
                  <>
                    <ActionNodeCard
                      title={F("Nouvelle depense", lang)}
                      subtitle="Sortie de cash, budget, fournisseur et justificatifs."
                      detail={`${leafCategories.length} categories disponibles`}
                      icon={FilePlus2}
                      tone="border-red-400/25 bg-red-500/10 text-red-200"
                      onClick={() => setActiveSubDialog("expense-create")}
                    />
                    <ActionNodeCard
                      title={F("Nouveau fournisseur", lang)}
                      subtitle="Créer un tiers payable avant de lier une depense."
                      detail={`${vendors.length} fournisseurs actifs`}
                      icon={UserPlus}
                      tone="border-brand-300/25 bg-brand-500/10 text-brand-100"
                      onClick={() => setActiveSubDialog("vendor-create")}
                    />
                  </>
                )}
                <ActionNodeCard
                  title={F("Base fournisseurs", lang)}
                  subtitle="Voir, rechercher, modifier et supprimer les tiers payables."
                  detail={`${filteredVendors.length}/${vendors.length} fournisseur(s)`}
                  icon={Users}
                  tone="border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
                  onClick={() => setActiveSubDialog("vendor-registry")}
                />
                <ActionNodeCard
                  title={F("Justificatifs", lang)}
                  subtitle="Voir les pieces indexees dans la branche Documents."
                  detail={`${documentEntries.length} piece(s)`}
                  icon={BriefcaseBusiness}
                  tone="border-amber-300/25 bg-amber-500/10 text-amber-100"
                  onClick={() => setActiveTab("documents")}
                />
              </div>
            </SectionCard>
          </div>

          {activeSubDialog === "expense-create" && canWrite && (
            <OperationsSubDialog title={F("Nouvelle depense", lang)} subtitle="Soumettre une sortie de cash avec categorie, budget et piece justificative." onClose={() => setActiveSubDialog(null)}>
              <form className="grid gap-3" onSubmit={handleCreateExpense}>
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                      {F("Titre ou motif de la depense", lang)}
                      <input className="input" value={expenseForm.title} onChange={(event) => setExpenseForm((current) => ({ ...current, title: event.target.value }))} placeholder={F("Ex: Achat de fournitures", lang)} required />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                        {F("Catégorie de dépense", lang)}
                        <select className="input" value={expenseForm.categoryId} onChange={(event) => setExpenseForm((current) => ({ ...current, categoryId: event.target.value }))} required>
                          <option value="">{F("Choisir la catégorie analytique", lang)}</option>
                          {leafCategories.map((category) => <option key={category.id} value={category.id}>{category.accountCode} — {category.name}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                        {F("Budget associe", lang)}
                        <select className="input" value={expenseForm.budgetId} onChange={(event) => setExpenseForm((current) => ({ ...current, budgetId: event.target.value }))}>
                          <option value="">{F("Aucun budget li?", lang)}</option>
                          {budgets.map((budget) => <option key={budget.id} value={budget.id}>{budget.name}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                        {F("Compte à débiter — ajouter", lang)}
                        <select className="input" value={expenseForm.debitAccountCode} onChange={(event) => setExpenseForm((current) => ({ ...current, debitAccountCode: event.target.value }))} required>
                          <option value="">{F("Choisir le compte à débiter", lang)}</option>
                          {SCHOOL_ACCOUNT_OPTIONS.map((group) => (
                            <optgroup key={`debit-${group.group}`} label={group.group}>
                              {group.accounts.map((account) => <option key={`debit-${group.group}-${account.code}`} value={account.code}>{account.code} — {account.label}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                        {F("Compte à créditer — soustraire", lang)}
                        <select className="input" value={expenseForm.creditAccountCode} onChange={(event) => setExpenseForm((current) => ({ ...current, creditAccountCode: event.target.value }))} required>
                          <option value="">{F("Choisir le compte à créditer", lang)}</option>
                          {SCHOOL_ACCOUNT_OPTIONS.map((group) => (
                            <optgroup key={`credit-${group.group}`} label={group.group}>
                              {group.accounts.map((account) => <option key={`credit-${group.group}-${account.code}`} value={account.code}>{account.code} — {account.label}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                        {F("Beneficiaire repertorie", lang)}
                        <select className="input" value={expenseForm.vendorId} onChange={(event) => setExpenseForm((current) => ({ ...current, vendorId: event.target.value }))}>
                          <option value="">{F("Aucun beneficiaire existant", lang)}</option>
                          {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                        {F("Beneficiaire libre", lang)}
                        <input className="input" value={expenseForm.beneficiaryName} onChange={(event) => setExpenseForm((current) => ({ ...current, beneficiaryName: event.target.value, supplierName: event.target.value }))} placeholder={F("Nom de la personne, societe ou compte paye", lang)} />
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                        {F("Contact beneficiaire", lang)}
                        <input className="input" value={expenseForm.beneficiaryContact} onChange={(event) => setExpenseForm((current) => ({ ...current, beneficiaryContact: event.target.value }))} placeholder={F("Telephone, email ou contact", lang)} />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                        {F("Compte / wallet", lang)}
                        <input className="input" value={expenseForm.beneficiaryAccount} onChange={(event) => setExpenseForm((current) => ({ ...current, beneficiaryAccount: event.target.value }))} placeholder={F("IBAN, compte, MPESA, Airtel...", lang)} />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                        {F("Référence paiement", lang)}
                        <input className="input" value={expenseForm.beneficiaryRéférence} onChange={(event) => setExpenseForm((current) => ({ ...current, beneficiaryRéférence: event.target.value }))} placeholder={F("Cheque, facture, transaction", lang)} />
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                        {F("Departement", lang)}
                        <input className="input" value={expenseForm.department} onChange={(event) => setExpenseForm((current) => ({ ...current, department: event.target.value }))} placeholder={F("Ex: Administration, Transport, Academique", lang)} required />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                        {F("Montant", lang)}
                        <input className="input" type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} placeholder={F("Montant en USD", lang)} required />
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                        {F("Mode de paiement", lang)}
                        <select className="input" value={expenseForm.paymentMethod} onChange={(event) => setExpenseForm((current) => ({ ...current, paymentMethod: event.target.value }))}>
                          <option value="">{F("Non précisé", lang)}</option>
                          {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                        {F("Date de la depense", lang)}
                        <DateSelect className="input"  value={expenseForm.expenseDate} onChange={(event) => setExpenseForm((current) => ({ ...current, expenseDate: event.target.value }))} required />
                      </label>
                    </div>
                    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">{F("Prévisualisation de l'écriture", lang)}</p>
                      <p className="mt-2 text-xs text-cyan-100">{F("Convention EduPay : débiter ajoute le montant au compte ; créditer soustrait le montant du compte.", lang)}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2"><p className="rounded-xl bg-slate-950/40 p-3 text-white"><span className="text-ink-dim">{F("Débit · +", lang)} {expenseForm.amount || "0"}</span><br/><strong>{selectedDebitAccount?.code || "—"} · {selectedDebitAccount?.label || "Compte à débiter à sélectionner"}</strong></p><p className="rounded-xl bg-slate-950/40 p-3 text-white"><span className="text-ink-dim">{F("Crédit · −", lang)} {expenseForm.amount || "0"}</span><br/><strong>{selectedCreditAccount?.code || "—"} · {selectedCreditAccount?.label || "Compte à créditer à sélectionner"}</strong></p></div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                        {F("Nom de la piece", lang)}
                        <input className="input" value={expenseForm.attachmentName} onChange={(event) => setExpenseForm((current) => ({ ...current, attachmentName: event.target.value }))} placeholder={F("Ex: Facture, bon de livraison", lang)} />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                        {F("Référence document", lang)}
                        <input className="input" value={expenseForm.attachmentUrl} onChange={(event) => setExpenseForm((current) => ({ ...current, attachmentUrl: event.target.value }))} placeholder={F("URL, numéro ou référence interne", lang)} />
                      </label>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-dim">{F("Depot documentaire", lang)}</label>
                      <input
                        type="file"
                        multiple
                        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv"
                        onChange={handleAttachmentSelection}
                        className="mt-3 block w-full text-sm text-ink-dim file:mr-4 file:rounded-xl file:border-0 file:bg-brand-500/15 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-brand-500/25"
                      />
                      {!!pendingAttachments.length && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {pendingAttachments.map((attachment) => (
                            <button
                              type="button"
                              key={attachment.id}
                              onClick={() => removePendingAttachment(attachment.id)}
                              className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-ink-dim hover:text-white"
                            >
                              {attachment.fileName} ×
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                      {F("Commentaires", lang)}
                      <textarea className="input min-h-24" value={expenseForm.comments} onChange={(event) => setExpenseForm((current) => ({ ...current, comments: event.target.value }))} placeholder={F("Motif, periode concernee, validation attendue...", lang)} />
                    </label>
                    <button type="submit" disabled={submittingKey === "expense"} className="btn-primary justify-center px-5 py-3 text-sm font-semibold disabled:opacity-60">
                      {F("Soumettre la depense", lang)}
                    </button>
              </form>
            </OperationsSubDialog>
          )}

          {activeSubDialog === "vendor-create" && canWrite && (
            <OperationsSubDialog title={F("Nouveau fournisseur", lang)} subtitle="Créer un tiers payable pour les achats, abonnements et utilities." onClose={() => setActiveSubDialog(null)}>
              <form className="grid gap-3" onSubmit={handleCreateVendor}>
                    <input className="input" value={vendorForm.name} onChange={(event) => setVendorForm((current) => ({ ...current, name: event.target.value }))} placeholder={F("Nom fournisseur", lang)} required />
                    <input className="input" value={vendorForm.contactName} onChange={(event) => setVendorForm((current) => ({ ...current, contactName: event.target.value }))} placeholder={F("Personne contact", lang)} />
                    <InternationalPhoneInput value={vendorForm.phone} onChange={(value) => setVendorForm((current) => ({ ...current, phone: value }))} />
                    <input className="input" value={vendorForm.email} onChange={(event) => setVendorForm((current) => ({ ...current, email: event.target.value }))} placeholder={F("Email", lang)} />
                    <input className="input" value={vendorForm.address} onChange={(event) => setVendorForm((current) => ({ ...current, address: event.target.value }))} placeholder={F("Adresse", lang)} />
                    <textarea className="input min-h-20" value={vendorForm.notes} onChange={(event) => setVendorForm((current) => ({ ...current, notes: event.target.value }))} placeholder={F("Notes fournisseur", lang)} />
                    <button type="submit" disabled={submittingKey === "vendor"} className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-500/20 disabled:opacity-60">
                      {F("Ajouter le fournisseur", lang)}
                    </button>
              </form>
            </OperationsSubDialog>
          )}

          {activeSubDialog === "vendor-registry" && (
            <OperationsSubDialog title={F("Base fournisseurs", lang)} subtitle="Registre consultable des tiers payables, avec lecture, modification, suppression et recherche strategique." onClose={() => { setActiveSubDialog(null); setEditingVendorId(null); }}>
              <div className="grid gap-4">
                <SearchField
                  value={vendorSearch}
                  onChange={(event) => setVendorSearch(event.target.value)}
                  placeholder={F("Recherche fournisseur, contact, telephone, email, departement, montant ou note", lang)}
                />
                <div className="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
                  <div className="max-h-[56vh] space-y-2 overflow-auto pr-1">
                    {filteredVendors.map((vendor) => {
                      const usage = vendorUsage[vendor.id];
                      const isSelected = selectedVendorId === vendor.id;
                      return (
                        <div key={vendor.id} className={`rounded-2xl border p-3 transition ${isSelected ? "border-brand-300/40 bg-brand-500/10" : "border-white/10 bg-slate-950/35 hover:border-white/20"}`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">{vendor.name}</p>
                              <p className="mt-1 text-xs text-ink-dim">{vendor.contactName || vendor.phone || vendor.email || "Contact non renseigne"}</p>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-ink-dim">{usage?.count ?? 0} {F("depense(s)", lang)}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" onClick={() => { setSelectedVendorId(vendor.id); setEditingVendorId(null); }} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/10">
                              <Eye className="h-3.5 w-3.5" /> {F("Voir", lang)}
                            </button>
                            {canWrite && (
                              <>
                                <button type="button" onClick={() => beginVendorEdit(vendor)} className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20">
                                  <Pencil className="h-3.5 w-3.5" /> {F("Modifier", lang)}
                                </button>
                                <button type="button" disabled={submittingKey === `vendor-delete-${vendor.id}`} onClick={() => void handleDeleteVendor(vendor)} className="inline-flex items-center gap-1 rounded-lg border border-red-300/20 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-60">
                                  <Trash2 className="h-3.5 w-3.5" /> {F("Supprimer", lang)}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {!filteredVendors.length && <p className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-ink-dim">{F("Aucun fournisseur ne correspond a cette recherche.", lang)}</p>}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    {editingVendorId ? (
                      <form className="grid gap-3" onSubmit={handleUpdateVendor}>
                        <p className="text-sm font-semibold text-white">{F("Modification fournisseur", lang)}</p>
                        <input className="input" value={vendorEditForm.name} onChange={(event) => setVendorEditForm((current) => ({ ...current, name: event.target.value }))} placeholder={F("Nom fournisseur", lang)} required />
                        <input className="input" value={vendorEditForm.contactName} onChange={(event) => setVendorEditForm((current) => ({ ...current, contactName: event.target.value }))} placeholder={F("Personne contact", lang)} />
                        <InternationalPhoneInput value={vendorEditForm.phone} onChange={(value) => setVendorEditForm((current) => ({ ...current, phone: value }))} />
                        <input className="input" value={vendorEditForm.email} onChange={(event) => setVendorEditForm((current) => ({ ...current, email: event.target.value }))} placeholder={F("Email", lang)} />
                        <input className="input" value={vendorEditForm.address} onChange={(event) => setVendorEditForm((current) => ({ ...current, address: event.target.value }))} placeholder={F("Adresse", lang)} />
                        <textarea className="input min-h-24" value={vendorEditForm.notes} onChange={(event) => setVendorEditForm((current) => ({ ...current, notes: event.target.value }))} placeholder={F("Notes fournisseur", lang)} />
                        <div className="flex flex-wrap gap-2">
                          <button type="submit" disabled={submittingKey === "vendor-update"} className="btn-primary px-4 py-2 text-sm font-semibold disabled:opacity-60">{F("Enregistrer", lang)}</button>
                          <button type="button" onClick={() => setEditingVendorId(null)} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">{F("Annuler", lang)}</button>
                        </div>
                      </form>
                    ) : selectedVendor ? (
                      <div className="grid gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-dim">{F("Fiche fournisseur", lang)}</p>
                          <h3 className="mt-1 text-2xl font-bold text-white">{selectedVendor.name}</h3>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <InfoPill label="Contact" value={selectedVendor.contactName || "Non renseigne"} />
                          <InfoPill label="Telephone" value={selectedVendor.phone || "Non renseigne"} />
                          <InfoPill label="Email" value={selectedVendor.email || "Non renseigne"} />
                          <InfoPill label="Adresse" value={selectedVendor.address || "Non renseigne"} />
                          <InfoPill label="Dépenses liees" value={String(vendorUsage[selectedVendor.id]?.count ?? 0)} />
                          <InfoPill label="Volume total" value={currency.format(vendorUsage[selectedVendor.id]?.total ?? 0)} />
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">{F("Departements touches", lang)}</p>
                          <p className="mt-2 text-sm text-white">{vendorUsage[selectedVendor.id] ? Array.from(vendorUsage[selectedVendor.id].departments).join(", ") : "Aucun historique"}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">{F("Notes", lang)}</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-ink-dim">{selectedVendor.notes || "Aucune note."}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-ink-dim">{F("Sélectionnez un fournisseur pour afficher sa fiche détaillée.", lang)}</p>
                    )}
                  </div>
                </div>
              </div>
            </OperationsSubDialog>
          )}
        </div>
      )}

      {activeTab === "budgets" && (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          {canWrite && (
            <SectionCard title={F("Arborescence budgétaire", lang)} subtitle="Les actions d'écriture s'ouvrent dans une boîte dédiée, le suivi reste visible.">
              <div className="grid gap-3">
                <ActionNodeCard
                  title={F("Nouveau budget", lang)}
                  subtitle="Planifier une enveloppe avec departement, categorie et seuil."
                  detail={`${budgets.length} budget(s) existant(s)`}
                  icon={WalletCards}
                  tone="border-cyan-400/25 bg-cyan-500/10 text-cyan-200"
                  onClick={openBudgetDialog}
                />
                <ActionNodeCard
                  title={F("Dépenses liées", lang)}
                  subtitle="Retourner vers le workflow pour relier les budgets aux sorties."
                  detail={`${expenseStats.pending} validation(s)`}
                  icon={ReceiptText}
                  tone="border-red-400/25 bg-red-500/10 text-red-200"
                  onClick={() => setActiveTab("expenses")}
                />
              </div>
            </SectionCard>
          )}

          <SectionCard title={F("Pilotage budgetaire", lang)} subtitle="Lecture planned vs actual, taux de consommation et depassements detectes.">
            <div className="space-y-3">
              {budgets.map((budget) => (
                <article key={budget.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{budget.name}</p>
                      <p className="mt-1 text-xs text-ink-dim">{budget.department} • {budget.period?.name ?? "Période active"} • {budget.category?.name ?? "Budget global"}</p>
                    </div>
                    <StatusBadge value={budget.status} />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
                    <div>
                      <p className="text-ink-dim">{F("Prevu", lang)}</p>
                      <p className="font-semibold text-white">{currency.format(budget.plannedAmount)}</p>
                    </div>
                    <div>
                      <p className="text-ink-dim">{F("Consomme", lang)}</p>
                      <p className="font-semibold text-amber-200">{currency.format(budget.consumedAmount)}</p>
                    </div>
                    <div>
                      <p className="text-ink-dim">{F("Reste", lang)}</p>
                      <p className="font-semibold text-emerald-300">{currency.format(budget.remainingAmount)}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className={`h-full rounded-full ${budget.utilization >= 100 ? "bg-gradient-to-r from-red-500 to-orange-400" : "bg-gradient-to-r from-brand-500 to-cyan-400"}`} style={{ width: `${Math.min(100, Math.max(0, budget.utilization))}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-ink-dim">{F("Utilisation:", lang)} {budget.utilization.toFixed(1)}%</p>
                </article>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "payroll" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-6">
            {canWrite && (
              <SectionCard title={F("Arborescence paie", lang)} subtitle="Separez les profils RH du lancement de paie pour garder la lecture claire.">
                <div className="grid gap-3">
                  <ActionNodeCard
                    title={F("Profil salarial", lang)}
                    subtitle="Base salariale, bonus, deductions et recovery rate."
                    detail={`${salaryProfiles.length} profil(s) actif(s)`}
                    icon={Users}
                    tone="border-brand-300/25 bg-brand-500/10 text-brand-100"
                    onClick={openSalaryProfileDialog}
                  />
                  <ActionNodeCard
                    title={F("Lancer une paie", lang)}
                    subtitle="Générer un run depuis les profils salariaux actifs."
                    detail={`${payrollRuns.length} run(s)`}
                    icon={CircleDollarSign}
                    tone="border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
                    onClick={openPayrollRunDialog}
                  />
                  <ActionNodeCard
                    title={F("Avance sur salaire", lang)}
                    subtitle="Décaisser une avance à un employé et générer le reçu."
                    detail={currency.format(employeeFinanceTotals.advances)}
                    icon={WalletCards}
                    tone="border-cyan-300/25 bg-cyan-500/10 text-cyan-100"
                    onClick={() => openEmployeeObligationDialog("SALARY_ADVANCE")}
                  />
                  <ActionNodeCard
                    title={F("Dette employé", lang)}
                    subtitle="Enregistrer une dette ou une obligation envers l'école."
                    detail={currency.format(employeeFinanceTotals.debts)}
                    icon={FilePlus2}
                    tone="border-amber-300/25 bg-amber-500/10 text-amber-100"
                    onClick={() => openEmployeeObligationDialog("SCHOOL_DEBT")}
                  />
                  <ActionNodeCard
                    title={F("Remboursement", lang)}
                    subtitle="Encaisser une échéance et produire un reçu de paiement."
                    detail={`${openEmployeeRepayments.length} échéance(s) ouverte(s)`}
                    icon={ReceiptText}
                    tone="border-violet-300/25 bg-violet-500/10 text-violet-100"
                    onClick={openEmployeeRepaymentDialog}
                  />
                </div>
              </SectionCard>
            )}

            <SectionCard title={F("Profils actifs", lang)} subtitle="Base des salaries utilises pour calculer la paie institutionnelle.">
              <div className="space-y-3">
                {salaryProfiles.map((profile) => (
                  <div key={profile.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{profile.fullName}</p>
                        <p className="mt-1 text-xs text-ink-dim">{profile.position} • {profile.department} • {labelizeFrequency(profile.frequency, lang)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-bold text-white">{currency.format(profile.baseSalary)}</p>
                        <p className="text-xs text-ink-dim">{profile.employeeCode}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
            <SectionCard title={F("Finance employé", lang)} subtitle="Avances, dettes, remboursements et reçus liés à la paie.">
              <div className="grid gap-3 sm:grid-cols-3">
                <InfoPill label="Solde ouvert" value={currency.format(employeeFinanceTotals.totalBalance)} />
                <InfoPill label="Avances" value={currency.format(employeeFinanceTotals.advances)} />
                <InfoPill label="Dettes" value={currency.format(employeeFinanceTotals.debts)} />
              </div>
              <div className="mt-4 space-y-3">
                {employeeObligations.slice(0, 5).map((obligation) => (
                  <div key={obligation.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{obligation.title}</p>
                        <p className="mt-1 text-xs text-ink-dim">
                          {obligation.salaryProfile?.fullName ?? salaryProfiles.find((profile) => profile.id === obligation.salaryProfileId)?.fullName ?? "Employé"} • {dynamicFinancialLabel(obligation.type, lang)} • {dynamicFinancialLabel(obligation.status, lang)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-bold text-white">{currency.format(Number(obligation.balance || 0))}</p>
                        <p className="text-xs text-ink-dim">{obligation.receipt?.receiptNumber ?? "Reçu disponible après création"}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {!employeeObligations.length && <p className="text-sm text-ink-dim">{F("Aucune avance, dette ou échéance employé n'est encore enregistrée.", lang)}</p>}
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard title={F("Fiches de paie disponibles", lang)} subtitle="Chaque salarié d'un run possède ici son bulletin consultable, imprimable en PDF et exportable en Excel.">
              <div className="space-y-3">
                {payrollRuns.map((run) => (
                  <article key={run.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{run.title}</p>
                        <p className="mt-1 text-xs text-ink-dim">{run.department || "Tous departements"} • {run.period?.name ?? "Période active"} • {labelizeFrequency(run.frequency, lang)}</p>
                      </div>
                      <StatusBadge value={run.status} />
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
                      <div>
                        <p className="text-ink-dim">{F("Net", lang)}</p>
                        <p className="font-semibold text-white">{currency.format(run.totalNet)}</p>
                      </div>
                      <div>
                        <p className="text-ink-dim">{F("Deductions", lang)}</p>
                        <p className="font-semibold text-amber-200">{currency.format(run.totalDeductions)}</p>
                      </div>
                      <div>
                        <p className="text-ink-dim">{F("Bulletins", lang)}</p>
                        <p className="font-semibold text-cyan-200">{run.items.length}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2">
                      {run.items.map((item) => (
                        <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{item.salaryProfile.fullName}</p>
                            <p className="mt-1 text-xs text-ink-dim">{item.salarySlipNumber} {F("• Net", lang)} {currency.format(item.netSalary)}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openPayslipPreview(run, item)}
                            className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
                          >
                            <Eye className="h-3.5 w-3.5" /> {F("Bulletin de paie", lang)}
                          </button>
                          <button
                            type="button"
                            onClick={() => printSalarySlip(run, item)}
                            className="inline-flex items-center gap-1 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-500/20"
                          >
                            <Printer className="h-3.5 w-3.5" /> {F("Imprimer / PDF", lang)}
                          </button>
                          <button
                            type="button"
                            onClick={() => exportSalarySlipExcel(run, item)}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
                          >
                            <Download className="h-3.5 w-3.5" /> Excel
                          </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
                {!payrollRuns.length && <p className="text-sm text-ink-dim">{F("Aucun run de paie généré pour l'instant.", lang)}</p>}
              </div>
            </SectionCard>
          </div>

          {activeSubDialog === "salary-profile-create" && canWrite && (
            <OperationsSubDialog title={F("Profil salarial", lang)} subtitle="Créer un profil de paie clair, sans valeurs injectées d'avance, pour les futurs runs." onClose={() => setActiveSubDialog(null)}>
              <form className="grid gap-5" onSubmit={handleCreateSalaryProfile}>
                <div className="rounded-2xl border border-brand-300/15 bg-brand-500/10 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-200">{F("Profil de rémunération", lang)}</p>
                  <p className="mt-2 text-sm text-ink-dim">{F("Renseignez explicitement les champs utiles. Les éléments optionnels laissés vides seront gérés par défaut côté système.", lang)}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {F("Code employé", lang)}
                    <input className="input" value={salaryForm.employeeCode} onChange={(event) => setSalaryForm((current) => ({ ...current, employeeCode: event.target.value }))} placeholder={F("Ex: EMP-ACAD-004", lang)} required />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {F("Nom complet", lang)}
                    <input className="input" value={salaryForm.fullName} onChange={(event) => setSalaryForm((current) => ({ ...current, fullName: event.target.value }))} placeholder={F("Ex: Grâce Mukendi", lang)} required />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {F("Département", lang)}
                    <input className="input" value={salaryForm.department} onChange={(event) => setSalaryForm((current) => ({ ...current, department: event.target.value }))} placeholder={F("Ex: Académique", lang)} required />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {F("Poste", lang)}
                    <input className="input" value={salaryForm.position} onChange={(event) => setSalaryForm((current) => ({ ...current, position: event.target.value }))} placeholder={F("Ex: Enseignant de mathématiques", lang)} required />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {F("Salaire de base", lang)}
                    <input className="input" type="number" min="0" step="0.01" value={salaryForm.baseSalary} onChange={(event) => setSalaryForm((current) => ({ ...current, baseSalary: event.target.value }))} placeholder={F("Ex: 450", lang)} required />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {F("Fréquence de paie", lang)}
                    <select className="input" value={salaryForm.frequency} onChange={(event) => setSalaryForm((current) => ({ ...current, frequency: event.target.value }))}>
                      <option value="">{F("Laisser le système appliquer le mensuel par défaut", lang)}</option>
                      {PAYROLL_FREQUENCIES.map((frequency) => <option key={frequency} value={frequency}>{labelizeFrequency(frequency, lang)}</option>)}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {F("Bonus par défaut", lang)}
                    <input className="input" type="number" min="0" step="0.01" value={salaryForm.defaultBonus} onChange={(event) => setSalaryForm((current) => ({ ...current, defaultBonus: event.target.value }))} placeholder={F("Ex: 25", lang)} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {F("Déduction par défaut", lang)}
                    <input className="input" type="number" min="0" step="0.01" value={salaryForm.defaultDeduction} onChange={(event) => setSalaryForm((current) => ({ ...current, defaultDeduction: event.target.value }))} placeholder={F("Ex: 15", lang)} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {F("Taux de recouvrement (%)", lang)}
                    <input className="input" type="number" min="0" max="100" step="0.01" value={salaryForm.debtRecoveryRate} onChange={(event) => setSalaryForm((current) => ({ ...current, debtRecoveryRate: event.target.value }))} placeholder={F("Ex: 5", lang)} />
                  </label>
                </div>

                <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                  {F("Notes RH", lang)}
                  <textarea className="input min-h-24" value={salaryForm.notes} onChange={(event) => setSalaryForm((current) => ({ ...current, notes: event.target.value }))} placeholder={F("Informations utiles sur ce profil salarial", lang)} />
                </label>

                <div className="flex flex-wrap justify-end gap-3">
                  <button type="button" onClick={() => setActiveSubDialog(null)} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white hover:border-brand-300/30 hover:bg-brand-500/10">
                    {F("Annuler", lang)}
                  </button>
                  <button type="submit" disabled={submittingKey === "salary"} className="btn-primary justify-center px-5 py-3 text-sm font-semibold disabled:opacity-60">
                    {F("Ajouter le profil salarial", lang)}
                  </button>
                </div>
              </form>
            </OperationsSubDialog>
          )}

          {activeSubDialog === "payroll-run-create" && canWrite && (
            <OperationsSubDialog title={F("Générer la paie", lang)} subtitle="Calcule la paie, crée les écritures et produit immédiatement une fiche par salarié." onClose={() => setActiveSubDialog(null)}>
              <form className="grid gap-4" onSubmit={handleCreatePayrollRun}>
                {actionError && <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{actionError}</div>}
                <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                  {F("Intitulé de la paie", lang)}
                  <input className="input" value={payrollForm.title} onChange={(event) => setPayrollForm((current) => ({ ...current, title: event.target.value }))} placeholder={F("Ex : Paie Août 2026", lang)} required />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {F("Département", lang)}
                    <select className="input" value={payrollForm.department} onChange={(event) => setPayrollForm((current) => ({ ...current, department: event.target.value }))}>
                      <option value="">{F("Tous les départements", lang)}</option>
                      {payrollDepartments.map((department) => <option key={department} value={department}>{department}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {F("Fréquence", lang)}
                    <select className="input" value={payrollForm.frequency} onChange={(event) => setPayrollForm((current) => ({ ...current, frequency: event.target.value }))}>
                      {PAYROLL_FREQUENCIES.map((frequency) => <option key={frequency} value={frequency}>{labelizeFrequency(frequency, lang)}</option>)}
                    </select>
                  </label>
                </div>
                <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                  {eligiblePayrollProfiles.length} {F("salarié(s) actif(s) seront inclus et recevront chacun une fiche de paie.", lang)}
                </div>
                <textarea className="input min-h-24" value={payrollForm.notes} onChange={(event) => setPayrollForm((current) => ({ ...current, notes: event.target.value }))} placeholder={F("Notes du run", lang)} />
                <button type="submit" disabled={submittingKey === "payroll" || !eligiblePayrollProfiles.length} className="btn-primary justify-center px-5 py-3 text-sm font-semibold disabled:opacity-60">
                  {submittingKey === "payroll" ? "Génération en cours..." : `Générer la paie et ${eligiblePayrollProfiles.length} fiche(s)`}
                </button>
              </form>
            </OperationsSubDialog>
          )}
          {activeSubDialog === "payslip-preview" && selectedPayslip && (
            <OperationsSubDialog
              title={`Bulletin de paie • ${selectedPayslip.item.salaryProfile.fullName}`}
              subtitle={`${selectedPayslip.item.salarySlipNumber} • ${selectedPayslip.run.period?.name ?? "Période active"}`}
              onClose={() => { setActiveSubDialog(null); setSelectedPayslip(null); }}
            >
              <div className="grid gap-5">
                <div className="rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-500/15 to-blue-600/10 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">{F("Bulletin de paie officiel", lang)}</p>
                      <h4 className="mt-2 font-display text-2xl font-bold text-white">{selectedPayslip.item.salaryProfile.fullName}</h4>
                      <p className="mt-1 text-sm text-ink-dim">{selectedPayslip.item.salaryProfile.employeeCode} • {selectedPayslip.item.salaryProfile.position} • {selectedPayslip.item.salaryProfile.department}</p>
                    </div>
                    <StatusBadge value={selectedPayslip.run.status} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Salaire de base", value: currency.format(selectedPayslip.item.baseSalary), tone: "text-white" },
                    { label: "Primes et bonus", value: currency.format(selectedPayslip.item.bonuses), tone: "text-emerald-200" },
                    { label: "Total retenues", value: currency.format(Number(selectedPayslip.item.deductions || 0) + Number(selectedPayslip.item.advancesRecovered || 0) + Number(selectedPayslip.item.debtRecovered || 0)), tone: "text-amber-200" },
                    { label: "Net à payer", value: currency.format(selectedPayslip.item.netSalary), tone: "text-cyan-200" }
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">{metric.label}</p>
                      <p className={`mt-2 text-lg font-black ${metric.tone}`}>{metric.value}</p>
                    </div>
                  ))}
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-white/10">
                      <tr><td className="px-4 py-3 text-ink-dim">{F("Salaire brut", lang)}</td><td className="px-4 py-3 text-right font-semibold text-white">{currency.format(Number(selectedPayslip.item.baseSalary || 0) + Number(selectedPayslip.item.bonuses || 0))}</td></tr>
                      <tr><td className="px-4 py-3 text-ink-dim">{F("Retenues ordinaires", lang)}</td><td className="px-4 py-3 text-right font-semibold text-amber-200">{currency.format(selectedPayslip.item.deductions)}</td></tr>
                      <tr><td className="px-4 py-3 text-ink-dim">{F("Avances récupérées", lang)}</td><td className="px-4 py-3 text-right font-semibold text-amber-200">{currency.format(selectedPayslip.item.advancesRecovered)}</td></tr>
                      <tr><td className="px-4 py-3 text-ink-dim">{F("Dettes récupérées", lang)}</td><td className="px-4 py-3 text-right font-semibold text-amber-200">{currency.format(selectedPayslip.item.debtRecovered)}</td></tr>
                      <tr className="bg-cyan-500/10"><td className="px-4 py-4 font-bold text-white">{F("Net à payer", lang)}</td><td className="px-4 py-4 text-right text-lg font-black text-cyan-200">{currency.format(selectedPayslip.item.netSalary)}</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <button type="button" onClick={() => exportSalarySlipExcel(selectedPayslip.run, selectedPayslip.item)} className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20">
                    <Download className="h-4 w-4" /> {F("Exporter Excel", lang)}
                  </button>
                  <button type="button" onClick={() => printSalarySlip(selectedPayslip.run, selectedPayslip.item)} className="btn-primary justify-center px-5 py-3 text-sm font-semibold">
                    <Printer className="h-4 w-4" /> {F("Imprimer / enregistrer en PDF", lang)}
                  </button>
                </div>
              </div>
            </OperationsSubDialog>
          )}
          {(activeSubDialog === "employee-advance-create" || activeSubDialog === "employee-debt-create") && canWrite && (
            <OperationsSubDialog
              title={activeSubDialog === "employee-advance-create" ? "Avance sur salaire" : "Dette employé"}
              subtitle="Cette opération crée une écriture comptable, une ligne de trésorerie et un reçu."
              onClose={() => setActiveSubDialog(null)}
            >
              <form className="grid gap-5" onSubmit={handleCreateEmployeeObligation}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {F("Employé", lang)}
                    <select className="input" value={employeeObligationForm.salaryProfileId} onChange={(event) => setEmployeeObligationForm((current) => ({ ...current, salaryProfileId: event.target.value }))} required>
                      <option value="">{F("Sélectionner un profil salarial", lang)}</option>
                      {salaryProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>{profile.fullName} - {profile.employeeCode}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {F("Type", lang)}
                    <select className="input" value={employeeObligationForm.type} onChange={(event) => setEmployeeObligationForm((current) => ({ ...current, type: event.target.value }))}>
                      <option value="SALARY_ADVANCE">{F("Avance sur salaire", lang)}</option>
                      <option value="SCHOOL_DEBT">{F("Dette envers l'école", lang)}</option>
                      <option value="OTHER_DEBT">{F("Autre dette", lang)}</option>
                    </select>
                  </label>
                </div>

                <input className="input" value={employeeObligationForm.title} onChange={(event) => setEmployeeObligationForm((current) => ({ ...current, title: event.target.value }))} placeholder={F("Titre de l'opération", lang)} required />

                <div className="grid gap-4 sm:grid-cols-3">
                  <input className="input" type="number" min="0" step="0.01" value={employeeObligationForm.principalAmount} onChange={(event) => setEmployeeObligationForm((current) => ({ ...current, principalAmount: event.target.value }))} placeholder={F("Montant", lang)} required />
                  <input className="input" type="number" min="0" step="0.01" value={employeeObligationForm.installmentAmount} onChange={(event) => setEmployeeObligationForm((current) => ({ ...current, installmentAmount: event.target.value }))} placeholder={F("Échéance", lang)} required />
                  <select className="input" value={employeeObligationForm.disbursementMethod} onChange={(event) => setEmployeeObligationForm((current) => ({ ...current, disbursementMethod: event.target.value }))}>
                    {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <select className="input" value={employeeObligationForm.repaymentMethod} onChange={(event) => setEmployeeObligationForm((current) => ({ ...current, repaymentMethod: event.target.value }))}>
                    <option value="SALARY_DEDUCTION">{F("Déduction sur salaire", lang)}</option>
                    <option value="EXTERNAL_PAYMENT">{F("Paiement hors salaire", lang)}</option>
                    <option value="MIXED">{F("Mixte", lang)}</option>
                  </select>
                  <DateSelect className="input"  value={employeeObligationForm.startDate} onChange={(event) => setEmployeeObligationForm((current) => ({ ...current, startDate: event.target.value }))} required />
                  <DateSelect className="input"  value={employeeObligationForm.dueDate} onChange={(event) => setEmployeeObligationForm((current) => ({ ...current, dueDate: event.target.value }))} required />
                </div>

                <textarea className="input min-h-24" value={employeeObligationForm.notes} onChange={(event) => setEmployeeObligationForm((current) => ({ ...current, notes: event.target.value }))} placeholder={F("Notes de validation, motif ou référence interne", lang)} />

                <div className="flex flex-wrap justify-end gap-3">
                  <button type="button" onClick={() => setActiveSubDialog(null)} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white hover:border-brand-300/30 hover:bg-brand-500/10">
                    {F("Annuler", lang)}
                  </button>
                  <button type="submit" disabled={submittingKey === "employee-obligation"} className="btn-primary justify-center px-5 py-3 text-sm font-semibold disabled:opacity-60">
                    {F("Enregistrer et générer le reçu", lang)}
                  </button>
                </div>
              </form>
            </OperationsSubDialog>
          )}

          {activeSubDialog === "employee-repayment-create" && canWrite && (
            <OperationsSubDialog title={F("Remboursement employé", lang)} subtitle="Encaisser une échéance ouverte et générer le reçu de paiement." onClose={() => setActiveSubDialog(null)}>
              <form className="grid gap-5" onSubmit={handleRecordEmployeeRepayment}>
                <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                  {F("Échéance à encaisser", lang)}
                  <select className="input" value={employeeRepaymentForm.repaymentId} onChange={(event) => {
                    const selected = openEmployeeRepayments.find((entry) => entry.repayment.id === event.target.value);
                    setEmployeeRepaymentForm((current) => ({
                      ...current,
                      repaymentId: event.target.value,
                      paidAmount: selected ? String(Math.max(Number(selected.repayment.expectedAmount || 0) - Number(selected.repayment.paidAmount || 0), 0)) : current.paidAmount
                    }));
                  }} required>
                    <option value="">{F("Sélectionner une échéance", lang)}</option>
                    {openEmployeeRepayments.map(({ obligation, repayment }) => (
                      <option key={repayment.id} value={repayment.id}>
                        {(obligation.salaryProfile?.fullName ?? salaryProfiles.find((profile) => profile.id === obligation.salaryProfileId)?.fullName ?? "Employé")} - {obligation.title} - {currency.format(Math.max(Number(repayment.expectedAmount || 0) - Number(repayment.paidAmount || 0), 0))}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-4 sm:grid-cols-3">
                  <input className="input" type="number" min="0" step="0.01" value={employeeRepaymentForm.paidAmount} onChange={(event) => setEmployeeRepaymentForm((current) => ({ ...current, paidAmount: event.target.value }))} placeholder={F("Montant payé", lang)} required />
                  <select className="input" value={employeeRepaymentForm.paymentMethod} onChange={(event) => setEmployeeRepaymentForm((current) => ({ ...current, paymentMethod: event.target.value }))}>
                    {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
                  </select>
                  <input className="input" value={employeeRepaymentForm.reference} onChange={(event) => setEmployeeRepaymentForm((current) => ({ ...current, reference: event.target.value }))} placeholder={F("Référence paiement", lang)} />
                </div>

                <textarea className="input min-h-24" value={employeeRepaymentForm.notes} onChange={(event) => setEmployeeRepaymentForm((current) => ({ ...current, notes: event.target.value }))} placeholder={F("Notes de caisse ou observation", lang)} />

                <div className="flex flex-wrap justify-end gap-3">
                  <button type="button" onClick={() => setActiveSubDialog(null)} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white hover:border-brand-300/30 hover:bg-brand-500/10">
                    {F("Annuler", lang)}
                  </button>
                  <button type="submit" disabled={submittingKey === "employee-repayment"} className="btn-primary justify-center px-5 py-3 text-sm font-semibold disabled:opacity-60">
                    {F("Encaisser et générer le reçu", lang)}
                  </button>
                </div>
              </form>
            </OperationsSubDialog>
          )}
        </div>
      )}

      {activeTab === "accounting" && (
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <SectionCard title={F("Lecture comptable", lang)} subtitle="Journal des ecritures generees par les depenses et la paie.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-dim">{F("Total ecritures", lang)}</p>
                <p className="mt-2 text-2xl font-bold text-white">{accountingEntries.length}</p>
                <p className="mt-2 text-xs text-ink-dim">{F("Cardinal du journal comptable actif.", lang)}</p>
              </div>
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-dim">{F("Volume comptabilisé", lang)}</p>
                <p className="mt-2 text-2xl font-bold text-red-300">{currency.format(accountingMetrics.totalVolume)}</p>
                <p className="mt-2 text-xs text-red-100/80">{F("Somme scientifique de toutes les écritures enregistrées.", lang)}</p>
              </div>
              <div className="rounded-2xl border border-brand-400/20 bg-brand-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-dim">{F("Ticket moyen", lang)}</p>
                <p className="mt-2 text-2xl font-bold text-white">{currency.format(accountingMetrics.averageEntry)}</p>
                <p className="mt-2 text-xs text-brand-100/80">{F("Moyenne = volume comptabilisé / nombre d'écritures.", lang)}</p>
              </div>
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-dim">{F("Part paie", lang)}</p>
                <p className="mt-2 text-2xl font-bold text-cyan-100">{formatPercent(accountingMetrics.payrollWeight)}</p>
                <p className="mt-2 text-xs text-cyan-100/80">{currency.format(accountingMetrics.payrollVolume)} {F("imputés à la masse salariale.", lang)}</p>
              </div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-dim">{F("Département dominant", lang)}</p>
                <p className="mt-2 text-lg font-bold text-white">{accountingMetrics.topDepartmentName}</p>
                <p className="mt-2 text-xs text-amber-100/80">{formatPercent(accountingMetrics.topDepartmentWeight)} {F("du volume comptable total.", lang)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-dim">{F("Couverture documentaire", lang)}</p>
                <p className="mt-2 text-2xl font-bold text-emerald-200">{formatPercent(accountingMetrics.documentationCoverage)}</p>
                <p className="mt-2 text-xs text-emerald-100/80">{F("Pièces jointes présentes sur les dépenses source.", lang)}</p>
              </div>
              <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-dim">{F("Taux d'approbation", lang)}</p>
                <p className="mt-2 text-2xl font-bold text-violet-100">{formatPercent(accountingMetrics.approvalCoverage)}</p>
                <p className="mt-2 text-xs text-violet-100/80">{F("Dépenses approuvées sur l'ensemble du pipeline.", lang)}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title={F("Journal general", lang)} subtitle="Chaque ligne relie la comptabilisation a son objet source.">
            <div className="mb-4 flex flex-wrap gap-3">
              <SearchField value={accountingSearch} onChange={(event) => setAccountingSearch(event.target.value)} placeholder={F("Rechercher une écriture, un département ou une source...", lang)} />
              <select value={accountingDepartmentFilter} onChange={(event) => setAccountingDepartmentFilter(event.target.value)} className="input min-w-[220px]">
                <option value="ALL">{F("Tous les départements", lang)}</option>
                {accountingDepartmentOptions.map((department) => <option key={department} value={department}>{department}</option>)}
              </select>
            </div>
            <div className="mb-4 grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-200">{F("Répartition par département", lang)}</p>
                <div className="mt-3 space-y-2">
                  {accountingBreakdown.slice(0, 5).map((entry) => (
                    <div key={entry.department} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                      <div>
                        <p className="font-semibold text-white">{entry.department}</p>
                        <p className="text-xs text-ink-dim">{entry.count} {F("écriture(s) • moyenne", lang)} {currency.format(entry.average)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-white">{currency.format(entry.volume)}</p>
                        <p className="text-xs text-brand-100">{formatPercent(entry.weight)}</p>
                      </div>
                    </div>
                  ))}
                  {!accountingBreakdown.length && <p className="text-sm text-ink-dim">{F("Aucune écriture pour le filtre actuel.", lang)}</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-200">{F("Actions du journal", lang)}</p>
                <div className="mt-3 flex flex-wrap gap-2 xl:flex-col xl:items-stretch">
                  <button onClick={printAccountingReport} className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-300/25 bg-brand-500/10 px-4 py-2.5 text-sm font-semibold text-white hover:border-brand-200/40 hover:bg-brand-500/20">
                    <Printer className="h-4 w-4" /> {F("Imprimer le journal", lang)}
                  </button>
                  <button onClick={exportAccountingExcel} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20">
                    <Download className="h-4 w-4" /> {F("Export Excel", lang)}
                  </button>
                  <button onClick={exportAccountingCsv} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-ink-dim hover:border-brand-300/25 hover:text-white hover:bg-brand-500/10">
                    <Download className="h-3.5 w-3.5" /> {F("CSV", lang)}
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {filteredAccountingEntries.map((entry) => (
                <article key={entry.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{entry.title}</p>
                      <p className="mt-1 text-xs text-ink-dim">{entry.entryType} • {entry.department || "Departement non renseigne"} • {new Date(entry.entryDate).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={entry.direction} />
                      <span className="font-mono text-sm font-bold text-white">{currency.format(entry.amount)}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-dim">
                    {entry.metadata?.debitAccountCode && <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-cyan-100">{F("Débit", lang)} {entry.metadata.debitAccountCode} {F("· Crédit", lang)} {entry.metadata.creditAccountCode || "-"}</span>}
                    {entry.expense && <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">{F("Depense:", lang)} {entry.expense.title}</span>}
                    {entry.payrollRun && <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">{F("Run:", lang)} {entry.payrollRun.title}</span>}
                    {entry.payrollItem && <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">{F("Fiche:", lang)} {entry.payrollItem.salarySlipNumber}</span>}
                  </div>
                </article>
              ))}
              {!filteredAccountingEntries.length && <p className="text-sm text-ink-dim">{F("Aucune écriture comptable disponible pour le filtre actuel.", lang)}</p>}
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "cashflow" && (
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <SectionCard title={F("Trésorerie", lang)} subtitle="Journal des sorties et mouvements de cash reliés aux opérations financières.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-dim">{F("Lignes de trésorerie", lang)}</p>
                <p className="mt-2 text-2xl font-bold text-white">{cashflowEntries.length}</p>
                <p className="mt-2 text-xs text-ink-dim">{F("Nombre d'enregistrements utilisés pour la lecture de cashflow.", lang)}</p>
              </div>
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-dim">{F("Sorties cumulees", lang)}</p>
                <p className="mt-2 text-2xl font-bold text-red-300">{currency.format(cashflowMetrics.totalOutflow)}</p>
                <p className="mt-2 text-xs text-red-100/80">{F("Flux sortants consolidés du journal de trésorerie.", lang)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-dim">{F("Balance disponible", lang)}</p>
                <p className="mt-2 text-2xl font-bold text-emerald-300">{currency.format(safeOverview.cashflow.availableCash)}</p>
                <p className="mt-2 text-xs text-emerald-100/80">{F("Encaisse encore disponible après les sorties enregistrées.", lang)}</p>
              </div>
              <div className="rounded-2xl border border-brand-400/20 bg-brand-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-dim">{F("Ticket moyen sortie", lang)}</p>
                <p className="mt-2 text-2xl font-bold text-white">{currency.format(cashflowMetrics.averageOutflow)}</p>
                <p className="mt-2 text-xs text-brand-100/80">{F("Moyenne des opérations classées OUTFLOW.", lang)}</p>
              </div>
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-dim">{F("Part paie", lang)}</p>
                <p className="mt-2 text-2xl font-bold text-cyan-100">{formatPercent(cashflowMetrics.payrollShare)}</p>
                <p className="mt-2 text-xs text-cyan-100/80">{currency.format(cashflowMetrics.payrollOutflow)} {F("sortis pour la paie.", lang)}</p>
              </div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-dim">{F("Couverture cash", lang)}</p>
                <p className="mt-2 text-2xl font-bold text-amber-100">{cashflowMetrics.coverageRatio.toFixed(2)}x</p>
                <p className="mt-2 text-xs text-amber-100/80">{F("Ratio = cash disponible / sorties consolidées.", lang)}</p>
              </div>
              <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-dim">{F("Source dominante", lang)}</p>
                <p className="mt-2 text-lg font-bold text-white">{cashflowMetrics.dominantSourceName}</p>
                <p className="mt-2 text-xs text-violet-100/80">{formatPercent(cashflowMetrics.dominantSourceWeight)} {F("du volume de trésorerie.", lang)}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title={F("Journal de cashflow", lang)} subtitle="Référence, source, moyen de paiement et notes opérationnelles.">
            <div className="mb-4 grid gap-2 xl:grid-cols-[minmax(180px,0.7fr)_auto_auto]">
              <SearchField
                value={cashflowSearch}
                onChange={(event) => setCashflowSearch(event.target.value)}
                placeholder={F("Recherche fine...", lang)}
                wrapperClassName="max-w-xl"
                inputClassName="h-9 text-xs"
              />
              <select value={cashflowSourceFilter} onChange={(event) => setCashflowSourceFilter(event.target.value)} className="input h-9 min-w-[180px] text-xs">
                <option value="ALL">{F("Toutes les sources", lang)}</option>
                {cashflowSourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}
              </select>
              <select value={cashflowPeriodFilter} onChange={(event) => setCashflowPeriodFilter(event.target.value)} className="input h-9 min-w-[180px] text-xs">
                {PERIOD_FILTERS.map((period) => <option key={period.value} value={period.value}>{period.label}</option>)}
              </select>
            </div>
            {cashflowPeriodFilter === "CUSTOM" && (
              <div className="mb-4 grid gap-2 sm:grid-cols-2">
                <DateSelect className="input h-9 text-xs"  value={cashflowDateFrom} onChange={(event) => setCashflowDateFrom(event.target.value)} aria-label={F("Date début trésorerie", lang)} />
                <DateSelect className="input h-9 text-xs"  value={cashflowDateTo} onChange={(event) => setCashflowDateTo(event.target.value)} aria-label={F("Date fin trésorerie", lang)} />
              </div>
            )}
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">
              {F("Periodicite appliquee:", lang)} {periodLabel(cashflowPeriodFilter, cashflowDateFrom, cashflowDateTo, lang)} - {filteredCashflowEntries.length} {F("ligne(s)", lang)}
            </p>
            <div className="mb-4 grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">{F("Répartition par source", lang)}</p>
                <div className="mt-3 space-y-2">
                  {cashflowBreakdown.slice(0, 5).map((entry) => (
                    <div key={entry.sourceType} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                      <div>
                        <p className="font-semibold text-white">{dynamicFinancialLabel(entry.sourceType, lang)}</p>
                        <p className="text-xs text-ink-dim">{entry.count} {F("ligne(s) • moyenne", lang)} {currency.format(entry.average)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-white">{currency.format(entry.volume)}</p>
                        <p className="text-xs text-cyan-100">{formatPercent(entry.weight)}</p>
                      </div>
                    </div>
                  ))}
                  {!cashflowBreakdown.length && <p className="text-sm text-ink-dim">{F("Aucun flux pour le filtre actuel.", lang)}</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">{F("Actions trésorerie", lang)}</p>
                <div className="mt-3 flex flex-wrap gap-2 xl:flex-col xl:items-stretch">
                  <button onClick={printCashflowReport} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-white hover:border-cyan-200/40 hover:bg-cyan-500/20">
                    <Printer className="h-4 w-4" /> {F("Imprimer le journal", lang)}
                  </button>
                  <button onClick={exportCashflowExcel} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20">
                    <Download className="h-4 w-4" /> {F("Export Excel", lang)}
                  </button>
                  <button onClick={exportCashflowCsv} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-ink-dim hover:border-brand-300/25 hover:text-white hover:bg-brand-500/10">
                    <Download className="h-3.5 w-3.5" /> {F("CSV", lang)}
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {filteredCashflowEntries.map((entry) => (
                <article key={entry.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{dynamicFinancialLabel(entry.sourceType, lang)}</p>
                      <p className="mt-1 text-xs text-ink-dim">{new Date(entry.référenceDate).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US")} • {entry.method || "Sans methode"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={entry.direction} />
                      <span className="font-mono text-sm font-bold text-white">{currency.format(entry.amount)}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-dim">
                    {entry.expense && <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">{F("Depense:", lang)} {entry.expense.title}</span>}
                    {entry.payrollRun && <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">{F("Paie:", lang)} {entry.payrollRun.title}</span>}
                    {entry.payrollItem && <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">{F("Fiche:", lang)} {entry.payrollItem.salarySlipNumber}</span>}
                  </div>
                  {entry.notes && <p className="mt-3 text-sm text-ink-dim">{entry.notes}</p>}
                </article>
              ))}
              {!filteredCashflowEntries.length && <p className="text-sm text-ink-dim">{F("Aucun mouvement de trésorerie disponible pour le filtre actuel.", lang)}</p>}
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <SectionCard title={F("Depot documentaire", lang)} subtitle="Toutes les pieces justificatives attachées aux depenses sont visibles ici.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-dim">{F("Documents indexes", lang)}</p>
                <p className="mt-2 text-2xl font-bold text-white">{documentEntries.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-dim">{F("Dépenses documentees", lang)}</p>
                <p className="mt-2 text-2xl font-bold text-white">{expenses.filter((expense) => (expense.attachments?.length ?? 0) > 0).length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-ink-dim">
                {F("Ajoutez des justificatifs depuis l'onglet Dépenses avec un vrai upload de fichiers ou une référence URL.", lang)}
              </div>
            </div>
          </SectionCard>

          <SectionCard title={F("Pieces justificatives", lang)} subtitle="Ouverture directe, telechargement et contexte de la depense associee.">
            <div className="space-y-3">
              {documentEntries.map((entry) => (
                <article key={entry.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{entry.fileName}</p>
                      <p className="mt-1 text-xs text-ink-dim">{entry.expenseTitle} • {entry.department} • {new Date(entry.expenseDate).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US")}</p>
                    </div>
                    <StatusBadge value={entry.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => openExpenseSupportDocument(entry)} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white hover:border-brand-300/25 hover:bg-brand-500/10">
                      {F("Ouvrir", lang)}
                    </button>
                    <button onClick={() => downloadExpenseSupportDocument(entry)} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white hover:border-brand-300/25 hover:bg-brand-500/10">
                      {F("Télécharger", lang)}
                    </button>
                  </div>
                </article>
              ))}
              {!documentEntries.length && <p className="text-sm text-ink-dim">{F("Aucune piece justificative indexee pour le moment.", lang)}</p>}
            </div>
          </SectionCard>

        </div>
      )}

      {activeSubDialog === "budget-create" && canWrite && (
        <OperationsSubDialog
          title={F("Nouveau budget", lang)}
          subtitle="Créer une enveloppe budgétaire claire, avec un département, une catégorie, un montant planifié et un seuil d'alerte." 
          onClose={() => setActiveSubDialog(null)}
        >
          <form className="grid gap-6" onSubmit={handleCreateBudget}>
            <div className="overflow-hidden rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/14 via-slate-950 to-slate-950 shadow-xl">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100">{F("Budget workspace", lang)}</p>
                  <h4 className="mt-2 font-display text-2xl font-bold text-white">{F("Créer une enveloppe budgétaire propre et traçable", lang)}</h4>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-dim">
                    {F("Renseignez manuellement chaque champ important pour éviter les budgets implicites, mal catégorisés ou mal ventilés.", lang)}
                  </p>
                </div>
                <div className="grid gap-2 text-xs sm:min-w-[220px]">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white">
                    <p className="font-black uppercase tracking-[0.16em] text-cyan-100">{F("Champs clés", lang)}</p>
                    <p className="mt-1 text-ink-dim">{F("Nom, département, montant, catégorie, seuil d'alerte.", lang)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white">
                    <p className="font-black uppercase tracking-[0.16em] text-cyan-100">{F("Résultat attendu", lang)}</p>
                    <p className="mt-1 text-ink-dim">{F("Un budget exploitable immédiatement dans le suivi des dépenses.", lang)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <section className="rounded-3xl border border-white/10 bg-slate-950/45 p-5 shadow-lg">
                <div className="mb-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-200">{F("Identité du budget", lang)}</p>
                  <h4 className="mt-2 text-lg font-bold text-white">{F("Informations principales", lang)}</h4>
                  <p className="mt-1 text-sm text-ink-dim">{F("Définissez clairement le nom, le département et le volume financier prévu.", lang)}</p>
                </div>

                <div className="grid gap-4">
                  <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {F("Nom du budget", lang)}
                    <input
                      className="input"
                      value={budgetForm.name}
                      onChange={(event) => setBudgetForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder={F("Ex: Budget transport T3 2026", lang)}
                      required
                    />
                    <span className="text-[11px] normal-case tracking-normal text-ink-dim">{F("Nom lisible dans les journaux, les tableaux et les exports.", lang)}</span>
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                      {F("Département concerné", lang)}
                      <input
                        className="input"
                        value={budgetForm.department}
                        onChange={(event) => setBudgetForm((current) => ({ ...current, department: event.target.value }))}
                        placeholder={F("Ex: Administration, Académique, Transport", lang)}
                        required
                      />
                      <span className="text-[11px] normal-case tracking-normal text-ink-dim">{F("Service ou unité qui consommera ce budget.", lang)}</span>
                    </label>

                    <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                      {F("Montant planifié", lang)}
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={budgetForm.plannedAmount}
                        onChange={(event) => setBudgetForm((current) => ({ ...current, plannedAmount: event.target.value }))}
                        placeholder={F("Ex: 2500", lang)}
                        required
                      />
                      <span className="text-[11px] normal-case tracking-normal text-ink-dim">{F("Montant total prévu pour l'enveloppe, en USD.", lang)}</span>
                    </label>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-slate-950/45 p-5 shadow-lg">
                <div className="mb-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">{F("Pilotage", lang)}</p>
                  <h4 className="mt-2 text-lg font-bold text-white">{F("Catégorisation et suivi", lang)}</h4>
                  <p className="mt-1 text-sm text-ink-dim">{F("Préparez le budget pour le suivi analytique et les alertes de consommation.", lang)}</p>
                </div>

                <div className="grid gap-4">
                  <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {F("Catégorie associée", lang)}
                    <select
                      className="input"
                      value={budgetForm.categoryId}
                      onChange={(event) => setBudgetForm((current) => ({ ...current, categoryId: event.target.value }))}
                    >
                      <option value="">{F("Choisir une catégorie principale", lang)}</option>
                      {categories.filter((category) => !category.parentCategoryId).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                    <span className="text-[11px] normal-case tracking-normal text-ink-dim">{F("Permet d'ancrer le budget dans une famille de dépenses.", lang)}</span>
                  </label>

                  <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {F("Seuil d'alerte (%)", lang)}
                    <input
                      className="input"
                      type="number"
                      min="1"
                      max="100"
                      value={budgetForm.alertThreshold}
                      onChange={(event) => setBudgetForm((current) => ({ ...current, alertThreshold: event.target.value }))}
                      placeholder={F("Ex: 80", lang)}
                    />
                    <span className="text-[11px] normal-case tracking-normal text-ink-dim">{F("Déclenche une alerte visuelle lorsque la consommation approche la limite.", lang)}</span>
                  </label>

                  <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {F("Notes budgétaires", lang)}
                    <textarea
                      className="input min-h-32"
                      value={budgetForm.notes}
                      onChange={(event) => setBudgetForm((current) => ({ ...current, notes: event.target.value }))}
                      placeholder={F("Contexte, période couverte, justification, limites ou remarques de gestion", lang)}
                    />
                    <span className="text-[11px] normal-case tracking-normal text-ink-dim">{F("Visible pour garder une trace de la logique budgétaire choisie.", lang)}</span>
                  </label>
                </div>
              </section>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-2">
              <button
                type="button"
                onClick={() => setActiveSubDialog(null)}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white hover:border-brand-300/30 hover:bg-brand-500/10"
              >
                {F("Annuler", lang)}
              </button>
              <button type="submit" disabled={submittingKey === "budget"} className="btn-primary justify-center px-5 py-3 text-sm font-semibold disabled:opacity-60">
                {F("Enregistrer le budget", lang)}
              </button>
            </div>
          </form>
        </OperationsSubDialog>
      )}
        </OperationsDialog>
      )}
    </div>
  );
}
