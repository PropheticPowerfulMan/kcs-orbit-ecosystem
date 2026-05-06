import re
import unicodedata
from dataclasses import dataclass


@dataclass(frozen=True)
class IntentDefinition:
    keywords: tuple[str, ...]
    actions_en: tuple[str, ...]
    actions_fr: tuple[str, ...]


class NLPEngine:
    """Deterministic school-operations assistant.

    The project does not require an external LLM to be useful locally. This engine
    classifies school requests, extracts operational details, and returns a
    concrete response with a draft, checklist, missing fields, and next actions.
    """

    def __init__(self):
        self.intent_definitions: dict[str, IntentDefinition] = {
            "announcement_request": IntentDefinition(
                keywords=(
                    "announce", "announcement", "annonce", "annoncer", "communique",
                    "broadcast", "diffuser", "message", "inform", "informer",
                    "notify", "notifier", "publier", "parents", "teachers",
                    "enseignants", "professeurs", "staff", "personnel", "students",
                    "eleves", "urgent",
                ),
                actions_en=("draft_announcement", "choose_audience", "set_priority", "schedule_message"),
                actions_fr=("rediger_annonce", "choisir_audience", "definir_priorite", "programmer_message"),
            ),
            "leave_request": IntentDefinition(
                keywords=(
                    "leave", "absence", "vacation", "permission", "sick", "malade",
                    "maladie", "day off", "repos", "recovery", "recuperation",
                    "conge", "approval", "approbation", "demande", "request",
                ),
                actions_en=("start_leave_workflow", "collect_dates", "assign_handover", "notify_approver"),
                actions_fr=("lancer_workflow_conge", "collecter_dates", "assigner_remplacement", "notifier_approbateur"),
            ),
            "report_request": IntentDefinition(
                keywords=(
                    "report", "rapport", "summary", "resume", "status", "bilan",
                    "weekly", "hebdomadaire", "monthly", "mensuel", "metrics",
                    "indicateurs", "analytics", "analyse", "performance", "activite",
                    "activity", "dashboard", "tableau",
                ),
                actions_en=("prepare_report_outline", "collect_metrics", "summarize_activity", "export_report"),
                actions_fr=("preparer_plan_rapport", "collecter_indicateurs", "resumer_activite", "exporter_rapport"),
            ),
            "meeting_query": IntentDefinition(
                keywords=(
                    "meeting", "reunion", "slot", "creneau", "availability",
                    "disponibilite", "invite", "invitation", "agenda",
                    "participants", "calendar", "calendrier", "reminder", "rappel",
                    "reschedule", "reporter",
                ),
                actions_en=("create_meeting_plan", "draft_agenda", "send_invites", "schedule_reminder"),
                actions_fr=("creer_plan_reunion", "rediger_ordre_du_jour", "envoyer_invitations", "programmer_rappel"),
            ),
            "schedule_query": IntentDefinition(
                keywords=(
                    "schedule", "horaire", "planning", "class", "classe", "timetable",
                    "emploi du temps", "period", "periode", "room", "salle",
                    "teacher", "enseignant", "lesson", "cours", "exam", "examen",
                    "supervision", "surveillance",
                ),
                actions_en=("identify_schedule_scope", "filter_by_day", "check_teacher_or_class", "prepare_schedule_reply"),
                actions_fr=("identifier_planning", "filtrer_par_jour", "verifier_classe_enseignant", "preparer_reponse"),
            ),
            "notification_query": IntentDefinition(
                keywords=(
                    "notification", "notifications", "alert", "alerte", "inbox",
                    "boite", "unread", "non lu", "reminder", "rappel", "read",
                    "lu", "priority", "priorite", "important",
                ),
                actions_en=("review_notifications", "prioritize_alerts", "mark_read", "follow_up"),
                actions_fr=("examiner_notifications", "prioriser_alertes", "marquer_comme_lu", "relancer"),
            ),
            "capability_query": IntentDefinition(
                keywords=(
                    "help", "aide", "capabilities", "capacites", "features",
                    "fonctionnalites", "what can you do", "que peux tu faire",
                    "guide", "explain", "explique", "how", "comment",
                ),
                actions_en=("show_capabilities", "suggest_prompt", "open_guide"),
                actions_fr=("afficher_capacites", "suggerer_prompt", "ouvrir_guide"),
            ),
        }

    def detect_intent(self, message: str) -> tuple[str, float]:
        text = self._normalize(message)
        if not text:
            return "capability_query", 0.65

        scores: dict[str, float] = {}
        for intent, definition in self.intent_definitions.items():
            score = 0.0
            for keyword in definition.keywords:
                if self._contains_term(text, keyword):
                    score += 1.0 if " " not in keyword else 2.0
            if self._has_action_verb(text) and score:
                score += 0.7
            scores[intent] = score

        best_intent, best_score = max(scores.items(), key=lambda item: item[1])
        if best_score <= 0:
            return "general_query", 0.58

        confidence = min(0.62 + best_score * 0.07, 0.97)
        return best_intent, round(confidence, 2)

    def generate_context_response(
        self,
        intent: str,
        context: dict | None = None,
        message: str = "",
    ) -> tuple[str, list[str]]:
        context = context or {}
        text = self._normalize(message)
        language = self._detect_language(text)
        details = self._extract_details(text, context)

        if language == "fr":
            response = self._compose_french_response(intent, message, details)
            actions = list(self.intent_definitions.get(intent, self.intent_definitions["capability_query"]).actions_fr)
        else:
            response = self._compose_english_response(intent, message, details)
            actions = list(self.intent_definitions.get(intent, self.intent_definitions["capability_query"]).actions_en)

        return response, actions

    def _compose_french_response(self, intent: str, original_message: str, details: dict[str, str]) -> str:
        if intent == "announcement_request":
            audience = details.get("audience", "le public concerne")
            priority = details.get("priority", "normale")
            timing = details.get("date", "au prochain creneau disponible")
            subject = self._topic(original_message, "communication scolaire")
            return "\n".join([
                f"Oui. Je prepare une annonce pour {audience}, priorite {priority}, diffusion {timing}.",
                "",
                "Brouillon pret a publier:",
                f"Objet: {subject.capitalize()}",
                f"Message: Bonjour, nous vous informons que {self._clean_sentence(original_message)}. Merci de prendre les dispositions necessaires et de confirmer reception si besoin.",
                "",
                "Avant envoi, verifie: public cible, heure de diffusion, canal, personne responsable.",
                "Action suivante: ouvre Actions > New announcement, je peux reprendre ce texte comme contenu.",
            ])

        if intent == "leave_request":
            return "\n".join([
                "Je peux transformer cette demande en workflow de conge.",
                f"Resume: {self._clean_sentence(original_message)}.",
                "Informations a completer: date de debut, date de fin, motif, remplacant ou plan de passation, approbateur.",
                "Proposition: statut initial Pending, priorite normale sauf urgence medicale, notification a l'administration.",
                "Action suivante: ouvre Actions > Internal workflow avec type leave_request.",
            ])

        if intent == "report_request":
            period = details.get("date", "la periode demandee")
            department = details.get("department", "le departement concerne")
            return "\n".join([
                f"Je peux construire un rapport pour {department} sur {period}.",
                "Structure proposee: 1) resume executif, 2) indicateurs cles, 3) activites realisees, 4) risques, 5) decisions attendues.",
                "Indicateurs utiles: annonces envoyees, workflows ouverts/fermes, notifications non lues, delai moyen de reponse.",
                "Action suivante: donne-moi les chiffres ou demande un rapport hebdomadaire/mensuel et je te fournis une version finale.",
            ])

        if intent == "meeting_query":
            audience = details.get("audience", "les participants")
            timing = details.get("date", "un creneau a confirmer")
            return "\n".join([
                f"Je peux organiser la reunion avec {audience} pour {timing}.",
                "Ordre du jour propose: contexte, points urgents, decisions a prendre, responsables, echeances.",
                "Message d'invitation: Bonjour, une reunion est proposee afin de traiter le sujet suivant. Merci de confirmer votre disponibilite.",
                "A completer: liste des participants, duree, salle ou lien, rappel souhaite.",
            ])

        if intent == "schedule_query":
            return "\n".join([
                "Je peux aider sur le planning, mais il faut cadrer la recherche.",
                "Precise au choix: classe, enseignant, salle, jour, periode ou examen.",
                "Reponse attendue possible: conflit detecte, horaire resume, ou message a envoyer aux personnes concernees.",
            ])

        if intent == "notification_query":
            return "\n".join([
                "Je peux t'aider a traiter les notifications.",
                "Priorisation: alertes urgentes d'abord, puis messages administratifs, puis rappels standards.",
                "Action possible: ouvrir Inbox, marquer les elements lus, ou preparer une relance pour les alertes importantes.",
            ])

        if intent == "capability_query":
            return (
                "Je peux faire beaucoup plus que repondre vaguement: rediger des annonces, preparer des workflows de conge, "
                "structurer des rapports, organiser des reunions, aider sur les plannings et prioriser les notifications. "
                "Donne-moi une demande concrete, par exemple: 'Prepare une annonce urgente aux parents pour la reunion de demain'."
            )

        return "\n".join([
            "J'ai compris que tu veux une aide operationnelle, mais la demande est trop ouverte.",
            f"Voici ce que je peux deja cadrer: {self._clean_sentence(original_message)}.",
            "Dis-moi si tu veux en faire une annonce, un workflow, un rapport, une reunion, un planning ou une notification.",
        ])

    def _compose_english_response(self, intent: str, original_message: str, details: dict[str, str]) -> str:
        if intent == "announcement_request":
            audience = details.get("audience", "the target audience")
            priority = details.get("priority", "normal")
            timing = details.get("date", "the next available slot")
            subject = self._topic(original_message, "school communication")
            return "\n".join([
                f"Yes. I can prepare an announcement for {audience}, priority {priority}, delivery {timing}.",
                "",
                "Ready draft:",
                f"Subject: {subject.capitalize()}",
                f"Message: Hello, please note that {self._clean_sentence(original_message)}. Kindly take the necessary steps and confirm receipt if required.",
                "",
                "Before sending, confirm: audience, channel, delivery time, and owner.",
                "Next step: open Actions > New announcement and reuse this draft.",
            ])

        if intent == "leave_request":
            return "\n".join([
                "I can convert this into a leave workflow.",
                f"Summary: {self._clean_sentence(original_message)}.",
                "Missing fields: start date, end date, reason, handover plan, approver.",
                "Suggested workflow: Pending status, normal priority unless medical/urgent, notify Administration.",
                "Next step: open Actions > Internal workflow with type leave_request.",
            ])

        if intent == "report_request":
            department = details.get("department", "the relevant department")
            period = details.get("date", "the requested period")
            return "\n".join([
                f"I can prepare a report for {department} covering {period}.",
                "Suggested structure: executive summary, key metrics, completed actions, risks, decisions needed.",
                "Useful metrics: announcements sent, workflows opened/closed, unread notifications, response latency.",
                "Next step: share the figures or ask for a weekly/monthly report and I will draft it.",
            ])

        if intent == "meeting_query":
            audience = details.get("audience", "the attendees")
            timing = details.get("date", "a time window to confirm")
            return "\n".join([
                f"I can organize a meeting with {audience} for {timing}.",
                "Agenda: context, urgent points, decisions, owners, deadlines.",
                "Invite draft: Hello, a meeting is proposed to address the following topic. Please confirm availability.",
                "Missing fields: attendees, duration, room/link, reminder timing.",
            ])

        if intent == "schedule_query":
            return (
                "I can help with scheduling. Please specify class, teacher, room, day, period, or exam. "
                "Then I can prepare a focused timetable reply or conflict-check message."
            )

        if intent == "notification_query":
            return (
                "I can help process notifications: prioritize urgent alerts, explain what needs attention, "
                "mark items read, or draft follow-up reminders."
            )

        if intent == "capability_query":
            return (
                "I can draft announcements, prepare leave workflows, structure reports, organize meetings, "
                "help with schedules, prioritize notifications, and summarize admin activity. Try: "
                "'Prepare an urgent announcement to parents about tomorrow's meeting.'"
            )

        return (
            f"I understand the request: {self._clean_sentence(original_message)}. "
            "Tell me whether this should become an announcement, workflow, report, meeting, schedule task, or notification."
        )

    def _normalize(self, message: str) -> str:
        decomposed = unicodedata.normalize("NFKD", (message or "").lower().strip())
        without_accents = "".join(char for char in decomposed if not unicodedata.combining(char))
        return re.sub(r"\s+", " ", without_accents)

    def _contains_term(self, text: str, term: str) -> bool:
        term = self._normalize(term)
        if " " in term:
            return term in text
        return re.search(rf"\b{re.escape(term)}\b", text) is not None

    def _has_action_verb(self, text: str) -> bool:
        verbs = (
            "prepare", "create", "send", "start", "draft", "schedule", "organize",
            "preparer", "creer", "envoyer", "lancer", "rediger", "planifier", "organiser",
            "faire", "ecrire", "aider", "help",
        )
        return any(self._contains_term(text, verb) for verb in verbs)

    def _detect_language(self, text: str) -> str:
        french_markers = (
            "je ", "tu ", "nous ", "vous ", "pour ", "avec ", "demande",
            "annonce", "conge", "reunion", "rapport", "enseignant", "ecole",
            "classe", "eleves", "parents", "peux", "faire", "aide",
        )
        return "fr" if any(marker in text for marker in french_markers) else "en"

    def _extract_details(self, text: str, context: dict) -> dict[str, str]:
        details: dict[str, str] = {}
        if context.get("department"):
            details["department"] = str(context["department"])

        if any(term in text for term in ("urgent", "urgence", "important", "prioritaire", "immediately")):
            details["priority"] = "urgent"
        elif any(term in text for term in ("info", "information", "normal")):
            details["priority"] = "normal"

        audience_terms = {
            "teachers": ("teachers", "teacher", "enseignants", "professeurs"),
            "staff": ("staff", "personnel", "employes"),
            "parents": ("parents",),
            "students": ("students", "eleves", "etudiants"),
            "whole school": ("everyone", "all", "tout le monde", "toute l ecole", "whole school"),
        }
        for audience, terms in audience_terms.items():
            if any(self._contains_term(text, term) for term in terms):
                details["audience"] = audience
                break

        date_match = re.search(
            r"\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|"
            r"demain|aujourd hui|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|"
            r"\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b",
            text,
        )
        if date_match:
            details["date"] = date_match.group(1)

        return details

    def _clean_sentence(self, message: str) -> str:
        cleaned = re.sub(r"\s+", " ", (message or "").strip())
        cleaned = cleaned.strip(" .")
        return cleaned[:1].lower() + cleaned[1:] if cleaned else "la demande doit etre precisee"

    def _topic(self, message: str, fallback: str) -> str:
        cleaned = re.sub(r"\s+", " ", (message or "").strip(" ."))
        if not cleaned:
            return fallback
        return cleaned[:80]
