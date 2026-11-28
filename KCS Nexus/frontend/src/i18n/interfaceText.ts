import {globalFrenchText} from './globalText'
import {auditedFrenchText,auditedEnglishAliases} from './auditText'

export const interfacePhrases:Record<string,string>={...globalFrenchText,...auditedFrenchText}
const englishByFrench = {...Object.fromEntries(Object.entries(interfacePhrases).map(([english, french]) => [french, english])), ...auditedEnglishAliases}
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()
const frenchByNormalizedEnglish = Object.fromEntries(Object.entries(interfacePhrases).map(([english, french]) => [normalize(english), french]))
const englishByNormalizedFrench = Object.fromEntries(Object.entries(interfacePhrases).map(([english, french]) => [normalize(french), english]))


// Display labels only: option values and API status codes are never rewritten.
const enumLabels:Record<string,[string,string]>={
 PROMOTE:['Promote','Passage en classe supérieure'],REPEAT:['Repeat','Redoublement'],GRADUATE:['Graduate','Fin des études'],
 PRESENT:['Present','Présent'],ABSENT:['Absent','Absent'],LATE:['Late','En retard'],SICK:['Sick','Malade'],EXCUSED:['Excused','Excusé'],SUSPENDED:['Suspended','Suspendu'],
 ACTIVE:['Active','Actif'],INACTIVE:['Inactive','Inactif'],active:['Active','Actif'],inactive:['Inactive','Inactif'],
 DRAFT:['Draft','Brouillon'],READY_FOR_REVIEW:['Ready for review','Prêt pour vérification'],APPROVED:['Approved','Approuvé'],POSTED_TO_PORTAL:['Published','Publié'],PENDING:['Pending','En attente'],SUBMITTED:['Submitted','Soumis'],REJECTED:['Rejected','Refusé'],CANCELLED:['Cancelled','Annulé'],
 DELIVERED:['Delivered','Distribué'],QUEUED:['Queued','En file d’attente'],FAILED:['Failed','Échec'],ACKNOWLEDGED:['Acknowledged','Réception confirmée'],
 STUDENT:['Student','Élève'],TEACHER:['Teacher','Enseignant'],STAFF:['Staff','Personnel'],PARENT:['Parent','Parent'],ADMIN:['Administrator','Administrateur'],INFO:['Information','Information'],NEW:['New','Nouveau'],
}

