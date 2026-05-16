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
            "ecosystem_status_query": IntentDefinition(
                keywords=(
                    "ecosystem", "ecosysteme", "system", "systeme", "etat", "status",
                    "porte parole", "porte-parole", "spokesperson", "parle au nom",
                    "savanex", "edupay", "nexus", "orbit", "edusync", "vie de l ecole",
                    "resume ecosysteme", "situation generale", "tout le systeme",
                ),
                actions_en=("summarize_ecosystem_state", "verify_data_sources", "prioritize_alerts", "prepare_official_reply"),
                actions_fr=("resumer_etat_ecosysteme", "verifier_sources", "prioriser_alertes", "preparer_reponse_officielle"),
            ),
            "announcement_request": IntentDefinition(
                keywords=(
                    "announce", "announcement", "annonce", "annoncer", "communique",
                    "broadcast", "diffuser", "message", "inform", "informer",
                    "notify", "notifier", "publier", "urgent",
                ),
                actions_en=("draft_announcement", "choose_audience", "set_priority", "schedule_message"),
                actions_fr=("rediger_annonce", "choisir_audience", "definir_priorite", "programmer_message"),
            ),
            "finance_query": IntentDefinition(
                keywords=(
                    "payment", "payments", "paid", "unpaid", "fees", "fee", "balance",
                    "invoice", "invoices", "receipt", "receipts", "tuition", "payer",
                    "paye", "payes", "payee", "payees", "paiement", "paiements",
                    "impaye", "impayes", "frais", "solde", "facture", "factures",
                    "recu", "recus", "scolarite", "finance", "finances", "eleves",
                    "students", "liste", "quels", "lesquels",
                ),
                actions_en=("open_finance_module", "filter_paid_students", "export_payment_list", "check_balances"),
                actions_fr=("ouvrir_module_finance", "filtrer_eleves_payes", "exporter_liste_paiements", "verifier_soldes"),
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
            if intent == "finance_query" and self._is_payment_question(text):
                score += 4.0
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
            response = self._apply_spokesperson_frame(response, context, "fr")
            actions = list(self.intent_definitions.get(intent, self.intent_definitions["capability_query"]).actions_fr)
        else:
            response = self._compose_english_response(intent, message, details)
            response = self._apply_spokesperson_frame(response, context, "en")
            actions = list(self.intent_definitions.get(intent, self.intent_definitions["capability_query"]).actions_en)

        return response, actions

    def _compose_french_response(self, intent: str, original_message: str, details: dict[str, str]) -> str:
        if intent == "ecosystem_status_query":
            return self._compose_ecosystem_status("fr", details)

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

        if intent == "finance_query":
            paid_status = details.get("payment_status", "payes")
            audience = self._localized_audience(details.get("audience", "students"), "fr")
            return "\n".join([
                f"Tu demandes une liste financiere: les {audience} qui ont ete {paid_status}.",
                "",
                "Reponse correcte: ce n'est pas une annonce a rediger. Il faut interroger le module paiement/frais, puis retourner un tableau.",
                "",
                "Colonnes a afficher: nom eleve, classe, parent, montant paye, solde restant, date du dernier paiement, statut.",
                "Filtres utiles: annee scolaire, trimestre, classe, statut Paye/Partiel/Impaye.",
                "",
                "Action suivante: ouvre EduPay ou le module Finance SAVANEX, filtre le statut Paye, puis exporte la liste. Si tu me donnes la classe ou la periode, je prepare le filtre exact.",
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
                "Je suis le porte-parole operationnel de l'ecosysteme: je transforme l'etat reel de SAVANEX, EduPay, Nexus, Orbit et EduSync en messages clairs. "
                "Je peux annoncer, alerter, resumer, expliquer les donnees disponibles, preparer des workflows, organiser des reunions et produire des rapports. "
                "Je signale aussi les donnees manquantes au lieu d'inventer."
            )

        return "\n".join([
            "J'ai compris que tu veux une aide operationnelle, mais la demande est trop ouverte.",
            f"Voici ce que je peux deja cadrer: {self._clean_sentence(original_message)}.",
            "Dis-moi si tu veux en faire une annonce, un workflow, un rapport, une reunion, un planning ou une notification.",
        ])

    def _compose_english_response(self, intent: str, original_message: str, details: dict[str, str]) -> str:
        if intent == "ecosystem_status_query":
            return self._compose_ecosystem_status("en", details)

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

        if intent == "finance_query":
            status_labels = {
                "payes": "paid",
                "impayes": "unpaid",
                "partiellement payes": "partially paid",
            }
            paid_status = status_labels.get(details.get("payment_status", "payes"), "paid")
            audience = details.get("audience", "students")
            requested_export = self._contains_term(self._normalize(original_message), "export")
            export_line = "Export: generate CSV/XLSX with the visible filtered rows." if requested_export else "Export: available after the filter is confirmed."
            return "\n".join([
                f"Finance command understood: list {audience} marked as {paid_status}, check balances, and prepare export.",
                "",
                "Correct handling: open the finance/payment module, not announcements or messaging.",
                "",
                "Apply filters: status = Paid, entity = Students. Add class, academic year, or term if provided.",
                "Table columns: student name, class, parent, amount paid, remaining balance, last payment date, status.",
                export_line,
                "",
                "Next step: connect this action to EduPay/Orbit data so I can return the table directly instead of only the workflow.",
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
                "I am the ecosystem's operational spokesperson: I turn the real state of SAVANEX, EduPay, Nexus, Orbit, and EduSync into clear official messages. "
                "I can announce, alert, summarize, explain available data, prepare workflows, organize meetings, and produce reports. "
                "I also flag missing data instead of inventing figures."
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
            "open", "filter", "export", "check", "show", "list",
            "preparer", "creer", "envoyer", "lancer", "rediger", "planifier", "organiser",
            "ouvrir", "filtrer", "exporter", "verifier", "afficher", "lister",
            "faire", "ecrire", "aider", "help",
        )
        return any(self._contains_term(text, verb) for verb in verbs)

    def _is_payment_question(self, text: str) -> bool:
        payment_terms = (
            "paye", "payes", "payee", "payees", "paiement", "paiements",
            "impaye", "impayes", "frais", "solde", "facture", "scolarite",
            "paid", "unpaid", "payment", "payments", "fees", "balance", "tuition",
        )
        student_terms = ("eleve", "eleves", "student", "students", "parent", "parents")
        question_terms = ("qui", "quels", "quelles", "liste", "voir", "affiche", "show", "list", "which", "who")
        return (
            any(self._contains_term(text, term) for term in payment_terms)
            and (
                any(self._contains_term(text, term) for term in student_terms)
                or any(self._contains_term(text, term) for term in question_terms)
            )
        )

    def _detect_language(self, text: str) -> str:
        french_markers = (
            "je ", "tu ", "nous ", "vous ", "pour ", "avec ", "demande",
            "annonce", "conge", "reunion", "rapport", "enseignant", "ecole",
            "classe", "eleves", "parents", "peux", "faire", "aide",
            "etat", "ecosysteme", "donne", "general",
        )
        return "fr" if any(marker in text for marker in french_markers) else "en"

    def _extract_details(self, text: str, context: dict) -> dict[str, str]:
        details: dict[str, str] = {}
        if context.get("department"):
            details["department"] = str(context["department"])
        if context.get("ecosystem_context"):
            details["ecosystem_context"] = context["ecosystem_context"]

        if any(term in text for term in ("urgent", "urgence", "important", "prioritaire", "immediately")):
            details["priority"] = "urgent"
        elif any(term in text for term in ("info", "information", "normal")):
            details["priority"] = "normal"

        has_paid = any(self._contains_term(text, term) for term in ("paye", "payes", "payee", "payees", "paid"))
        has_unpaid = any(self._contains_term(text, term) for term in ("impaye", "impayes", "unpaid"))

        if has_unpaid:
            details["payment_status"] = "impayes"
        elif any(self._contains_term(text, term) for term in ("partiel", "partial")):
            details["payment_status"] = "partiellement payes"
        elif has_paid:
            details["payment_status"] = "payes"

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

    def _apply_spokesperson_frame(self, response: str, context: dict, language: str) -> str:
        ecosystem = context.get("ecosystem_context")
        if not ecosystem:
            return response

        metrics = ecosystem.get("metrics", {})
        shared_directory = ecosystem.get("shared_directory", {})
        orbit_connected = ecosystem.get("ecosystem", {}).get("orbit_connected", False)

        if language == "fr":
            header = (
                "Voix officielle EduSync AI: je reponds au nom de l'ecosysteme et je me base uniquement sur les donnees disponibles."
            )
            facts = (
                f"Etat verifie: {metrics.get('announcements_total', 0)} annonces, "
                f"{metrics.get('pending_workflows', 0)} workflows en attente, "
                f"{metrics.get('unread_notifications_for_user', 0)} notifications non lues pour toi, "
                f"{metrics.get('activity_events_last_24h', 0)} actions journalisees sur 24h."
            )
            source = (
                "Source: EduSync local + KCS Orbit connecte."
                if orbit_connected and shared_directory.get("available")
                else f"Source: EduSync local. KCS Orbit non confirme ({shared_directory.get('reason', 'configuration ou reponse indisponible')})."
            )
        else:
            header = (
                "Official EduSync AI voice: I speak for the ecosystem and use only available data."
            )
            facts = (
                f"Verified state: {metrics.get('announcements_total', 0)} announcements, "
                f"{metrics.get('pending_workflows', 0)} pending workflows, "
                f"{metrics.get('unread_notifications_for_user', 0)} unread notifications for you, "
                f"{metrics.get('activity_events_last_24h', 0)} logged actions in 24h."
            )
            source = (
                "Source: local EduSync + connected KCS Orbit."
                if orbit_connected and shared_directory.get("available")
                else f"Source: local EduSync. KCS Orbit not confirmed ({shared_directory.get('reason', 'configuration or response unavailable')})."
            )

        return "\n".join([header, facts, source, "", response])

    def _compose_ecosystem_status(self, language: str, details: dict[str, str]) -> str:
        ecosystem = details.get("ecosystem_context", {})
        metrics = ecosystem.get("metrics", {})
        directory = ecosystem.get("shared_directory", {})
        latest_announcements = ecosystem.get("latest_announcements", [])
        latest_alerts = ecosystem.get("latest_alerts", [])

        if language == "fr":
            lines = [
                "Synthese generale:",
                f"- Communication: {metrics.get('announcements_total', 0)} annonces dont {metrics.get('urgent_announcements', 0)} urgentes.",
                f"- Operations: {metrics.get('pending_workflows', 0)} workflows attendent une decision.",
                f"- Alertes: {metrics.get('unread_notifications_for_user', 0)} notifications non lues pour l'utilisateur connecte.",
                f"- Activite: {metrics.get('activity_events_total', 0)} evenements journalises, {metrics.get('activity_events_last_24h', 0)} sur 24h.",
            ]
            if directory.get("available"):
                lines.append(
                    f"- Repertoire Orbit: {directory.get('students_count')} eleves, {directory.get('parents_count')} parents, {directory.get('teachers_count')} enseignants visibles."
                )
            else:
                lines.append(f"- Repertoire Orbit: non disponible; raison: {directory.get('reason', 'non precisee')}.")

            if latest_announcements:
                lines.append("Dernieres annonces: " + "; ".join(item["title"] for item in latest_announcements))
            if latest_alerts:
                lines.append("Dernieres alertes: " + "; ".join(item["title"] for item in latest_alerts))

            lines.extend([
                "",
                "Decision recommandee: traiter d'abord les workflows en attente et les notifications non lues, puis publier une annonce officielle si une information doit atteindre parents, eleves, enseignants ou staff.",
                "Limite de verite: je ne peux pas confirmer les notes, paiements ou statistiques SAVANEX/EduPay/Nexus si ces donnees ne sont pas exposees par Orbit ou injectees dans cette requete.",
            ])
            return "\n".join(lines)

        lines = [
            "General summary:",
            f"- Communication: {metrics.get('announcements_total', 0)} announcements including {metrics.get('urgent_announcements', 0)} urgent.",
            f"- Operations: {metrics.get('pending_workflows', 0)} workflows awaiting decision.",
            f"- Alerts: {metrics.get('unread_notifications_for_user', 0)} unread notifications for the signed-in user.",
            f"- Activity: {metrics.get('activity_events_total', 0)} logged events, {metrics.get('activity_events_last_24h', 0)} in 24h.",
        ]
        if directory.get("available"):
            lines.append(
                f"- Orbit directory: {directory.get('students_count')} students, {directory.get('parents_count')} parents, {directory.get('teachers_count')} teachers visible."
            )
        else:
            lines.append(f"- Orbit directory: unavailable; reason: {directory.get('reason', 'not specified')}.")

        if latest_announcements:
            lines.append("Latest announcements: " + "; ".join(item["title"] for item in latest_announcements))
        if latest_alerts:
            lines.append("Latest alerts: " + "; ".join(item["title"] for item in latest_alerts))

        lines.extend([
            "",
            "Recommended decision: handle pending workflows and unread notifications first, then publish an official announcement if information must reach parents, students, teachers, or staff.",
            "Truth limit: I cannot confirm SAVANEX, EduPay, or Nexus grades/payments/statistics unless those data are exposed by Orbit or included in this request.",
        ])
        return "\n".join(lines)

    def _clean_sentence(self, message: str) -> str:
        cleaned = re.sub(r"\s+", " ", (message or "").strip())
        cleaned = cleaned.strip(" .")
        return cleaned[:1].lower() + cleaned[1:] if cleaned else "la demande doit etre precisee"

    def _localized_audience(self, audience: str, language: str) -> str:
        labels = {
            "fr": {
                "teachers": "enseignants",
                "staff": "personnel",
                "parents": "parents",
                "students": "eleves",
                "whole school": "toute l'ecole",
            },
            "en": {
                "teachers": "teachers",
                "staff": "staff",
                "parents": "parents",
                "students": "students",
                "whole school": "the whole school",
            },
        }
        return labels.get(language, labels["en"]).get(audience, audience)

    def _topic(self, message: str, fallback: str) -> str:
        cleaned = re.sub(r"\s+", " ", (message or "").strip(" ."))
        if not cleaned:
            return fallback
        return cleaned[:80]
