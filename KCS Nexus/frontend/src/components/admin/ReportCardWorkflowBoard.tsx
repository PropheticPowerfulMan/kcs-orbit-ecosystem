import { SCHOOL_LEVELS, normalizeSchoolLevel } from "@/constants/schoolLevels";
import { useUIStore } from "@/store/uiStore";
export type ReportQueue = "ALL" | "WAITING" | "READY" | "SENT";
type Item = {
  publicationStatus: string;
  student: { grade?: string | null; section?: string | null };
};
export const reportCardQueue = (card: Item): ReportQueue =>
  card.publicationStatus === "EMAILED"
    ? "SENT"
    : ["APPROVED", "POSTED_TO_PORTAL"].includes(card.publicationStatus)
      ? "READY"
      : "WAITING";
export const reportCardClass = (card: Item) =>
  [
    normalizeSchoolLevel(card.student.grade) || card.student.grade,
    card.student.section,
  ]
    .filter(Boolean)
    .join(" ");
type Props = {
  documentKind?: "report-card" | "certificate";
  cards: Item[];
  grade: string;
  section: string;
  queue: ReportQueue;
  busy: boolean;
  onClass: (grade: string, section: string) => void;
  onQueue: (queue: ReportQueue) => void;
  onReadyDelivery: () => void;
  readyDeliveryCount?: number;
};
export default function ReportCardWorkflowBoard({
  documentKind = "report-card",
  cards,
  grade,
  section,
  queue,
  busy,
  onClass,
  onQueue,
  onReadyDelivery,
  readyDeliveryCount,
}: Props) {
  const language = useUIStore((state) => state.language);
  const tr = (fr: string, en: string) => (language === "fr" ? fr : en);
  const certificates = documentKind === "certificate";
  const scoped = cards.filter(
    (card) =>
      (grade === "ALL" || normalizeSchoolLevel(card.student.grade) === grade) &&
      (section === "ALL" || card.student.section === section),
  );
  const steps: { id: ReportQueue; title: string; description: string }[] = [
    {
      id: "WAITING",
      title: certificates
        ? tr("À préparer", "Awaiting preparation")
        : tr("À vérifier / corriger", "Awaiting review / correction"),
      description: certificates
        ? tr(
            "Certificats à générer et vérifier.",
            "Certificates awaiting generation and review.",
          )
        : tr(
            "Brouillons et bulletins transmis à examiner.",
            "Drafts and submitted report cards awaiting review.",
          ),
    },
    {
      id: "READY",
      title: tr("Prêts à envoyer", "Ready to send"),
      description: certificates
        ? tr(
            "Certificats préparés et vérifiables.",
            "Prepared and verifiable certificates.",
          )
        : tr(
            "Bulletins corrigés et approuvés par le SuperAdmin.",
            "Report cards reviewed and approved by the SuperAdmin.",
          ),
    },
    {
      id: "SENT",
      title: tr("Envois enregistrés", "Delivery recorded"),
      description: tr(
        "Envoi confirmé dans la file de courriels et la messagerie Nexus.",
        "Delivery recorded in the email queue and Nexus inbox.",
      ),
    },
  ];
  const classes = [
    ...new Map(
      cards.map((card) => [
        reportCardClass(card),
        {
          grade:
            normalizeSchoolLevel(card.student.grade) ||
            card.student.grade ||
            "",
          section: card.student.section || "",
          label: reportCardClass(card),
        },
      ]),
    ).values(),
  ].sort(
    (a, b) =>
      SCHOOL_LEVELS.indexOf(a.grade as (typeof SCHOOL_LEVELS)[number]) -
        SCHOOL_LEVELS.indexOf(b.grade as (typeof SCHOOL_LEVELS)[number]) ||
      a.section.localeCompare(b.section),
  );
  return (
    <section
      data-testid="report-workflow-board"
      className="my-4 space-y-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-kcs-blue-700 dark:bg-kcs-blue-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-kcs-blue-950 dark:text-white">
            {certificates
              ? tr(
                  "Organisation des certificats par classe",
                  "Certificate preparation by class",
                )
              : tr(
                  "Organisation du toilettage par classe",
                  "Report-card review by class",
                )}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-200">
            {certificates
              ? tr(
                  "Les états ci-dessous filtrent la liste des élèves. Préparez les certificats, puis choisissez leurs parents destinataires avec le bouton d’envoi.",
                  "The statuses below filter the learner list. Prepare certificates, then use the delivery button to choose their parent recipients.",
                )
              : tr(
                  "Enregistrez vos corrections, puis marquez le bulletin prêt après vérification. Chaque nouvelle correction d’un bulletin approuvé le replace dans la file à vérifier.",
                  "Save corrections, then mark the report card ready after review. Editing an approved card returns it to the review queue.",
                )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onQueue("ALL")}
          aria-pressed={queue === "ALL"}
          className="rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-bold text-kcs-blue-900 dark:border-kcs-blue-600 dark:bg-kcs-blue-950 dark:text-white"
        >
          {tr("Tous les états", "All statuses")} · {scoped.length}
        </button>
      </div>
      <div className="flex max-h-36 flex-wrap gap-2 overflow-auto">
        <button
          type="button"
          onClick={() => onClass("ALL", "ALL")}
          aria-pressed={grade === "ALL"}
          className="rounded-lg border border-sky-300 px-3 py-2 text-xs font-bold text-kcs-blue-950 dark:border-kcs-blue-600 dark:text-white"
        >
          {tr("Toutes les classes", "All grades")}
        </button>
        {classes.map((item) => (
          <button
            type="button"
            key={item.label}
            aria-pressed={grade === item.grade && section === item.section}
            onClick={() => onClass(item.grade, item.section)}
            className={
              (grade === item.grade && section === item.section
                ? "bg-kcs-blue-700 text-white"
                : "bg-white text-kcs-blue-900 dark:bg-kcs-blue-950 dark:text-white") +
              " rounded-lg border border-sky-300 px-3 py-2 text-xs font-bold dark:border-kcs-blue-600"
            }
          >
            {item.label} ·{" "}
            {
              cards.filter((card) => reportCardClass(card) === item.label)
                .length
            }
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((step) => (
          <button
            key={step.id}
            data-certificate-workflow-step={certificates ? step.id : undefined}
            type="button"
            aria-pressed={queue === step.id}
            onClick={() => onQueue(step.id)}
            className={
              (queue === step.id
                ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-400 dark:bg-emerald-950/60"
                : "border-sky-200 bg-white dark:border-kcs-blue-600 dark:bg-kcs-blue-950") +
              " rounded-xl border p-3 text-left text-kcs-blue-950 dark:text-white"
            }
          >
            <b className="block text-2xl">
              {
                scoped.filter((card) => reportCardQueue(card) === step.id)
                  .length
              }
            </b>
            <b className="block text-sm">{step.title}</b>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-300">
              {step.description}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={
          busy || (readyDeliveryCount !== undefined ? !readyDeliveryCount : !scoped.some((card) => reportCardQueue(card) === "READY"))
        }
        onClick={onReadyDelivery}
        className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {certificates
          ? tr(
              "Choisir les parents des certificats prêts",
              "Select parents for ready certificates",
            )
          : tr(
              "Choisir les parents des bulletins prêts",
              "Select parents for ready report cards",
            )}
        {certificates && readyDeliveryCount !== undefined ? ` · ${readyDeliveryCount}` : ''}
      </button>
    </section>
  );
}
