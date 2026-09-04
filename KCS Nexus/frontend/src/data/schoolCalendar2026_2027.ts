export type SchoolCalendarEvent = {
  date: string
  endDate?: string
  title: string
  description: string
  type: 'academic' | 'assessment' | 'break' | 'community' | 'holiday' | 'spiritual'
  location: string
}

export const schoolYear2026_2027 = {
  name: '2026-2027',
  firstDay: '2026-09-07',
  lastOfficialDay: '2027-06-11',
  semesters: [
    { code: 'S1', name: 'Semestre 1', startDate: '2026-09-07', endDate: '2027-01-29' },
    { code: 'S2', name: 'Semestre 2', startDate: '2027-02-01', endDate: '2027-06-11' },
  ],
  trimesters: [
    { code: 'T1', name: 'Trimestre 1', startDate: '2026-09-07', endDate: '2026-12-18' },
    { code: 'T2', name: 'Trimestre 2', startDate: '2027-01-05', endDate: '2027-03-19' },
    { code: 'T3', name: 'Trimestre 3', startDate: '2027-04-05', endDate: '2027-06-11' },
  ],
  quarterEnds: [
    { code: 'Q1', date: '2026-11-06' },
    { code: 'Q2', date: '2027-01-22' },
    { code: 'Q3', date: '2027-04-09' },
    { code: 'Q4', date: '2027-06-11' },
  ],
} as const

