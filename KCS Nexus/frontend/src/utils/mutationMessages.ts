const pairs: Array<[string, string]> = [
 ['Bulletins générés à partir des notes soumises.','Report cards generated from submitted grades'],
 ['Le bulletin est approuvé et les notes officielles sont figées.','Report card approved and official grades frozen'],
 ['Six préférences électives classées ont été enregistrées.','Six ranked elective choices submitted'],
 ['Cours électif ajouté.','Elective added'],
 ['Proposition de cours électif envoyée au Principal.','Proposal submitted for approval'],
  ["Modification enregistrée avec succès.", "Changes saved successfully."],
  [
    "Opération créée et enregistrée avec succès.",
    "Operation created and saved successfully.",
  ],
  ["Suppression effectuée avec succès.", "Deletion completed successfully."],
  [
    "L’opération n’a pas pu être effectuée.",
    "The operation could not be completed.",
  ],
  [
    "Les corrections du bulletin ont été enregistrées et auditées.",
    "Report-card academic and presentation fields updated and audited",
  ],
  [
    "Le bulletin est enregistré dans le registre de vérification public.",
    "Report card registered for public verification",
  ],
  [
    "Les bulletins ont été publiés et leur envoi aux parents est en file sécurisée.",
    "Official report cards published to parent dashboards and email delivery safely queued",
  ],
  [
    "L’envoi de bulletins déjà reçu a été reconnu.",
    "Previously queued report-card delivery confirmed",
  ],
  [
    "Les notes finales sont enregistrées et les brouillons de bulletins ont été vérifiés.",
    "Final grades saved, previous course submission replaced, and report-card drafts verified",
  ],
  [
    "La période est clôturée et ses dossiers académiques sont en lecture seule.",
    "The academic period is closed and its academic records are read-only",
  ],
  [
    "Photo personnelle Nexus enregistrée. La photo officielle reste indépendante.",
    "Personal Nexus profile photo updated without changing the official ecosystem portrait",
  ],
  ["Profil enregistré.", "Profile updated successfully"],
  ["Campagne de cours électifs créée.", "Elective cycle created"],
  ["Statut de la campagne mis à jour.", "Elective cycle status updated"],
  ["Cours électif mis à jour.", "Elective updated"],
  ["Cours électif supprimé.", "Elective removed"],
  ["Cours électif déjà supprimé.", "Elective already removed"],
  ["Attributions calculées.", "Allocation completed"],
  ["Listes électives définitives publiées.", "Final elective lists published"],
];
export function localizeMutationMessage(message: string, language: string) {
  if (message.startsWith('ACADEMIC_PERIOD_CLOSED:')) return language.startsWith('fr') ? 'Cette période est clôturée. Ses notes et ses dossiers académiques sont en lecture seule.' : 'This academic period is closed. Its grades and academic records are read-only.'
  const pair = pairs.find(([fr, en]) => message === fr || message === en);
  return pair ? pair[language.startsWith("fr") ? 0 : 1] : message;
}
