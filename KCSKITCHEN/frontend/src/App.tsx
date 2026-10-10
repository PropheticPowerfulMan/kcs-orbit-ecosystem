import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertTriangle, Archive, BarChart3, CalendarDays, ChefHat, ClipboardList, CreditCard, Languages,
  LayoutDashboard, LogOut, Menu, Package, PackagePlus, Plus, ReceiptText, ScanLine, Search,
  Eye, EyeOff, PanelLeftClose, PanelLeftOpen, ShieldCheck, ShoppingCart, Sun, Moon, Trash2, Users, Wallet, X, Pencil, LoaderCircle
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { api, apiBlob, dateTime, getToken, setToken } from './api'
import type { Person, Product, Role, Transaction, User } from './types'
import Procurement from './Procurement'
import DailyMenus from './DailyMenus'
import InstallAppButton from './InstallApp'
import PersonSelector from './PersonSelector'
import { CurrencyDisplayProvider, DisplayMoney, ExchangeRateCard, useCurrencyDisplay } from './ExchangeRate'

type Lang = 'fr' | 'en'
type Page = 'dashboard' | 'menus' | 'pos' | 'catalog' | 'transactions' | 'ledger' | 'inventory' | 'procurement' | 'disputes' | 'reports' | 'access'

type StatementHolder = {
  orbitPersonId: string
  displayId: string | null
  fullName: string
  email: string | null
  kind: 'STUDENT' | 'TEACHER' | 'STAFF'
}

type OfficialStatement = {
  documentId: string
  issuer: string
  application: string
  holder: StatementHolder
  issuedAt: string
  periodFrom: string
  periodToExclusive: string
  currency: string
  openingBalance: string
  closingBalance: string
  entryCount: number
  entries: Array<{
    id: string
    transactionId: string | null
    paymentId: string | null
    type: string
    amount: string
    currency: string
    description: string
    createdAt: string
  }>
  payloadHash: string
  keyId: string
  version: number
  signature: string
  reused: boolean
}

type StatementVerificationResult = {
  valid: boolean
  status: 'VALID' | 'INVALID_SIGNATURE' | 'CORRUPTED' | 'UNKNOWN_KEY' | 'EXPIRED' | 'REVOKED' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UNAVAILABLE'
  documentId?: string
  document?: Pick<OfficialStatement, 'documentId' | 'issuer' | 'application' | 'issuedAt' | 'periodFrom' | 'periodToExclusive' | 'currency' | 'entryCount' | 'payloadHash' | 'keyId' | 'version'>
  details?: {
    holder: Pick<StatementHolder, 'fullName' | 'displayId' | 'kind'>
    currency: string
    openingBalance: string
    closingBalance: string
  }
}
type AccountingPeriod = {
  id: string
  year: number
  month: number
  status: 'OPEN' | 'REVIEW' | 'CLOSED'
  reviewedBy: string | null
  reviewedAt: string | null
  closedBy: string | null
  closedAt: string | null
  archivedBy: string | null
  archivedAt: string | null
  archiveReason: string | null
}

type OfficialTransactionReport = {
  documentId: string
  issuer: string
  application: string
  issuedAt: string
  issuedBy: string
  periodFrom: string
  periodToExclusive: string
  filters: { status: string | null; paymentMode: string | null }
  currency: string
  transactionCount: number
  confirmedSubtotal: string
  confirmedDiscount: string
  confirmedTotal: string
  voidedCount: number
  rowsHash: string
  payloadHash: string
  keyId: string
  version: number
  signature: string
  rows: Array<{
    id: string
    transactionNumber: string
    createdAt: string
    personName: string
    cashierName: string
    subtotal: string
    discount: string
    total: string
    currency: string
    paymentMode: string
    paymentStatus: string
    status: string
  }>
}

type TransactionReportVerificationResult = {
  valid: boolean
  status: 'VALID' | 'INVALID_SIGNATURE' | 'CORRUPTED' | 'UNKNOWN_KEY' | 'REVOKED' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UNAVAILABLE'
  documentId?: string
  document?: Omit<OfficialTransactionReport, 'rows' | 'signature' | 'rowsHash' | 'issuedBy' | 'confirmedSubtotal' | 'confirmedDiscount'>
}

const pageNames = new Set<Page>(['dashboard', 'menus', 'pos', 'catalog', 'transactions', 'ledger', 'inventory', 'procurement', 'disputes', 'reports', 'access'])
function requestedPage(): Page {
  if (typeof window === 'undefined') return 'dashboard'
  const value = new URLSearchParams(window.location.search).get('page') as Page | null
  return value && pageNames.has(value) ? value : 'dashboard'
}

function requestedStatementVerification() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const documentId = params.get('verifyStatement')?.trim()
  const signature = params.get('signature')?.trim()
  return documentId && signature ? { documentId, signature } : null
}

function statementVerificationUrl(statement: Pick<OfficialStatement, 'documentId' | 'signature'>) {
  const url = new URL('/kitchen/', window.location.origin)
  url.searchParams.set('verifyStatement', statement.documentId)
  url.searchParams.set('signature', statement.signature)
  return url.toString()
}

function requestedTransactionReportVerification() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const documentId = params.get('verifyRegister')?.trim()
  const signature = params.get('signature')?.trim()
  return documentId && signature ? { documentId, signature } : null
}

function transactionReportVerificationUrl(report: Pick<OfficialTransactionReport, 'documentId' | 'signature'>) {
  const url = new URL('/kitchen/', window.location.origin)
  url.searchParams.set('verifyRegister', report.documentId)
  url.searchParams.set('signature', report.signature)
  return url.toString()
}

function statementMoney(value: unknown, currency = 'CDF') {
  return new Intl.NumberFormat('fr-CD', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(Number(value || 0))
}

function statementDate(value: string | Date, lang: Lang, withTime = false) {
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-CD' : 'en-US', {
    dateStyle: 'medium', ...(withTime ? { timeStyle: 'short' as const } : {}), timeZone: 'Africa/Kinshasa'
  }).format(new Date(value))
}

