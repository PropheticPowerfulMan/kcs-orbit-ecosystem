const hasConfiguredApi = Boolean(import.meta.env.VITE_API_URL);
const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
const isLocalHost = ["localhost", "127.0.0.1", ""].includes(hostname);
const IS_DEMO = import.meta.env.VITE_DEMO_MODE === "true" || (!hasConfiguredApi && !isLocalHost);
const API_BASES = hasConfiguredApi
  ? [import.meta.env.VITE_API_URL]
  : ["http://localhost:8010/api/v1", "http://localhost:8000/api/v1"];

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
    const isFrench = /\b(je|nous|vous|pour|avec|annonce|conge|reunion|rapport|enseignant|classe|systeme|ecosysteme|etat)\b/.test(
      normalized
    );
    const ecosystemFacts = {
      announcements: demoState.announcements.length,
      workflows: demoState.workflows.filter((item) => item.status === "pending").length,
      unread: demoState.notifications.filter((item) => !(item.is_read ?? item.read)).length,
      urgent: demoState.announcements.filter((item) => item.priority === "urgent").length,
    };
    const spokespersonPrefix = isFrench
      ? `Voix officielle EduSync AI: je parle au nom de l'ecosysteme et je me base uniquement sur les donnees disponibles.\nEtat verifie: ${ecosystemFacts.announcements} annonces, ${ecosystemFacts.workflows} workflows en attente, ${ecosystemFacts.unread} notifications non lues. Source: donnees demo EduSync; Orbit/SAVANEX/EduPay/Nexus non confirmes dans ce mode.\n\n`
      : `Official EduSync AI voice: I speak for the ecosystem and use only available data.\nVerified state: ${ecosystemFacts.announcements} announcements, ${ecosystemFacts.workflows} pending workflows, ${ecosystemFacts.unread} unread notifications. Source: EduSync demo data; Orbit/SAVANEX/EduPay/Nexus not confirmed in this mode.\n\n`;
    const details = {
      audience: normalized.includes("parent")
        ? "parents"
        : normalized.includes("enseignant") || normalized.includes("teacher")
          ? "teachers"
          : normalized.includes("staff") || normalized.includes("personnel")
            ? "staff"
            : "public cible",
      priority: normalized.includes("urgent") || normalized.includes("urgence") ? "urgent" : "normal",
      timing: normalized.includes("demain") || normalized.includes("tomorrow") ? "demain" : "prochain creneau",
    };
    const intents = [
      {
        intent: "ecosystem_status_query",
        terms: ["ecosystem", "ecosysteme", "systeme", "system", "etat", "status", "porte parole", "porte-parole", "savanex", "edupay", "nexus", "orbit"],
        response: isFrench
          ? `Synthese generale:\n- Communication: ${ecosystemFacts.announcements} annonces dont ${ecosystemFacts.urgent} urgentes.\n- Operations: ${ecosystemFacts.workflows} workflows attendent une decision.\n- Alertes: ${ecosystemFacts.unread} notifications non lues.\n\nDecision recommandee: traiter les notifications et workflows en attente, puis publier une annonce officielle si l'information doit atteindre parents, eleves, enseignants ou staff.\nLimite de verite: en mode demo, je ne confirme pas les notes, paiements ou statistiques SAVANEX/EduPay/Nexus sans connexion Orbit.`
          : `General summary:\n- Communication: ${ecosystemFacts.announcements} announcements including ${ecosystemFacts.urgent} urgent.\n- Operations: ${ecosystemFacts.workflows} workflows awaiting decision.\n- Alerts: ${ecosystemFacts.unread} unread notifications.\n\nRecommended decision: handle pending notifications and workflows, then publish an official announcement if information must reach parents, students, teachers, or staff.\nTruth limit: in demo mode, I do not confirm SAVANEX/EduPay/Nexus grades, payments, or statistics without Orbit connection.`,
        actions: isFrench
          ? ["resumer_etat_ecosysteme", "verifier_sources", "prioriser_alertes", "preparer_reponse_officielle"]
          : ["summarize_ecosystem_state", "verify_data_sources", "prioritize_alerts", "prepare_official_reply"],
      },
      {
        intent: "finance_query",
        terms: ["paye", "payes", "payee", "paiement", "frais", "solde", "scolarite", "finance", "paid", "payment", "payments", "fees", "balance", "balances", "export"],
        response: isFrench
          ? `Tu demandes une liste financiere: les eleves qui ont paye.\n\nCe n'est pas une annonce. Il faut interroger le module paiement/frais et retourner un tableau.\n\nColonnes a afficher: nom eleve, classe, parent, montant paye, solde restant, date du dernier paiement, statut.\nFiltres utiles: annee scolaire, trimestre, classe, statut Paye/Partiel/Impaye.\n\nAction suivante: ouvre EduPay ou Finance SAVANEX, filtre statut Paye, puis exporte la liste.`
          : `Finance command understood: list paid students, check balances, and prepare export.\n\nCorrect handling: open the finance/payment module, not announcements or messaging.\n\nApply filters: status = Paid, entity = Students. Add class, academic year, or term if provided.\nTable columns: student name, class, parent, amount paid, remaining balance, last payment date, status.\nExport: generate CSV/XLSX with the visible filtered rows.\n\nNext step: connect this action to EduPay/Orbit data so I can return the table directly instead of only the workflow.`,
        actions: isFrench
          ? ["ouvrir_module_finance", "filtrer_eleves_payes", "exporter_liste_paiements"]
          : ["open_finance_module", "filter_paid_students", "export_payment_list", "check_balances"],
      },
      {
        intent: "announcement_request",
        terms: ["announce", "announcement", "annonce", "annoncer", "diffuser", "message", "teachers", "enseignants"],
        response: isFrench
          ? `Oui. Je prepare une annonce pour ${details.audience}, priorite ${details.priority}, diffusion ${details.timing}.\n\nBrouillon pret a publier:\nObjet: Communication KCS\nMessage: Bonjour, nous vous informons que ${message}. Merci de prendre les dispositions necessaires et de confirmer reception si besoin.\n\nAvant envoi, verifie: public cible, heure, canal et responsable.`
          : `Yes. I can prepare an announcement for ${details.audience}, priority ${details.priority}, delivery ${details.timing}.\n\nReady draft:\nSubject: KCS communication\nMessage: Hello, please note that ${message}. Kindly take the necessary steps and confirm receipt if required.\n\nBefore sending, confirm audience, channel, timing, and owner.`,
        actions: isFrench
          ? ["rediger_annonce", "choisir_audience", "definir_priorite"]
          : ["draft_announcement", "choose_audience", "set_priority"],
      },
      {
        intent: "leave_request",
        terms: ["leave", "absence", "vacation", "conge", "repos", "permission", "malade"],
        response: isFrench
          ? `Je peux transformer cette demande en workflow de conge.\nResume: ${message}.\nChamps a completer: debut, fin, motif, remplacant, approbateur.\nProposition: statut Pending, notification a l'administration.`
          : `I can convert this into a leave workflow.\nSummary: ${message}.\nMissing fields: start date, end date, reason, handover plan, approver.\nSuggested status: Pending, notify Administration.`,
        actions: isFrench
          ? ["lancer_workflow_conge", "collecter_dates", "notifier_approbateur"]
          : ["start_leave_workflow", "collect_dates", "notify_approver"],
      },
      {
        intent: "report_request",
        terms: ["report", "summary", "rapport", "resume", "bilan", "analytics", "indicateurs"],
        response: isFrench
          ? "Je peux construire un rapport utile.\nStructure: resume executif, indicateurs, activites realisees, risques, decisions attendues.\nIndicateurs: annonces envoyees, workflows ouverts/fermes, notifications non lues, delai moyen."
          : "I can prepare a useful report.\nStructure: executive summary, metrics, completed actions, risks, decisions needed.\nMetrics: announcements sent, workflows opened/closed, unread notifications, average latency.",
        actions: isFrench
          ? ["preparer_plan_rapport", "collecter_indicateurs", "exporter_rapport"]
          : ["prepare_report_outline", "collect_metrics", "export_report"],
      },
      {
        intent: "meeting_query",
        terms: ["meeting", "reunion", "agenda", "invite", "invitation", "creneau", "rappel"],
        response: isFrench
          ? "Je peux organiser la reunion.\nOrdre du jour: contexte, points urgents, decisions, responsables, echeances.\nA completer: participants, duree, salle ou lien, rappel souhaite."
          : "I can organize the meeting.\nAgenda: context, urgent points, decisions, owners, deadlines.\nMissing fields: attendees, duration, room/link, reminder timing.",
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
          ? `J'ai compris la demande: ${message}.\nJe peux parler officiellement pour l'ecosysteme, mais je dois rester fidele aux donnees disponibles. Dis-moi si tu veux une annonce, une alerte, un rapport, une reunion, un workflow ou un etat general.`
          : `I understand the request: "${message}". I can speak officially for the ecosystem, but I must stay faithful to available data. Tell me whether this should become an announcement, alert, report, meeting, workflow, or general status.`,
        actions: isFrench
          ? ["clarifier_demande", "afficher_capacites", "suggerer_prompt"]
          : ["clarify_request", "show_capabilities", "suggest_prompt"],
      };
    return {
      intent: match.intent,
      confidence: match.intent === "general_query" ? 0.48 : 0.9,
      response: `${spokespersonPrefix}${match.response}`,
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
  let lastBase = API_BASES[0];
  try {
    for (const baseUrl of API_BASES) {
      lastBase = baseUrl;
      try {
        response = await fetch(`${baseUrl}${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        break;
      } catch {
        continue;
      }
    }
  } catch {
    response = null;
  }

  if (!response) {
    const error = new Error(
      "Unable to reach the API. Start the local backend or configure VITE_API_URL in production."
    );
    error.status = 0;
    throw error;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const isUnauthorized = response.status === 401;
    const message = isUnauthorized
      ? "Session expired. Please sign in again."
      : errorData.detail || `API request failed on ${lastBase}`;
    const error = new Error(message);
    error.status = response.status;
    error.detail = errorData.detail;
    throw error;
  }

  return response.json();
}
