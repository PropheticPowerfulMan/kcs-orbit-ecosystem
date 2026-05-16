import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DataTable from '../../components/ui/DataTable';
import StatCard from '../../components/ui/StatCard';
import { useTranslation } from 'react-i18next';
import { communicationService, studentsService } from '../../services/api';

const deliveryClass = {
  sent: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  simulated: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',
  skipped: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  failed: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
};

const inputClass = 'rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue';

const initialDraft = {
  receiver: '',
  subject: 'Suivi scolaire SAVANEX',
  body: '',
};

const buildParentOptions = (students) => {
  const parents = new Map();
  students.forEach((student) => {
    if (!student.parent || String(student.parent).startsWith('orbit:')) {
      return;
    }
    if (!parents.has(student.parent)) {
      parents.set(student.parent, {
        id: student.parent,
        name: student.parent_name || 'Parent',
        email: student.parent_email || '',
        phone: student.parent_phone || '',
        students: [],
      });
    }
    parents.get(student.parent).students.push(student.full_name);
  });
  return Array.from(parents.values()).sort((left, right) => left.name.localeCompare(right.name));
};

const formatDelivery = (delivery = []) => {
  if (!delivery.length) return 'En attente';
  return delivery.map((item) => `${item.channel.toUpperCase()}: ${item.status}`).join(' | ');
};

