import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertTriangle, Archive, BarChart3, ChefHat, ClipboardList, CreditCard, Languages,
  LayoutDashboard, LogOut, Menu, Package, PackagePlus, Plus, ReceiptText, ScanLine, Search,
  Eye, EyeOff, PanelLeftClose, PanelLeftOpen, ShieldCheck, ShoppingCart, Sun, Moon, Trash2, Users, Wallet, X, Pencil, LoaderCircle
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { api, dateTime, getToken, setToken } from './api'
import type { Person, Product, Role, Transaction, User } from './types'
import Procurement from './Procurement'
import InstallAppButton from './InstallApp'
import PersonSelector from './PersonSelector'
import { CurrencyDisplayProvider, DisplayMoney, ExchangeRateCard, useCurrencyDisplay } from './ExchangeRate'

type Lang = 'fr' | 'en'
type Page = 'dashboard' | 'pos' | 'catalog' | 'transactions' | 'ledger' | 'inventory' | 'procurement' | 'disputes' | 'reports' | 'access'

const text = {
  fr: {
    signIn: 'Connexion institutionnelle', identifier: 'E-mail ou code institutionnel', password: 'Mot de passe',
    enter: 'Entrer dans KCS Kitchen', trace: 'Chaque consommation. Chaque franc. Une preuve.',
    powered: 'Propulsé par KCS Orbit', dashboard: 'Tableau de bord', pos: 'Point de vente', catalog: 'Catalogue',
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
    trackInventory: 'Suivre le stock', updateReason: 'Motif de la modification', saveChanges: 'Enregistrer les modifications', unavailable: 'Indisponible'
  },
  en: {
    signIn: 'Institutional sign in', identifier: 'Email or institutional code', password: 'Password',
    enter: 'Enter KCS Kitchen', trace: 'Every consumption. Every franc. One proof.',
    powered: 'Powered by KCS Orbit', dashboard: 'Dashboard', pos: 'Point of sale', catalog: 'Catalog',
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
    trackInventory: 'Track inventory', updateReason: 'Reason for update', saveChanges: 'Save changes', unavailable: 'Unavailable'
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
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError('')
    const data = new FormData(event.currentTarget)
    try {
      const result = await api<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: data.get('identifier'), password: data.get('password') })
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
      <div className="brand-line"><ChefHat /> Smart Canteen Management</div>
    </section>
    <section className="login-card">
      <div><span className="eyebrow">SECURE ACCESS</span><h2>{t.signIn}</h2><p>{t.powered}</p></div>
      <form onSubmit={submit}>
        <label>{t.identifier}<input name="identifier" autoComplete="username" required /></label>
        <label>{t.password}<span className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary large" disabled={loading}>{loading ? '…' : t.enter}</button>
      </form>
      <small>🔒 Orbit identity · Encrypted session · Audited access</small>
    </section>
      <p className="manager-hint">Gestionnaires : utilisez votre identité Admin Nexus institutionnelle. Aucun compte Kitchen séparé n’est créé.</p>
  </main>
}

const privileged: Role[] = ['KITCHEN_ADMIN', 'CASHIER', 'FINANCE', 'AUDITOR']

