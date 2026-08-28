import React, { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Eye, Mail, MessageSquare, Send, Square, Users, X } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import StatCard from '../../components/ui/StatCard';
import { useTranslation } from 'react-i18next';
import { communicationService, studentsService } from '../../services/api';

const deliveryClass = {
  sent: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  simulated: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',
  skipped: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  failed: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  pending: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
};

const inputClass = 'w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue';

const initialDraft = {
  subject: 'Suivi scolaire SAVANEX',
  body: '',
};
const stableParentId = (student) => (
  student.parent
  || student.parent_external_id
  || `${student.parent_name || 'parent'}-${student.parent_email || ''}-${student.parent_phone || ''}`
);

const buildParentOptions = (students) => {
  const parents = new Map();
  students.forEach((student) => {
    const hasContact = student.parent_email || student.parent_phone || student.parent_name;
    if (!hasContact) return;

    const parentId = stableParentId(student);
    if (!parents.has(parentId)) {
      parents.set(parentId, {
        id: parentId,
        name: student.parent_name || 'Parent',
        email: student.parent_email || '',
        phone: student.parent_phone || '',
        students: [],
      });
    }
    parents.get(parentId).students.push(student.full_name);
  });
  return Array.from(parents.values())
    .filter((parent) => parent.email || parent.phone)
    .sort((left, right) => left.name.localeCompare(right.name));
};

const formatDelivery = (delivery = []) => {
  if (!delivery.length) return 'En attente';
  return delivery.map((item) => `${item.channel.toUpperCase()}: ${item.status}`).join(' | ');
};