export const translateInterfaceText = (value: string, language: string) => {
  const trimmed = value.trim()
  if (!trimmed) return value
  const canonical = auditedEnglishAliases[trimmed]
  if (canonical) return value.replace(trimmed, language === 'fr' ? interfacePhrases[canonical] ?? trimmed : canonical)
  // An English source must survive a round trip even when a French label is ambiguous.
  if (language !== 'fr' && Object.prototype.hasOwnProperty.call(interfacePhrases, trimmed)) return value
  if (enumLabels[trimmed]) return value.replace(trimmed, enumLabels[trimmed][language === 'fr' ? 1 : 0])

  if (language === 'fr') {
    const dynamicRules: Array<[RegExp, string]> = [
      [/^Delete (.+)$/, 'Supprimer $1'], [/^Edit (.+)$/, 'Modifier $1'], [/^View (.+)$/, 'Voir $1'], [/^Select (.+)$/, 'Sélectionner $1'],
      [/^Reset access for (.+)$/, 'Réinitialiser les accès de $1'],
      [/^No results found for "(.+)"$/, 'Aucun résultat trouvé pour « $1 »'],
      [/^(\d+) assigned student\(s\)$/, '$1 \u00e9l\u00e8ve(s) assign\u00e9(s)'],
      [/^A discipline report has been recorded for (.+): (.+)\.$/, 'Un rapport disciplinaire a \u00e9t\u00e9 enregistr\u00e9 pour $1 : $2.'],
      [/^To (.+)$/, 'À $1'], [/^From (.+)$/, 'De $1'], [/^(\d+) unread$/, '$1 non lu(s)'],
      [/^Due (.+)$/, 'Échéance : $1'], [/^Max (.+) points$/, 'Maximum : $1 points'],
      [/^(\d+) student\(s\)$/, '$1 élève(s)'],
      [/^(\d+) enrolled$/, '$1 inscrit(s)'],
      [/^(\d+) active students in the school$/, '$1 élève(s) actif(s) dans l’école'],
      [/^(\d+)\/(\d+) selected$/, '$1/$2 sélectionné(s)'],
      [/^Save (\d+) enrolled$/, 'Enregistrer $1 inscrit(s)'],
      [/^Comment applied to (\d+) visible learner\(s\)\. Save the draft to persist it\.$/, 'Commentaire appliqué à $1 élève(s) visible(s). Enregistrez le brouillon pour le conserver.'],
      [/^Submission blocked: (\d+) learner\(s\) have no calculated grade or approved override\.$/, 'Soumission bloquée : $1 élève(s) n’ont ni note calculée ni dérogation approuvée.'],
      [/^Submission blocked: explain every manual override before submission \((\d+) learner\(s\)\)\.$/, 'Soumission bloquée : justifiez chaque dérogation manuelle avant la soumission ($1 élève(s)).'],
      [/^(\d+) final grade\(s\) submitted\. The session is now read-only pending administrative review\.$/, '$1 note(s) finale(s) soumise(s). La session est maintenant en lecture seule dans l’attente de l’examen administratif.'],
      [/^Final grade for (.+)$/, 'Note finale de $1'],
      [/^Override reason for (.+)$/, 'Justification de la dérogation pour $1'],
      [/^Teacher comment for (.+)$/, 'Commentaire de l’enseignant pour $1'],
      [/^(\d+) visible of (\d+) enrolled learners$/, '$1 visibles sur $2 élèves inscrits'],
      [/^Apply to (\d+)$/, 'Appliquer à $1'],
      [/^(\d+) enrolled - (\d+) available$/, '$1 inscrits - $2 disponibles'],
      [/^(\d+) credit hour\(s\) - (\d+) enrolled$/, '$1 heure(s) de crédit - $2 inscrits'],
      [/^Verified indicators: (\d+) graded item\(s\), (\d+) attendance record\(s\), and (\d+) overdue assignment\(s\)\.$/, 'Indicateurs vérifiés : $1 élément(s) noté(s), $2 présence(s) enregistrée(s) et $3 devoir(s) en retard.'],
      [/^(.+) updated for (.+); (\d+) official student\(s\) enrolled\.$/, '$1 mis à jour pour $2 ; $3 élève(s) officiel(s) inscrit(s).'],
      [/^(.+) created for (.+); (\d+) official student\(s\) enrolled\.$/, '$1 créé pour $2 ; $3 élève(s) officiel(s) inscrit(s).'],
      [/^(.+) column added and saved\. Final grades recalculated\.$/, 'Colonne $1 ajoutée et enregistrée. Notes finales recalculées.'],
    ]
    for (const [pattern, replacement] of dynamicRules) {
      if (pattern.test(trimmed)) return value.replace(trimmed, trimmed.replace(pattern, replacement))
    }
    if (/^\d+\s+years?\s+experience$/i.test(trimmed)) {
      return value.replace(trimmed, trimmed.replace(/\s+years?\s+experience/i, ' ans d’expérience'))
    }
    if (/^Step\s+\d+$/i.test(trimmed)) {
      return value.replace(trimmed, trimmed.replace(/^Step/i, 'Étape'))
    }
    if (/^\d+\s+students$/i.test(trimmed)) {
      return value.replace(trimmed, trimmed.replace(/\s+students$/i, ' élèves'))
    }
    if (/^\d+\s+spots remaining$/i.test(trimmed)) {
      return value.replace(trimmed, trimmed.replace(/\s+spots remaining$/i, ' places restantes'))
    }
  } else {
    const reverseDynamicRules: Array<[RegExp, string]> = [
      [/^Supprimer (.+)$/, 'Delete $1'], [/^Modifier (.+)$/, 'Edit $1'], [/^Voir (.+)$/, 'View $1'], [/^Sélectionner (.+)$/, 'Select $1'],
      [/^Réinitialiser les accès de (.+)$/, 'Reset access for $1'],
      [/^Connexion impossible à l’API KCS Nexus \((.+)\)\. Vérifiez que le service est disponible\.$/, 'Unable to connect to the KCS Nexus API ($1). Check that the service is available.'],
      [/^Commentaire appliqué à (\d+) élève\(s\) visible\(s\)\. Enregistrez le brouillon pour le conserver\.$/, 'Comment applied to $1 visible learner(s). Save the draft to persist it.'],
      [/^Soumission bloquée : (\d+) élève\(s\) n’ont ni note calculée ni dérogation approuvée\.$/, 'Submission blocked: $1 learner(s) have no calculated grade or approved override.'],
      [/^Soumission bloquée : justifiez chaque dérogation manuelle avant la soumission \((\d+) élève\(s\)\)\.$/, 'Submission blocked: explain every manual override before submission ($1 learner(s)).'],
      [/^(\d+) note\(s\) finale\(s\) soumise\(s\)\. La session est maintenant en lecture seule dans l’attente de l’examen administratif\.$/, '$1 final grade(s) submitted. The session is now read-only pending administrative review.'],
      [/^(\d+) inscrit\(s\)$/, '$1 enrolled'],
      [/^(\d+) élève\(s\) actif\(s\) dans l’école$/, '$1 active students in the school'],
      [/^(\d+)\/(\d+) sélectionné\(s\)$/, '$1/$2 selected'],
      [/^Enregistrer (\d+) inscrit\(s\)$/, 'Save $1 enrolled'],
      [/^Note finale de (.+)$/, 'Final grade for $1'],
      [/^Justification de la dérogation pour (.+)$/, 'Override reason for $1'],
      [/^Commentaire de l’enseignant pour (.+)$/, 'Teacher comment for $1'],
      [/^(\d+) visibles sur (\d+) élèves inscrits$/, '$1 visible of $2 enrolled learners'],
      [/^Appliquer à (\d+)$/, 'Apply to $1'],
      [/^(\d+) inscrits - (\d+) disponibles$/, '$1 enrolled - $2 available'],
      [/^(\d+) heure\(s\) de crédit - (\d+) inscrits$/, '$1 credit hour(s) - $2 enrolled'],
      [/^Indicateurs vérifiés : (\d+) élément\(s\) noté\(s\), (\d+) présence\(s\) enregistrée\(s\) et (\d+) devoir\(s\) en retard\.$/, 'Verified indicators: $1 graded item(s), $2 attendance record(s), and $3 overdue assignment(s).'],
      [/^(\d+) \u00e9l\u00e8ve\(s\) assign\u00e9\(s\)$/, '$1 assigned student(s)'],
      [/^Un rapport disciplinaire a \u00e9t\u00e9 enregistr\u00e9 pour (.+) : (.+)\.$/, 'A discipline report has been recorded for $1: $2.'],
      [/^(.+) mis à jour pour (.+) ; (\d+) élève\(s\) officiel\(s\) inscrit\(s\)\.$/, '$1 updated for $2; $3 official student(s) enrolled.'],
      [/^(.+) créé pour (.+) ; (\d+) élève\(s\) officiel\(s\) inscrit\(s\)\.$/, '$1 created for $2; $3 official student(s) enrolled.'],
      [/^Colonne (.+) ajoutée et enregistrée\. Notes finales recalculées\.$/, '$1 column added and saved. Final grades recalculated.'],
    ]
    for (const [pattern, replacement] of reverseDynamicRules) {
      if (pattern.test(trimmed)) return value.replace(trimmed, trimmed.replace(pattern, replacement))
    }
    if (/^\d+\s+ans d/i.test(trimmed)) {
      return value.replace(trimmed, trimmed.replace(/\s+ans d.*$/i, ' years experience'))
    }
    if (/^Étape\s+\d+$/i.test(trimmed)) {
      return value.replace(trimmed, trimmed.replace(/^Étape/i, 'Step'))
    }
    if (/^\d+\s+élèves$/i.test(trimmed)) {
      return value.replace(trimmed, trimmed.replace(/\s+élèves$/i, ' students'))
    }
    if (/^\d+\s+places restantes$/i.test(trimmed)) {
      return value.replace(trimmed, trimmed.replace(/\s+places restantes$/i, ' spots remaining'))
    }
  }

  const normalized = normalize(trimmed)
  const translated =
    language === 'fr'
      ? interfacePhrases[trimmed] ?? frenchByNormalizedEnglish[normalized]
      : englishByFrench[trimmed] ?? englishByNormalizedFrench[normalized]
  if (!translated) return value

  return value.replace(trimmed, translated)
}