function Shell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { lang, setLang, t } = useLanguage()
  const [page, setPage] = useState<Page>('dashboard')
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('kcs-kitchen-theme') === 'dark')
  useEffect(() => { document.body.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('kcs-kitchen-theme', dark ? 'dark' : 'light') }, [dark])
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('kcs-kitchen-sidebar') === 'collapsed')
  const isPrivileged = privileged.includes(user.role)
  useEffect(() => { localStorage.setItem('kcs-kitchen-sidebar', collapsed ? 'collapsed' : 'expanded') }, [collapsed])
  const nav: Array<[Page, string, ReactNode, boolean]> = [
    ['dashboard', t.dashboard, <LayoutDashboard />, true],
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
  return <div className={collapsed ? 'app-shell collapsed' : 'app-shell'}>
    <aside className={(open ? 'sidebar open' : 'sidebar') + (collapsed ? ' collapsed' : '')}>
      <div className="sidebar-brand"><img src="./images/kcs-seal.svg" alt="Kinshasa Christian School" /><div><b>KCS KITCHEN</b><small>{t.powered}</small></div><button onClick={() => setOpen(false)}><X /></button></div>
      <div className="identity"><span>{user.fullName.split(' ').map(v => v[0]).slice(0, 2).join('')}</span><div><b>{user.fullName}</b><small>{user.role.replaceAll('_', ' ')}</small></div></div>
      <nav>{nav.filter(item => item[3]).map(item => <button key={item[0]} title={item[1]} aria-label={item[1]} className={page === item[0] ? 'active' : ''} onClick={() => { setPage(item[0]); setOpen(false) }}>{item[2]}<span>{item[1]}</span></button>)}</nav>
      <div className="sidebar-footer">
        <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}><Languages /> {lang.toUpperCase()}</button>
        <button onClick={() => setDark(!dark)}>{dark ? <Sun /> : <Moon />} {dark ? 'Light' : 'Dark'}</button>
        <button className="danger-text" onClick={onLogout}><LogOut /> {t.logout}</button>
      </div>
    </aside>
    <CurrencyDisplayProvider userKey={user.userId}>
    <main className="workspace">
      <header><button className="menu-button" onClick={() => setOpen(true)}><Menu /></button><button className="collapse-button" onClick={() => setCollapsed(value => !value)} aria-label="Toggle navigation">{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</button><img className="header-logo" src="./images/kcs-seal.svg" alt="Kinshasa Christian School"/><div><span className="eyebrow">KCS KITCHEN · LIVE</span><h1>{t[page]}</h1></div><div className="header-actions"><InstallAppButton lang={lang} compact /><div className="status-pill"><ShieldCheck /> Orbit verified</div></div></header>
      <div className="page-body">
        <ExchangeRateCard lang={lang} compact />
        {page === 'dashboard' && <Dashboard user={user} t={t} />}
        {page === 'pos' && <PointOfSale t={t} lang={lang} />}
        {page === 'catalog' && <Catalog canEdit={user.role === 'KITCHEN_ADMIN'} t={t} lang={lang} />}
        {page === 'transactions' && <Transactions user={user} t={t} />}
        {page === 'ledger' && <Ledger user={user} t={t} />}
        {page === 'inventory' && <Inventory canEdit={user.role === 'KITCHEN_ADMIN'} t={t} />}
        {page === 'disputes' && <Disputes user={user} t={t} />}
        {page === 'reports' && <Reports t={t} />}
        {page === 'access' && <Access t={t} />}
        {page === 'procurement' && <Procurement user={user} lang={lang} />}
      </div>
    </main>
    </CurrencyDisplayProvider>
  </div>
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
    <section className="hero"><div><span className="eyebrow">PERSONAL KITCHEN ACCOUNT</span><h2>Welcome, {user.fullName.split(' ').at(-1)}</h2><p>Your consumption ledger is live, exact and verifiable.</p></div><ChefHat size={70} /></section>
    <div className="stats">
      <Stat icon={<ShoppingCart />} label={t.today} value={<DisplayMoney value={data.today._sum.total} />} />
      <Stat icon={<ClipboardList />} label="This month" value={<DisplayMoney value={data.month._sum.total} />} />
      <Stat icon={<Wallet />} label={t.outstanding} value={<DisplayMoney value={data.balance} />} tone={Number(data.balance) > 0 ? 'warn' : 'good'} />
      <Stat icon={<AlertTriangle />} label={t.openDisputes} value={data.disputes} />
    </div>
    <section className="panel"><div className="section-heading"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Kitchen notifications</h2></div></div>
      {data.notifications.length ? <div className="activity-list">{data.notifications.map((item: any) => <div key={item.id}><ShieldCheck /><span><b>{item.eventType.replaceAll('_', ' ')}</b><small>{dateTime(item.createdAt)}</small></span></div>)}</div> : <Empty text={t.noData} />}
    </section>
  </>
  return <>
    <section className="hero"><div><span className="eyebrow">SMART CANTEEN CONTROL CENTER</span><h2>Good service starts with perfect traceability.</h2><p>Sales, credit, payments, inventory and disputes in one audited view.</p></div><ChefHat size={70} /></section>
    <div className="stats">
      <Stat icon={<ShoppingCart />} label={t.sales + ' · ' + t.today} value={<DisplayMoney value={data.today._sum.total} />} tone="good" />
      <Stat icon={<CreditCard />} label={t.credit} value={<DisplayMoney value={data.credit._sum.total} />} tone="warn" />
      <Stat icon={<Wallet />} label={t.outstanding} value={<DisplayMoney value={data.outstanding} />} />
      <Stat icon={<ReceiptText />} label={t.payments} value={<DisplayMoney value={data.payments._sum.amount} />} />
      <Stat icon={<AlertTriangle />} label={t.openDisputes} value={data.disputes} tone={data.disputes ? 'warn' : ''} />
      <Stat icon={<Archive />} label={t.lowStock} value={data.lowStock} />
    </div>
    <section className="panel"><div className="section-heading"><div><span className="eyebrow">POPULAR PRODUCTS</span><h2>Top consumption</h2></div></div>
      {data.popular.length ? <div className="rank-list">{data.popular.map((item: any, index: number) => <div key={item.productId}><b>{String(index + 1).padStart(2, '0')}</b><span>{item.productNameSnapshot}</span><strong>{Number(item._sum.quantity || 0)}</strong></div>)}</div> : <Empty text={t.noData} />}
    </section>
  </>
}

