import InternationalPhoneInput from "./InternationalPhoneInput";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { apiRequest } from "../services/api";
import { schoolLogo } from "../assets";

const quickPrompts = [
  {
    label: "Annonce",
    text: "Prepare une annonce urgente aux parents pour la reunion de demain matin.",
  },
  {
    label: "Conge",
    text: "Je veux demander un conge de recuperation apres la surveillance des examens.",
  },
  {
    label: "Rapport",
    text: "Aide-moi a preparer un rapport hebdomadaire pour le departement Academics.",
  },
];

const tabItems = [
  ["chat", "Chat", "AI"],
  ["directory", "Entités", "CRUD"],
  ["actions", "Actions", "+"],
  ["activity", "Activity", "Log"],
  ["inbox", "Inbox", "New"],
  ["guide", "Guide", "?"],
  ["settings", "Réglages", "Key"],
];

const featureGuide = [
  {
    title: "AI Chatbot",
    detail: "It understands school requests, detects intent, and recommends the next action.",
  },
  {
    title: "Announcements",
    detail: "It creates priority-based messages for teachers, staff, or the whole school.",
  },
  {
    title: "Workflows",
    detail: "It turns internal requests into approval flows, such as leave or sign-off requests.",
  },
  {
    title: "Notifications",
    detail: "It centralizes important alerts and reminders sent to users.",
  },
  {
    title: "Analytics",
    detail: "It shows recent activity and communication performance for administrators.",
  },
];

