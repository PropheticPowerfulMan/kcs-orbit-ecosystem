type Payload = Record<string, unknown>

function amount(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? new Intl.NumberFormat('fr-FR').format(parsed) + ' CDF' : 'montant enregistré'
}

export function buildKitchenNotification(eventType: string, payload: Payload) {
  if (eventType === 'KITCHEN_DAILY_REPORT' || eventType === 'KITCHEN_COMPLAINT_OPENED') {
    return {
      title: String(payload.title || (eventType === 'KITCHEN_DAILY_REPORT' ? 'KCS Kitchen · Rapport journalier' : 'KCS Kitchen · Nouvelle réclamation')),
      text: String(payload.text || 'Une nouvelle information Kitchen est disponible dans la boîte du gestionnaire.'),
    }
  }
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
  if (eventType === 'KITCHEN_ORDER_PENDING') {
    const reference = String(payload.transactionNumber || 'KCS Kitchen')
    return { title: 'KCS Kitchen ? Commande en attente', text: ['Votre commande ' + reference + ' a bien été reçue.', 'Elle ne sera comptabilisée qu’après confirmation de sa livraison par la cuisine.', '', 'Your order ' + reference + ' was received and will only be accounted for after delivery confirmation.'].join('\n') }
  }
  if (eventType === 'KITCHEN_ORDER_DELIVERED') {
    const reference = String(payload.transactionNumber || 'KCS Kitchen')
    return { title: 'KCS Kitchen ? Commande livrée', text: ['La livraison de votre commande ' + reference + ' a été confirmée.', 'Montant comptabilisé : ' + amount(payload.total) + '.', '', 'Delivery of order ' + reference + ' has been confirmed.'].join('\n') }
  }
  if (eventType === 'KITCHEN_ORDER_CANCELLED') {
    const reference = String(payload.transactionNumber || 'KCS Kitchen')
    return { title: 'KCS Kitchen ? Commande annulée', text: ['La commande ' + reference + ' a été annulée sans mouvement comptable.', '', 'Order ' + reference + ' was cancelled without accounting impact.'].join('\n') }
  }
  if (eventType === 'KITCHEN_ONLINE_ORDER_PLACED') {
    const reference = String(payload.transactionNumber || 'KCS Kitchen')
    const person = String(payload.personName || 'KCS member')
    const items = Array.isArray(payload.items) ? payload.items.join(', ') : ''
    return {
      title: 'KCS Kitchen · Nouvelle commande / New order',
      text: [`${person} a passé une commande Kitchen (${reference}).`, items, `Montant: ${amount(payload.total)} · ${String(payload.paymentMode || '')}.`, '', `${person} placed a Kitchen order (${reference}).`].filter(Boolean).join('\n')
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
