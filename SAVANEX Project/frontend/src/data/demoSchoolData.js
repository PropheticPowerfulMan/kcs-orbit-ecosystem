export const students = [
  { id: 1, name: 'Elise Kabongo', className: 'Grade 11A', parent: 'Rachel Kabongo', attendance: 97, average: 18.4, trend: '+0.8', status: 'Excellent', risk: 'Faible' },
  { id: 2, name: 'David Kabongo', className: 'Grade 8B', parent: 'Rachel Kabongo', attendance: 89, average: 15.6, trend: '-0.2', status: 'À surveiller', risk: 'Moyen' },
  { id: 3, name: 'Amani Mbuyi', className: 'Grade 10A', parent: 'Mireille Mbuyi', attendance: 72, average: 10.8, trend: '-1.1', status: 'Intervention', risk: 'Élevé' },
  { id: 4, name: 'Naomi Ilunga', className: 'Grade 7A', parent: 'Patrick Ilunga', attendance: 91, average: 14.6, trend: '+0.4', status: 'Stable', risk: 'Faible' },
  { id: 5, name: 'Sarah Kalala', className: 'Grade 6', parent: 'Claire Kalala', attendance: 88, average: 13.2, trend: '+0.9', status: 'En progrès', risk: 'Faible' },
  { id: 6, name: 'Joel Banza', className: 'Grade 10B', parent: 'Beatrice Banza', attendance: 74, average: 10.2, trend: '-0.3', status: 'Soutien', risk: 'Élevé' },
];

export const teachers = [
  { id: 1, name: 'M. Alain Lukusa', subject: 'Mathématiques', classes: 5, load: '26h', satisfaction: 94, completion: 88 },
  { id: 2, name: 'Mme Chantal Moke', subject: 'Français', classes: 4, load: '22h', satisfaction: 91, completion: 93 },
  { id: 3, name: 'Dr. Peter Ngalula', subject: 'Sciences', classes: 6, load: '29h', satisfaction: 89, completion: 84 },
  { id: 4, name: 'Mme Esther Kalala', subject: 'Anglais', classes: 5, load: '24h', satisfaction: 96, completion: 91 },
];

export const parents = [
  { id: 1, name: 'Rachel Kabongo', student: 'Elise Kabongo, David Kabongo', phone: '+243 812 450 221', email: 'rachel.kabongo@kcs.local', relation: 'Mère', engagement: 97, lastContact: "Aujourd'hui", balance: 'Partiellement payé', meetings: 4 },
  { id: 2, name: 'Mireille Mbuyi', student: 'Amani Mbuyi', phone: '+243 899 120 882', email: 'mireille.mbuyi@kcs.local', relation: 'Mère', engagement: 63, lastContact: 'Il y a 3 jours', balance: 'En retard', meetings: 1 },
  { id: 3, name: 'Patrick Ilunga', student: 'Naomi Ilunga', phone: '+243 843 774 101', email: 'patrick.ilunga@kcs.local', relation: 'Tuteur', engagement: 88, lastContact: 'Hier', balance: 'Payé', meetings: 3 },
  { id: 4, name: 'Claire Kalala', student: 'Sarah Kalala', phone: '+243 815 330 477', email: 'claire.kalala@kcs.local', relation: 'Mère', engagement: 79, lastContact: 'Il y a 5 jours', balance: 'Payé', meetings: 2 },
  { id: 5, name: 'Beatrice Banza', student: 'Joel Banza', phone: '+243 817 444 909', email: 'beatrice.banza@kcs.local', relation: 'Mère', engagement: 42, lastContact: 'Il y a 12 jours', balance: 'En attente', meetings: 0 },
];

export const timetable = [
  { id: 1, day: 'Lundi', time: '08:00', className: 'Grade 11A', subject: 'Mathématiques', teacher: 'M. Alain Lukusa', room: 'A12', conflict: 'Aucun' },
  { id: 2, day: 'Lundi', time: '10:00', className: 'Grade 8B', subject: 'Sciences', teacher: 'Dr. Peter Ngalula', room: 'Lab 2', conflict: 'Aucun' },
  { id: 3, day: 'Mardi', time: '09:00', className: 'Grade 10A', subject: 'Français', teacher: 'Mme Chantal Moke', room: 'B04', conflict: 'Capacité à vérifier' },
  { id: 4, day: 'Mercredi', time: '13:00', className: 'Grade 7A', subject: 'Anglais', teacher: 'Mme Esther Kalala', room: 'C09', conflict: 'Aucun' },
  { id: 5, day: 'Vendredi', time: '11:00', className: 'Grade 10B', subject: 'Sciences', teacher: 'Dr. Peter Ngalula', room: 'Lab 1', conflict: 'Charge enseignant' },
];

export const messages = [
  { id: 1, channel: 'Relance parent', audience: 'Mireille Mbuyi', priority: 'Urgent', status: 'Brouillon prêt', owner: 'Conseiller', sentiment: 'Préoccupation' },
  { id: 2, channel: 'Bulletin hebdomadaire', audience: 'Tous les parents', priority: 'Normal', status: 'Planifié', owner: 'Admin', sentiment: 'Positif' },
  { id: 3, channel: "Rappel d'examen", audience: 'Grade 10', priority: 'High', status: 'Envoyé', owner: 'Bureau académique', sentiment: 'Neutre' },
  { id: 4, channel: 'Réunion enseignant', audience: 'Rachel Kabongo', priority: 'High', status: 'En attente de réponse', owner: 'M. Lukusa', sentiment: 'Préoccupation' },
];

export const monthlyPerformance = [
  { month: 'Jan', attendance: 88, grades: 13.1, engagement: 66, risk: 17 },
  { month: 'Feb', attendance: 90, grades: 13.7, engagement: 71, risk: 15 },
  { month: 'Mar', attendance: 92, grades: 14.2, engagement: 76, risk: 11 },
  { month: 'Apr', attendance: 94, grades: 14.8, engagement: 82, risk: 8 },
  { month: 'May', attendance: 93, grades: 15.1, engagement: 85, risk: 7 },
  { month: 'Jun', attendance: 95, grades: 15.4, engagement: 88, risk: 5 },
];

export const classDistribution = [
  { name: 'Grade 7', students: 74 },
  { name: 'Grade 8', students: 82 },
  { name: 'Grade 9', students: 79 },
  { name: 'Grade 10', students: 91 },
  { name: 'Grade 11', students: 64 },
  { name: 'Grade 12', students: 38 },
];

export const financeSignals = [
  { label: 'Payé', value: 72 },
  { label: 'En attente', value: 19 },
  { label: 'En retard', value: 9 },
];

export const advancedMetrics = {
  retentionProbability: 96,
  interventionAccuracy: 89,
  parentEngagement: 82,
  curriculumCompletion: 91,
  predictedPassRate: 93,
  feeRecoveryRate: 86,
};
