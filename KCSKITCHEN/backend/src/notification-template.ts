type Payload = Record<string, unknown>

function amount(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? new Intl.NumberFormat('fr-FR').format(parsed) + ' CDF' : 'montant enregistré'
}

export function buildKitchenNotification(eventType: string, payload: Payload) {
  if (eventType === 'KITCHEN_TRANSACTION_CREATED') {
    const reference = String(payload.transactionNumber || 'KCS Kitchen')
    return {
      title: 'KCS Kitchen · Reçu ' + reference,
      text: [
        'Une consommation de ' + amount(payload.total) + ' a été enregistrée dans votre compte KCS Kitchen.',
        'Mode : ' + String(payload.paymentMode || 'non précisé') + '.',
        'Référence : ' + reference + '.',
        '',
        'A consumption of ' + amount(payload.total) + ' was recorded in your KCS Kitchen account.'
      ].join('\n')
    }
  }
  if (eventType === 'KITCHEN_PAYMENT_RECORDED') {
    return {
      title: 'KCS Kitchen · Paiement enregistré',
      text: [
        'Votre paiement de ' + amount(payload.amount) + ' a été enregistré.',
        'Mode : ' + String(payload.method || 'non précisé') + '.',
        '',
        'Your payment of ' + amount(payload.amount) + ' has been recorded.'
      ].join('\n')
    }
  }
  return { title: 'KCS Kitchen · Notification', text: 'Une nouvelle opération KCS Kitchen est disponible dans votre tableau de bord.' }
}