function PointOfSale({ t, lang }: { t: Record<string, string>; lang: Lang }) {
  const [products, setProducts] = useState<Product[]>([])
  const [person, setPerson] = useState<Person | null>(null)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [paymentMode, setPaymentMode] = useState('CASH')
  const [receipt, setReceipt] = useState<Transaction | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { rate } = useCurrencyDisplay()
  useEffect(() => { api<{ products: Product[] }>('/products').then(result => setProducts(result.products)) }, [])
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
        <div className="step-title"><span>2</span><div><small>CATALOG</small><h2>{t.chooseItems}</h2></div></div>
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
  const [officialOpen, setOfficialOpen] = useState(false)
  useEffect(() => { api<any>('/ledger/' + encodeURIComponent(user.orbitPersonId)).then(setData) }, [user.orbitPersonId])
  if (!data) return <Loading />
  return <>
    <section className="panel statement"><div className="section-heading"><div><span className="eyebrow">KCS KITCHEN LEDGER</span><h2>{user.fullName}</h2><p>Every amount below is linked to an auditable operation.</p></div><button onClick={() => setOfficialOpen(true)}><ReceiptText /> {t.print}</button></div>
      <div className="statement-balance"><small>{t.outstanding}</small><strong><DisplayMoney value={data.closingBalance} /></strong></div>
      <div className="data-table ledger-table"><div className="table-head"><span>Date</span><span>Type</span><span>Description</span><span>Amount</span></div>{data.entries.map((entry: any) => <div className="table-row" key={entry.id}><span data-label="Date">{dateTime(entry.createdAt)}</span><span data-label="Type"><em className="badge">{entry.type}</em></span><span data-label="Description">{entry.description}</span><span data-label="Amount" className={Number(entry.amount) < 0 ? 'negative' : 'positive'}><b><DisplayMoney value={entry.amount} /></b></span></div>)}</div>
      {!data.entries.length && <Empty text={t.noData} />}
    </section>
    {officialOpen && <OfficialLedgerStatement user={user} data={data} onClose={() => setOfficialOpen(false)} />}
  </>
}