async function printStandaloneDocument(elementId: string, title: string, orientation: 'portrait' | 'landscape' = 'portrait') {
  const source = document.getElementById(elementId)
  if (!source) throw new Error('The official document is unavailable')
  const popup = window.open('', '_blank', 'width=1080,height=900')
  if (!popup) throw new Error('Please allow pop-ups to print this document')
  popup.opener = null

  const printable = source.cloneNode(true) as HTMLElement
  printable.querySelectorAll('img').forEach(image => {
    if (image.src) image.setAttribute('src', new URL(image.src, window.location.href).toString())
  })
  const styles = [...document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"],style')]
    .map(node => node instanceof HTMLLinkElement
      ? `<link rel="stylesheet" href="${new URL(node.href, window.location.href)}">`
      : `<style>${node.textContent || ''}</style>`)
    .join('')
  popup.document.open()
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title>${styles}<style>html,body{margin:0!important;background:#fff!important;overflow:visible!important}.print-shell{padding:8mm}.official-statement{max-width:1020px;margin:0 auto;overflow:visible!important}@page{size:A4 ${orientation};margin:8mm}</style></head><body><main class="print-shell">${printable.outerHTML}</main></body></html>`)
  popup.document.close()

  const links = [...popup.document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
  await Promise.all(links.map(link => new Promise<void>(resolve => {
    if (link.sheet) return resolve()
    link.addEventListener('load', () => resolve(), { once: true })
    link.addEventListener('error', () => resolve(), { once: true })
    window.setTimeout(resolve, 2500)
  })))
  await Promise.all([...popup.document.images].map(image => image.complete
    ? Promise.resolve()
    : new Promise<void>(resolve => {
        image.addEventListener('load', () => resolve(), { once: true })
        image.addEventListener('error', () => resolve(), { once: true })
        window.setTimeout(resolve, 2500)
      })))
  await popup.document.fonts?.ready.catch(() => undefined)
  popup.focus()
  popup.print()
}
const text = {
  fr: {
    signIn: 'Connexion institutionnelle', identifier: 'E-mail ou code institutionnel', password: 'Mot de passe',
    enter: 'Entrer dans KCS Kitchen', trace: 'Chaque consommation. Chaque franc. Une preuve.',
    powered: 'Propulsé par KCS Orbit', menus: 'Menu du jour', dashboard: 'Tableau de bord', pos: 'Point de vente', catalog: 'Catalogue',
    transactions: 'Transactions', ledger: 'Mon relevé', inventory: 'Stock', procurement: 'Achats et fournisseurs', disputes: 'Contestations',
    reports: 'Rapports', access: 'Accès et crédit', logout: 'Déconnexion', today: 'Aujourd’hui',
    outstanding: 'Solde à recouvrer', sales: 'Ventes', credit: 'Crédit émis', payments: 'Paiements',
    discounts: 'Réductions', openDisputes: 'Contestations ouvertes', lowStock: 'Stock faible',
    identify: 'Identifier la personne', searchPerson: 'Nom, matricule, e-mail, téléphone…',
    chooseItems: 'Choisir les articles', basket: 'Panier', confirmSale: 'Confirmer la transaction',
    payNow: 'Payer maintenant', onCredit: 'À crédit', total: 'Total', noData: 'Aucune donnée pour le moment.',
    addProduct: 'Ajouter un produit', save: 'Enregistrer', available: 'Disponible', price: 'Prix',
    quantity: 'Quantité', history: 'Historique vérifiable', receipt: 'Reçu', print: 'Imprimer / PDF',
    close: 'Fermer', search: 'Rechercher', role: 'Rôle', active: 'Actif', creditAllowed: 'Crédit autorisé',
    success: 'Opération réussie', error: 'L’opération a échoué', refresh: 'Actualiser',
    deleteProduct: 'Retirer du catalogue', deleteProductTitle: 'Retirer ce produit du catalogue ?',
    deleteProductHelp: 'Le produit ne sera plus proposé dans KCS Kitchen. Son historique de ventes et de stock restera intact et vérifiable.',
    cancel: 'Annuler', productRemoved: 'Le produit a été retiré du catalogue avec succès.', actions: 'Actions',
    editProduct: 'Modifier le produit', editProductHelp: 'Mettez à jour les informations opérationnelles. Chaque changement reste audité.',
    productCreated: 'Le produit a été créé avec succès.', productUpdated: 'Le produit a été mis à jour avec succès.',
    name: 'Nom du produit', description: 'Description détaillée', category: 'Catégorie', currency: 'Devise', unit: 'Unité',
    openingStock: 'Stock initial', reorderLevel: 'Seuil de réapprovisionnement', minimumStock: 'Stock minimum',
    trackInventory: 'Suivre le stock', updateReason: 'Motif de la modification', saveChanges: 'Enregistrer les modifications', unavailable: 'Indisponible',
    secureAccess: 'ACCÈS SÉCURISÉ', smartManagement: 'Gestion intelligente de la cantine',
    identityProof: 'Identité Orbit · Session chiffrée · Accès audité',
    managerHint: 'Gestionnaires : utilisez votre identité Admin Nexus institutionnelle. Aucun compte Kitchen séparé n’est créé.',
    live: 'EN DIRECT', verified: 'Orbit vérifié', lightMode: 'Mode soleil', darkMode: 'Mode lune',
    personalAccount: 'COMPTE KITCHEN PERSONNEL', welcome: 'Bienvenue', consumptionLive: 'Votre relevé de consommation est à jour, exact et vérifiable.',
    thisMonth: 'Ce mois-ci', recentActivity: 'ACTIVITÉ RÉCENTE', kitchenNotifications: 'Notifications Kitchen',
    controlCenter: 'CENTRE DE CONTRÔLE DE LA CANTINE', controlHeadline: 'Un bon service commence par une traçabilité parfaite.',
    controlSummary: 'Ventes, crédits, paiements, stock et contestations dans une vue unique et auditée.',
    popularProducts: 'PRODUITS POPULAIRES', topConsumption: 'Consommations principales', secureLoading: 'Chargement sécurisé des données Kitchen…'
  },
  en: {
    signIn: 'Institutional sign in', identifier: 'Email or institutional code', password: 'Password',
    enter: 'Enter KCS Kitchen', trace: 'Every consumption. Every franc. One proof.',
    powered: 'Powered by KCS Orbit', menus: 'Daily menu', dashboard: 'Dashboard', pos: 'Point of sale', catalog: 'Catalog',
    transactions: 'Transactions', ledger: 'My statement', inventory: 'Inventory', procurement: 'Purchasing & suppliers', disputes: 'Disputes',
    reports: 'Reports', access: 'Access and credit', logout: 'Sign out', today: 'Today',
    outstanding: 'Outstanding balance', sales: 'Sales', credit: 'Credit issued', payments: 'Payments',
    discounts: 'Discounts', openDisputes: 'Open disputes', lowStock: 'Low stock',
    identify: 'Identify person', searchPerson: 'Name, ID, email, phone…',
    chooseItems: 'Choose items', basket: 'Basket', confirmSale: 'Confirm transaction',
    payNow: 'Pay now', onCredit: 'Credit', total: 'Total', noData: 'No data yet.',
    addProduct: 'Add product', save: 'Save', available: 'Available', price: 'Price',
    quantity: 'Quantity', history: 'Verifiable history', receipt: 'Receipt', print: 'Print / PDF',
    close: 'Close', search: 'Search', role: 'Role', active: 'Active', creditAllowed: 'Credit enabled',
    success: 'Operation completed', error: 'Operation failed', refresh: 'Refresh',
    deleteProduct: 'Remove from catalog', deleteProductTitle: 'Remove this product from the catalog?',
    deleteProductHelp: 'The product will no longer be offered in KCS Kitchen. Its sales and inventory history will remain intact and auditable.',
    cancel: 'Cancel', productRemoved: 'The product was successfully removed from the catalog.', actions: 'Actions',
    editProduct: 'Edit product', editProductHelp: 'Update operational information. Every change remains audited.',
    productCreated: 'The product was created successfully.', productUpdated: 'The product was updated successfully.',
    name: 'Product name', description: 'Detailed description', category: 'Category', currency: 'Currency', unit: 'Unit',
    openingStock: 'Opening stock', reorderLevel: 'Reorder level', minimumStock: 'Minimum stock',
    trackInventory: 'Track inventory', updateReason: 'Reason for update', saveChanges: 'Save changes', unavailable: 'Unavailable',
    secureAccess: 'SECURE ACCESS', smartManagement: 'Smart canteen management',
    identityProof: 'Orbit identity · Encrypted session · Audited access',
    managerHint: 'Managers: use your institutional Nexus Admin identity. No separate Kitchen account is created.',
    live: 'LIVE', verified: 'Orbit verified', lightMode: 'Light mode', darkMode: 'Dark mode',
    personalAccount: 'PERSONAL KITCHEN ACCOUNT', welcome: 'Welcome', consumptionLive: 'Your consumption ledger is live, exact and verifiable.',
    thisMonth: 'This month', recentActivity: 'RECENT ACTIVITY', kitchenNotifications: 'Kitchen notifications',
    controlCenter: 'SMART CANTEEN CONTROL CENTER', controlHeadline: 'Good service starts with perfect traceability.',
    controlSummary: 'Sales, credit, payments, inventory and disputes in one audited view.',
    popularProducts: 'POPULAR PRODUCTS', topConsumption: 'Top consumption', secureLoading: 'Secure Kitchen data loading…'
  }
}

function useLanguage() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('kcs-kitchen-lang') as Lang) || 'fr')
  useEffect(() => { document.documentElement.lang = lang; localStorage.setItem('kcs-kitchen-lang', lang) }, [lang])
  return { lang, setLang, t: text[lang] }
}

function Modal({ children, onClose, wide = false }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true">
    <div className={wide ? 'modal wide' : 'modal'}>
      <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
      {children}
    </div>
  </div>
}

function Notice({ type, message, onClose }: { type: 'success' | 'error'; message: string; onClose: () => void }) {
  return <div className="notice-backdrop"><div className={'notice ' + type}>
    {type === 'success' ? <ShieldCheck size={38} /> : <AlertTriangle size={38} />}
    <h3>{type === 'success' ? '✓' : '!'}</h3><p>{message}</p>
    <button className="primary" onClick={onClose}>OK</button>
  </div></div>
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const { lang, setLang, t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [credentials, setCredentials] = useState({ identifier: '', password: '' })
  const [locked, setLocked] = useState({ identifier: true, password: true })

  function unlock(field: 'identifier' | 'password') {
    if (!locked[field]) return
    setLocked(current => ({ ...current, [field]: false }))
    setCredentials(current => ({ ...current, [field]: '' }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      const result = await api<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: credentials.identifier.trim(), password: credentials.password })
      })
      setToken(result.token); onLogin(result.user)
    } catch (err) { setError((err as Error).message) } finally { setLoading(false) }
  }

  return <main className="login-page">
    <button className="language-fab" onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}><Languages size={18} /> {lang.toUpperCase()}</button>
    <InstallAppButton lang={lang} />
    <section className="login-brand">
      <img src="./images/kcs-logo.png" alt="Kinshasa Christian School" />
      <span>KCS ORBIT ECOSYSTEM</span>
      <h1>KCS <strong>KITCHEN</strong></h1>
      <p>{t.trace}</p>
      <div className="brand-line"><ChefHat /> {t.smartManagement}</div>
    </section>
    <section className="login-card">
      <div><span className="eyebrow">{t.secureAccess}</span><h2>{t.signIn}</h2><p>{t.powered}</p></div>
      <form onSubmit={submit} autoComplete="off" data-lpignore="true" data-form-type="other">
        <label>{t.identifier}<input
          name="kcs-kitchen-identifier"
          value={credentials.identifier}
          readOnly={locked.identifier}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          onPointerDown={() => unlock('identifier')}
          onFocus={() => unlock('identifier')}
          onChange={event => setCredentials(current => ({ ...current, identifier: event.target.value }))}
          required
        /></label>
        <label>{t.password}<span className="password-field"><input
          name="kcs-kitchen-password"
          value={credentials.password}
          readOnly={locked.password}
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          onPointerDown={() => unlock('password')}
          onFocus={() => unlock('password')}
          onChange={event => setCredentials(current => ({ ...current, password: event.target.value }))}
          required
        /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? (lang === 'fr' ? 'Masquer le mot de passe' : 'Hide password') : (lang === 'fr' ? 'Afficher le mot de passe' : 'Show password')}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary large" disabled={loading}>{loading ? '…' : t.enter}</button>
      </form>
      <small>🔒 {t.identityProof}</small>
    </section>
    <p className="manager-hint">{t.managerHint}</p>
  </main>
}

const privileged: Role[] = ['KITCHEN_ADMIN', 'CASHIER', 'FINANCE', 'AUDITOR']