function formatIntent(intent) {
  return intent.replaceAll("_", " ");
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function greetingForNow(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function displayRole(role) {
  return ({ admin: "Administrator", teacher: "Teacher", staff: "Staff", parent: "Parent", student: "Student" })[role] || "KCS member";
}

function EmptyState({ children }) {
  return <p className="mobile-empty">{children}</p>;
}

export default function DashboardPanel() {
  const { token, logout, user, profileLoading } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("chat");
  const [chatText, setChatText] = useState("");
  const chatInputRef = useRef(null);
  const messageEndRef = useRef(null);
  const screenRef = useRef(null);
  const [chatMessages, setChatMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      text:
        "Bonjour. Je suis EduSync AI, la voix operationnelle de l'ecosysteme. Je peux parler au nom du systeme, resumer son etat reel, alerter les personnes concernees, preparer des annonces, workflows et rapports, et signaler les donnees manquantes au lieu d'inventer.",
      intent: "assistant",
      confidence: 1,
      actions: ["show_capabilities"],
      time: formatTime(),
    },
  ]);
  const [announcements, setAnnouncements] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [sharedDirectory, setSharedDirectory] = useState({ parents: [], students: [], teachers: [] });
  const [editingEntity, setEditingEntity] = useState(null);
  const [entityForm, setEntityForm] = useState({ entityType: "parent", fullName: "", email: "", phone: "", className: "", parentOrbitId: "", subject: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [busyChat, setBusyChat] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    title: "Weekly reminder",
    content: "Please send department highlights by Friday at 5 PM.",
    priority: "normal",
    channel: "teachers",
  });
  const [workflowForm, setWorkflowForm] = useState({
    type: "leave_request",
    payload: "Leave request for recovery after exam supervision.",
  });

  const unreadCount = useMemo(
    () => notifications.filter((item) => !(item.is_read ?? item.read)).length,
    [notifications]
  );

  const navigateTo = (tab, options = {}) => {
    setActiveTab(tab);
    setError("");
    if (!options.keepNotice) {
      setNotice("");
    }
    requestAnimationFrame(() => {
      screenRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      if (tab === "chat") {
        chatInputRef.current?.focus();
      }
    });
  };

  const loadData = async () => {
    setError("");
    try {
      const [a, w, n, directory] = await Promise.all([
        apiRequest("/messaging/announcements", "GET", null, token),
        apiRequest("/workflows", "GET", null, token),
        apiRequest("/notifications", "GET", null, token),
        apiRequest("/directory/shared", "GET", null, token).catch(() => ({ parents: [], students: [], teachers: [] })),
      ]);
      setAnnouncements(a);
      setWorkflows(w);
      setNotifications(n);
      setSharedDirectory(directory);

      try {
        const metrics = await apiRequest("/analytics/dashboard", "GET", null, token);
        setAnalytics(metrics);
      } catch {
        setAnalytics(null);
      }
    } catch (err) {
      if (err.status === 401) {
        logout();
        return;
      }
      setError(err.message);
    }
  };

  const saveEntity = async (event) => {
    event.preventDefault();
    setError("");
    const { entityType, ...values } = entityForm;
    const payload = Object.fromEntries(Object.entries(values).filter(([, value]) => String(value ?? "").trim()));
    try {
      const path = editingEntity
        ? `/registry/entities/${entityType}/${encodeURIComponent(editingEntity.id)}?identifier_type=orbitId`
        : `/registry/entities/${entityType}`;
      await apiRequest(path, editingEntity ? "PATCH" : "POST", { payload }, token);
      setNotice(editingEntity ? "Entité modifiée et propagée." : "Entité créée et propagée.");
      setEditingEntity(null);
      setEntityForm({ entityType, fullName: "", email: "", phone: "", className: "", parentOrbitId: "", subject: "" });
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const editEntity = (entityType, entity) => {
    setEditingEntity(entity);
    setEntityForm({
      entityType,
      fullName: entity.fullName || "",
      email: entity.email || "",
      phone: entity.phone || "",
      className: entity.className || "",
      parentOrbitId: entity.parentId || "",
      subject: entity.subject || "",
    });
    navigateTo("directory");
  };

  const deleteEntity = async (entityType, entity) => {
    if (!window.confirm(`Supprimer ${entity.fullName || entity.id} dans tout l'écosystème ?`)) return;
    try {
      await apiRequest(`/registry/entities/${entityType}/${encodeURIComponent(entity.id)}?identifier_type=orbitId`, "DELETE", null, token);
      setNotice("Entité supprimée et propagation demandée.");
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!passwordForm.current) return setError("Saisissez votre mot de passe actuel.");
    if (passwordForm.next.length < 8) return setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
    if (passwordForm.next !== passwordForm.confirm) return setError("Les nouveaux mots de passe ne correspondent pas.");
    setPasswordBusy(true);
    try {
      await apiRequest("/auth/change-password", "POST", { current_password: passwordForm.current, new_password: passwordForm.next }, token);
      setPasswordForm({ current: "", next: "", confirm: "" });
      setNotice("Mot de passe modifié. Utilisez-le lors de votre prochaine connexion.");
    } catch (err) { setError(err.message); } finally { setPasswordBusy(false); }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === "chat") {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [activeTab, chatMessages, busyChat]);

  const askAssistant = async (message = chatText) => {
    const cleanMessage = message.trim();
    if (!cleanMessage) return;

    setBusyChat(true);
    setError("");
    setNotice("");
    setChatText("");
    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: cleanMessage,
      time: formatTime(),
      status: "read",
    };
    setChatMessages((current) => [...current, userMessage]);

    try {
      const data = await apiRequest(
        "/chat/query",
        "POST",
        { message: cleanMessage, context: { source: "workspace_chat", conversation: chatMessages.slice(-8).map(({ role, text }) => ({ role, text })) } },
        token
      );
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: data.response,
          intent: data.intent,
          confidence: data.confidence,
          actions: data.actions || [],
          time: formatTime(),
        },
      ]);
    } catch (err) {
      setError(err.message);
      if (err.status === 401) {
        logout();
      }
      setChatMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          text:
            err.status === 401
              ? "Your session expired. Sign in again to continue using EduSync AI."
              : err.message,
          intent: "error",
          confidence: 0,
          actions: [],
          time: formatTime(),
        },
      ]);
    } finally {
      setBusyChat(false);
    }
  };

  const createAnnouncement = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      await apiRequest("/messaging/announcements", "POST", announcementForm, token);
      await loadData();
      setNotice("Announcement created and added to activity.");
      navigateTo("activity", { keepNotice: true });
    } catch (err) {
      setError(err.message);
    }
  };

  const createWorkflow = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      await apiRequest("/workflows", "POST", workflowForm, token);
      await loadData();
      setNotice("Workflow submitted and ready for follow-up.");
      navigateTo("activity", { keepNotice: true });
    } catch (err) {
      setError(err.message);
    }
  };

  const markNotificationRead = async (notificationId) => {
    try {
      const updated = await apiRequest(`/notifications/${notificationId}/read`, "PATCH", null, token);
      setNotifications((current) =>
        current.map((item) => (item.id === notificationId ? { ...item, ...updated } : item))
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const markAllNotificationsRead = async () => {
    const unread = notifications.filter((item) => !(item.is_read ?? item.read));
    if (!unread.length) {
      setNotice("No unread notifications.");
      navigateTo("inbox", { keepNotice: true });
      return;
    }

    setError("");
    try {
      const updatedItems = await Promise.all(
        unread.map((item) => apiRequest(`/notifications/${item.id}/read`, "PATCH", null, token))
      );
      setNotifications((current) =>
        current.map((item) => {
          const updated = updatedItems.find((entry) => entry.id === item.id);
          return updated ? { ...item, ...updated } : item;
        })
      );
      setNotice("All notifications marked as read.");
      navigateTo("inbox", { keepNotice: true });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSuggestedAction = (action) => {
    if (busyChat) return;
    const readableAction = formatIntent(action);
    const normalized = action.toLowerCase();

    if (normalized.includes("announcement") || normalized.includes("annonce") || normalized.includes("audience")) {
      setAnnouncementForm((prev) => ({
        ...prev,
        priority: normalized.includes("priority") || normalized.includes("priorite") ? "urgent" : prev.priority,
        channel: normalized.includes("audience") ? "teachers" : prev.channel,
      }));
      setNotice(`Ready to ${readableAction}. Review the announcement form.`);
      navigateTo("actions", { keepNotice: true });
      return;
    }

    if (normalized.includes("leave") || normalized.includes("conge") || normalized.includes("workflow")) {
      setWorkflowForm((prev) => ({
        ...prev,
        type: "leave_request",
        payload: prev.payload || "Leave request with dates, reason, and handover plan.",
      }));
      setNotice(`Ready to ${readableAction}. Review the workflow form.`);
      navigateTo("actions", { keepNotice: true });
      return;
    }

    if (normalized.includes("notification") || normalized.includes("alerte") || normalized.includes("read") || normalized.includes("lu")) {
      if (normalized.includes("read") || normalized.includes("lu")) {
        markAllNotificationsRead();
        return;
      }
      setNotice("Notification center opened.");
      navigateTo("inbox", { keepNotice: true });
      return;
    }

    if (normalized.includes("guide") || normalized.includes("capacit") || normalized.includes("capabilit")) {
      setNotice("Guide opened.");
      navigateTo("guide", { keepNotice: true });
      return;
    }

    if (normalized.includes("report") || normalized.includes("rapport") || normalized.includes("analytics")) {
      setNotice("Activity and analytics opened.");
      navigateTo("guide", { keepNotice: true });
      return;
    }

    if (normalized.includes("clarify") || normalized.includes("clarifier") || normalized.includes("suggest")) {
      setChatText(`Help me clarify this request: ${readableAction}`);
      navigateTo("chat");
      return;
    }

    askAssistant(`Explain and prepare the next step for this action: ${readableAction}`);
  };

  return (
    <main className="mobile-app-shell">
      <section className="phone-frame" aria-label="EduSync AI mobile chatbot">
        <header className="mobile-header">
          <div className="brand-lockup compact social-brand">
            <img src={schoolLogo} alt="Kinshasa Christian School" className="school-logo" />
            <div>
              <p className="eyebrow">Kinshasa Christian School</p>
              <h1>EduSync AI</h1>
              <span className="presence-line">{profileLoading ? "Loading your workspace..." : greetingForNow() + ", " + (user?.full_name || "KCS member") + " · " + displayRole(user?.role)}</span>
            </div>
          </div>
          <div className="icon-actions">
            <button type="button" className="icon-button" onClick={toggleTheme} aria-label="Toggle theme">
              {isDark ? "L" : "D"}
            </button>
            <button type="button" className="icon-button" onClick={logout} aria-label="Sign out">
              X
            </button>
          </div>
        </header>

        {error && <p className="error-text app-error">{error}</p>}
        {notice && <p className="notice-text app-error">{notice}</p>}

        <section className="mobile-status">
          <article className="status-story">
            <span>{announcements.length}</span>
            <p>Announcements</p>
          </article>
          <article className="status-story">
            <span>{workflows.length}</span>
            <p>Workflows</p>
          </article>
          <article className="status-story">
            <span>{sharedDirectory.students?.length ?? 0}</span>
            <p>Students</p>
          </article>
          <article className="status-story">
            <span>{sharedDirectory.teachers?.length ?? 0}</span>
            <p>Employees</p>
          </article>
        </section>

        <div className="mobile-screen" ref={screenRef}>
          <div className="workspace-commandbar">
            <div><p className="eyebrow">KCS operational workspace</p><strong>{tabItems.find(([key]) => key === activeTab)?.[1] || "Workspace"}</strong></div>
            <div className="workspace-health"><span>Orbit synced</span><span>Secure session</span></div>
          </div>
          {activeTab === "chat" && (
            <section className="chat-view">
              <div className="section-title">
                <div>
                  <p className="eyebrow">EduSync workspace</p>
                  <h2>What would you like to do?</h2>
                </div>
                <span>{analytics?.events_last_24h ?? 0} actions today</span>
              </div>

              <div className="quick-prompt-row">
                {quickPrompts.map((prompt) => (
                  <button
                    type="button"
                    className="prompt-chip"
                    key={prompt.label}
                    onClick={() => askAssistant(prompt.text)}
                    disabled={busyChat}
                  >
                    <span className="story-ring">{prompt.label.slice(0, 1)}</span>
                    {prompt.label}
                  </button>
                ))}
              </div>

              <div className="message-list">
                {chatMessages.map((message) => (
                  <article className={`message-bubble ${message.role}`} key={message.id}>
                    <div className="message-content">{String(message.text || "").split("\n").filter(Boolean).map((line, index) => <p key={message.id + "-" + index}>{line}</p>)}</div>
                    {message.role === "assistant" && (
                      <div className="message-meta">
                        <span>{formatIntent(message.intent || "assistant")}</span>
                        <span>{Math.round((message.confidence || 0) * 100)}%</span>
                        <button type="button" className="message-copy" onClick={() => navigator.clipboard?.writeText(message.text)} aria-label="Copy answer">Copy</button>
                      </div>
                    )}
                    {message.actions?.length > 0 && (
                      <div className="action-tags">
                        {message.actions.map((action) => (
                          <button
                            type="button"
                            key={action}
                            onClick={() => handleSuggestedAction(action)}
                            disabled={busyChat}
                          >
                            {formatIntent(action)}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="message-time">
                      <span>{message.time}</span>
                      {message.role === "user" && <span>{message.status}</span>}
                    </div>
                  </article>
                ))}
                {busyChat && (
                  <article className="message-bubble assistant typing-bubble" aria-live="polite">
                    <div className="typing-dots" aria-label="EduSync is typing">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="message-time">
                      <span>EduSync is typing...</span>
                    </div>
                  </article>
                )}
                <div ref={messageEndRef} />
              </div>

              <form
                className="composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  askAssistant();
                }}
              >
                <button
                  type="button"
                  className="composer-tool"
                  onClick={() => setActiveTab("actions")}
                  aria-label="Open actions"
                >
                  +
                </button>
                <input
                  placeholder="Type a request..."
                  ref={chatInputRef}
                  value={chatText}
                  onChange={(event) => setChatText(event.target.value)}
                />
                <button className="send-button" type="submit" disabled={busyChat || !chatText.trim()}>
                  Envoyer
                </button>
              </form>
            </section>
          )}

          {activeTab === "actions" && (
            <section className="action-view action-grid">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Actions</p>
                  <h2>Turn a request into a task</h2>
                </div>
              </div>

              <form className="mobile-form" onSubmit={createAnnouncement}>
                <h3>New announcement</h3>
                <input
                  value={announcementForm.title}
                  onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Titre"
                  required
                />
                <textarea
                  value={announcementForm.content}
                  onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, content: event.target.value }))}
                  placeholder="Message"
                  required
                />
                <div className="field-row">
                  <select
                    value={announcementForm.channel}
                    onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, channel: event.target.value }))}
                  >
                    <option value="all">Whole school</option>
                    <option value="teachers">Teachers</option>
                    <option value="staff">Staff</option>
                  </select>
                  <select
                    value={announcementForm.priority}
                    onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, priority: event.target.value }))}
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="informational">Info</option>
                  </select>
                </div>
                <button type="submit">Create announcement</button>
              </form>

              <form className="mobile-form" onSubmit={createWorkflow}>
                <h3>Internal workflow</h3>
                <select
                  value={workflowForm.type}
                  onChange={(event) => setWorkflowForm((prev) => ({ ...prev, type: event.target.value }))}
                >
                  <option value="leave_request">Leave request</option>
                  <option value="report_submission">Report submission</option>
                  <option value="approval_request">Approval request</option>
                </select>
                <textarea
                  value={workflowForm.payload}
                  onChange={(event) => setWorkflowForm((prev) => ({ ...prev, payload: event.target.value }))}
                  placeholder="Describe the request"
                  required
                />
                <button type="submit">Submit</button>
              </form>
            </section>
          )}

          {activeTab === "directory" && (
            <section className="activity-view">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Registre partagé</p>
                  <h2>Gestion des entités</h2>
                </div>
                <button type="button" className="ghost-button" onClick={loadData}>Synchroniser</button>
              </div>
              <form className="mobile-form" onSubmit={saveEntity}>
                <h3>{editingEntity ? "Modifier l'entité" : "Ajouter une entité"}</h3>
                <select value={entityForm.entityType} disabled={Boolean(editingEntity)} onChange={(event) => setEntityForm((current) => ({ ...current, entityType: event.target.value }))}>
                  <option value="parent">Parent</option>
                  <option value="student">Élève</option>
                  <option value="teacher">Employé / enseignant</option>
                </select>
                <input value={entityForm.fullName} onChange={(event) => setEntityForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Nom complet *" required />
                <input type="email" value={entityForm.email} onChange={(event) => setEntityForm((current) => ({ ...current, email: event.target.value }))} placeholder="Adresse e-mail" />
                <InternationalPhoneInput value={entityForm.phone} onChange={(value) => setEntityForm((current) => ({ ...current, phone: value }))} />
                {entityForm.entityType === "student" && <>
                  <input value={entityForm.className} onChange={(event) => setEntityForm((current) => ({ ...current, className: event.target.value }))} placeholder="Classe *" required />
                  <input value={entityForm.parentOrbitId} onChange={(event) => setEntityForm((current) => ({ ...current, parentOrbitId: event.target.value }))} placeholder="Orbit ID du parent *" required />
                </>}
                {entityForm.entityType === "teacher" && <input value={entityForm.subject} onChange={(event) => setEntityForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Fonction / matière" />}
                <div className="field-row">
                  {editingEntity && <button type="button" className="ghost-button" onClick={() => { setEditingEntity(null); setEntityForm({ entityType: entityForm.entityType, fullName: "", email: "", phone: "", className: "", parentOrbitId: "", subject: "" }); }}>Annuler</button>}
                  <button type="submit">{editingEntity ? "Enregistrer les modifications" : "Créer et propager"}</button>
                </div>
              </form>
              {[
                ["parent", sharedDirectory.parents || []],
                ["student", sharedDirectory.students || []],
                ["teacher", sharedDirectory.teachers || []],
              ].map(([entityType, rows]) => (
                <div className="activity-section" key={entityType}>
                  <h3>{entityType === "parent" ? "Parents" : entityType === "student" ? "Élèves" : "Employés"}</h3>
                  {rows.length ? rows.map((entity) => (
                    <article className="activity-row" key={entity.id}>
                      <div><p>{entity.fullName}</p><span>{entity.displayId || entity.studentNumber || entity.employeeId || entity.id}</span></div>
                      <div className="action-tags">
                        <button type="button" onClick={() => editEntity(entityType, entity)}>Modifier</button>
                        <button type="button" onClick={() => deleteEntity(entityType, entity)}>Supprimer</button>
                      </div>
                    </article>
                  )) : <EmptyState>Aucune entité.</EmptyState>}
                </div>
              ))}
            </section>
          )}

          {activeTab === "activity" && (
            <section className="activity-view">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Activity</p>
                  <h2>What the app manages</h2>
                </div>
                <button type="button" className="ghost-button" onClick={loadData}>
                  Sync
                </button>
              </div>

              <div className="activity-section">
                <h3>Recent announcements</h3>
                {announcements.slice(0, 4).map((item) => (
                  <article className="activity-row" key={item.id}>
                    <div>
                      <p>{item.title}</p>
                      <span>{item.content}</span>
                    </div>
                    <strong>{item.priority}</strong>
                  </article>
                ))}
                {!announcements.length && <EmptyState>No announcements yet.</EmptyState>}
              </div>

              <div className="activity-section">
                <h3>Workflows</h3>
                {workflows.slice(0, 4).map((item) => (
                  <article className="activity-row" key={item.id}>
                    <div>
                      <p>{formatIntent(item.type)}</p>
                      <span>{item.payload}</span>
                    </div>
                    <strong>{item.status}</strong>
                  </article>
                ))}
                {!workflows.length && <EmptyState>No submitted workflows.</EmptyState>}
              </div>
            </section>
          )}

          {activeTab === "inbox" && (
            <section className="inbox-view">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Notifications</p>
                  <h2>Internal alerts</h2>
                </div>
              </div>

              {notifications.map((item) => {
                const isRead = item.is_read ?? item.read;
                return (
                  <article className={`notification-row ${isRead ? "read" : ""}`} key={item.id}>
                    <div>
                      <p>{item.title}</p>
                      <span>{item.content || "EduSync AI internal notification"}</span>
                    </div>
                    {!isRead && (
                      <button type="button" className="ghost-button" onClick={() => markNotificationRead(item.id)}>
                        Read
                      </button>
                    )}
                  </article>
                );
              })}
              {!notifications.length && <EmptyState>No notifications.</EmptyState>}
            </section>
          )}

          {activeTab === "settings" && (
            <section className="action-view">
              <div className="section-title"><div><p className="eyebrow">Sécurité du compte</p><h2>Changer mon mot de passe</h2></div></div>
              <p className="mobile-empty">Le mot de passe actuel n’est jamais affiché. Saisissez-le pour que son hash soit vérifié.</p>
              <form className="workflow-form" onSubmit={changePassword} autoComplete="off">
                <label>Mot de passe actuel<input required type="password" autoComplete="off" data-lpignore="true" value={passwordForm.current} onChange={(event) => setPasswordForm((current) => ({ ...current, current: event.target.value }))} placeholder="Saisissez le mot de passe actuel" /></label>
                <label>Nouveau mot de passe<input required minLength={8} type="password" autoComplete="new-password" value={passwordForm.next} onChange={(event) => setPasswordForm((current) => ({ ...current, next: event.target.value }))} placeholder="8 caractères minimum" /></label>
                <label>Confirmer<input required minLength={8} type="password" autoComplete="new-password" value={passwordForm.confirm} onChange={(event) => setPasswordForm((current) => ({ ...current, confirm: event.target.value }))} /></label>
                <button type="submit" disabled={passwordBusy}>{passwordBusy ? "Vérification…" : "Changer le mot de passe"}</button>
              </form>
            </section>
          )}

          {activeTab === "guide" && (
            <section className="guide-view">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Guide</p>
                  <h2>What is EduSync AI for?</h2>
                </div>
              </div>

              <div className="guide-list">
                {featureGuide.map((item) => (
                  <article key={item.title}>
                    <h3>{item.title}</h3>
                    <p>{item.detail}</p>
                  </article>
                ))}
              </div>

              <div className="analytics-card">
                <h3>Admin dashboard</h3>
                {analytics ? (
                  <>
                    <p>Total events: {analytics.total_events}</p>
                    <p>Average latency: {analytics.average_response_latency_ms} ms</p>
                    <div className="action-tags">
                      {analytics.department_activity.map((item) => (
                        <span key={item.department}>
                          {item.department}: {item.events}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p>Analytics are visible with an administrator account.</p>
                )}
              </div>
            </section>
          )}
        </div>

        <nav className="bottom-tabs" aria-label="Navigation principale">
          <div className="edusync-side-brand">
            <img src={schoolLogo} alt="" />
            <div><strong>EduSync <span>AI</span></strong><small>KCS ECOSYSTEM</small></div>
          </div>
          <p className="edusync-side-label">Workspace</p>
          {tabItems.map(([key, label, icon]) => (
            <button
              type="button"
              key={key}
              className={activeTab === key ? "active" : ""}
              onClick={() => navigateTo(key)}
              aria-current={activeTab === key ? "page" : undefined}
            >
              <span className="tab-icon">{key === "inbox" && unreadCount > 0 ? unreadCount : icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </section>
    </main>
  );
}