function OfficialLedgerStatement({ user, data, onClose }: { user: User; data: any; onClose: () => void }) {
  const fr = document.documentElement.lang === 'fr'
  const issued = new Date()
  const documentId = 'KCS-KIT-STMT-' + user.orbitPersonId.replace(/[^a-z0-9]/gi, '').slice(-10).toUpperCase() + '-' + issued.toISOString().slice(0, 10).replaceAll('-', '')
  const qrValue = JSON.stringify({ issuer: 'Kinshasa Christian School', application: 'KCS Kitchen', documentId, orbitPersonId: user.orbitPersonId, entries: data.entries.length, closingBalance: String(data.closingBalance), issuedAt: issued.toISOString() })
  return <Modal wide onClose={onClose}>
    <article className="official-statement">
      <img className="statement-watermark" src="./images/kcs-seal.svg" alt="" />
      <header className="statement-official-head">
        <img src="./images/kcs-logo.png" alt="Kinshasa Christian School" />
        <div><span>KINSHASA CHRISTIAN SCHOOL</span><h1>{fr ? 'RELEVÉ OFFICIEL KCS KITCHEN' : 'OFFICIAL KCS KITCHEN STATEMENT'}</h1><b>{documentId}</b></div>
        <QRCodeSVG className="statement-qr" value={qrValue} size={92} level="M" includeMargin title={fr ? 'QR de référence du document' : 'Document reference QR'} />
      </header>
      <div className="statement-document-status"><ShieldCheck /> {fr ? 'DOCUMENT GÉNÉRÉ DEPUIS LE REGISTRE AUDITÉ KCS ORBIT' : 'DOCUMENT GENERATED FROM THE AUDITED KCS ORBIT REGISTER'}</div>
      <section className="statement-holder">
        <div><small>{fr ? 'TITULAIRE' : 'ACCOUNT HOLDER'}</small><strong>{user.fullName}</strong><span>{user.email || '—'}</span></div>
        <div><small>ORBIT ID</small><strong>{user.orbitPersonId}</strong><span>{user.role.replaceAll('_', ' ')}</span></div>
        <div><small>{fr ? 'DATE D’ÉMISSION' : 'ISSUE DATE'}</small><strong>{issued.toLocaleDateString(fr ? 'fr-CD' : 'en-US', { dateStyle: 'long' })}</strong><span>{issued.toLocaleTimeString(fr ? 'fr-CD' : 'en-US')}</span></div>
        <div className="official-balance"><small>{fr ? 'SOLDE DE CLÔTURE' : 'CLOSING BALANCE'}</small><strong><DisplayMoney value={data.closingBalance} /></strong><span>{fr ? 'Devise d’affichage sélectionnée' : 'Selected display currency'}</span></div>
      </section>
      <section className="statement-register">
        <h2>{fr ? 'Mouvements du compte' : 'Account movements'}</h2>
        <table><thead><tr><th>{fr ? 'Date' : 'Date'}</th><th>{fr ? 'Nature' : 'Type'}</th><th>{fr ? 'Description' : 'Description'}</th><th>{fr ? 'Montant' : 'Amount'}</th></tr></thead>
          <tbody>{data.entries.map((entry: any) => <tr key={entry.id}><td>{dateTime(entry.createdAt)}</td><td>{entry.type.replaceAll('_', ' ')}</td><td>{entry.description}</td><td className={Number(entry.amount) < 0 ? 'negative' : 'positive'}><DisplayMoney value={entry.amount} /></td></tr>)}</tbody>
        </table>
        {!data.entries.length && <p className="statement-empty">{fr ? 'Aucun mouvement enregistré pour ce compte.' : 'No movement is recorded for this account.'}</p>}
      </section>
      <footer className="statement-official-foot">
        <p><ShieldCheck /> {fr ? 'Ce relevé reflète les écritures présentes dans KCS Kitchen à la date d’émission. Le QR contient la référence institutionnelle et les éléments de contrôle du document.' : 'This statement reflects the KCS Kitchen ledger at issuance time. The QR contains the institutional reference and document control elements.'}</p>
        <div className="statement-signatures"><span>{fr ? 'Gestionnaire KCS Kitchen' : 'KCS Kitchen Manager'}</span><span>{fr ? 'Administration / Finance' : 'Administration / Finance'}</span></div>
        <div className="statement-address"><b>Kinshasa Christian School</b><span>Macampagne, Ngaliema · Kinshasa, RDC</span><span>KCS Orbit Ecosystem · KCS Kitchen</span></div>
      </footer>
    </article>
    <div className="official-statement-actions"><button onClick={onClose}>{fr ? 'Fermer' : 'Close'}</button><button className="primary" onClick={() => window.print()}><ReceiptText />{fr ? 'Imprimer / Enregistrer en PDF' : 'Print / Save as PDF'}</button></div>
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

function Reports({ t }: { t: Record<string, string> }) {
  const [periods, setPeriods] = useState<any[]>([])
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const load = () => api<{ periods: any[] }>('/periods').then(result => setPeriods(result.periods))
  useEffect(() => { load() }, [])
  async function downloadCsv() {
    try {
      const base = import.meta.env.VITE_API_URL || '/kitchen/api'
      const response = await fetch(base + '/reports/transactions.csv', { headers: { authorization: 'Bearer ' + getToken() } })
      if (!response.ok) throw new Error('Export failed')
      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'kcs-kitchen-transactions.csv'; anchor.click(); URL.revokeObjectURL(url)
    } catch (err) { setNotice({ type: 'error', message: (err as Error).message }) }
  }
  async function setPeriod(year: number, month: number, status: string) {
    if (status === 'CLOSED' && !confirm('Close this month? Future corrections will require audited adjustments.')) return
    try { await api('/periods/' + year + '/' + month, { method: 'PUT', body: JSON.stringify({ status }) }); load(); setNotice({ type: 'success', message: t.success }) }
    catch (err) { setNotice({ type: 'error', message: (err as Error).message }) }
  }
  const now = new Date()
  return <><section className="report-grid">
    <article className="panel report-card"><ReceiptText /><span className="eyebrow">FINANCE EXPORT</span><h2>Transaction register</h2><p>Auditable export with person, cashier, price, discount, mode and status.</p><button className="primary" onClick={downloadCsv}>Download CSV</button></article>
    <article className="panel report-card"><Wallet /><span className="eyebrow">MONTH END</span><h2>Close accounting period</h2><p>Review and close a period. Confirmed history remains immutable.</p><div className="button-row"><button onClick={() => setPeriod(now.getFullYear(), now.getMonth() + 1, 'REVIEW')}>Mark review</button><button className="warning" onClick={() => setPeriod(now.getFullYear(), now.getMonth() + 1, 'CLOSED')}>Close month</button></div></article>
  </section>
  <section className="panel"><div className="section-heading"><div><span className="eyebrow">PERIOD CONTROL</span><h2>Monthly status</h2></div></div><div className="activity-list">{periods.map(period => <div key={period.id}><Archive /><span><b>{String(period.month).padStart(2, '0')} / {period.year}</b><small>{period.closedAt ? dateTime(period.closedAt) : 'Active workflow'}</small></span><em className={'badge ' + (period.status === 'CLOSED' ? 'good' : '')}>{period.status}</em></div>)}</div>{!periods.length && <Empty text={t.noData} />}</section>
  {notice && <Notice {...notice} onClose={() => setNotice(null)} />}</>
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

function Loading() { return <div className="loading"><ChefHat /><span>Secure Kitchen data loading…</span></div> }
function Empty({ text }: { text: string }) { return <div className="empty"><ChefHat /><span>{text}</span></div> }

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(Boolean(getToken()))
  useEffect(() => {
    if (!getToken()) return setChecking(false)
    api<{ user: User }>('/me').then(result => setUser(result.user)).catch(() => setToken(null)).finally(() => setChecking(false))
  }, [])
  if (checking) return <Loading />
  if (!user) return <Login onLogin={setUser} />
  return <Shell user={user} onLogout={() => { setToken(null); setUser(null) }} />
}