function Shell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { lang, setLang, t } = useLanguage()
  const [page, setPage] = useState<Page>(requestedPage)
  const [open, setOpen] = useState(false)
  const sidebarRef = useRef<HTMLElement | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const [drawerViewport, setDrawerViewport] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  const [dark, setDark] = useState(() => localStorage.getItem('kcs-kitchen-theme') === 'dark')
  useEffect(() => { document.body.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('kcs-kitchen-theme', dark ? 'dark' : 'light') }, [dark])
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('kcs-kitchen-sidebar') === 'collapsed')
  const [officialAvatar, setOfficialAvatar] = useState('')
  useEffect(() => {
    if (!user.hasOfficialPhoto) return
    let active = true
    let objectUrl = ''
    void apiBlob('/me/avatar').then(blob => {
      if (!active || !blob.size) return
      objectUrl = URL.createObjectURL(blob)
      setOfficialAvatar(objectUrl)
    }).catch(() => setOfficialAvatar(''))
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [user.hasOfficialPhoto, user.userId])
  const isPrivileged = privileged.includes(user.role)
  useEffect(() => { localStorage.setItem('kcs-kitchen-sidebar', collapsed ? 'collapsed' : 'expanded') }, [collapsed])
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
    window.scrollTo({ top: 0, left: 0 })
  }, [])
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }) }, [page])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const syncViewport = () => {
      setDrawerViewport(media.matches)
      if (!media.matches) setOpen(false)
    }
    syncViewport()
    media.addEventListener('change', syncViewport)
    return () => media.removeEventListener('change', syncViewport)
  }, [])
  useEffect(() => {
    const sidebar = sidebarRef.current
    if (!sidebar) return
    if (drawerViewport && !open) {
      sidebar.setAttribute('inert', '')
      sidebar.setAttribute('aria-hidden', 'true')
    } else {
      sidebar.removeAttribute('inert')
      sidebar.removeAttribute('aria-hidden')
    }
  }, [drawerViewport, open])
  useEffect(() => {
    if (!open || !drawerViewport) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
      const sidebar = sidebarRef.current
      if (event.key !== 'Tab' || !sidebar) return
      const controls = [...sidebar.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]')]
        .filter(control => control.tabIndex >= 0)
      if (!controls.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    sidebarRef.current?.querySelector<HTMLElement>('button')?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      menuButtonRef.current?.focus()
    }
  }, [drawerViewport, open])
  const nav: Array<[Page, string, ReactNode, boolean]> = [
    ['dashboard', t.dashboard, <LayoutDashboard />, true],
    ['menus', lang === 'fr' ? 'Menu du jour' : 'Daily menu', <CalendarDays />, user.role === 'KITCHEN_ADMIN'],
    ['pos', t.pos, <ShoppingCart />, ['KITCHEN_ADMIN', 'CASHIER', 'FINANCE'].includes(user.role)],
    ['catalog', t.catalog, <ChefHat />, isPrivileged],
    ['transactions', t.transactions, <ReceiptText />, true],
    ['ledger', t.ledger, <Wallet />, true],
    ['inventory', t.inventory, <Package />, isPrivileged],
    ['disputes', t.disputes, <AlertTriangle />, true],
    ['reports', t.reports, <BarChart3 />, isPrivileged],
    ['procurement', t.procurement, <PackagePlus />, ['KITCHEN_ADMIN', 'FINANCE', 'AUDITOR'].includes(user.role)],
    ['access', t.access, <Users />, user.role === 'KITCHEN_ADMIN']
  ]
  function navigateToPage(nextPage: Page, replace = false) {
    setPage(nextPage)
    setOpen(false)
    const url = new URL(window.location.href)
    if (nextPage === 'dashboard') url.searchParams.delete('page')
    else url.searchParams.set('page', nextPage)
    if (replace) window.history.replaceState({}, '', url)
    else window.history.pushState({}, '', url)
  }
  useEffect(() => {
    if (!nav.some(item => item[0] === page && item[3])) navigateToPage('dashboard', true)
  }, [page, user.role])
  useEffect(() => {
    const restorePage = () => {
      const nextPage = requestedPage()
      setPage(nav.some(item => item[0] === nextPage && item[3]) ? nextPage : 'dashboard')
      setOpen(false)
      window.scrollTo({ top: 0, left: 0 })
    }
    window.addEventListener('popstate', restorePage)
    return () => window.removeEventListener('popstate', restorePage)
  }, [user.role])
  return <div className={collapsed ? 'app-shell collapsed' : 'app-shell'}>
    {open && drawerViewport && <button className="sidebar-scrim" aria-label={lang === 'fr' ? 'Fermer le menu' : 'Close navigation'} onClick={() => setOpen(false)} />}
    <aside id="kitchen-navigation" ref={sidebarRef} aria-label={lang === 'fr' ? 'Navigation principale' : 'Main navigation'} className={(open ? 'sidebar open' : 'sidebar') + (collapsed ? ' collapsed' : '')}>
      <div className="sidebar-brand"><img className="sidebar-logo" src="./images/kcs-emblem.jpg" alt="Kinshasa Christian School" /><div><b>KCS KITCHEN</b><small>{t.powered}</small></div><button onClick={() => setOpen(false)} aria-label={lang === 'fr' ? 'Fermer le menu' : 'Close navigation'}><X /></button></div>
      <div className="identity"><span>{officialAvatar ? <img src={officialAvatar} alt={user.fullName}/> : user.fullName.split(' ').map(v => v[0]).slice(0, 2).join('')}</span><div><b>{user.fullName}</b><small>{translatedRole(user.role, lang)}</small></div></div>
      <nav>{nav.filter(item => item[3]).map(item => <button key={item[0]} title={item[1]} aria-label={item[1]} className={page === item[0] ? 'active' : ''} onClick={() => navigateToPage(item[0])}>{item[2]}<span>{item[1]}</span></button>)}</nav>
      <div className="sidebar-footer">
        <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}><Languages /> {lang.toUpperCase()}</button>
        <button onClick={() => setDark(!dark)}>{dark ? <Sun /> : <Moon />} {dark ? t.lightMode : t.darkMode}</button>
        <button className="danger-text" onClick={onLogout}><LogOut /> {t.logout}</button>
      </div>
    </aside>
    <CurrencyDisplayProvider userKey={user.userId}>
    <main className="workspace">
      <header><button ref={menuButtonRef} className="menu-button" aria-expanded={open} aria-controls="kitchen-navigation" aria-label={lang === 'fr' ? 'Ouvrir le menu' : 'Open navigation'} onClick={() => setOpen(true)}><Menu /></button><button className="collapse-button" onClick={() => setCollapsed(value => !value)} aria-label="Toggle navigation">{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</button><img className="header-logo" src="./images/kcs-emblem.jpg" alt="Kinshasa Christian School"/><div><span className="eyebrow">KCS KITCHEN · {t.live}</span><h1>{t[page]}</h1></div><div className="header-actions"><InstallAppButton lang={lang} compact /><div className="status-pill"><ShieldCheck /> {t.verified}</div></div></header>
      <div className="page-body">
        <ExchangeRateCard lang={lang} compact />
        {page === 'dashboard' && <Dashboard user={user} t={t} />}
        {page === 'menus' && <DailyMenus lang={lang} />}
        {page === 'pos' && <PointOfSale t={t} lang={lang} />}
        {page === 'catalog' && <Catalog canEdit={user.role === 'KITCHEN_ADMIN'} t={t} lang={lang} />}
        {page === 'transactions' && <Transactions user={user} t={t} />}
        {page === 'ledger' && <Ledger user={user} t={t} />}
        {page === 'inventory' && <Inventory canEdit={user.role === 'KITCHEN_ADMIN'} t={t} />}
        {page === 'disputes' && <Disputes user={user} t={t} />}
        {page === 'reports' && <Reports user={user} t={t} />}
        {page === 'access' && <Access t={t} />}
        {page === 'procurement' && <Procurement user={user} lang={lang} />}
      </div>
    </main>
    </CurrencyDisplayProvider>
  </div>
}

const translatedRole = (role: Role, lang: Lang) => {
  const labels: Record<Role, [string, string]> = {
    KITCHEN_ADMIN: ['Gestionnaire Kitchen', 'Kitchen manager'], CASHIER: ['Caissier', 'Cashier'],
    FINANCE: ['Finance', 'Finance'], AUDITOR: ['Auditeur', 'Auditor'], TEACHER: ['Enseignant', 'Teacher'],
    STAFF: ['Personnel', 'Staff'], STUDENT: ['Élève', 'Student'],
  }
  return labels[role]?.[lang === 'fr' ? 0 : 1] ?? role.replaceAll('_', ' ')
}

function Stat({ icon, label, value, tone = '' }: { icon: ReactNode; label: string; value: ReactNode; tone?: string }) {
  return <article className={'stat-card ' + tone}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>
}

function Dashboard({ user, t }: { user: User; t: Record<string, string> }) {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  useEffect(() => { api<any>('/dashboard').then(setData).catch(err => setError(err.message)) }, [])
  if (error) return <div className="empty error">{error}</div>
  if (!data) return <Loading />
  if (data.mode === 'personal') return <>
    <section className="hero"><div><span className="eyebrow">{t.personalAccount}</span><h2>{t.welcome}, {user.fullName.split(' ').at(-1)}</h2><p>{t.consumptionLive}</p></div><ChefHat size={70} /></section>
    <div className="stats">
      <Stat icon={<ShoppingCart />} label={t.today} value={<DisplayMoney value={data.today._sum.total} />} />
      <Stat icon={<ClipboardList />} label={t.thisMonth} value={<DisplayMoney value={data.month._sum.total} />} />
      <Stat icon={<Wallet />} label={t.outstanding} value={<DisplayMoney value={data.balance} />} tone={Number(data.balance) > 0 ? 'warn' : 'good'} />
      <Stat icon={<AlertTriangle />} label={t.openDisputes} value={data.disputes} />
    </div>
    <section className="panel"><div className="section-heading"><div><span className="eyebrow">{t.recentActivity}</span><h2>{t.kitchenNotifications}</h2></div></div>
      {data.notifications.length ? <div className="activity-list">{data.notifications.map((item: any) => <div key={item.id}><ShieldCheck /><span><b>{item.eventType.replaceAll('_', ' ')}</b><small>{dateTime(item.createdAt)}</small></span></div>)}</div> : <Empty text={t.noData} />}
    </section>
  </>
  return <>
    <section className="hero"><div><span className="eyebrow">{t.controlCenter}</span><h2>{t.controlHeadline}</h2><p>{t.controlSummary}</p></div><ChefHat size={70} /></section>
    <div className="stats">
      <Stat icon={<ShoppingCart />} label={t.sales + ' · ' + t.today} value={<DisplayMoney value={data.today._sum.total} />} tone="good" />
      <Stat icon={<CreditCard />} label={t.credit} value={<DisplayMoney value={data.credit._sum.total} />} tone="warn" />
      <Stat icon={<Wallet />} label={t.outstanding} value={<DisplayMoney value={data.outstanding} />} />
      <Stat icon={<ReceiptText />} label={t.payments} value={<DisplayMoney value={data.payments._sum.amount} />} />
      <Stat icon={<AlertTriangle />} label={t.openDisputes} value={data.disputes} tone={data.disputes ? 'warn' : ''} />
      <Stat icon={<Archive />} label={t.lowStock} value={data.lowStock} />
    </div>
    <section className="panel"><div className="section-heading"><div><span className="eyebrow">{t.popularProducts}</span><h2>{t.topConsumption}</h2></div></div>
      {data.popular.length ? <div className="rank-list">{data.popular.map((item: any, index: number) => <div key={item.productId}><b>{String(index + 1).padStart(2, '0')}</b><span>{item.productNameSnapshot}</span><strong>{Number(item._sum.quantity || 0)}</strong></div>)}</div> : <Empty text={t.noData} />}
    </section>
  </>
}