const CommunicationPage = () => {
  const { t } = useTranslation();
  const [messageList, setMessageList] = useState([]);
  const [students, setStudents] = useState([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    async function loadCommunication() {
      setLoading(true);
      setError('');
      try {
        const [messages, loadedStudents] = await Promise.all([
          communicationService.getMessages('sent'),
          studentsService.getAll(),
        ]);
        if (!alive) return;
        setMessageList(messages);
        setStudents(loadedStudents);
      } catch (loadError) {
        if (!alive) return;
        setError(loadError?.response?.data?.detail || loadError?.message || 'Impossible de charger la communication.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadCommunication();
    return () => {
      alive = false;
    };
  }, []);

  const parentOptions = useMemo(() => buildParentOptions(students), [students]);
  const selectedParent = parentOptions.find((parent) => String(parent.id) === String(draft.receiver));

  const recommendedText = useMemo(() => {
    if (!selectedParent) {
      return 'Bonjour, SAVANEX souhaite vous informer de l evolution scolaire de votre enfant. Merci de contacter l administration si vous souhaitez un accompagnement.';
    }
    const childLabel = selectedParent.students.join(', ') || 'votre enfant';
    return `Bonjour ${selectedParent.name}, SAVANEX souhaite vous informer de l evolution scolaire de ${childLabel}. Merci de contacter l administration si vous souhaitez un accompagnement.`;
  }, [selectedParent]);

  const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const useSuggestedMessage = () => {
    setDraft((current) => ({
      ...current,
      body: recommendedText,
    }));
  };

  const submitDraft = async (event) => {
    event.preventDefault();
    setSending(true);
    setError('');
    setNotice('');

    try {
      const created = await communicationService.sendParentMessage({
        receiver: draft.receiver,
        subject: draft.subject,
        body: draft.body || recommendedText,
      });
      setMessageList((current) => [created, ...current]);
      setNotice(`Message envoye. ${formatDelivery(created.delivery)}`);
      setComposerOpen(false);
      setDraft(initialDraft);
    } catch (sendError) {
      setError(sendError?.response?.data?.detail || sendError?.message || "Impossible d'envoyer le message.");
    } finally {
      setSending(false);
    }
  };

  const deliveryStats = useMemo(() => {
    const all = messageList.flatMap((message) => message.delivery || []);
    return {
      sent: all.filter((item) => item.status === 'sent').length,
      simulated: all.filter((item) => item.status === 'simulated').length,
      failed: all.filter((item) => item.status === 'failed').length,
    };
  }, [messageList]);

  const columns = [
    { key: 'subject', label: 'Sujet' },
    { key: 'receiver_name', label: 'Parent' },
    { key: 'body', label: 'Message', render: (value) => <span className="line-clamp-2 text-slate-300">{value}</span> },
    {
      key: 'delivery',
      label: 'Email + SMS',
      render: (delivery) => (
        <div className="flex flex-wrap gap-1.5">
          {(delivery?.length ? delivery : [{ channel: 'sync', status: 'pending' }]).map((item) => (
            <span key={`${item.channel}-${item.status}`} className={`rounded-full border px-2 py-1 text-xs ${deliveryClass[item.status] || deliveryClass.skipped}`}>
              {item.channel.toUpperCase()} {item.status}
            </span>
          ))}
        </div>
      ),
    },
    { key: 'sent_at', label: 'Date', render: (value) => value ? new Date(value).toLocaleString() : '-' },
  ];

  return (
    <DashboardLayout>
      <section className="mb-6 flex flex-col gap-4 page-enter lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-kcs-blue">Communication hub</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-100">{t('nav.communication')}</h2>
          <p className="mt-2 text-sm text-slate-400">Messages parents par email + SMS, avec alertes automatiques selon notes, presence et evolution.</p>
        </div>
        <button
          type="button"
          onClick={() => setComposerOpen((value) => !value)}
          className="rounded-xl bg-kcs-blue px-4 py-2 text-sm font-semibold text-slate-950"
        >
          Composer un message
        </button>
      </section>

      {notice ? <p className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{notice}</p> : null}
      {error ? <p className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      {composerOpen ? (
        <section className="mb-6 card p-5">
          <h3 className="font-display text-lg font-semibold text-slate-100">Nouveau message parent</h3>
          <form onSubmit={submitDraft} className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_1fr_auto]">
            <select value={draft.receiver} onChange={(event) => updateDraft('receiver', event.target.value)} className={inputClass} required>
              <option value="">Choisir un parent</option>
              {parentOptions.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name} - {parent.students.join(', ')}
                </option>
              ))}
            </select>
            <input value={draft.subject} onChange={(event) => updateDraft('subject', event.target.value)} placeholder="Sujet" className={inputClass} required />
            <button type="button" onClick={useSuggestedMessage} className="rounded-xl border border-github-border px-4 py-3 text-sm font-semibold text-slate-200">
              Message suggere
            </button>
            <textarea
              value={draft.body}
              onChange={(event) => updateDraft('body', event.target.value)}
              placeholder={recommendedText}
              className={`${inputClass} min-h-32 lg:col-span-2`}
            />
            <button type="submit" disabled={sending || !draft.receiver} className="rounded-xl bg-kcs-blue px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
              {sending ? 'Envoi...' : 'Envoyer email + SMS'}
            </button>
          </form>
          <p className="mt-4 rounded-xl border border-github-border bg-slate-950/45 p-4 text-sm text-slate-300">{recommendedText}</p>
        </section>
      ) : null}

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Messages envoyes" value={loading ? '...' : messageList.length} accent="text-cyan-300" />
        <StatCard title="Canaux envoyes" value={deliveryStats.sent} subtitle="Email/SMS reels" accent="text-emerald-300" />
        <StatCard title="Simulations SMS" value={deliveryStats.simulated} subtitle="Cle SMS a configurer" accent="text-cyan-300" />
        <StatCard title="Echecs" value={deliveryStats.failed} subtitle="A verifier" accent="text-rose-300" />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <article className="card p-5 lg:col-span-2">
          <p className="font-display text-lg font-semibold text-slate-100">Alertes automatiques actives</p>
          <p className="mt-2 text-sm text-slate-400">SAVANEX avertit les parents quand une note est publiee, quand une absence/retard est enregistre, quand la moyenne baisse ou progresse nettement, ou quand la presence passe sous 75%.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">Email</span>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">SMS</span>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">Notification interne</span>
          </div>
        </article>
        <article className="card p-5">
          <p className="text-sm text-slate-400">Parents joignables</p>
          <p className="mt-2 font-display text-4xl font-bold text-emerald-300">{parentOptions.length}</p>
          <p className="mt-2 text-xs text-slate-500">Comptes parents locaux avec email ou telephone.</p>
        </article>
      </section>

      <DataTable columns={columns} data={messageList} />
    </DashboardLayout>
  );
};

export default CommunicationPage;
