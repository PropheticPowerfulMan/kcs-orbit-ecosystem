const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
const hasConfiguredApi = Boolean(import.meta.env.VITE_API_URL);
const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
const isLocalHost = ["localhost", "127.0.0.1", ""].includes(hostname);
const IS_DEMO = import.meta.env.VITE_DEMO_MODE === "true" || (!hasConfiguredApi && !isLocalHost);

const demoState = {
  users: [
    {
      id: 1,
      full_name: "System Administrator",
      email: "admin@school.edu",
      password: "Admin@123",
      role: "admin",
      department: "Administration",
    },
  ],
  announcements: [
    {
      id: 1,
      title: "Weekly Faculty Reminder",
      content: "Submit department highlights by Friday 5PM.",
      priority: "normal",
      channel: "teachers",
      status: "sent",
    },
  ],
  workflows: [
    {
      id: 1,
      requester_id: 1,
      approver_id: null,
      type: "leave_request",
      payload: "Need leave for exam supervision recovery day.",
      status: "pending",
      ai_suggestion: "Route to administration for approval.",
    },
  ],
  notifications: [
    {
      id: 1,
      title: "Staff meeting moved to 10:00 AM",
      content: "The administration meeting has been rescheduled and needs acknowledgement.",
      priority: "high",
      is_read: false,
    },
  ],
};

function demoResponse(path, method, body) {
  if (path === "/auth/login" && method === "POST") {
    const user = demoState.users.find(
      (item) => item.email === body?.email && item.password === body?.password
    );
    if (user) {
      return { access_token: `demo-${user.role}-token-${user.id}` };
    }
    throw new Error("Invalid credentials");
  }

  if (path === "/auth/register" && method === "POST") {
    const exists = demoState.users.some((item) => item.email === body?.email);
    if (exists) {
      throw new Error("Email is already registered");
    }
    const user = { id: Date.now(), ...body };
    demoState.users = [user, ...demoState.users];
    return user;
  }

  if (path === "/messaging/announcements" && method === "GET") {
    return demoState.announcements;
  }

  if (path === "/messaging/announcements" && method === "POST") {
    const announcement = {
      id: Date.now(),
      status: "sent",
      ...body,
    };
    demoState.announcements = [announcement, ...demoState.announcements];
    return announcement;
  }

  if (path === "/workflows" && method === "GET") {
    return demoState.workflows;
  }

  if (path === "/workflows" && method === "POST") {
    const workflow = {
      id: Date.now(),
      requester_id: 1,
      approver_id: null,
      status: "pending",
      ai_suggestion: "AI suggests routing this request to an administrator.",
      ...body,
    };
    demoState.workflows = [workflow, ...demoState.workflows];
    return workflow;
  }

  if (path === "/notifications" && method === "GET") {
    return demoState.notifications;
  }

  if (path.startsWith("/notifications/") && path.endsWith("/read") && method === "PATCH") {
    const id = Number(path.split("/")[2]);
    const notification = demoState.notifications.find((item) => item.id === id);
    if (!notification) {
      throw new Error("Notification not found");
    }
    notification.is_read = true;
    return notification;
  }

  if (path === "/analytics/dashboard" && method === "GET") {
    return {
      total_events: 128,
      events_last_24h: 23,
      average_response_latency_ms: 420,
      department_activity: [
        { department: "Academics", events: 54 },
        { department: "Administration", events: 39 },
        { department: "Student Affairs", events: 35 },
      ],
    };
  }

  if (path === "/chat/query" && method === "POST") {
    const message = body?.message || "your request";
    const normalized = message
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const isFrench = /\b(je|nous|vous|pour|avec|annonce|conge|reunion|rapport|enseignant|classe)\b/.test(
      normalized
    );
    const intents = [
      {
        intent: "announcement_request",
        terms: ["announce", "announcement", "annonce", "annoncer", "diffuser", "message", "teachers", "enseignants"],
        response: isFrench
          ? "Je peux preparer l'annonce, choisir le public, regler la priorite et proposer un texte pret a envoyer."
          : "I can draft the announcement, choose the audience, set priority, and prepare it for sending.",
        actions: isFrench
          ? ["rediger_annonce", "choisir_audience", "definir_priorite"]
          : ["draft_announcement", "choose_audience", "set_priority"],
      },
      {
        intent: "leave_request",
        terms: ["leave", "absence", "vacation", "conge", "repos", "permission", "malade"],
        response: isFrench
          ? "Je peux lancer le workflow de conge avec dates, motif, remplacement et approbateur."
          : "I can start a leave workflow with dates, reason, handover plan, and approver.",
        actions: isFrench
          ? ["lancer_workflow_conge", "collecter_dates", "notifier_approbateur"]
          : ["start_leave_workflow", "collect_dates", "notify_approver"],
      },
      {
        intent: "report_request",
        terms: ["report", "summary", "rapport", "resume", "bilan", "analytics", "indicateurs"],
        response: isFrench
          ? "Je peux construire un rapport avec resume, faits marquants, risques et indicateurs."
          : "I can prepare a report with summary, highlights, risks, and metrics.",
        actions: isFrench
          ? ["preparer_plan_rapport", "collecter_indicateurs", "exporter_rapport"]
          : ["prepare_report_outline", "collect_metrics", "export_report"],
      },
      {
        intent: "meeting_query",
        terms: ["meeting", "reunion", "agenda", "invite", "invitation", "creneau", "rappel"],
        response: isFrench
          ? "Je peux organiser la reunion: participants, creneau, ordre du jour, invitations et rappel."
          : "I can organize the meeting: attendees, time window, agenda, invites, and reminder.",
        actions: isFrench
          ? ["creer_plan_reunion", "rediger_ordre_du_jour", "envoyer_invitations"]
          : ["create_meeting_plan", "draft_agenda", "send_invites"],
      },
    ];
    const match =
      intents.find((item) => item.terms.some((term) => normalized.includes(term))) ||
      {
        intent: "general_query",
        response: isFrench
          ? "Je peux transformer une demande scolaire en prochaines etapes claires: annonce, conge, reunion, rapport, planning ou notification."
          : `I can coordinate this request: "${message}". I will identify the right school operations module and prepare the next step.`,
        actions: isFrench
          ? ["clarifier_demande", "afficher_capacites", "suggerer_prompt"]
          : ["clarify_request", "show_capabilities", "suggest_prompt"],
      };
    return {
      intent: match.intent,
      confidence: match.intent === "general_query" ? 0.48 : 0.9,
      response: match.response,
      actions: match.actions,
    };
  }

  throw new Error("Demo endpoint unavailable");
}

export async function apiRequest(path, method = "GET", body, token) {
  if (IS_DEMO) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return demoResponse(path, method, body, token);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new Error(
      "Unable to reach the API. Start the local backend or configure VITE_API_URL in production."
    );
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "API request failed");
  }

  return response.json();
}