function PointOfSale({ t, lang }: { t: Record<string, string>; lang: Lang }) {
  const [products, setProducts] = useState<Product[]>([])
  const [dailyMenuId, setDailyMenuId] = useState('')
  const [menuTitle, setMenuTitle] = useState('')
  const [person, setPerson] = useState<Person | null>(null)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [paymentMode, setPaymentMode] = useState('CASH')
  const [receipt, setReceipt] = useState<Transaction | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { rate } = useCurrencyDisplay()
  useEffect(() => { api<{ menu: { id: string; title: string; items: Array<{ unitPrice: string; currency: string; product: Product }> } }>('/daily-menus/today').then(result => { setDailyMenuId(result.menu.id); setMenuTitle(result.menu.title); setProducts(result.menu.items.map(item => ({ ...item.product, currentPrice: item.unitPrice, currency: item.currency }))) }).catch(err => setNotice({ type: 'error', message: err.message })) }, [])
  const total = useMemo(() => products.reduce((sum, product) => sum + Number(product.currentPrice) * (product.currency === 'USD' && rate ? rate.rate : 1) * (cart[product.id] || 0), 0), [products, cart, rate])
  function add(id: string) { setCart(current => ({ ...current, [id]: (current[id] || 0) + 1 })) }
  function change(id: string, quantity: number) { setCart(current => ({ ...current, [id]: Math.max(0, quantity) })) }
  async function checkout() {
    if (!person || total <= 0) return setNotice({ type: 'error', message: 'Select a person and at least one item.' })
    setSubmitting(true)
    try {
      const result = await api<{ transaction: Transaction }>('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          orbitPersonId: person.id,
          dailyMenuId,
          items: Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => ({ productId, quantity })),
          paymentMode,
          confirmationType: 'DASHBOARD'
        })
      })
      setReceipt(result.transaction); setCart({}); setPerson(null)
    } catch (err) { setNotice({ type: 'error', message: (err as Error).message }) }
    finally { setSubmitting(false) }
  }
  return <>
    <section className="pos-grid">
      <div className="panel">
        <div className="step-title"><span>1</span><div><small>IDENTITY</small><h2>{t.identify}</h2></div></div>
        <PersonSelector value={person} onChange={setPerson} lang={lang} />
        <div className="step-title"><span>2</span><div><small>{menuTitle || "DAILY MENU"}</small><h2>{t.chooseItems}</h2></div></div>
        <div className="product-grid">{products.map(product => <button key={product.id} className="product-tile" onClick={() => add(product.id)} disabled={!product.isAvailable}>
          <span className="product-icon"><ChefHat /></span><b>{product.name}</b><small>{product.category}</small><DisplayMoney value={product.currentPrice} currency={product.currency} />{cart[product.id] ? <em>{cart[product.id]}</em> : null}
        </button>)}</div>
      </div>
      <aside className="basket panel">
        <div className="step-title"><span>3</span><div><small>CHECKOUT</small><h2>{t.basket}</h2></div></div>
        <div className="basket-lines">{products.filter(product => cart[product.id]).map(product => <div key={product.id}><span><b>{product.name}</b><DisplayMoney value={product.currentPrice} currency={product.currency} /></span><div className="qty"><button onClick={() => change(product.id, cart[product.id] - 1)}>−</button><b>{cart[product.id]}</b><button onClick={() => add(product.id)}>+</button></div><DisplayMoney value={Number(product.currentPrice) * cart[product.id]} currency={product.currency} /></div>)}</div>
        {!total && <Empty text={t.noData} />}
        <div className="payment-switch"><button className={paymentMode !== 'CREDIT' ? 'active' : ''} onClick={() => setPaymentMode('CASH')}><Wallet />{t.payNow}</button><button className={paymentMode === 'CREDIT' ? 'active' : ''} onClick={() => setPaymentMode('CREDIT')}><CreditCard />{t.onCredit}</button></div>
        <div className="total-row"><span>{t.total}</span><DisplayMoney value={total} currency="CDF" /></div>
        <button className="primary large" onClick={checkout} disabled={submitting}>{submitting ? <LoaderCircle className="spin" /> : <ShieldCheck />} {t.confirmSale}</button>
      </aside>
    </section>
    {receipt && <Receipt transaction={receipt} onClose={() => setReceipt(null)} />}
    {notice && <Notice {...notice} onClose={() => setNotice(null)} />}
  </>
}

function Catalog({ canEdit, t, lang }: { canEdit: boolean; t: Record<string, string>; lang: Lang }) {
  const [products, setProducts] = useState<Product[]>([])
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const load = () => api<{ products: Product[] }>('/products?all=true').then(result => setProducts(result.products))
  useEffect(() => { load() }, [])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    setSaving(true)
    try {
      const payload = {
        name: data.get('name'), description: data.get('description') || null, category: data.get('category'), currentPrice: Number(data.get('price')),
        currency: data.get('currency'), isAvailable: data.get('available') === 'on', trackInventory: data.get('track') === 'on',
        unit: data.get('unit'), minimumStock: Number(data.get('minimum') || 0), reorderLevel: Number(data.get('reorder') || 0),
        ...(editing ? { reason: data.get('reason') } : { stockQuantity: Number(data.get('stock') || 0) })
      }
      await api('/products' + (editing ? '/' + encodeURIComponent(editing.id) : ''), { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) })
      setShow(false); setEditing(null); await load(); setNotice({ type: 'success', message: editing ? t.productUpdated : t.productCreated })
    } catch (err) { setNotice({ type: 'error', message: (err as Error).message }) }
    finally { setSaving(false) }
  }
  async function removeProduct() {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    try {
      await api('/products/' + encodeURIComponent(pendingDelete.id), { method: 'DELETE' })
      setPendingDelete(null)
      await load()
      setNotice({ type: 'success', message: t.productRemoved })
    } catch (err) {
      setNotice({ type: 'error', message: (err as Error).message })
    } finally {
      setDeleting(false)
    }
  }
  return <><section className="panel catalog-panel"><div className="section-heading"><div><span className="eyebrow">KCS KITCHEN · LIVE CATALOG</span><h2>{t.catalog}</h2><p>{lang === 'fr' ? 'Produits, prix, disponibilité et seuils de stock dans un registre audité.' : 'Products, pricing, availability and inventory thresholds in one audited register.'}</p></div>{canEdit && <button className="primary" onClick={() => { setEditing(null); setShow(true) }}><Plus />{t.addProduct}</button>}</div>
    <div className="data-table catalog-table"><div className="table-head"><span>{t.name}</span><span>{t.category}</span><span>{t.price}</span><span>Stock</span><span>Status</span><span>{t.actions}</span></div>
      {products.map(product => <div className="table-row" key={product.id}>
        <span data-label={t.name}><b>{product.name}</b><small>{product.description}</small></span>
        <span data-label={t.category}>{product.category}</span>
        <span data-label={t.price}><DisplayMoney value={product.currentPrice} currency={product.currency} /></span>
        <span data-label="Stock">{product.trackInventory ? product.stockQuantity + ' ' + product.unit : '—'}</span>
        <span data-label="Status"><em className={product.isAvailable ? 'badge good' : 'badge'}>{product.isAvailable ? t.available : t.unavailable}</em></span>
        <span className="catalog-actions" data-label={t.actions}>{canEdit ? <><button className="catalog-edit" onClick={() => { setEditing(product); setShow(true) }}><Pencil />{t.editProduct}</button><button className="catalog-delete" onClick={() => setPendingDelete(product)}><Trash2 />{t.deleteProduct}</button></> : '—'}</span>
      </div>)}
    </div></section>
    {show && <Modal wide onClose={() => !saving && (setShow(false), setEditing(null))}><form key={editing?.id || 'new-product'} className="modal-form product-editor" onSubmit={save}>
      <div className="editor-intro"><span className="product-editor-icon"><ChefHat /></span><div><span className="eyebrow">KCS KITCHEN · CATALOG</span><h2>{editing ? t.editProduct : t.addProduct}</h2><p>{editing ? t.editProductHelp : (lang === 'fr' ? 'Créez une fiche produit complète, exploitable sur ordinateur, tablette et mobile.' : 'Create a complete product record for desktop, tablet and mobile operations.')}</p></div></div>
      <div className="form-grid"><label>{t.name}<input name="name" required defaultValue={editing?.name || ''} /></label><label>{t.category}<select name="category" defaultValue={editing?.category || 'FOOD'}><option>FOOD</option><option>DRINK</option><option>SNACK</option><option>DESSERT</option><option>OTHER</option></select></label></div>
      <label>{t.description}<textarea name="description" maxLength={500} defaultValue={editing?.description || ''} placeholder={lang === 'fr' ? 'Composition, portion, allergènes ou précisions utiles…' : 'Contents, portion, allergens or useful details…'} /></label>
      <div className="form-grid three"><label>{t.price}<input name="price" type="number" min="0" step="0.01" required defaultValue={editing?.currentPrice || ''} /></label><label>{t.currency}<select name="currency" defaultValue={editing?.currency || 'CDF'}><option value="CDF">CDF · Franc congolais</option><option value="USD">USD · Dollar américain</option></select></label><label>{t.unit}<select name="unit" defaultValue={editing?.unit || 'UNIT'}><option>UNIT</option><option>BOTTLE</option><option>CAN</option><option>KG</option><option>LITER</option><option>PORTION</option><option>OTHER</option></select></label></div>
      <div className="form-grid three">{!editing && <label>{t.openingStock}<input name="stock" type="number" min="0" step="0.001" defaultValue="0" /></label>}<label>{t.minimumStock}<input name="minimum" type="number" min="0" step="0.001" defaultValue={editing?.minimumStock || '0'} /></label><label>{t.reorderLevel}<input name="reorder" type="number" min="0" step="0.001" defaultValue={editing?.reorderLevel || '0'} /></label></div>
      <div className="editor-switches"><label className="check"><input name="track" type="checkbox" defaultChecked={editing?.trackInventory || false} /> {t.trackInventory}</label><label className="check"><input name="available" type="checkbox" defaultChecked={editing ? editing.isAvailable : true} /> {t.available}</label></div>
      {editing && <label>{t.updateReason}<textarea name="reason" maxLength={500} placeholder={lang === 'fr' ? 'Ex. : correction de prix, changement de portion…' : 'E.g. price correction, portion change…'} /></label>}
      <div className="editor-rate-note"><ExchangeRateCard lang={lang} /><p>{lang === 'fr' ? 'Les équivalences USD/CDF sont recalculées automatiquement. Le prix historique original reste conservé.' : 'USD/CDF equivalents refresh automatically. The original historical price remains preserved.'}</p></div>
      <div className="editor-actions"><button type="button" onClick={() => { setShow(false); setEditing(null) }} disabled={saving}>{t.cancel}</button><button className="primary" disabled={saving}>{saving ? <LoaderCircle className="spin" /> : <ShieldCheck />}{editing ? t.saveChanges : t.save}</button></div>
    </form></Modal>}
    {pendingDelete && <Modal onClose={() => !deleting && setPendingDelete(null)}><div className="delete-confirmation"><span className="delete-confirmation-icon"><Trash2 /></span><span className="eyebrow">KCS KITCHEN · CATALOG</span><h2>{t.deleteProductTitle}</h2><strong>{pendingDelete.name}</strong><p>{t.deleteProductHelp}</p><div className="button-row"><button onClick={() => setPendingDelete(null)} disabled={deleting}>{t.cancel}</button><button className="danger-action" onClick={removeProduct} disabled={deleting}>{deleting ? <span className="button-spinner" /> : <Trash2 />}{t.deleteProduct}</button></div></div></Modal>}
    {notice && <Notice {...notice} onClose={() => setNotice(null)} />}</>
}

