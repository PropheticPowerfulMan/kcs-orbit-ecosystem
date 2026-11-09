import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ClipboardList, GraduationCap, MessageSquare } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import IncidentReportsPage from "@/pages/IncidentReports";
import ParentCommunicationPanel from "@/pages/Admin/ParentCommunicationPanel";

type Props = { academicReports: ReactNode };
export default function TeacherReportsHub({ academicReports }: Props) {
  const language = useUIStore((state) => state.language);
  const tr = (fr: string, en: string) => (language === "fr" ? fr : en);
  const location = useLocation();
  const requested = new URLSearchParams(location.search).get("view");
  const active = location.pathname.endsWith("/messages")
    ? "messages"
    : ["academic", "incident", "messages"].includes(requested ?? "")
      ? requested
      : "incident";
  const sections = [
    {
      id: "incident",
      title: tr("Rapport d’incident", "Incident report"),
      description: tr(
        "Signaler un événement, joindre une preuve et suivre son traitement.",
        "Report an event, attach evidence and track its review.",
      ),
      icon: ClipboardList,
    },
    {
      id: "academic",
      title: tr("Rapports académiques", "Academic reports"),
      description: tr(
        "Bilans de classe, analyses des élèves et rapports d’activités.",
        "Class summaries, learner analysis and activity reports.",
      ),
      icon: GraduationCap,
    },
    {
      id: "messages",
      title: tr("Messages et échanges", "Messages and conversations"),
      description: tr(
        "Retrouver les conversations et communiquer avec les familles.",
        "Find conversations and communicate with families.",
      ),
      icon: MessageSquare,
    },
  ];
  return (
    <section className="min-w-0 space-y-5">
      <header className="rounded-3xl border border-kcs-blue-600 bg-gradient-to-r from-kcs-blue-900 to-kcs-blue-700 p-5 text-white shadow-lg sm:p-6">
        <p className="text-xs font-black uppercase tracking-widest text-kcs-gold-300">
          KCS Nexus AI
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold">
          {tr("Rapports", "Reports")}
        </h2>
        <p className="mt-2 text-sm text-blue-100">
          {tr(
            "Choisissez le type de rapport ou ouvrez vos échanges depuis ce même espace.",
            "Choose a report type or open your conversations from this workspace.",
          )}
        </p>
      </header>
      <nav
        aria-label={tr("Types de rapports", "Report types")}
        className="grid gap-3 md:grid-cols-3"
      >
        {sections.map((section) => (
          <Link
            key={section.id}
            to={"/portal/teacher/reports?view=" + section.id}
            aria-current={active === section.id ? "page" : undefined}
            className={
              "flex min-w-0 items-start gap-3 rounded-2xl border p-4 shadow-sm transition " +
              (active === section.id
                ? "border-kcs-blue-600 bg-kcs-blue-700 text-white dark:border-sky-400"
                : "border-sky-200 bg-white text-kcs-blue-950 hover:border-sky-500 dark:border-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-white")
            }
          >
            <section.icon size={23} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <b className="block text-sm">{section.title}</b>
              <p className="mt-1 text-xs leading-relaxed opacity-80">
                {section.description}
              </p>
            </div>
          </Link>
        ))}
      </nav>
      <div className="min-w-0">
        {active === "academic" ? (
          academicReports
        ) : active === "messages" ? (
          <ParentCommunicationPanel />
        ) : (
          <IncidentReportsPage embedded />
        )}
      </div>
    </section>
  );
}