export const schoolCalendarEvents2026_2027: SchoolCalendarEvent[] = [
  { date: '2026-08-31', title: 'Teachers Begin', description: 'Official preparation day for KCS teachers.', type: 'academic', location: 'KCS Campus' },
  { date: '2026-09-07', title: 'First Day of School', description: 'Official opening of classes for the 2026-2027 school year.', type: 'academic', location: 'KCS Campus' },
  { date: '2026-09-09', endDate: '2026-09-10', title: 'High School Orientation', description: 'Orientation program for Upper School students.', type: 'academic', location: 'KCS Campus' },
  { date: '2026-09-12', title: 'High School Parent Orientation', description: 'Online orientation session for High School parents.', type: 'community', location: 'Online' },
  { date: '2026-09-19', title: 'Parent Prayer Meeting', description: 'Prayer gathering for KCS parents.', type: 'spiritual', location: 'KCS Campus' },
  { date: '2026-10-19', title: 'Legacy Day', description: 'Official KCS Legacy Month celebration.', type: 'community', location: 'KCS Campus' },
  { date: '2026-11-04', endDate: '2026-11-05', title: 'Edulastic Tests', description: 'Scheduled Edulastic assessment days.', type: 'assessment', location: 'KCS Campus' },
  { date: '2026-11-06', title: 'End of First Quarter', description: 'Official end of Quarter 1.', type: 'academic', location: 'KCS Campus' },
  { date: '2026-11-14', title: 'Parent-Teacher Conference', description: 'Conference between families and teachers.', type: 'community', location: 'KCS Campus' },
  { date: '2026-11-26', title: 'Thanksgiving', description: 'Thanksgiving observance.', type: 'holiday', location: 'School closed' },
  { date: '2026-11-28', title: 'Thanksgiving Dinner', description: 'KCS community Thanksgiving dinner.', type: 'community', location: 'KCS Campus' },
  { date: '2026-12-18', title: 'Last Day Before Christmas Break', description: 'Final day of classes before Christmas break.', type: 'academic', location: 'KCS Campus' },
  { date: '2026-12-19', title: 'Christmas Concert', description: 'Official KCS Christmas concert.', type: 'community', location: 'KCS Campus' },
  { date: '2026-12-21', endDate: '2027-01-04', title: 'Christmas Break', description: 'Christmas school break.', type: 'break', location: 'School closed' },
  { date: '2027-01-01', title: "New Year's Day", description: "New Year's Day holiday.", type: 'holiday', location: 'School closed' },
  { date: '2027-01-04', title: "Independence Martyrs' Day", description: 'National holiday.', type: 'holiday', location: 'School closed' },
  { date: '2027-01-05', title: 'Back to School', description: 'Classes resume after Christmas break.', type: 'academic', location: 'KCS Campus' },
  { date: '2027-01-16', title: 'Mzee Kabila Day', description: 'National remembrance day.', type: 'holiday', location: 'School closed' },
  { date: '2027-01-17', title: 'Lumumba Day', description: 'National remembrance day.', type: 'holiday', location: 'School closed' },
  { date: '2027-01-22', title: 'End of Second Quarter', description: 'Official end of Quarter 2.', type: 'academic', location: 'KCS Campus' },
  { date: '2027-01-28', endDate: '2027-01-29', title: 'First Semester Exams - Upper School', description: 'First semester examination period for Upper School.', type: 'assessment', location: 'Upper School' },
  { date: '2027-02-06', title: 'Parent-Teacher Conference', description: 'Conference between families and teachers.', type: 'community', location: 'KCS Campus' },
  { date: '2027-02-26', title: 'Lower School Field Trip', description: 'Official field trip for Lower School.', type: 'community', location: 'Off campus' },
  { date: '2027-02-27', title: 'Teacher Prayer Meeting', description: 'Prayer meeting for KCS teachers.', type: 'spiritual', location: 'KCS Campus' },
  { date: '2027-03-04', endDate: '2027-03-05', title: 'Edulastic Tests', description: 'Scheduled Edulastic assessment days.', type: 'assessment', location: 'KCS Campus' },
  { date: '2027-03-19', endDate: '2027-03-21', title: 'Upper School Retreat', description: 'Official Upper School retreat.', type: 'spiritual', location: 'KCS Retreat' },
  { date: '2027-03-22', endDate: '2027-04-04', title: 'Spring Break', description: 'Official spring school break.', type: 'break', location: 'School closed' },
  { date: '2027-04-05', title: 'Back to School', description: 'Classes resume after spring break.', type: 'academic', location: 'KCS Campus' },
  { date: '2027-04-09', title: 'End of Third Quarter', description: 'Official end of Quarter 3.', type: 'academic', location: 'KCS Campus' },
  { date: '2027-04-17', title: 'Parent-Teacher Conference', description: 'Conference between families and teachers.', type: 'community', location: 'KCS Campus' },
  { date: '2027-04-30', title: 'Education Day', description: 'KCS Education Day.', type: 'community', location: 'KCS Campus' },
  { date: '2027-06-04', title: 'All-Section Field Trip', description: 'Official field trip for all school sections.', type: 'community', location: 'Off campus' },
  { date: '2027-06-09', endDate: '2027-06-11', title: 'Second Semester Exams - Upper School', description: 'Second semester examination period for Upper School.', type: 'assessment', location: 'Upper School' },
  { date: '2027-06-11', title: 'Last Official Day of School', description: 'Official end of classes and Quarter 4.', type: 'academic', location: 'KCS Campus' },
  { date: '2027-06-19', title: 'Graduation', description: 'Official KCS graduation ceremony.', type: 'academic', location: 'KCS Campus' },
  { date: '2027-06-26', title: 'Closing Ceremonies', description: 'Official closing ceremonies for the 2026-2027 school year.', type: 'community', location: 'KCS Campus' },
]

export function formatSchoolCalendarDate(event: Pick<SchoolCalendarEvent, 'date' | 'endDate'>, locale = 'en-US') {
  const formatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const start = formatter.format(new Date(`${event.date}T12:00:00Z`))
  if (!event.endDate || event.endDate === event.date) return start
  return `${start} — ${formatter.format(new Date(`${event.endDate}T12:00:00Z`))}`
}

export function getUpcomingSchoolEvents(today = new Date()) {
  const todayIso = today.toISOString().slice(0, 10)
  return schoolCalendarEvents2026_2027.filter((event) => (event.endDate || event.date) >= todayIso)
}