function Transactions({ user, t }: { user: User; t: Record<string, string> }) {
  const [rows, setRows] = useState<Transaction[]>([])
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [query, setQuery] = useState('')
  useEffect(() => { api<{ transactions: Transaction[] }>('/transactions').then(result => setRows(result.transactions)) }, [])
  const filtered = rows.filter(row => [row.transactionNumber, row.personNameSnapshot, row.cashierNameSnapshot].some(value => value.toLowerCase().includes(query.toLowerCase())))
  return <section className="panel"><div className="section-heading"><div><span className="eyebrow">IMMUTABLE REGISTER</span><h2>{t.history}</h2></div><div className="search-inline"><Search /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t.search} /></div></div>
    <div className="data-table transaction-table"><div className="table-head"><span>Transaction</span><span>Date</span><span>Person</span><span>Mode</span><span>{t.total}</span><span>Status</span></div>
      {filtered.map(row => <button className="table-row" key={row.id} onClick={() => setSelected(row)}><span data-label="Transaction"><b>{row.transactionNumber}</b></span><span data-label="Date">{dateTime(row.createdAt)}</span><span data-label="Person">{row.personNameSnapshot}</span><span data-label="Mode">{row.paymentMode}</span><span data-label={t.total}><b><DisplayMoney value={row.total} /></b></span><span data-label="Status"><em className={'badge ' + (row.status === 'CONFIRMED' ? 'good' : 'warn')}>{row.status}</em></span></button>)}
    </div>{!filtered.length && <Empty text={t.noData} />}
    {selected && <Receipt transaction={selected} onClose={() => setSelected(null)} allowDispute={['TEACHER', 'STAFF', 'STUDENT'].includes(user.role)} />}
  </section>
}

function Receipt({ transaction, onClose, allowDispute = false }: { transaction: Transaction; onClose: () => void; allowDispute?: boolean }) {
  const [dispute, setDispute] = useState(false)
  const [message, setMessage] = useState('')
  async function sendDispute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    try {
      await api('/disputes', { method: 'POST', body: JSON.stringify({ transactionId: transaction.id, reason: data.get('reason'), comment: data.get('comment') }) })
      setMessage('Dispute submitted for audited review.'); setDispute(false)
    } catch (err) { setMessage((err as Error).message) }
  }
  return <Modal wide onClose={onClose}><div className="receipt" id={'receipt-' + transaction.id}>
    <div className="receipt-head"><img src="./images/kcs-logo.png" alt="Kinshasa Christian School" /><div><span>KINSHASA CHRISTIAN SCHOOL</span><h2>KCS KITCHEN RECEIPT</h2><b>{transaction.transactionNumber}</b></div></div>
    <div className="receipt-meta"><div><small>PERSON</small><b>{transaction.personNameSnapshot}</b></div><div><small>DATE / TIME</small><b>{dateTime(transaction.createdAt)}</b></div><div><small>CASHIER</small><b>{transaction.cashierNameSnapshot}</b></div><div><small>PAYMENT</small><b>{transaction.paymentMode} · {transaction.paymentStatus}</b></div></div>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Subtotal</th></tr></thead><tbody>{transaction.items.map(item => <tr key={item.id}><td>{item.productNameSnapshot}</td><td>{item.quantity}</td><td><DisplayMoney value={item.unitPriceAtPurchase} /></td><td><DisplayMoney value={item.subtotal} /></td></tr>)}</tbody></table>
    <div className="receipt-totals"><span>Subtotal <b><DisplayMoney value={transaction.subtotal} /></b></span><span>Discount <b>− <DisplayMoney value={transaction.discount} /></b></span><strong>Total <b><DisplayMoney value={transaction.total} /></b></strong></div>
    <div className="receipt-proof"><ShieldCheck /> Digitally registered, timestamped and auditable. Original transaction records are never silently deleted.</div>
    {message && <div className="form-message">{message}</div>}
    <div className="receipt-actions"><button onClick={() => window.print()}><ReceiptText /> Print / PDF</button>{allowDispute && <button className="warning" onClick={() => setDispute(!dispute)}><AlertTriangle /> Dispute</button>}<button className="primary" onClick={onClose}>Close</button></div>
    {dispute && <form className="dispute-form" onSubmit={sendDispute}><select name="reason"><option value="I_DID_NOT_TAKE_THIS">I did not take this</option><option value="WRONG_ITEM">Wrong item</option><option value="WRONG_QUANTITY">Wrong quantity</option><option value="WRONG_PRICE">Wrong price</option><option value="WRONG_DATE">Wrong date</option><option value="OTHER">Other</option></select><textarea name="comment" placeholder="Explain the issue…" /><button className="warning">Submit dispute</button></form>}
  </div></Modal>
}

function Ledger({ user, t }: { user: User; t: Record<string, string> }) {
  const [data, setData] = useState<any>(null)
  const [statement, setStatement] = useState<OfficialStatement | null>(null)
  const [generating, setGenerating] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  useEffect(() => { api<any>('/ledger/' + encodeURIComponent(user.orbitPersonId)).then(setData) }, [user.orbitPersonId])
  async function issueStatement() {
    setGenerating(true)
    try {
      const result = await api<{ statement: OfficialStatement }>('/statements/issue', {
        method: 'POST',
        body: JSON.stringify({ orbitPersonId: user.orbitPersonId })
      })
      setStatement(result.statement)
    } catch (error) {
      setNotice({ type: 'error', message: (error as Error).message })
    } finally {
      setGenerating(false)
    }
  }
  if (!data) return <Loading />
  return <>
    <section className="panel statement"><div className="section-heading"><div><span className="eyebrow">KCS KITCHEN LEDGER</span><h2>{user.fullName}</h2><p>Every amount below is linked to an auditable operation.</p></div><button disabled={generating} onClick={issueStatement}>{generating ? <LoaderCircle className="spin" /> : <ReceiptText />} {generating ? (document.documentElement.lang === 'fr' ? 'Génération…' : 'Generating…') : t.print}</button></div>
      <div className="statement-balance"><small>{t.outstanding}</small><strong><DisplayMoney value={data.closingBalance} /></strong></div>
      <div className="data-table ledger-table"><div className="table-head"><span>Date</span><span>Type</span><span>Description</span><span>Amount</span></div>{data.entries.map((entry: any) => <div className="table-row" key={entry.id}><span data-label="Date">{dateTime(entry.createdAt)}</span><span data-label="Type"><em className="badge">{entry.type}</em></span><span data-label="Description">{entry.description}</span><span data-label="Amount" className={Number(entry.amount) < 0 ? 'negative' : 'positive'}><b><DisplayMoney value={entry.amount} /></b></span></div>)}</div>
      {!data.entries.length && <Empty text={t.noData} />}
    </section>
    {statement && <OfficialLedgerStatement statement={statement} onClose={() => setStatement(null)} />}
    {notice && <Notice {...notice} onClose={() => setNotice(null)} />}
  </>
}

