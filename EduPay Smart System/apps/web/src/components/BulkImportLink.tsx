import { FileUp } from "lucide-react";

type BulkImportLinkProps = {
  entity: "STUDENT" | "PARENT" | "TEACHER" | "STAFF";
  label: string;
};

const nexusUrl = (import.meta.env.VITE_NEXUS_URL || "https://kinshasachristianschool.org").replace(/\/$/, "");

export function BulkImportLink({ entity, label }: BulkImportLinkProps) {
  return (
    <a
      href={`${nexusUrl}/admin/data-migration?entity=${encodeURIComponent(entity)}`}
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-4 py-2.5 text-sm font-bold text-cyan-100 transition hover:border-cyan-200/60 hover:bg-cyan-500/20"
    >
      <FileUp className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  );
}
