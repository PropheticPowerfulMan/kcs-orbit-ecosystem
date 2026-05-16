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
  ["actions", "Actions", "+"],
  ["activity", "Activity", "Log"],
  ["inbox", "Inbox", "New"],
  ["guide", "Guide", "?"],
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

function EmptyState({ children }) {
  return <p className="mobile-empty">{children}</p>;
}

export default function DashboardPanel() {
  const { token, logout } = useAuth();
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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
        { message: cleanMessage, context: { source: "mobile_chat" } },
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
              <span className="presence-line">Online now</span>
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
        </section>

        <div className="mobile-screen" ref={screenRef}>
          {activeTab === "chat" && (
            <section className="chat-view">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Mobile assistant</p>
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
                    <p>{message.text}</p>
                    {message.role === "assistant" && (
                      <div className="message-meta">
                        <span>{formatIntent(message.intent || "assistant")}</span>
                        <span>{Math.round((message.confidence || 0) * 100)}%</span>
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
            <section className="action-view">
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