function OfficialLedgerStatement({ statement, onClose }: { statement: OfficialStatement; onClose: () => void }) {
  const fr = document.documentElement.lang === 'fr'
  const [printError, setPrintError] = useState('')
  const qrValue = statementVerificationUrl(statement)
  const printId = 'official-statement-' + statement.documentId
  const issued = new Date(statement.issuedAt)
  const periodEnd = new Date(new Date(statement.periodToExclusive).getTime() - 1)

  async function printDocument() {
    setPrintError('')
    try { await printStandaloneDocument(printId, statement.documentId) }
    catch (error) { setPrintError((error as Error).message) }
  }
  return <Modal wide onClose={onClose}>
    <article className="official-statement" id={printId}>
      <img className="statement-watermark" src="./images/kcs-seal.svg" alt="" />
      <header className="statement-official-head">
        <img src="./images/kcs-logo.png" alt="Kinshasa Christian School" />
        <div><span>KINSHASA CHRISTIAN SCHOOL</span><h1>{fr ? 'RELEVÉ OFFICIEL KCS KITCHEN' : 'OFFICIAL KCS KITCHEN STATEMENT'}</h1><b>{statement.documentId}</b></div>
        <QRCodeSVG className="statement-qr" value={qrValue} size={92} level="M" includeMargin title={fr ? 'Vérifier ce document' : 'Verify this document'} />
      </header>
      <div className="statement-document-status"><ShieldCheck /> {fr ? 'DOCUMENT SIGNÉ · QR DE VÉRIFICATION EN LIGNE' : 'SIGNED DOCUMENT · ONLINE VERIFICATION QR'}</div>
      <section className="statement-holder">
        <div><small>{fr ? 'TITULAIRE' : 'ACCOUNT HOLDER'}</small><strong>{statement.holder.fullName}</strong><span>{statement.holder.email || statement.holder.displayId || '—'}</span></div>
        <div><small>ORBIT ID</small><strong>{statement.holder.orbitPersonId}</strong><span>{statement.holder.kind}</span></div>
        <div><small>{fr ? 'PÉRIODE / ÉMISSION' : 'PERIOD / ISSUE DATE'}</small><strong>{statementDate(statement.periodFrom, fr ? 'fr' : 'en')} — {statementDate(periodEnd, fr ? 'fr' : 'en')}</strong><span>{statementDate(issued, fr ? 'fr' : 'en', true)}</span></div>
        <div className="official-balance"><small>{fr ? 'SOLDE DE CLÔTURE' : 'CLOSING BALANCE'}</small><strong>{statementMoney(statement.closingBalance, statement.currency)}</strong><span>{fr ? 'Ouverture' : 'Opening'}: {statementMoney(statement.openingBalance, statement.currency)} · {statement.entryCount} {fr ? 'écriture(s)' : 'entry/entries'}</span></div>
      </section>
      <section className="statement-register">
        <h2>{fr ? 'Mouvements du compte' : 'Account movements'}</h2>
        <table><thead><tr><th>{fr ? 'Date' : 'Date'}</th><th>{fr ? 'Nature' : 'Type'}</th><th>{fr ? 'Description' : 'Description'}</th><th>{fr ? 'Montant' : 'Amount'}</th></tr></thead>
          <tbody>{statement.entries.map(entry => <tr key={entry.id}><td>{statementDate(entry.createdAt, fr ? 'fr' : 'en', true)}</td><td>{entry.type.replaceAll('_', ' ')}</td><td>{entry.description}<small className="statement-entry-ref">{entry.transactionId || entry.paymentId || entry.id}</small></td><td className={Number(entry.amount) < 0 ? 'negative' : 'positive'}>{statementMoney(entry.amount, entry.currency)}</td></tr>)}</tbody>
        </table>
        {!statement.entries.length && <p className="statement-empty">{fr ? 'Aucun mouvement enregistré pour cette période.' : 'No movement is recorded for this period.'}</p>}
      </section>
      <footer className="statement-official-foot">
        <p><ShieldCheck /> {fr ? 'Ce relevé provient du registre audité KCS Orbit. Scannez le QR pour contrôler la signature numérique et la référence du document.' : 'This statement comes from the audited KCS Orbit register. Scan the QR to validate its digital signature and document reference.'}</p>
        <code className="statement-proof">SHA-256 {statement.payloadHash} · {statement.keyId} · v{statement.version}</code>
        <div className="statement-signatures"><span>{fr ? 'Gestionnaire KCS Kitchen' : 'KCS Kitchen Manager'}</span><span>{fr ? 'Administration / Finance' : 'Administration / Finance'}</span></div>
        <div className="statement-address"><b>Kinshasa Christian School</b><span>Macampagne, Ngaliema · Kinshasa, RDC</span><span>KCS Orbit Ecosystem · KCS Kitchen</span></div>
      </footer>
    </article>
    {printError && <div className="form-message error">{printError}</div>}
    <div className="official-statement-actions"><button onClick={onClose}>{fr ? 'Fermer' : 'Close'}</button><button className="primary" onClick={printDocument}><ReceiptText />{fr ? 'Imprimer / Enregistrer en PDF' : 'Print / Save as PDF'}</button></div>
  </Modal>
}
function Inventory({ canEdit, t }: { canEdit: boolean; t: Record<string, string> }) {
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [show, setShow] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const load = () => Promise.all([
    api<{ products: Product[] }>('/products?all=true').then(result => setProducts(result.products)),
    api<{ movements: any[] }>('/stock-movements').then(result => setMovements(result.movements))
  ])
  useEffect(() => { load() }, [])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    try {
      await api('/stock-movements', { method: 'POST', body: JSON.stringify({ productId: data.get('productId'), type: data.get('type'), quantity: Number(data.get('quantity')), reason: data.get('reason') }) })
      setShow(false); load(); setNotice({ type: 'success', message: t.success })
    } catch (err) { setNotice({ type: 'error', message: (err as Error).message }) }
  }
  return <><section className="panel"><div className="section-heading"><div><span className="eyebrow">INVENTORY CONTROL</span><h2>{t.inventory}</h2></div>{canEdit && <button className="primary" onClick={() => setShow(true)}><Plus />Stock movement</button>}</div>
    <div className="inventory-cards">{products.filter(product => product.trackInventory).map(product => <article key={product.id} className={Number(product.stockQuantity) <= Number(product.reorderLevel) ? 'low' : ''}><div><Package /><em className="badge">{product.unit}</em></div><h3>{product.name}</h3><strong>{product.stockQuantity}</strong><small>Reorder at {product.reorderLevel}</small></article>)}</div>
    <h3>Recent movements</h3><div className="activity-list">{movements.slice(0, 20).map(item => <div key={item.id}><Archive /><span><b>{item.product.name} · {item.type}</b><small>{dateTime(item.createdAt)} · {item.reason}</small></span><strong>{item.quantity}</strong></div>)}</div>
  </section>
  {show && <Modal onClose={() => setShow(false)}><form className="modal-form" onSubmit={save}><span className="eyebrow">AUDITED STOCK</span><h2>Record movement</h2><label>Product<select name="productId">{products.filter(product => product.trackInventory).map(product => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label><label>Movement<select name="type"><option>STOCK_IN</option><option>WASTE</option><option>EXPIRED</option><option>DAMAGED</option><option>LOSS</option><option>ADJUSTMENT</option><option>RETURN</option></select></label><label>Quantity<input name="quantity" type="number" min="0.001" step="0.001" required /></label><label>Reason<textarea name="reason" required /></label><button className="primary large">{t.save}</button></form></Modal>}
  {notice && <Notice {...notice} onClose={() => setNotice(null)} />}</>
}

function Disputes({ user, t }: { user: User; t: Record<string, string> }) {
  const [rows, setRows] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const managerial = ['KITCHEN_ADMIN', 'FINANCE'].includes(user.role)
  const load = () => api<{ disputes: any[] }>('/disputes').then(result => setRows(result.disputes))
  useEffect(() => { load() }, [])
  async function resolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    try {
      await api('/disputes/' + selected.id, { method: 'PUT', body: JSON.stringify({ status: data.get('status'), resolution: data.get('resolution') }) })
      setSelected(null); load(); setNotice({ type: 'success', message: t.success })
    } catch (err) { setNotice({ type: 'error', message: (err as Error).message }) }
  }
  return <><section className="panel"><div className="section-heading"><div><span className="eyebrow">FAIR REVIEW WORKFLOW</span><h2>{t.disputes}</h2></div></div>
    <div className="data-table dispute-table"><div className="table-head"><span>Date</span><span>Transaction</span><span>Person</span><span>Reason</span><span>Status</span></div>{rows.map(row => <button className="table-row" key={row.id} onClick={() => managerial && setSelected(row)}><span data-label="Date">{dateTime(row.createdAt)}</span><span data-label="Transaction"><b>{row.transaction.transactionNumber}</b></span><span data-label="Person">{row.transaction.personNameSnapshot}</span><span data-label="Reason">{row.reason.replaceAll('_', ' ')}</span><span data-label="Status"><em className={'badge ' + (row.status === 'RESOLVED' ? 'good' : 'warn')}>{row.status}</em></span></button>)}</div>
    {!rows.length && <Empty text={t.noData} />}
  </section>
  {selected && <Modal wide onClose={() => setSelected(null)}><form className="modal-form" onSubmit={resolve}><span className="eyebrow">AUDITED DISPUTE REVIEW</span><h2>{selected.transaction.transactionNumber}</h2><p><b>{selected.transaction.personNameSnapshot}</b> · {selected.reason.replaceAll('_', ' ')}</p><blockquote>{selected.comment || 'No additional comment.'}</blockquote><label>Decision<select name="status"><option>UNDER_REVIEW</option><option>RESOLVED</option><option>REJECTED</option></select></label><label>Resolution<textarea name="resolution" required /></label><button className="primary large">{t.save}</button></form></Modal>}
  {notice && <Notice {...notice} onClose={() => setNotice(null)} />}</>
}

function OfficialTransactionRegister({ report, onClose }: { report: OfficialTransactionReport; onClose: () => void }) {
  const fr = document.documentElement.lang === 'fr'
  const qrValue = transactionReportVerificationUrl(report)
  const periodEnd = new Date(new Date(report.periodToExclusive).getTime() - 1)
  const printDocument = () => printStandaloneDocument('official-transaction-register', report.documentId, 'landscape')
  return <div className="official-statement-shell"><div id="official-transaction-register" className="official-statement transaction-register-document">
    <header className="statement-masthead"><img src="/kitchen/kcs-logo.png" alt="KCS" /><div><span>KINSHASA CHRISTIAN SCHOOL</span><h1>{fr ? 'REGISTRE OFFICIEL DES TRANSACTIONS' : 'OFFICIAL TRANSACTION REGISTER'}</h1><small>{report.documentId}</small></div><QRCodeSVG className="statement-qr" value={qrValue} size={92} level="M" includeMargin /></header>
    <section className="statement-summary"><div><small>{fr ? 'PÉRIODE' : 'PERIOD'}</small><strong>{statementDate(report.periodFrom, fr ? 'fr' : 'en')} — {statementDate(periodEnd, fr ? 'fr' : 'en')}</strong></div><div><small>{fr ? 'TRANSACTIONS' : 'TRANSACTIONS'}</small><strong>{report.transactionCount}</strong></div><div><small>{fr ? 'TOTAL CONFIRMÉ' : 'CONFIRMED TOTAL'}</small><strong>{statementMoney(report.confirmedTotal, report.currency)}</strong></div><div><small>{fr ? 'ANNULÉES' : 'VOIDED'}</small><strong>{report.voidedCount}</strong></div></section>
    <div className="statement-table-wrap"><table className="statement-table"><thead><tr><th>{fr ? 'Référence' : 'Reference'}</th><th>{fr ? 'Date' : 'Date'}</th><th>{fr ? 'Entité' : 'Person'}</th><th>{fr ? 'Caissier' : 'Cashier'}</th><th>{fr ? 'Paiement' : 'Payment'}</th><th>{fr ? 'Statut' : 'Status'}</th><th>{fr ? 'Total' : 'Total'}</th></tr></thead><tbody>{report.rows.map(row => <tr key={row.id}><td>{row.transactionNumber}</td><td>{statementDate(row.createdAt, fr ? 'fr' : 'en', true)}</td><td>{row.personName}</td><td>{row.cashierName}</td><td>{row.paymentMode}</td><td>{row.status}</td><td>{statementMoney(row.total,row.currency)}</td></tr>)}</tbody></table></div>
    <footer className="statement-footer"><p><ShieldCheck /> {fr ? 'Document signé numériquement. Scannez le QR code pour vérifier son authenticité.' : 'Digitally signed document. Scan the QR code to verify authenticity.'}</p><code>SHA-256 · {report.payloadHash}</code></footer>
  </div><div className="official-statement-actions"><button onClick={onClose}>{fr ? 'Fermer' : 'Close'}</button><button className="primary" onClick={printDocument}><ReceiptText />{fr ? 'Imprimer / Enregistrer en PDF' : 'Print / Save as PDF'}</button></div></div>
}

