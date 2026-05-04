import re
import unicodedata
from dataclasses import dataclass


@dataclass(frozen=True)
class IntentDefinition:
    keywords: tuple[str, ...]
    phrases: tuple[str, ...]
    response: str
    actions: tuple[str, ...]


class NLPEngine:
    def __init__(self):
        self.intent_definitions: dict[str, IntentDefinition] = {
            "announcement_request": IntentDefinition(
                keywords=(
                    "announce",
                    "announcement",
                    "annonce",
                    "annoncer",
                    "communique",
                    "notice",
                    "broadcast",
                    "diffuser",
                    "message",
                    "inform",
                    "informer",
                    "send",
                    "envoyer",
                    "publish",
                    "publier",
                    "teachers",
                    "enseignants",
                    "professeurs",
                    "staff",
                    "personnel",
                    "parents",
                    "urgent",
                ),
                phrases=(
                    "send an announcement",
                    "create an announcement",
                    "preparer une annonce",
                    "creer une annonce",
                    "envoyer une annonce",
                    "diffuser un message",
                    "inform everyone",
                    "informer tout le monde",
                    "notify teachers",
                    "notifier les enseignants",
                    "broadcast message",
                ),
                response=(
                    "I can help draft and route the announcement. Share the audience, priority, "
                    "message content, and timing, then I will prepare it for publication."
                ),
                actions=("draft_announcement", "choose_audience", "set_priority", "schedule_message"),
            ),
            "leave_request": IntentDefinition(
                keywords=(
                    "leave",
                    "conge",
                    "absence",
                    "vacation",
                    "permission",
                    "autorisation",
                    "sick",
                    "malade",
                    "maladie",
                    "day off",
                    "repos",
                    "recovery",
                    "recuperation",
                    "approval",
                    "approbation",
                    "request",
                    "demande",
                    "demander",
                    "recuperer",
                ),
                phrases=(
                    "request leave",
                    "ask for leave",
                    "demande de conge",
                    "demander un conge",
                    "poser un conge",
                    "day off",
                    "sick leave",
                    "absence request",
                ),
                response=(
                    "I can start a leave workflow. Please provide the dates, reason, handover plan, "
                    "and preferred approver so the request can be tracked."
                ),
                actions=("start_leave_workflow", "collect_dates", "notify_approver", "track_decision"),
            ),
            "report_request": IntentDefinition(
                keywords=(
                    "report",
                    "rapport",
                    "summary",
                    "resume",
                    "status",
                    "bilan",
                    "weekly",
                    "hebdomadaire",
                    "monthly",
                    "mensuel",
                    "metrics",
                    "indicateurs",
                    "analytics",
                    "analyse",
                    "performance",
                    "activity",
                    "activite",
                    "dashboard",
                    "tableau",
                ),
                phrases=(
                    "weekly report",
                    "monthly report",
                    "activity summary",
                    "status update",
                    "performance report",
                    "rapport hebdomadaire",
                    "rapport mensuel",
                    "resume d activite",
                    "tableau de bord",
                ),
                response=(
                    "I can prepare a structured report. Tell me the department, reporting period, "
                    "key highlights, risks, and metrics you want included."
                ),
                actions=("prepare_report_outline", "collect_metrics", "summarize_activity", "export_report"),
            ),
            "meeting_query": IntentDefinition(
                keywords=(
                    "meeting",
                    "reunion",
                    "slot",
                    "creneau",
                    "availability",
                    "disponibilite",
                    "invite",
                    "invitation",
                    "agenda",
                    "ordre du jour",
                    "attendees",
                    "participants",
                    "calendar",
                    "calendrier",
                    "reminder",
                    "rappel",
                    "reschedule",
                    "reporter",
                ),
                phrases=(
                    "schedule a meeting",
                    "meeting agenda",
                    "find a slot",
                    "send invites",
                    "meeting reminder",
                    "planifier une reunion",
                    "organiser une reunion",
                    "ordre du jour",
                    "envoyer les invitations",
                ),
                response=(
                    "I can organize the meeting workflow. Share attendees, preferred time window, "
                    "agenda, and reminder timing so I can prepare the invite."
                ),
                actions=("create_meeting_plan", "draft_agenda", "send_invites", "schedule_reminder"),
            ),
            "schedule_query": IntentDefinition(
                keywords=(
                    "schedule",
                    "horaire",
                    "planning",
                    "class",
                    "classe",
                    "timetable",
                    "emploi du temps",
                    "period",
                    "periode",
                    "room",
                    "salle",
                    "teacher",
                    "enseignant",
                    "lesson",
                    "cours",
                    "exam",
                    "examen",
                    "supervision",
                    "surveillance",
                ),
                phrases=(
                    "class schedule",
                    "exam timetable",
                    "teacher schedule",
                    "room schedule",
                    "supervision schedule",
                    "emploi du temps",
                    "planning des examens",
                    "horaire de classe",
                    "planning de surveillance",
                ),
                response=(
                    "I can help with schedule information. Provide the class, day, teacher, or exam "
                    "period you need, and I will narrow the request."
                ),
                actions=("identify_schedule_scope", "filter_by_day", "check_teacher_or_class", "prepare_schedule_reply"),
            ),
            "notification_query": IntentDefinition(
                keywords=(
                    "notification",
                    "notifications",
                    "alert",
                    "alerte",
                    "inbox",
                    "boite",
                    "unread",
                    "non lu",
                    "reminder",
                    "rappel",
                    "read",
                    "lu",
                    "priority",
                    "priorite",
                    "important",
                ),
                phrases=(
                    "unread notifications",
                    "mark as read",
                    "important alerts",
                    "notification center",
                    "notifications non lues",
                    "marquer comme lu",
                    "alertes importantes",
                ),
                response=(
                    "I can help review notification priority, explain what needs attention, "
                    "and mark items as read once handled."
                ),
                actions=("review_notifications", "prioritize_alerts", "mark_read", "follow_up"),
            ),
            "capability_query": IntentDefinition(
                keywords=(
                    "help",
                    "aide",
                    "capabilities",
                    "capacites",
                    "features",
                    "fonctionnalites",
                    "what can you do",
                    "que peux tu faire",
                    "guide",
                    "explain",
                    "explique",
                    "how",
                    "comment",
                    "support",
                ),
                phrases=(
                    "what can you do",
                    "show capabilities",
                    "help me",
                    "how does this work",
                    "que peux tu faire",
                    "aide moi",
                    "comment ca marche",
                    "explique moi",
                ),
                response=(
                    "I can support school communication tasks: announcements, leave workflows, "
                    "meeting coordination, reports, schedules, notifications, and admin analytics."
                ),
                actions=("show_capabilities", "suggest_prompt", "open_guide"),
            ),
        }

    def detect_intent(self, message: str) -> tuple[str, float]:
        text = self._normalize(message)
        if not text:
            return "general_query", 0.3

        if self._looks_like_leave_request(text):
            return "leave_request", 0.88

        best_intent = "general_query"
        best_score = 0.0

        for intent, definition in self.intent_definitions.items():
            keyword_hits = sum(1 for keyword in definition.keywords if self._contains_term(text, keyword))
            phrase_hits = sum(1 for phrase in definition.phrases if phrase in text)
            action_bonus = 0.6 if self._has_action_verb(text) and keyword_hits else 0
            score = keyword_hits + (phrase_hits * 2.2) + action_bonus

            if score > best_score:
                best_intent = intent
                best_score = score

        if best_score <= 0:
            return "general_query", 0.42

        confidence = min(0.58 + best_score * 0.08, 0.96)
        return best_intent, round(confidence, 2)

    def generate_context_response(
        self,
        intent: str,
        context: dict | None = None,
        message: str = "",
    ) -> tuple[str, list[str]]:
        context = context or {}
        definition = self.intent_definitions.get(intent)
        text = self._normalize(message)
        language = self._detect_language(text)
        details = self._extract_details(text)

        if language == "fr":
            response, actions = self._french_response(intent, details)
        elif definition:
            response = definition.response
            actions = list(definition.actions)
        else:
            response = (
                "I can help turn school operations messages into clear next steps. "
                "Try asking for an announcement, leave workflow, meeting, report, schedule, or notification review."
            )
            actions = ["clarify_request", "show_capabilities", "suggest_prompt"]

        department = context.get("department")
        if department:
            if language == "fr":
                response += f" Je garde aussi le contexte du departement {department} pour cette demande."
            else:
                response += f" I will keep the {department} department context attached to this request."

        return response, actions

    def _normalize(self, message: str) -> str:
        decomposed = unicodedata.normalize("NFKD", message.lower().strip())
        without_accents = "".join(char for char in decomposed if not unicodedata.combining(char))
        return re.sub(r"\s+", " ", without_accents)

    def _contains_term(self, text: str, term: str) -> bool:
        term = self._normalize(term)
        if " " in term:
            return term in text
        return re.search(rf"\b{re.escape(term)}\b", text) is not None

    def _has_action_verb(self, text: str) -> bool:
        verbs = (
            "prepare",
            "create",
            "send",
            "start",
            "draft",
            "schedule",
            "preparer",
            "creer",
            "envoyer",
            "lancer",
            "rediger",
            "planifier",
            "organiser",
        )
        return any(self._contains_term(text, verb) for verb in verbs)

    def _looks_like_leave_request(self, text: str) -> bool:
        leave_terms = (
            "leave",
            "absence",
            "vacation",
            "sick",
            "recovery",
            "conge",
            "repos",
            "maladie",
            "recuperation",
            "permission",
        )
        request_terms = (
            "request",
            "ask",
            "need",
            "want",
            "demande",
            "demander",
            "besoin",
            "veux",
            "souhaite",
        )
        has_leave_term = any(self._contains_term(text, term) for term in leave_terms)
        has_request_term = any(self._contains_term(text, term) for term in request_terms)
        return has_leave_term and has_request_term

    def _detect_language(self, text: str) -> str:
        french_markers = (
            "je ",
            "tu ",
            "nous ",
            "vous ",
            "pour ",
            "avec ",
            "demande",
            "annonce",
            "conge",
            "reunion",
            "rapport",
            "enseignant",
            "ecole",
            "classe",
        )
        return "fr" if any(marker in text for marker in french_markers) else "en"

    def _extract_details(self, text: str) -> dict[str, str]:
        details: dict[str, str] = {}
        if any(term in text for term in ("urgent", "urgence", "important", "prioritaire")):
            details["priority"] = "urgent"
        elif any(term in text for term in ("info", "information", "normal")):
            details["priority"] = "normal"

        audience_terms = {
            "teachers": ("teachers", "enseignants", "professeurs"),
            "staff": ("staff", "personnel"),
            "parents": ("parents",),
            "whole school": ("everyone", "all", "tout le monde", "toute l ecole", "whole school"),
        }
        for audience, terms in audience_terms.items():
            if any(term in text for term in terms):
                details["audience"] = audience
                break

        date_match = re.search(
            r"\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|samedi|dimanche|lundi|mardi|mercredi|jeudi|vendredi|demain|aujourd hui)\b",
            text,
        )
        if date_match:
            details["date"] = date_match.group(1)

        return details

    def _french_response(self, intent: str, details: dict[str, str]) -> tuple[str, list[str]]:
        detail_bits = []
        if details.get("audience"):
            detail_bits.append(f"audience: {details['audience']}")
        if details.get("priority"):
            detail_bits.append(f"priorite: {details['priority']}")
        if details.get("date"):
            detail_bits.append(f"date: {details['date']}")
        suffix = f" Details detectes: {', '.join(detail_bits)}." if detail_bits else ""

        responses = {
            "announcement_request": (
                "Je peux preparer l'annonce, choisir le bon public, regler la priorite et proposer un texte pret a envoyer."
                f"{suffix} Donne-moi le message exact ou les points cles, et je le structure.",
                ["rediger_annonce", "choisir_audience", "definir_priorite", "programmer_message"],
            ),
            "leave_request": (
                "Je peux lancer le workflow de conge: dates, motif, plan de remplacement et approbateur."
                f"{suffix} Il me faut surtout la periode et la raison pour finaliser la demande.",
                ["lancer_workflow_conge", "collecter_dates", "notifier_approbateur", "suivre_decision"],
            ),
            "report_request": (
                "Je peux construire un rapport clair avec resume, faits marquants, risques et indicateurs."
                f"{suffix} Precise le departement et la periode pour que je prepare le plan.",
                ["preparer_plan_rapport", "collecter_indicateurs", "resumer_activite", "exporter_rapport"],
            ),
            "meeting_query": (
                "Je peux organiser la reunion: participants, creneau, ordre du jour, invitations et rappel."
                f"{suffix} Envoie-moi les participants et la fenetre horaire souhaitee.",
                ["creer_plan_reunion", "rediger_ordre_du_jour", "envoyer_invitations", "programmer_rappel"],
            ),
            "schedule_query": (
                "Je peux aider a retrouver ou clarifier un planning de classe, d'enseignant, de salle ou d'examen."
                f"{suffix} Indique la classe, le jour ou l'enseignant concerne.",
                ["identifier_planning", "filtrer_par_jour", "verifier_classe_enseignant", "preparer_reponse"],
            ),
            "notification_query": (
                "Je peux trier les notifications, signaler les alertes importantes et aider a les marquer comme lues."
                f"{suffix}",
                ["examiner_notifications", "prioriser_alertes", "marquer_comme_lu", "relancer"],
            ),
            "capability_query": (
                "Je peux aider avec les annonces, conges, reunions, rapports, plannings, notifications et analyses administratives.",
                ["afficher_capacites", "suggerer_prompt", "ouvrir_guide"],
            ),
        }
        return responses.get(
            intent,
            (
                "Je peux transformer une demande scolaire en prochaines etapes claires. Essaie une annonce, un conge, une reunion, un rapport, un planning ou une notification.",
                ["clarifier_demande", "afficher_capacites", "suggerer_prompt"],
            ),
        )
