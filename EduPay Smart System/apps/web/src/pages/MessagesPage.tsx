import DateSelect from '../components/DateSelect';
import { useEffect, useMemo, useState } from "react";
import { Eye, Mail, MessageSquare, Send, Trash2, Users, X } from "lucide-react";
import { SearchField } from "../components/SearchField";
import { useI18n } from "../i18n";
import { api } from "../services/api";

type ParentOption = {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  students?: Array<{ id: string; fullName: string; className?: string }>;
};

type ManualMessageLog = {
  id: string;
  parentId: string;
  parentName: string;
  parentPhone?: string;
  parentEmail?: string;
  type: string;
  language: string;
  channel: string;
  content: string;
  status: string;
  createdAt: string;
};

type HistoryDeliveryFilter = "ALL" | "DASHBOARD" | "EMAIL" | "SMS" | "EMAIL_SENT" | "SMS_SENT" | "EMAIL_SKIPPED" | "SMS_SKIPPED";

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function parseManualMessageContent(content: string) {
  const normalized = content.replace(/\r\n/g, "\n");
  const subjectMatch = normalized.match(/^Objet\s*:\s*(.+)$/m);
  const subject = subjectMatch?.[1]?.trim() ?? "";
  const body = subject
    ? normalized.replace(/^Objet\s*:\s*.+$/m, "").replace(/^\s*\n/, "").trim()
    : normalized.trim();
  return { subject, body };
}

function matchesDeliveryFilter(log: ManualMessageLog, filter: HistoryDeliveryFilter) {
  if (filter === "ALL") return true;
  if (filter === "DASHBOARD") return log.status.includes("DASHBOARD:OPEN");
  if (filter === "EMAIL") return /EMAIL:(SIMULATED|SENT|SKIPPED|PENDING)/.test(log.status);
  if (filter === "SMS") return /SMS:(SIMULATED|SENT|SKIPPED|PENDING)/.test(log.status);
  if (filter === "EMAIL_SENT") return /EMAIL:(SIMULATED|SENT)/.test(log.status);
  if (filter === "SMS_SENT") return /SMS:(SIMULATED|SENT)/.test(log.status);
  if (filter === "EMAIL_SKIPPED") return log.status.includes("EMAIL:SKIPPED");
  if (filter === "SMS_SKIPPED") return log.status.includes("SMS:SKIPPED");
  return true;
}

function messageMatchesDateRange(log: ManualMessageLog, dateFrom: string, dateTo: string) {
  const timestamp = new Date(log.createdAt).getTime();
  if (Number.isNaN(timestamp)) return false;
  const min = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const max = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
  return timestamp >= min && timestamp <= max;
}