function Reports({ user, t }: { user: User; t: Record<string, string> }) {
  const [periods, setPeriods] = useState<AccountingPeriod[]>([])
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [statementPerson, setStatementPerson] = useState<Person | null>(null)
  const [statement, setStatement] = useState<OfficialStatement | null>(null)
  const [generating, setGenerating] = useState(false)
  const [transactionReport, setTransactionReport] = useState<OfficialTransactionReport | null>(null)
  const [reportGenerating, setReportGenerating] = useState(false)
  const [reportStatus, setReportStatus] = useState('')
  const [reportPaymentMode, setReportPaymentMode] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [periodBusy, setPeriodBusy] = useState(false)
  const [periodAction, setPeriodAction] = useState<{
    mode: 'edit' | 'archive' | 'restore'
    period?: AccountingPeriod
    year: number
    month: number
    status: AccountingPeriod['status']
    reason: string
  } | null>(null)
  const [from, setFrom] = useState(() => {
    const value = new Date(); value.setDate(1)
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [to, setTo] = useState(() => {
    const value = new Date()
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  })
  const lang: Lang = document.documentElement.lang === 'fr' ? 'fr' : 'en'
  const canManagePeriods = user.role === 'KITCHEN_ADMIN' || user.role === 'FINANCE'
  const load = () => api<{ periods: AccountingPeriod[] }>('/periods?includeArchived=' + includeArchived).then(result => setPeriods(result.periods))
  useEffect(() => { void load() }, [includeArchived])
  function reportQuery() {
    const params = new URLSearchParams({ from, to })
    if (reportStatus) params.set('status', reportStatus)
    if (reportPaymentMode) params.set('paymentMode', reportPaymentMode)
    return params
  }
  async function downloadCsv() {
    try {
      const base = import.meta.env.VITE_API_URL || '/kitchen/api'
      const response = await fetch(base + '/reports/transactions.csv?' + reportQuery(), { headers: { authorization: 'Bearer ' + getToken() } })
      if (!response.ok) throw new Error(lang === 'fr' ? "Échec de l'export CSV." : 'CSV export failed.')
      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `kcs-kitchen-transactions-${from}-${to}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) { setNotice({ type: 'error', message: (err as Error).message }) }
  }
  async function generateTransactionReport() {
    setReportGenerating(true)
    try {
      const result = await api<{ report: OfficialTransactionReport }>('/reports/transactions/issue', {
        method: 'POST',
        body: JSON.stringify({ from, to, status: reportStatus || null, paymentMode: reportPaymentMode || null })
      })
      setTransactionReport(result.report)
    } catch (error) {
      setNotice({ type: 'error', message: (error as Error).message })
    } finally {
      setReportGenerating(false)
    }
  }
  function editPeriod(period?: AccountingPeriod) {
    const now = new Date()
    setPeriodAction({
      mode: 'edit',
      period,
      year: period?.year ?? now.getFullYear(),
      month: period?.month ?? now.getMonth() + 1,
      status: period?.status ?? 'OPEN',
      reason: ''
    })
  }
  async function submitPeriodAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!periodAction || periodAction.reason.trim().length < 5) return
    setPeriodBusy(true)
    try {
      if (periodAction.mode === 'edit') {
        await api('/periods/' + periodAction.year + '/' + periodAction.month, {
          method: 'PUT',
          body: JSON.stringify({ status: periodAction.status, reason: periodAction.reason.trim() })
        })
      } else if (periodAction.period) {
        await api('/periods/' + periodAction.period.id + (periodAction.mode === 'restore' ? '/restore' : ''), {
          method: periodAction.mode === 'restore' ? 'POST' : 'DELETE',
          body: JSON.stringify({ reason: periodAction.reason.trim() })
        })
      }
      setPeriodAction(null)
      await load()
      setNotice({ type: 'success', message: t.success })
    } catch (error) {
      setNotice({ type: 'error', message: (error as Error).message })
    } finally {
      setPeriodBusy(false)
    }
  }
  async function generateStatement() {
    if (!statementPerson) {
      setNotice({ type: 'error', message: lang === 'fr' ? 'Sélectionnez d’abord une entité.' : 'Select an entity first.' })
      return
    }
    setGenerating(true)
    try {
      const result = await api<{ statement: OfficialStatement }>('/statements/issue', {
        method: 'POST',
        body: JSON.stringify({ orbitPersonId: statementPerson.id, from, to })
      })
      setStatement(result.statement)
    } catch (error) {
      setNotice({ type: 'error', message: (error as Error).message })
    } finally {
      setGenerating(false)
    }
  }
  return <>
    <section className="report-grid">
      <article className="panel report-card transaction-export-card">
        <ReceiptText />
        <span className="eyebrow">{lang === 'fr' ? 'EXPORT FINANCIER' : 'FINANCE EXPORT'}</span>
        <h2>{lang === 'fr' ? 'Registre des transactions' : 'Transaction register'}</h2>
        <p>{lang === 'fr' ? 'Export auditable avec période, statut et mode de paiement.' : 'Auditable export with period, status and payment mode.'}</p>
        <div className="transaction-report-filters">
          <label>{lang === 'fr' ? 'Du' : 'From'}<input type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} /></label>
          <label>{lang === 'fr' ? 'Au' : 'To'}<input type="date" value={to} min={from} onChange={event => setTo(event.target.value)} /></label>
          <label>{lang === 'fr' ? 'Statut' : 'Status'}<select value={reportStatus} onChange={event => setReportStatus(event.target.value)}><option value="">{lang === 'fr' ? 'Tous les statuts' : 'All statuses'}</option><option value="CONFIRMED">{lang === 'fr' ? 'Confirmée' : 'Confirmed'}</option><option value="VOIDED">{lang === 'fr' ? 'Annulée' : 'Voided'}</option><option value="REVERSED">{lang === 'fr' ? 'Contrepassée' : 'Reversed'}</option><option value="REFUNDED">{lang === 'fr' ? 'Remboursée' : 'Refunded'}</option></select></label>
          <label>{lang === 'fr' ? 'Mode de paiement' : 'Payment mode'}<select value={reportPaymentMode} onChange={event => setReportPaymentMode(event.target.value)}><option value="">{lang === 'fr' ? 'Tous les modes' : 'All modes'}</option><option value="CASH">{lang === 'fr' ? 'Espèces' : 'Cash'}</option><option value="MOBILE_MONEY">Mobile Money</option><option value="BANK">{lang === 'fr' ? 'Banque' : 'Bank'}</option><option value="EDUPAY">EduPay</option><option value="CREDIT">{lang === 'fr' ? 'Crédit' : 'Credit'}</option></select></label>
        </div>
        <div className="button-row"><button onClick={downloadCsv}>{lang === 'fr' ? 'Télécharger CSV' : 'Download CSV'}</button><button className="primary" disabled={reportGenerating || !from || !to} onClick={generateTransactionReport}>{reportGenerating ? <LoaderCircle className="spin" /> : <ReceiptText />}{reportGenerating ? (lang === 'fr' ? 'Génération…' : 'Generating.') : (lang === 'fr' ? 'PDF officiel vérifiable' : 'Verifiable official PDF')}</button></div>
      </article>
      <article className="panel report-card"><Wallet /><span className="eyebrow">{lang === 'fr' ? 'FIN DE MOIS' : 'MONTH END'}</span><h2>{lang === 'fr' ? 'Piloter une période comptable' : 'Control an accounting period'}</h2><p>{lang === 'fr' ? 'Ouvrez, révisez ou clôturez un mois avec un motif audité.' : 'Open, review or close a month with an audited reason.'}</p>{canManagePeriods && <button className="primary" onClick={() => editPeriod()}><Plus />{lang === 'fr' ? 'Créer / modifier une période' : 'Create / edit a period'}</button>}</article>
    </section>
    {user.role === 'KITCHEN_ADMIN' && <section className="panel admin-statement-builder">
      <div className="section-heading"><div><span className="eyebrow">{lang === 'fr' ? 'RELEVÉ OFFICIEL PAR ENTITÉ' : 'OFFICIAL ENTITY STATEMENT'}</span><h2>{lang === 'fr' ? 'Consommations sur une période précise' : 'Consumption over a precise period'}</h2><p>{lang === 'fr' ? 'Recherchez l’élève ou le membre du personnel, choisissez la période, puis générez un document signé et vérifiable.' : 'Find the student or staff member, choose the period, then generate a signed and verifiable document.'}</p></div></div>
      <div className={generating ? 'entity-selector-lock locked' : 'entity-selector-lock'}><PersonSelector value={statementPerson} onChange={person => { setStatementPerson(person); setStatement(null) }} lang={lang} /></div>
      <div className="statement-period-controls"><label>{lang === 'fr' ? 'Du' : 'From'}<input type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} /></label><label>{lang === 'fr' ? 'Au' : 'To'}<input type="date" value={to} min={from} onChange={event => setTo(event.target.value)} /></label><button className="primary" disabled={!statementPerson || generating || !from || !to} onClick={generateStatement}>{generating ? <LoaderCircle className="spin" /> : <ReceiptText />}{generating ? (lang === 'fr' ? 'Génération…' : 'Generating…') : (lang === 'fr' ? 'Générer le relevé officiel' : 'Generate official statement')}</button></div>
    </section>}
    <section className="panel period-control-panel">
      <div className="section-heading"><div><span className="eyebrow">PERIOD CONTROL</span><h2>{lang === 'fr' ? 'Statut mensuel traçable' : 'Traceable monthly status'}</h2><p>{lang === 'fr' ? "La suppression archive la période sans effacer les transactions ni le journal d'audit." : 'Delete archives the period without erasing transactions or its audit trail.'}</p></div><div className="period-heading-actions"><label className="check"><input type="checkbox" checked={includeArchived} onChange={event => setIncludeArchived(event.target.checked)} />{lang === 'fr' ? 'Voir les archives' : 'Show archives'}</label>{canManagePeriods && <button className="primary" onClick={() => editPeriod()}><Plus />{lang === 'fr' ? 'Nouvelle période' : 'New period'}</button>}</div></div>
      <div className="period-list">{periods.map(period => <article key={period.id} className={period.archivedAt ? 'period-row archived' : 'period-row'}><Archive /><span><b>{String(period.month).padStart(2, '0')} / {period.year}</b><small>{period.archivedAt ? (lang === 'fr' ? 'Archivée' : 'Archived') + ' · ' + dateTime(period.archivedAt) : period.closedAt ? (lang === 'fr' ? 'Clôturée' : 'Closed') + ' · ' + dateTime(period.closedAt) : period.reviewedAt ? (lang === 'fr' ? 'En révision' : 'In review') + ' · ' + dateTime(period.reviewedAt) : (lang === 'fr' ? 'Flux actif' : 'Active workflow')}</small>{period.archiveReason && <small>{period.archiveReason}</small>}</span><em className={'badge ' + (period.status === 'CLOSED' ? 'good' : period.status === 'REVIEW' ? 'warn' : '')}>{period.status}</em>{canManagePeriods && <div className="period-row-actions">{!period.archivedAt && <button title={lang === 'fr' ? 'Modifier' : 'Edit'} onClick={() => editPeriod(period)}><Pencil /></button>}{!period.archivedAt ? <button className="danger" title={lang === 'fr' ? 'Supprimer (archiver)' : 'Delete (archive)'} onClick={() => setPeriodAction({ mode: 'archive', period, year: period.year, month: period.month, status: period.status, reason: '' })}><Trash2 /></button> : <button title={lang === 'fr' ? 'Restaurer' : 'Restore'} onClick={() => setPeriodAction({ mode: 'restore', period, year: period.year, month: period.month, status: period.status, reason: '' })}><Archive /></button>}</div>}</article>)}</div>
      {!periods.length && <Empty text={t.noData} />}
    </section>
    {statement && <OfficialLedgerStatement statement={statement} onClose={() => setStatement(null)} />}
    {transactionReport && <OfficialTransactionRegister report={transactionReport} onClose={() => setTransactionReport(null)} />}
    {periodAction && <Modal onClose={() => setPeriodAction(null)}><form className="modal-form" onSubmit={submitPeriodAction}><span className="eyebrow">{lang === 'fr' ? 'PÉRIODE COMPTABLE' : 'ACCOUNTING PERIOD'}</span><h2>{periodAction.mode === 'edit' ? (lang === 'fr' ? 'Créer ou modifier la période' : 'Create or edit period') : periodAction.mode === 'archive' ? (lang === 'fr' ? 'Archiver la période' : 'Archive period') : (lang === 'fr' ? 'Restaurer la période' : 'Restore period')}</h2>{periodAction.mode === 'edit' && <><label>{lang === 'fr' ? 'Année' : 'Year'}<input type="number" min="2020" max="2100" value={periodAction.year} onChange={event => setPeriodAction({...periodAction,year:Number(event.target.value)})} /></label><label>{lang === 'fr' ? 'Mois' : 'Month'}<input type="number" min="1" max="12" value={periodAction.month} onChange={event => setPeriodAction({...periodAction,month:Number(event.target.value)})} /></label><label>{lang === 'fr' ? 'Statut' : 'Status'}<select value={periodAction.status} onChange={event => setPeriodAction({...periodAction,status:event.target.value as AccountingPeriod['status']})}><option value="OPEN">OPEN</option><option value="REVIEW">REVIEW</option><option value="CLOSED">CLOSED</option></select></label></>}<label>{lang === 'fr' ? 'Motif auditable (5 caractères minimum)' : 'Auditable reason (minimum 5 characters)'}<textarea required minLength={5} value={periodAction.reason} onChange={event => setPeriodAction({...periodAction,reason:event.target.value})} /></label><button className="primary large" disabled={periodBusy || periodAction.reason.trim().length < 5}>{periodBusy ? <LoaderCircle className="spin" /> : <ShieldCheck />}{periodBusy ? (lang === 'fr' ? 'Traitement…' : 'Processing…') : t.save}</button></form></Modal>}
    {notice && <Notice {...notice} onClose={() => setNotice(null)} />}
  </>
}
function Access({ t }: { t: Record<string, string> }) {
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState<Person[]>([])
  const [selected, setSelected] = useState<Person | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  async function search() {
    try { const result = await api<{ people: Person[] }>('/directory?q=' + encodeURIComponent(query)); setPeople(result.people) }
    catch (err) { setNotice({ type: 'error', message: (err as Error).message }) }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    try {
      await api('/access/' + selected!.id, { method: 'PUT', body: JSON.stringify({
        role: data.get('role'), isActive: data.get('active') === 'on', creditEnabled: data.get('credit') === 'on',
        creditLimit: data.get('limit') ? Number(data.get('limit')) : null
      }) })
      setSelected(null); setNotice({ type: 'success', message: t.success })
    } catch (err) { setNotice({ type: 'error', message: (err as Error).message }) }
  }
  return <><section className="panel"><div className="section-heading"><div><span className="eyebrow">ORBIT IDENTITY · KITCHEN RBAC</span><h2>{t.access}</h2><p>Roles and credit rules are attached to the institutional Orbit ID, never to a duplicate identity.</p></div></div>
    <div className="search-toolbar"><div className="search-box"><Search /><input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.key === 'Enter' && search()} placeholder={t.searchPerson} /></div><button className="primary" onClick={search}>{t.search}</button></div>
    <div className="person-cards">{people.map(person => <button key={person.id} onClick={() => setSelected(person)}><div className="avatar">{person.fullName.slice(0, 2).toUpperCase()}</div><span><b>{person.fullName}</b><small>{person.kind} · {person.displayId || person.email}</small></span><ShieldCheck /></button>)}</div>
  </section>
  {selected && <Modal onClose={() => setSelected(null)}><form className="modal-form" onSubmit={save}><span className="eyebrow">KITCHEN ACCESS</span><h2>{selected.fullName}</h2><label>{t.role}<select name="role"><option>KITCHEN_ADMIN</option><option>CASHIER</option><option>FINANCE</option><option>AUDITOR</option><option>{selected.kind === 'TEACHER' ? 'TEACHER' : selected.kind === 'STUDENT' ? 'STUDENT' : 'STAFF'}</option></select></label><label className="check"><input name="active" type="checkbox" defaultChecked />{t.active}</label><label className="check"><input name="credit" type="checkbox" />{t.creditAllowed}</label><label>Credit limit (CDF)<input name="limit" type="number" min="1" /></label><button className="primary large">{t.save}</button></form></Modal>}
  {notice && <Notice {...notice} onClose={() => setNotice(null)} />}</>
}

function PublicStatementVerification({ request }: { request: { documentId: string; signature: string } }) {
  const { lang } = useLanguage()
  const fr = lang === 'fr'
  const [result, setResult] = useState<StatementVerificationResult | null>(null)
  const [loading, setLoading] = useState(true)
  async function verify() {
    setLoading(true)
    try {
      const path = '/statements/verify/' + encodeURIComponent(request.documentId) + '?signature=' + encodeURIComponent(request.signature)
      const publicResult = await api<StatementVerificationResult>(path)
      if (publicResult.valid && getToken()) {
        try {
          const privateResult = await api<StatementVerificationResult>('/statements/verify/' + encodeURIComponent(request.documentId) + '/details?signature=' + encodeURIComponent(request.signature))
          setResult({ ...publicResult, details: privateResult.details })
        } catch { setResult(publicResult) }
      } else setResult(publicResult)
    } catch (error: any) {
      const status: StatementVerificationResult['status'] = error?.status === 404
        ? 'NOT_FOUND'
        : error?.status === 429
          ? 'RATE_LIMITED'
          : error?.status && error.status < 500
            ? 'CORRUPTED'
            : 'UNAVAILABLE'
      setResult({ valid: false, status, documentId: request.documentId })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void verify() }, [request.documentId, request.signature])
  const temporary = result?.status === 'RATE_LIMITED' || result?.status === 'UNAVAILABLE'
  return <main className="statement-verification-page">
    <section className="statement-verification-card">
      <img src="./images/kcs-logo.png" alt="Kinshasa Christian School" />
      <span className="eyebrow">KCS ORBIT · KCS KITCHEN</span>
      <h1>{fr ? 'Vérification du relevé officiel' : 'Official statement verification'}</h1>
      {loading && <div className="verification-state loading"><LoaderCircle className="spin" /><b>{fr ? 'Vérification cryptographique en cours…' : 'Cryptographic verification in progress…'}</b></div>}
      {!loading && result?.valid && result.document && <>
        <div className="verification-state valid"><ShieldCheck /><b>{fr ? 'Document authentique et intègre' : 'Authentic and intact document'}</b><span>{fr ? 'La signature numérique correspond au registre officiel.' : 'The digital signature matches the official register.'}</span></div>
        <dl><div><dt>{fr ? 'Référence' : 'Reference'}</dt><dd>{result.document.documentId}</dd></div><div><dt>{fr ? 'Émis le' : 'Issued on'}</dt><dd>{statementDate(result.document.issuedAt, lang, true)}</dd></div><div><dt>{fr ? 'Période' : 'Period'}</dt><dd>{statementDate(result.document.periodFrom, lang)} — {statementDate(new Date(new Date(result.document.periodToExclusive).getTime() - 1), lang)}</dd></div><div><dt>{fr ? 'Écritures' : 'Entries'}</dt><dd>{result.document.entryCount} · {result.document.currency}</dd></div><div><dt>SHA-256</dt><dd><code>{result.document.payloadHash}</code></dd></div><div><dt>{fr ? 'Clé / version' : 'Key / version'}</dt><dd>{result.document.keyId} · v{result.document.version}</dd></div></dl>
        {result.details ? <div className="verification-comparison"><b>{fr ? 'Comparaison autorisée' : 'Authorized comparison'}</b><span>{result.details.holder.fullName} · {result.details.holder.displayId || result.details.holder.kind}</span><span>{fr ? 'Solde d’ouverture' : 'Opening balance'}: {statementMoney(result.details.openingBalance, result.details.currency)}</span><strong>{fr ? 'Solde de clôture' : 'Closing balance'}: {statementMoney(result.details.closingBalance, result.details.currency)}</strong></div> : <p className="verification-private-note">{fr ? 'Pour comparer le titulaire et les soldes, ouvrez ce QR dans la session Kitchen du titulaire ou du gestionnaire.' : 'To compare the holder and balances, open this QR in the holder or Kitchen manager session.'}</p>}
      </>}
      {!loading && result && !result.valid && <div className={'verification-state ' + (temporary ? 'temporary' : 'invalid')}><AlertTriangle /><b>{temporary ? (fr ? 'Vérification temporairement indisponible' : 'Verification temporarily unavailable') : (fr ? 'Document non validé' : 'Document not validated')}</b><span>{temporary ? (fr ? 'Le document n’est pas déclaré invalide. Réessayez lorsque la connexion est disponible.' : 'The document is not declared invalid. Retry when the connection is available.') : `${fr ? 'Statut' : 'Status'}: ${result.status}`}</span></div>}
      <div className="verification-actions">{temporary && <button className="primary" onClick={verify}>{fr ? 'Réessayer' : 'Retry'}</button>}<a href="/kitchen/">{fr ? 'Ouvrir KCS Kitchen' : 'Open KCS Kitchen'}</a></div>
      <small>Kinshasa Christian School · Macampagne, Ngaliema · Kinshasa, RDC</small>
    </section>
  </main>
}
function Loading() { const { t } = useLanguage(); return <div className="loading"><ChefHat /><span>{t.secureLoading}</span></div> }
function Empty({ text }: { text: string }) { return <div className="empty"><ChefHat /><span>{text}</span></div> }

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(Boolean(getToken()))
  useEffect(() => {
    if (!getToken()) return setChecking(false)
    api<{ user: User }>('/me').then(result => setUser(result.user)).catch(() => setToken(null)).finally(() => setChecking(false))
  }, [])
  const verificationRequest = requestedStatementVerification()
  if (verificationRequest) return <PublicStatementVerification request={verificationRequest} />
  if (checking) return <Loading />
  if (!user) return <Login onLogin={setUser} />
  return <Shell user={user} onLogout={() => { setToken(null); setUser(null) }} />
}
