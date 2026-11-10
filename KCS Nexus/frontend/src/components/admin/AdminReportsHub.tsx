import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ClipboardList, FileBarChart2 } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import IncidentReportsPage from "@/pages/IncidentReports";

export default function AdminReportsHub({
  administrativeReports,
}: {
  administrativeReports: ReactNode;
}) {
  const language = useUIStore((state) => state.language);
  const tr = (fr: string, en: string) => (language === "fr" ? fr : en);
  const incident =
    new URLSearchParams(useLocation().search).get("view") === "incident";
  const sections = [
    {
      id: "administrative",
      title: tr("Rapports administratifs", "Administrative reports"),
      detail: tr(
        "Indicateurs de l’école, analyses et documents officiels.",
        "School indicators, analysis and official documents.",
      ),
      icon: FileBarChart2,
    },
    {
      id: "incident",
      title: tr("Rapports d’incident", "Incident reports"),
      detail: tr(
        "Signalements, pièces jointes, traitement et suivi des événements.",
        "Incident submissions, evidence, review and follow-up.",
      ),
      icon: ClipboardList,
    },
  ];
  return (
    <section className="min-w-0 space-y-5">
      <header className="relative overflow-hidden rounded-3xl border border-sky-500/30 bg-gradient-to-br from-kcs-blue-950 via-kcs-blue-800 to-sky-700 p-5 text-white shadow-xl sm:p-6">
        <span
          aria-hidden="true"
          className="absolute -right-10 -top-12 size-48 rounded-full border-[24px] border-white/5"
        />
        <p className="relative text-xs font-black uppercase tracking-[.2em] text-cyan-200">
          KCS Nexus AI · {tr("Superadministration", "Super Administration")}
        </p>
        <h2 className="relative mt-3 text-2xl font-black sm:text-3xl">
          {tr(
            "Rapports et suivi institutionnel",
            "Reports and institutional oversight",
          )}
        </h2>
        <p className="relative mt-2 max-w-3xl text-sm leading-relaxed text-sky-100">
          {tr(
            "Retrouvez les analyses de l’école et les rapports d’incident dans un seul espace organisé.",
            "Find school analysis and incident reports in one organized workspace.",
          )}
        </p>
      </header>
      <nav
        aria-label={tr("Types de rapports", "Report types")}
        className="grid gap-3 md:grid-cols-2"
      >
        {sections.map((section) => {
          const selected = incident === (section.id === "incident");
          return (
            <Link
              key={section.id}
              to={"/admin/reports?view=" + section.id}
              aria-current={selected ? "page" : undefined}
              className={
                (selected
                  ? "border-cyan-400 bg-sky-800 text-white dark:!text-white shadow-lg ring-1 ring-cyan-400/40"
                  : "border-sky-200 bg-white text-kcs-blue-950 hover:border-sky-400 dark:border-kcs-blue-700 dark:bg-kcs-blue-900 dark:!text-white") +
                " flex min-w-0 items-start gap-4 rounded-2xl border p-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              }
            >
              <span
                className={
                  (selected
                    ? "bg-white/10 text-cyan-100"
                    : "bg-sky-100 text-sky-800 dark:bg-kcs-blue-950 dark:text-cyan-200") +
                  " rounded-xl p-3"
                }
              >
                <section.icon size={24} />
              </span>
              <div className="min-w-0">
                <b className="block text-base dark:!text-white">
                  {section.title}
                </b>
                <p
                  className={
                    (selected
                      ? "text-sky-100"
                      : "text-slate-600 dark:!text-slate-200") +
                    " mt-2 text-sm leading-relaxed"
                  }
                >
                  {section.detail}
                </p>
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="min-w-0">
        {incident ? <IncidentReportsPage embedded /> : administrativeReports}
      </div>
    </section>
  );
}