export function MessagesPage() {
  const { lang } = useI18n();
  const L = (fr: string, en: string) => lang === "fr" ? fr : en;
  const messageTypeLabel = (value: string) => ({ MANUAL: L("Manuel", "Manual"), MANUAL_PARENT_MESSAGE: L("Message parent manuel", "Manual parent message"), NOTIFICATION: "Notification" } as Record<string, string>)[value] ?? value.replace(/_/g, " ");
  const messageLanguageLabel = (value: string) => value.toLowerCase().startsWith("fr") ? L("Français", "French") : value.toLowerCase().startsWith("en") ? L("Anglais", "English") : value;
  const deliveryStatusLabel = (value: string) => value.split(/\s*[|,;]\s*/).map((part) => {
    const [channel, state] = part.split(":");
    const channelLabel = ({ DASHBOARD: L("Tableau de bord", "Dashboard"), EMAIL: L("E-mail", "Email"), SMS: "SMS" } as Record<string, string>)[channel] ?? channel;
    const stateLabel = ({ OPEN: L("actif", "active"), SENT: L("envoyé", "sent"), SIMULATED: L("simulé", "simulated"), SKIPPED: L("ignoré", "skipped"), PENDING: L("en attente", "pending"), FAILED: L("échoué", "failed") } as Record<string, string>)[state] ?? state;
    return state ? `${channelLabel}: ${stateLabel}` : channelLabel;
  }).join(" · ");
  const [parents, setParents] = useState<ParentOption[]>([]);
  const [logs, setLogs] = useState<ManualMessageLog[]>([]);
  const [search, setSearch] = useState("");
  const [selectedParentIds, setSelectedParentIds] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [historyParentId, setHistoryParentId] = useState("ALL");
  const [historyLanguage, setHistoryLanguage] = useState("ALL");
  const [historyDelivery, setHistoryDelivery] = useState<HistoryDeliveryFilter>("ALL");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [selectedLog, setSelectedLog] = useState<ManualMessageLog | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadData() {
    const [parentsResult, logsResult] = await Promise.all([
      api<ParentOption[]>("/api/parents").catch(() => []),
      api<ManualMessageLog[]>("/api/notifications/messages").catch(() => []),
    ]);
    setParents(
      (Array.isArray(parentsResult) ? parentsResult : [])
        .slice()
        .sort((left, right) => left.fullName.localeCompare(right.fullName, "fr", { sensitivity: "base" }))
    );
    setLogs(Array.isArray(logsResult) ? logsResult : []);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredParents = useMemo(() => {
    const query = normalizeText(search);
    if (!query) return parents;
    return parents.filter((parent) => [
      parent.fullName,
      parent.phone || "",
      parent.email || "",
      ...(parent.students ?? []).map((student) => `${student.fullName} ${student.className ?? ""}`)
    ].map(normalizeText).join(" ").includes(query));
  }, [parents, search]);

  const selectedParents = useMemo(
    () => parents.filter((parent) => selectedParentIds.includes(parent.id)),
    [parents, selectedParentIds]
  );

  const stats = useMemo(() => ({
    total: logs.length,
    parents: new Set(logs.map((log) => log.parentId)).size,
    email: logs.filter((log) => log.status.includes("EMAIL:SENT") || log.status.includes("EMAIL:SIMULATED")).length,
    sms: logs.filter((log) => log.status.includes("SMS:SENT") || log.status.includes("SMS:SIMULATED")).length,
  }), [logs]);

  const filteredLogs = useMemo(() => {
    const query = normalizeText(historySearch);
    return logs.filter((log) => {
      const parsed = parseManualMessageContent(log.content);
      const searchable = normalizeText([
        log.parentName,
        log.parentPhone || "",
        log.parentEmail || "",
        log.type,
        log.language,
        log.channel,
        log.status,
        parsed.subject,
        parsed.body,
      ].join(" "));

      const matchesQuery = !query || query.split(/\s+/).every((token) => searchable.includes(token));
      const matchesParent = historyParentId === "ALL" || log.parentId === historyParentId;
      const matchesLanguage = historyLanguage === "ALL" || log.language === historyLanguage;
      const matchesDelivery = matchesDeliveryFilter(log, historyDelivery);
      const matchesDate = messageMatchesDateRange(log, historyDateFrom, historyDateTo);

      return matchesQuery && matchesParent && matchesLanguage && matchesDelivery && matchesDate;
    });
  }, [historyDateFrom, historyDateTo, historyDelivery, historyLanguage, historyParentId, historySearch, logs]);

  const visibleParentIds = useMemo(() => filteredParents.map((parent) => parent.id), [filteredParents]);

  const toggleParent = (parentId: string) => {
    setSelectedParentIds((current) => current.includes(parentId)
      ? current.filter((id) => id !== parentId)
      : [...current, parentId]);
  };

  const selectAllVisibleParents = () => {
    setSelectedParentIds((current) => Array.from(new Set([...current, ...visibleParentIds])));
  };

  const clearParentSelection = () => {
    setSelectedParentIds([]);
  };

  const deleteMessage = async (log: ManualMessageLog) => {
    const confirmed = window.confirm(L(`Supprimer le message envoyé à ${log.parentName} ?`, `Delete the message sent to ${log.parentName}?`));
    if (!confirmed) return;

    setDeletingId(log.id);
    setError(null);
    setStatus(null);
    try {
      await api(`/api/notifications/messages/${log.id}`, { method: "DELETE" });
      setLogs((current) => current.filter((entry) => entry.id !== log.id));
      if (selectedLog?.id === log.id) setSelectedLog(null);
      setStatus("Le message a été supprimé de l'historique.");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Impossible de supprimer ce message.");
    } finally {
      setDeletingId(null);
    }
  };

  const submit = async () => {
    setError(null);
    setStatus(null);

    if (selectedParentIds.length === 0) {
      setError(L("Sélectionnez au moins un parent.", "Select at least one parent."));
      return;
    }
    if (!body.trim()) {
      setError(L("Le message est obligatoire.", "The message is required."));
      return;
    }
    if (!sendEmail && !sendSms) {
      setError(L("Choisissez au moins un canal direct : e-mail ou SMS.", "Select at least one direct channel: email or SMS."));
      return;
    }

    setSending(true);
    try {
      const response = await api<{ sentCount: number }>("/api/notifications/messages", {
        method: "POST",
        body: JSON.stringify({
          parentIds: selectedParentIds,
          subject: subject.trim(),
          body: body.trim(),
          language: "fr",
          channels: [sendEmail ? "EMAIL" : null, sendSms ? "SMS" : null].filter(Boolean)
        })
      });

      setStatus(`${response.sentCount} message(s) envoyé(s) et déposés dans Messages reçus.`);
      setSubject("");
      setBody("");
      setSelectedParentIds([]);
      await loadData();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Impossible d'envoyer le message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="glass rounded-3xl border border-brand-300/20 p-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-300">{L("Messagerie financière", "Financial messaging")}</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-white">{L("Messages entre le financier et les parents", "Messages between finance staff and parents")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-dim">
          {L("Le message saisi ici peut être transmis à un ou plusieurs parents, envoyé par e-mail et/ou SMS, puis conservé dans leur espace EduPay sous Messages reçus.", "The message entered here can be sent to one or more parents by email and/or SMS, then saved under Received messages in their EduPay account.")}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="glass rounded-2xl border border-white/10 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-dim">{L("Messages envoyés", "Messages sent")}</p>
          <p className="mt-2 text-3xl font-black text-white">{stats.total}</p>
        </article>
        <article className="glass rounded-2xl border border-white/10 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-dim">{L("Parents contactés", "Parents contacted")}</p>
          <p className="mt-2 text-3xl font-black text-cyan-300">{stats.parents}</p>
        </article>
        <article className="glass rounded-2xl border border-white/10 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-dim">{L("Envois e-mail", "Email deliveries")}</p>
          <p className="mt-2 text-3xl font-black text-brand-100">{stats.email}</p>
        </article>
        <article className="glass rounded-2xl border border-white/10 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-dim">{L("Envois SMS", "SMS deliveries")}</p>
          <p className="mt-2 text-3xl font-black text-emerald-300">{stats.sms}</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-5">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-brand-200" />
              <div>
                <h2 className="font-display text-xl font-bold text-white">{L("Choisir les parents", "Choose parents")}</h2>
                <p className="text-sm text-ink-dim">{L("Tous les noms de parents sont chargés automatiquement. Sélection multiple autorisée.", "All parent names are loaded automatically. Multiple selection is allowed.")}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-ink-dim">
              <span>{parents.length} {L("parent(s) disponible(s) immédiatement dans la sélection.", "parent(s) immediately available for selection.")}</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={selectAllVisibleParents} className="rounded-full border border-brand-300/25 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-100">
                  {L("Tout sélectionner", "Select all")}
                </button>
                <button type="button" onClick={clearParentSelection} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-ink-dim hover:text-white">
                  {L("Effacer", "Clear")}
                </button>
              </div>
            </div>

           <SearchField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={L("Filtrer un parent, un téléphone ou un élève...", "Filter by parent, phone or student...")}
              wrapperClassName="mt-4"
            />

            <div className="mt-4 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
              {filteredParents.map((parent) => {
                const active = selectedParentIds.includes(parent.id);
                return (
                  <button
                    key={parent.id}
                    type="button"
                    onClick={() => toggleParent(parent.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${active ? "border-brand-300/40 bg-brand-500/10" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{parent.fullName}</p>
                        <p className="mt-1 text-xs text-ink-dim">{parent.phone || "Téléphone non renseigné"} · {parent.email || "Email non renseigné"}</p>
                        {(parent.students?.length ?? 0) > 0 ? (
                          <p className="mt-2 text-xs text-ink-dim">
                            {(parent.students ?? []).map((student) => `${student.fullName}${student.className ? ` (${student.className})` : ""}`).join(" · ")}
                          </p>
                        ) : null}
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${active ? "bg-brand-300 text-slate-950" : "bg-white/[0.08] text-ink-dim"}`}>
                        {active ? "Sélectionné" : "Choisir"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="glass rounded-3xl border border-white/10 p-5">
            <div className="flex items-center gap-3">
              <Send className="h-5 w-5 text-emerald-300" />
              <div>
                <h2 className="font-display text-xl font-bold text-white">{L("Rédiger et transmettre", "Compose and send")}</h2>
                <p className="text-sm text-ink-dim">{L("Le tableau de bord parent est toujours alimenté en même temps.", "The parent dashboard is always updated at the same time.")}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {selectedParents.length > 0 ? selectedParents.map((parent) => (
                <span key={parent.id} className="rounded-full border border-brand-300/25 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-100">
                  {parent.fullName}
                </span>
              )) : <span className="text-sm text-ink-dim">{L("Aucun parent sélectionné.", "No parent selected.")}</span>}
            </div>

            <div className="mt-4 grid gap-4">
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="w-full"
                placeholder={L("Objet du message (facultatif)", "Message subject (optional)")}
              />
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="min-h-[12rem] w-full"
                placeholder={L("Écrivez ici le message à transmettre aux parents sélectionnés...", "Write the message to send to selected parents...")}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white">
                <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} />
                <Mail className="h-4 w-4 text-brand-200" /> {L("E-mail", "Email")}
              </label>
              <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white">
                <input type="checkbox" checked={sendSms} onChange={(event) => setSendSms(event.target.checked)} />
                <MessageSquare className="h-4 w-4 text-emerald-300" /> SMS
              </label>
              <span className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200">
                {L("Dashboard parent: actif automatiquement", "Parent dashboard: automatically enabled")}
              </span>
            </div>

            {error ? <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
            {status ? <p className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{status}</p> : null}

            <button
              type="button"
              onClick={() => void submit()}
              disabled={sending}
              className="btn-primary mt-5 inline-flex items-center gap-2 px-5 py-3 text-sm font-bold disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> {sending ? "Envoi en cours..." : "Envoyer le message"}
            </button>
          </div>
        </div>

        <div className="glass rounded-3xl border border-white/10 p-5">
          <h2 className="font-display text-xl font-bold text-white">{L("Historique des messages transmis", "Sent message history")}</h2>
          <p className="mt-1 text-sm text-ink-dim">{L("Tous les envois manuels du financier vers les parents sont conservés ici, avec filtres précis et actions directes.", "All manual messages sent by finance staff to parents are stored here, with precise filters and direct actions.")}</p>

          <div className="mt-5 grid gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="xl:col-span-3">
           <SearchField
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
              placeholder={L("Recherche précise : parent, objet, contenu, statut, téléphone, e-mail...", "Detailed search: parent, subject, content, status, phone, email...")}
            />
            </div>
            <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-dim">
              {L("Parent", "Parent")}
              <select value={historyParentId} onChange={(event) => setHistoryParentId(event.target.value)} className="w-full">
                <option value="ALL">{L("Tous les parents", "All parents")}</option>
                {parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.fullName}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-dim">
              {L("Livraison", "Delivery")}
              <select value={historyDelivery} onChange={(event) => setHistoryDelivery(event.target.value as HistoryDeliveryFilter)} className="w-full">
                <option value="ALL">{L("Toutes", "All")}</option>
                <option value="DASHBOARD">{L("Dashboard parent", "Parent dashboard")}</option>
                <option value="EMAIL">{L("Email activé", "Email enabled")}</option>
                <option value="SMS">{L("SMS activé", "SMS enabled")}</option>
                <option value="EMAIL_SENT">{L("Email envoyé", "Email sent")}</option>
                <option value="SMS_SENT">{L("SMS envoyé", "SMS sent")}</option>
                <option value="EMAIL_SKIPPED">{L("Email ignoré", "Email skipped")}</option>
                <option value="SMS_SKIPPED">{L("SMS ignoré", "SMS skipped")}</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-dim">
              {L("Langue", "Language")}
              <select value={historyLanguage} onChange={(event) => setHistoryLanguage(event.target.value)} className="w-full">
                <option value="ALL">{L("Toutes", "All")}</option>
                <option value="fr">{L("Français", "French")}</option>
                <option value="en">{L("English", "English")}</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-dim">
              {L("Du", "From")}
              <DateSelect value={historyDateFrom} onChange={(event) => setHistoryDateFrom(event.target.value)} className="w-full" />
            </label>
            <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-dim">
              {L("Au", "To")}
              <DateSelect value={historyDateTo} onChange={(event) => setHistoryDateTo(event.target.value)} className="w-full" />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setHistorySearch("");
                  setHistoryParentId("ALL");
                  setHistoryLanguage("ALL");
                  setHistoryDelivery("ALL");
                  setHistoryDateFrom("");
                  setHistoryDateTo("");
                }}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-ink-dim hover:text-white"
              >
                {L("Réinitialiser les filtres", "Reset filters")}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-ink-dim">
            {filteredLogs.length} {L("message(s) affiché(s) sur", "message(s) shown out of")} {logs.length}.
          </div>

          <div className="mt-5 space-y-3">
            {filteredLogs.length === 0 ? <p className="text-sm text-ink-dim">{L("Aucun message manuel ne correspond aux critères courants.", "No manual message matches the current criteria.")}</p> : filteredLogs.map((log) => {
              const parsed = parseManualMessageContent(log.content);
              return (
              <article key={log.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{log.parentName}</p>
                    <p className="mt-1 text-xs text-ink-dim">{log.parentPhone || "Téléphone non renseigné"} · {log.parentEmail || "Email non renseigné"}</p>
                    {parsed.subject ? <p className="mt-2 text-sm font-semibold text-brand-100">{parsed.subject}</p> : null}
                  </div>
                  <div className="text-right">
                    <span className="rounded-full border border-brand-300/25 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-100">{messageTypeLabel(log.type)}</span>
                    <p className="mt-2 text-xs text-ink-dim">{new Date(log.createdAt).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")}</p>
                  </div>
                </div>
                <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-ink">{parsed.body || log.content}</pre>
                <p className="mt-3 text-xs font-semibold text-cyan-200">{deliveryStatusLabel(log.status)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedLog(log)}
                    className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100"
                  >
                    <Eye className="h-4 w-4" /> {L("Voir", "View")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteMessage(log)}
                    disabled={deletingId === log.id}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" /> {deletingId === log.id ? "Suppression..." : "Supprimer"}
                  </button>
                </div>
              </article>
            );})}
          </div>
        </div>
      </section>

      {selectedLog ? (() => {
        const parsed = parseManualMessageContent(selectedLog.content);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-2 py-4 backdrop-blur-sm"
            onClick={() => setSelectedLog(null)}
            style={{ cursor: 'pointer' }}
          >
            <div
              className="edupay-dialog-panel-md glass w-full max-w-[98vw] max-h-[95vh] min-h-[500px] min-w-[700px] overflow-y-auto rounded-3xl border border-white/10 p-10 sm:p-12 relative"
              onClick={e => e.stopPropagation()}
              style={{ cursor: 'default' }}
            >
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="absolute top-5 right-5 z-10 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-ink-dim hover:text-white"
                style={{ background: 'rgba(0,0,0,0.15)' }}
                aria-label={L("Fermer", "Close")}
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-300">{L("Message détaillé", "Message details")}</p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-white">{selectedLog.parentName}</h2>
                  <p className="mt-2 text-sm text-ink-dim">{new Date(selectedLog.createdAt).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-ink">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-dim">{L("Contact", "Contact")}</p>
                  <p className="mt-2 font-semibold text-white">{selectedLog.parentEmail || "Email non renseigné"}</p>
                  <p className="mt-1 font-semibold text-white">{selectedLog.parentPhone || "Téléphone non renseigné"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-ink">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-dim">{L("Trace technique", "Technical trace")}</p>
                  <p className="mt-2 text-white">{L("Type:", "Type:")} {messageTypeLabel(selectedLog.type)}</p>
                  <p className="mt-1 text-white">{L("Langue:", "Language:")} {messageLanguageLabel(selectedLog.language)}</p>
                  <p className="mt-1 text-white">{L("Canal principal:", "Primary channel:")} {selectedLog.channel}</p>
                  <p className="mt-1 text-cyan-200">{deliveryStatusLabel(selectedLog.status)}</p>
                </div>
              </div>

              {parsed.subject ? (
                <div className="mt-5 rounded-2xl border border-brand-300/20 bg-brand-500/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-200">{L("Objet", "Subject")}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{parsed.subject}</p>
                </div>
              ) : null}

              <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-dim">{L("Contenu", "Content")}</p>
                <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink break-words">{parsed.body || selectedLog.content}</pre>
              </div>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}
