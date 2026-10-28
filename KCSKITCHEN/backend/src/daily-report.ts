import type { PrismaClient } from '@prisma/client'

const kinshasaParts = (date = new Date()) => Object.fromEntries(
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kinshasa', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value])
) as Record<string, string>

const ascii = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, ' ')
const pdfEscape = (value: unknown) => ascii(value).replace(/([\\()])/g, '\\$1')

function buildProfessionalDailyPdf(input: {
  date: string
  transactionCount: number
  subtotal: number
  subsidy: number
  payable: number
  credit: number
  payments: number
  disputes: number
  rows: Array<{ reference: string; person: string; total: number; mode: string }>
}) {
  const commands: string[] = [
    '0.02 0.18 0.34 rg 0 770 595 72 re f',
    '1 0.80 0.04 rg 0 764 595 6 re f',
    '1 1 1 rg BT /F1 21 Tf 52 805 Td (KCS) Tj ET',
    '1 1 1 rg BT /F1 14 Tf 122 808 Td (KINSHASA CHRISTIAN SCHOOL) Tj ET',
    '0.75 0.86 0.96 rg BT /F1 9 Tf 122 790 Td (KCS KITCHEN - RAPPORT JOURNALIER OFFICIEL) Tj ET',
    '0.92 g BT /F1 72 Tf 220 390 Td (KCS) Tj ET',
    '0.02 0.18 0.34 rg BT /F1 16 Tf 42 728 Td (RAPPORT DU ' + pdfEscape(input.date) + ') Tj ET',
    '0.2 g BT /F1 9 Tf 42 710 Td (Document genere depuis le registre audite KCS Kitchen) Tj ET',
  ]
  const cards = [
    ['Transactions', input.transactionCount], ['Ventes brutes CDF', input.subtotal], ['Prise en charge KCS CDF', input.subsidy],
    ['Net clients CDF', input.payable], ['Credits CDF', input.credit], ['Paiements recus CDF', input.payments], ['Reclamations', input.disputes],
  ] as const
  cards.forEach(([label, value], index) => {
    const col = index % 4
    const row = Math.floor(index / 4)
    const x = 42 + col * 128
    const y = 654 - row * 62
    commands.push(`0.94 0.97 1 rg ${x} ${y} 118 48 re f`, `0.08 0.34 0.57 RG ${x} ${y} 118 48 re S`)
    commands.push(`0.35 g BT /F1 7 Tf ${x + 8} ${y + 31} Td (${pdfEscape(label)}) Tj ET`)
    commands.push(`0.02 0.18 0.34 rg BT /F1 12 Tf ${x + 8} ${y + 13} Td (${pdfEscape(Number(value).toLocaleString('fr-FR'))}) Tj ET`)
  })
  let y = 532
  commands.push('0.02 0.18 0.34 rg BT /F1 12 Tf 42 558 Td (DERNIERES OPERATIONS) Tj ET')
  commands.push('0.08 0.34 0.57 rg 42 536 510 20 re f', '1 1 1 rg BT /F1 8 Tf 49 543 Td (REFERENCE          PERSONNE                              MODE             TOTAL CDF) Tj ET')
  for (const row of input.rows.slice(0, 18)) {
    commands.push(`0.2 g BT /F1 7 Tf 49 ${y} Td (${pdfEscape(row.reference.padEnd(18).slice(0, 18) + row.person.padEnd(36).slice(0, 36) + row.mode.padEnd(16).slice(0, 16) + Number(row.total).toLocaleString('fr-FR'))}) Tj ET`)
    commands.push(`0.87 G 42 ${y - 5} 510 0 l S`)
    y -= 18
  }
  commands.push('0.02 0.18 0.34 rg BT /F1 8 Tf 42 42 Td (Kinshasa Christian School - KCS Kitchen - Document officiel) Tj ET')
  commands.push('0.4 g BT /F1 7 Tf 42 28 Td (Authenticite: registre KCS Orbit / emission automatique quotidienne) Tj ET')

  const stream = commands.join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ]
  let pdf = '%PDF-1.4\n%KCSKITCHEN\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n ').join('\n')}\n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf, 'latin1')
}

export async function queueDailyKitchenReport(prisma: PrismaClient, force = false) {
  const parts = kinshasaParts()
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`
  const settings = await prisma.kitchenManagerSettings.upsert({ where: { id: 'primary' }, create: { id: 'primary' }, update: {} })
  if (!settings.dailyReportEnabled || !settings.reportEmail || !settings.managerOrbitPersonId) return { queued: false, reason: 'NOT_CONFIGURED' }
  if (!force && (Number(parts.hour) < settings.dailyReportHour || settings.lastReportDate === dateKey)) return { queued: false, reason: 'NOT_DUE' }
  const from = new Date(`${dateKey}T00:00:00+01:00`)
  const to = new Date(from.getTime() + 24 * 60 * 60_000)
  const [transactions, payments, disputes] = await Promise.all([
    prisma.kitchenTransaction.findMany({ where: { createdAt: { gte: from, lt: to } }, orderBy: { createdAt: 'desc' }, take: 500 }),
    prisma.kitchenPayment.aggregate({ where: { createdAt: { gte: from, lt: to } }, _sum: { amount: true } }),
    prisma.kitchenDispute.count({ where: { createdAt: { gte: from, lt: to } } }),
  ])
  const confirmed = transactions.filter(row => row.status === 'CONFIRMED')
  const stats = {
    date: dateKey,
    transactionCount: confirmed.length,
    subtotal: confirmed.reduce((sum, row) => sum + Number(row.subtotal), 0),
    subsidy: confirmed.reduce((sum, row) => sum + Number(row.schoolSubsidy), 0),
    payable: confirmed.reduce((sum, row) => sum + Number(row.total), 0),
    credit: confirmed.filter(row => row.paymentMode === 'CREDIT').reduce((sum, row) => sum + Number(row.total), 0),
    payments: Number(payments._sum.amount || 0),
    disputes,
    rows: confirmed.map(row => ({ reference: row.transactionNumber, person: row.personNameSnapshot, total: Number(row.total), mode: row.paymentMode })),
  }
  const attachmentName = `KCS-Kitchen-Rapport-${dateKey}.pdf`
  const attachmentBase64 = buildProfessionalDailyPdf(stats).toString('base64')
  const message = `Rapport journalier KCS Kitchen du ${dateKey}. ${stats.transactionCount} transaction(s), ventes nettes ${stats.payable.toLocaleString('fr-FR')} CDF, prise en charge KCS ${stats.subsidy.toLocaleString('fr-FR')} CDF et ${stats.disputes} reclamation(s).`
  const inbox = await prisma.kitchenManagerInbox.upsert({
    where: { kind_reportDate: { kind: 'DAILY_REPORT', reportDate: dateKey } },
    create: { kind: 'DAILY_REPORT', reportDate: dateKey, title: `Rapport journalier Kitchen - ${dateKey}`, message, attachmentName, attachmentBase64 },
    update: { message, attachmentName, attachmentBase64 },
  })
  await prisma.notificationOutbox.create({ data: {
    orbitPersonId: settings.managerOrbitPersonId,
    eventType: 'KITCHEN_DAILY_REPORT', channels: ['IN_APP', 'EMAIL'],
    payload: { title: inbox.title, text: message, recipientEmail: settings.reportEmail, attachmentName, attachmentBase64, inboxId: inbox.id },
  } })
  await prisma.kitchenManagerSettings.update({ where: { id: 'primary' }, data: { lastReportDate: dateKey } })
  return { queued: true, inboxId: inbox.id, date: dateKey }
}