const CommunicationPage = () => {
  const { t, i18n } = useTranslation();
  const L = (fr, en) => (i18n.resolvedLanguage || i18n.language).startsWith('fr') ? fr : en;
  const [messageList, setMessageList] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedParentIds, setSelectedParentIds] = useState([]);
  const [draft, setDraft] = useState(initialDraft);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [parentSearch, setParentSearch] = useState('');
  const [contactFilter, setContactFilter] = useState('all');
  const [historySearch, setHistorySearch] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('all');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    async function loadCommunication() {
      setLoading(true);
      setError('');
      const [messagesResult, studentsResult] = await Promise.allSettled([
        communicationService.getMessages('sent'),
        studentsService.getAll(),
      ]);
      if (!alive) return;

      setMessageList(messagesResult.status === 'fulfilled' ? messagesResult.value : []);
      setStudents(studentsResult.status === 'fulfilled' ? studentsResult.value : []);

      if (messagesResult.status === 'rejected') {
        setNotice("Historique momentanement indisponible. L'envoi email/SMS reste disponible.");
      }
      if (studentsResult.status === 'rejected') {
        setError(studentsResult.reason?.response?.data?.detail || studentsResult.reason?.message || 'Impossible de charger les parents joignables.');
      }
      setLoading(false);
    }
    loadCommunication();
    return () => {
      alive = false;
    };
  }, []);

  const parentOptions = useMemo(() => buildParentOptions(students), [students]);
  const selectedParents = useMemo(
    () => parentOptions.filter((parent) => selectedParentIds.includes(String(parent.id))),
    [parentOptions, selectedParentIds]
  );
  const visibleParents = useMemo(() => {
    const query = parentSearch.trim().toLowerCase();
    return parentOptions.filter((parent) => {
      if (contactFilter === 'email' && !parent.email) return false;
      if (contactFilter === 'sms' && !parent.phone) return false;
      if (contactFilter === 'both' && (!parent.email || !parent.phone)) return false;
      if (!query) return true;
      const haystack = [
        parent.id,
        parent.name,
        parent.email,
        parent.phone,
        parent.students.join(' '),
        parent.students.length,
      ].join(' ').toLowerCase();
      return query.split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
    });
  }, [contactFilter, parentOptions, parentSearch]);
  const allVisibleSelected = visibleParents.length > 0 && visibleParents.every((parent) => selectedParentIds.includes(String(parent.id)));

  const recommendedText = useMemo(() => {
    if (!selectedParents.length) {
      return "Bonjour, SAVANEX souhaite vous informer de l'evolution scolaire de votre enfant. Merci de contacter l'administration si vous souhaitez un accompagnement.";
    }
    const childLabel = selectedParents.flatMap((parent) => parent.students).slice(0, 4).join(', ') || 'votre enfant';
    return `Bonjour, SAVANEX souhaite vous informer de l'evolution scolaire de ${childLabel}. Merci de contacter l'administration si vous souhaitez un accompagnement.`;
  }, [selectedParents]);

  const channels = useMemo(() => [
    ...(sendEmail ? ['email'] : []),
    ...(sendSms ? ['sms'] : []),
  ], [sendEmail, sendSms]);

  const filteredMessages = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return messageList.filter((message) => {
      const haystack = `${message.subject || ''} ${message.receiver_name || ''} ${message.body || ''}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const matchesDelivery = deliveryFilter === 'all' || (message.delivery || []).some((item) => item.status === deliveryFilter || item.channel === deliveryFilter);
      return matchesQuery && matchesDelivery;
    });
  }, [deliveryFilter, historySearch, messageList]);

  const deliveryStats = useMemo(() => {
    const all = messageList.flatMap((message) => message.delivery || []);
    return {
      sent: all.filter((item) => item.status === 'sent').length,
      simulated: all.filter((item) => item.status === 'simulated').length,
      failed: all.filter((item) => item.status === 'failed').length,
    };
  }, [messageList]);

  const toggleParent = (parentId) => {
    const safeId = String(parentId);
    setSelectedParentIds((current) => (
      current.includes(safeId) ? current.filter((id) => id !== safeId) : [...current, safeId]
    ));
  };

  const selectVisibleParents = () => {
    setSelectedParentIds((current) => Array.from(new Set([...current, ...visibleParents.map((parent) => String(parent.id))])));
  };

  const toggleAllVisibleParents = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(visibleParents.map((parent) => String(parent.id)));
      setSelectedParentIds((current) => current.filter((id) => !visibleIds.has(id)));
      return;
    }
    selectVisibleParents();
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!selectedParents.length) {
      setError('Selectionnez au moins un parent avant l\'envoi.');
      return;
    }
    if (!channels.length) {
      setError('Activez au moins un canal : email ou SMS.');
      return;
    }

    setSending(true);
    setError('');
    setNotice('');

    try {
      const body = draft.body || recommendedText;
      const created = await communicationService.sendParentMessages({
        recipients: selectedParents,
        subject: draft.subject,
        body,
        channels,
      });
      setMessageList((current) => [...created, ...current]);
      setNotice(`${created.length} message(s) parent envoye(s). ${created.map((item) => formatDelivery(item.delivery)).join(' | ')}`);
      setDraft(initialDraft);
      setSelectedParentIds([]);
    } catch (sendError) {
      setError(sendError?.response?.data?.detail || sendError?.message || "Impossible d'envoyer le message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <section className="mb-6 flex flex-col gap-4 page-enter lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-kcs-blue">Communication hub</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-100">{t('nav.communication')}</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            {L("Envoi groupé ou ciblé aux parents par email et SMS, même quand le parent est seulement un contact relié à l'élève.", 'Send targeted or bulk email and SMS messages to parents, including contacts linked through a student.')}
          </p>
        </div>
      </section>

      {notice ? <p className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{notice}</p> : null}
      {error ? <p className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title={L('Parents joignables', 'Reachable parents')} value={loading ? '...' : parentOptions.length} accent="text-cyan-300" />
        <StatCard title={L('Messages envoyés', 'Messages sent')} value={messageList.length} accent="text-sky-300" />
        <StatCard title={L('Canaux réels', 'Live channels')} value={deliveryStats.sent} subtitle="Email/SMS livrés" accent="text-emerald-300" />
        <StatCard title={L('Échecs', 'Failures')} value={deliveryStats.failed} subtitle={`${deliveryStats.simulated} simulation(s)`} accent="text-rose-300" />
      </section>

      <section className="mb-6 grid gap-4 xl:grid-cols-[0.95fr_1.35fr]">
        <article className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">{L('Destinataires', 'Recipients')}</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-slate-100">{L('Parents liés aux élèves', 'Parents linked to students')}</h3>
            </div>
            <Users className="h-6 w-6 text-cyan-300" />
          </div>
          <div className="mt-4 grid gap-2">
            <input
              value={parentSearch}
              onChange={(event) => setParentSearch(event.target.value)}
              placeholder={L('Recherche précise : parent + enfant + email + téléphone...', 'Precise search: parent + child + email + phone...')}
              className={inputClass}
            />
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <select value={contactFilter} onChange={(event) => setContactFilter(event.target.value)} className={inputClass}>
                <option value="all">Tous les contacts</option>
                <option value="email">Avec email</option>
                <option value="sms">Avec telephone/SMS</option>
                <option value="both">Email + SMS</option>
              </select>
              <button type="button" onClick={toggleAllVisibleParents} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-400/15">
                {allVisibleSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {allVisibleSelected ? 'Retirer visibles' : 'Tous visibles'}
              </button>
              <button type="button" onClick={() => setSelectedParentIds([])} className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-github-border px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800/70">
                Vider
              </button>
            </div>
            <p className="text-xs text-slate-500">{visibleParents.length} parent(s) dans le filtre - {selectedParentIds.length} selectionne(s). Selection possible: 1, 2, 3, n ou tous.</p>
          </div>
          <div className="mt-4 max-h-[460px] space-y-2 overflow-y-auto pr-1">
            {visibleParents.map((parent) => {
              const checked = selectedParentIds.includes(String(parent.id));
              return (
                <button
                  key={parent.id}
                  type="button"
                  onClick={() => toggleParent(parent.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${checked ? 'border-cyan-300/60 bg-cyan-400/12' : 'border-github-border bg-slate-950/35 hover:border-cyan-400/40 hover:bg-slate-900/70'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-100">{parent.name}</p>
                      <p className="mt-1 text-xs text-slate-400">{parent.students.join(', ')}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${checked ? 'bg-cyan-300 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                      {checked ? 'Sélectionné' : 'Choisir'}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">{parent.email || 'Email absent'} · {parent.phone || 'Téléphone absent'}</p>
                </button>
              );
            })}
          </div>
        </article>

        <article className="card p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">{L('Composer', 'Compose')}</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-slate-100">{L('Message email + SMS', 'Email + SMS message')}</h3>
              <p className="mt-1 text-sm text-slate-400">{selectedParents.length} parent(s) sélectionné(s)</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setSendEmail((value) => !value)} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${sendEmail ? 'border-emerald-300/50 bg-emerald-300/12 text-emerald-200' : 'border-github-border text-slate-400'}`}>
                <Mail className="h-4 w-4" /> Email
              </button>
              <button type="button" onClick={() => setSendSms((value) => !value)} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${sendSms ? 'border-cyan-300/50 bg-cyan-300/12 text-cyan-200' : 'border-github-border text-slate-400'}`}>
                <MessageSquare className="h-4 w-4" /> SMS
              </button>
            </div>
          </div>

          <form onSubmit={sendMessage} className="mt-5 space-y-4">
            <input value={draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} placeholder={L('Sujet', 'Subject')} className={inputClass} required />
            <textarea
              value={draft.body}
              onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              placeholder={recommendedText}
              className={`${inputClass} min-h-[210px] resize-y`}
            />
            <div className="rounded-2xl border border-github-border bg-slate-950/45 p-4 text-sm text-slate-300">
              {recommendedText}
            </div>
            <button type="submit" disabled={sending} className="sticky bottom-3 z-10 inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-2xl border border-cyan-200/60 bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400 px-6 py-4 text-base font-black text-slate-950 shadow-[0_16px_40px_rgba(14,165,233,0.38)] ring-2 ring-cyan-300/20 transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-wait disabled:opacity-60 sm:w-auto">
              <Send className="h-5 w-5" />
              {sending ? 'Envoi en cours...' : selectedParents.length > 1 ? `Envoyer aux ${selectedParents.length} parents` : 'Envoyer au parent'}
            </button>
          </form>
        </article>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-amber-300">{L('Historique', 'History')}</p>
            <h3 className="mt-2 font-display text-xl font-semibold text-slate-100">{L('Messages sortants', 'Outgoing messages')}</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder={L("Rechercher dans l'historique...", 'Search message history...')} className={inputClass} />
            <select value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value)} className={inputClass}>
              <option value="all">Tous les statuts</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="sent">Envoyé</option>
              <option value="simulated">Simulation</option>
              <option value="failed">Échec</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="bg-slate-800/55 text-slate-300">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Parent</th>
                <th className="px-4 py-3 text-left font-semibold">Sujet</th>
                <th className="px-4 py-3 text-left font-semibold">Canaux</th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredMessages.map((message, index) => (
                <tr key={message.id || index} className="border-t border-github-border hover:bg-slate-800/35">
                  <td className="px-4 py-3 text-slate-100">{message.receiver_name || 'Parent'}</td>
                  <td className="px-4 py-3 text-slate-200">
                    <p className="font-semibold">{message.subject}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-500">{message.body}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(message.delivery?.length ? message.delivery : [{ channel: 'sync', status: 'pending' }]).map((item) => (
                        <span key={`${message.id}-${item.channel}-${item.status}`} className={`rounded-full border px-2 py-1 text-xs ${deliveryClass[item.status] || deliveryClass.pending}`}>
                          {item.channel.toUpperCase()} {item.status}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{message.sent_at ? new Date(message.sent_at).toLocaleString() : '-'}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setSelectedMessage(message)} className="savanex-entity-action savanex-entity-action-view">
                      <Eye className="h-4 w-4" /> {L('Voir', 'View')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedMessage ? (
        <div className="savanex-modal-backdrop fixed inset-0 z-[1000] grid place-items-center overflow-y-auto px-4 py-8" role="dialog" aria-modal="true" onClick={() => setSelectedMessage(null)}>
          <section className="savanex-modal-panel w-full max-w-4xl overflow-y-auto p-5 sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Message parent</p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-slate-100">{selectedMessage.subject}</h3>
                <p className="mt-1 text-sm text-slate-400">{selectedMessage.receiver_name || 'Parent'} · {selectedMessage.sent_at ? new Date(selectedMessage.sent_at).toLocaleString() : '-'}</p>
              </div>
              <button type="button" onClick={() => setSelectedMessage(null)} className="inline-flex items-center gap-2 rounded-xl border border-github-border px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/60">
                <X className="h-4 w-4" /> {L('Fermer', 'Close')}
              </button>
            </div>
            <div className="rounded-2xl border border-github-border bg-slate-950/45 p-4 text-sm leading-7 text-slate-200">
              {selectedMessage.body}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(selectedMessage.delivery || []).map((item) => (
                <span key={`${item.channel}-${item.status}-${item.detail}`} className={`rounded-full border px-3 py-1.5 text-xs ${deliveryClass[item.status] || deliveryClass.pending}`}>
                  {item.channel.toUpperCase()} {item.status}: {item.detail || '-'}
                </span>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </DashboardLayout>
  );
};

export default CommunicationPage;
