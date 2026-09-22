import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertTriangle, Archive, BarChart3, ChefHat, ClipboardList, CreditCard, Languages,
  LayoutDashboard, LogOut, Menu, Package, Plus, ReceiptText, ScanLine, Search,
  ShieldCheck, ShoppingCart, Sun, Moon, Users, Wallet, X
} from 'lucide-react'
import { api, dateTime, getToken, money, setToken } from './api'
import type { Person, Product, Role, Transaction, User } from './types'

type Lang = 'fr' | 'en'
type Page = 'dashboard' | 'pos' | 'catalog' | 'transactions' | 'ledger' | 'inventory' | 'disputes' | 'reports' | 'access'

const text = {
  fr: {
    signIn: 'Connexion institutionnelle', identifier: 'E-mail ou code institutionnel', password: 'Mot de passe',
    enter: 'Entrer dans KCS Kitchen', trace: 'Chaque consommation. Chaque franc. Une preuve.',
    powered: 'Propulsé par KCS Orbit', dashboard: 'Tableau de bord', pos: 'Point de vente', catalog: 'Catalogue',
    transactions: 'Transactions', ledger: 'Mon relevé', inventory: 'Stock', disputes: 'Contestations',
    reports: 'Rapports', access: 'Accès et crédit', logout: 'Déconnexion', today: 'Aujourd’hui',
    outstanding: 'Solde à recouvrer', sales: 'Ventes', credit: 'Crédit émis', payments: 'Paiements',
    discounts: 'Réductions', openDisputes: 'Contestations ouvertes', lowStock: 'Stock faible',
    identify: 'Identifier la personne', searchPerson: 'Nom, matricule, e-mail, téléphone…',
    chooseItems: 'Choisir les articles', basket: 'Panier', confirmSale: 'Confirmer la transaction',
    payNow: 'Payer maintenant', onCredit: 'À crédit', total: 'Total', noData: 'Aucune donnée pour le moment.',
    addProduct: 'Ajouter un produit', save: 'Enregistrer', available: 'Disponible', price: 'Prix',
    quantity: 'Quantité', history: 'Historique vérifiable', receipt: 'Reçu', print: 'Imprimer / PDF',
    close: 'Fermer', search: 'Rechercher', role: 'Rôle', active: 'Actif', creditAllowed: 'Crédit autorisé',
    success: 'Opération réussie', error: 'L’opération a échoué', refresh: 'Actualiser'
  },
  en: {
    signIn: 'Institutional sign in', identifier: 'Email or institutional code', password: 'Password',
    enter: 'Enter KCS Kitchen', trace: 'Every consumption. Every franc. One proof.',
    powered: 'Powered by KCS Orbit', dashboard: 'Dashboard', pos: 'Point of sale', catalog: 'Catalog',
    transactions: 'Transactions', ledger: 'My statement', inventory: 'Inventory', disputes: 'Disputes',
    reports: 'Reports', access: 'Access and credit', logout: 'Sign out', today: 'Today',
    outstanding: 'Outstanding balance', sales: 'Sales', credit: 'Credit issued', payments: 'Payments',
    discounts: 'Discounts', openDisputes: 'Open disputes', lowStock: 'Low stock',
    identify: 'Identify person', searchPerson: 'Name, ID, email, phone…',
    chooseItems: 'Choose items', basket: 'Basket', confirmSale: 'Confirm transaction',
    payNow: 'Pay now', onCredit: 'Credit', total: 'Total', noData: 'No data yet.',
    addProduct: 'Add product', save: 'Save', available: 'Available', price: 'Price',
    quantity: 'Quantity', history: 'Verifiable history', receipt: 'Receipt', print: 'Print / PDF',
    close: 'Close', search: 'Search', role: 'Role', active: 'Active', creditAllowed: 'Credit enabled',
    success: 'Operation completed', error: 'Operation failed', refresh: 'Refresh'
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
        <label>{t.password}<input name="password" type="password" autoComplete="current-password" required /></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary large" disabled={loading}>{loading ? '…' : t.enter}</button>
      </form>
      <small>🔒 Orbit identity · Encrypted session · Audited access</small>
    </section>
  </main>
}

const privileged: Role[] = ['KITCHEN_ADMIN', 'CASHIER', 'FINANCE', 'AUDITOR']

function Shell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { lang, setLang, t } = useLanguage()
  const [page, setPage] = useState<Page>('dashboard')
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('kcs-kitchen-theme') === 'dark')
  useEffect(() => { document.body.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('kcs-kitchen-theme', dark ? 'dark' : 'light') }, [dark])
  const isPrivileged = privileged.includes(user.role)
  const nav: Array<[Page, string, ReactNode, boolean]> = [
    ['dashboard', t.dashboard, <LayoutDashboard />, true],
    ['pos', t.pos, <ShoppingCart />, ['KITCHEN_ADMIN', 'CASHIER', 'FINANCE'].includes(user.role)],
    ['catalog', t.catalog, <ChefHat />, isPrivileged],
    ['transactions', t.transactions, <ReceiptText />, true],
    ['ledger', t.ledger, <Wallet />, true],
    ['inventory', t.inventory, <Package />, isPrivileged],
    ['disputes', t.disputes, <AlertTriangle />, true],
    ['reports', t.reports, <BarChart3 />, isPrivileged],
    ['access', t.access, <Users />, user.role === 'KITCHEN_ADMIN']
  ]
  return <div className="app-shell">
    <aside className={open ? 'sidebar open' : 'sidebar'}>
      <div className="sidebar-brand"><img src="./images/kcs-logo.png" /><div><b>KCS KITCHEN</b><small>{t.powered}</small></div><button onClick={() => setOpen(false)}><X /></button></div>
      <div className="identity"><span>{user.fullName.split(' ').map(v => v[0]).slice(0, 2).join('')}</span><div><b>{user.fullName}</b><small>{user.role.replaceAll('_', ' ')}</small></div></div>
      <nav>{nav.filter(item => item[3]).map(item => <button key={item[0]} className={page === item[0] ? 'active' : ''} onClick={() => { setPage(item[0]); setOpen(false) }}>{item[2]}<span>{item[1]}</span></button>)}</nav>
      <div className="sidebar-footer">
        <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}><Languages /> {lang.toUpperCase()}</button>
        <button onClick={() => setDark(!dark)}>{dark ? <Sun /> : <Moon />} {dark ? 'Light' : 'Dark'}</button>
        <button className="danger-text" onClick={onLogout}><LogOut /> {t.logout}</button>
      </div>
    </aside>
    <main className="workspace">
      <header><button className="menu-button" onClick={() => setOpen(true)}><Menu /></button><div><span className="eyebrow">KCS KITCHEN · LIVE STAGING</span><h1>{t[page]}</h1></div><div className="status-pill"><ShieldCheck /> Orbit verified</div></header>
      <div className="page-body">
        {page === 'dashboard' && <Dashboard user={user} t={t} />}
        {page === 'pos' && <PointOfSale t={t} />}
        {page === 'catalog' && <Catalog canEdit={user.role === 'KITCHEN_ADMIN'} t={t} />}
        {page === 'transactions' && <Transactions user={user} t={t} />}
        {page === 'ledger' && <Ledger user={user} t={t} />}
        {page === 'inventory' && <Inventory canEdit={user.role === 'KITCHEN_ADMIN'} t={t} />}
        {page === 'disputes' && <Disputes user={user} t={t} />}
        {page === 'reports' && <Reports t={t} />}
        {page === 'access' && <Access t={t} />}
      </div>
    </main>
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
      <Stat icon={<ShoppingCart />} label={t.today} value={money(data.today._sum.total)} />
      <Stat icon={<ClipboardList />} label="This month" value={money(data.month._sum.total)} />
      <Stat icon={<Wallet />} label={t.outstanding} value={money(data.balance)} tone={Number(data.balance) > 0 ? 'warn' : 'good'} />
      <Stat icon={<AlertTriangle />} label={t.openDisputes} value={data.disputes} />
    </div>
    <section className="panel"><div className="section-heading"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Kitchen notifications</h2></div></div>
      {data.notifications.length ? <div className="activity-list">{data.notifications.map((item: any) => <div key={item.id}><ShieldCheck /><span><b>{item.eventType.replaceAll('_', ' ')}</b><small>{dateTime(item.createdAt)}</small></span></div>)}</div> : <Empty text={t.noData} />}
    </section>
  </>
  return <>
    <section className="hero"><div><span className="eyebrow">SMART CANTEEN CONTROL CENTER</span><h2>Good service starts with perfect traceability.</h2><p>Sales, credit, payments, inventory and disputes in one audited view.</p></div><ChefHat size={70} /></section>
    <div className="stats">
      <Stat icon={<ShoppingCart />} label={t.sales + ' · ' + t.today} value={money(data.today._sum.total)} tone="good" />
      <Stat icon={<CreditCard />} label={t.credit} value={money(data.credit._sum.total)} tone="warn" />
      <Stat icon={<Wallet />} label={t.outstanding} value={money(data.outstanding)} />
      <Stat icon={<ReceiptText />} label={t.payments} value={money(data.payments._sum.amount)} />
      <Stat icon={<AlertTriangle />} label={t.openDisputes} value={data.disputes} tone={data.disputes ? 'warn' : ''} />
      <Stat icon={<Archive />} label={t.lowStock} value={data.lowStock} />
    </div>
    <section className="panel"><div className="section-heading"><div><span className="eyebrow">POPULAR PRODUCTS</span><h2>Top consumption</h2></div></div>
      {data.popular.length ? <div className="rank-list">{data.popular.map((item: any, index: number) => <div key={item.productId}><b>{String(index + 1).padStart(2, '0')}</b><span>{item.productNameSnapshot}</span><strong>{Number(item._sum.quantity || 0)}</strong></div>)}</div> : <Empty text={t.noData} />}
    </section>
  </>
}

function PointOfSale({ t }: { t: Record<string, string> }) {
  const [products, setProducts] = useState<Product[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [query, setQuery] = useState('')
  const [person, setPerson] = useState<Person | null>(null)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [paymentMode, setPaymentMode] = useState('CASH')
  const [receipt, setReceipt] = useState<Transaction | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  useEffect(() => { api<{ products: Product[] }>('/products').then(result => setProducts(result.products)) }, [])
  useEffect(() => {
    if (query.trim().length < 2) return setPeople([])
    const timer = setTimeout(() => api<{ people: Person[] }>('/directory?q=' + encodeURIComponent(query)).then(result => setPeople(result.people)).catch(() => setPeople([])), 250)
    return () => clearTimeout(timer)
  }, [query])
  const total = useMemo(() => products.reduce((sum, product) => sum + Number(product.currentPrice) * (cart[product.id] || 0), 0), [products, cart])
  function add(id: string) { setCart(current => ({ ...current, [id]: (current[id] || 0) + 1 })) }
  function change(id: string, quantity: number) { setCart(current => ({ ...current, [id]: Math.max(0, quantity) })) }
  async function checkout() {
    if (!person || total <= 0) return setNotice({ type: 'error', message: 'Select a person and at least one item.' })
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
      setReceipt(result.transaction); setCart({}); setPeople([]); setQuery(''); setPerson(null)
    } catch (err) { setNotice({ type: 'error', message: (err as Error).message }) }
  }
  return <>
    <section className="pos-grid">
      <div className="panel">
        <div className="step-title"><span>1</span><div><small>IDENTITY</small><h2>{t.identify}</h2></div></div>
        {person ? <div className="selected-person"><div className="avatar">{person.fullName.slice(0, 2).toUpperCase()}</div><div><b>{person.fullName}</b><small>{person.kind} · {person.displayId || person.className || ''}</small></div><button onClick={() => setPerson(null)}><X /></button></div> :
          <div className="search-box"><Search /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t.searchPerson} />
            {people.length > 0 && <div className="search-results">{people.map(item => <button key={item.id} onClick={() => { setPerson(item); setPeople([]); setQuery('') }}><b>{item.fullName}</b><small>{item.kind} · {item.displayId || item.email}</small></button>)}</div>}
          </div>}
        <div className="step-title"><span>2</span><div><small>CATALOG</small><h2>{t.chooseItems}</h2></div></div>
        <div className="product-grid">{products.map(product => <button key={product.id} className="product-tile" onClick={() => add(product.id)} disabled={!product.isAvailable}>
          <span className="product-icon"><ChefHat /></span><b>{product.name}</b><small>{product.category}</small><strong>{money(product.currentPrice, product.currency)}</strong>{cart[product.id] ? <em>{cart[product.id]}</em> : null}
        </button>)}</div>
      </div>
      <aside className="basket panel">
        <div className="step-title"><span>3</span><div><small>CHECKOUT</small><h2>{t.basket}</h2></div></div>
        <div className="basket-lines">{products.filter(product => cart[product.id]).map(product => <div key={product.id}><span><b>{product.name}</b><small>{money(product.currentPrice)}</small></span><div className="qty"><button onClick={() => change(product.id, cart[product.id] - 1)}>−</button><b>{cart[product.id]}</b><button onClick={() => add(product.id)}>+</button></div><strong>{money(Number(product.currentPrice) * cart[product.id])}</strong></div>)}</div>
        {!total && <Empty text={t.noData} />}
        <div className="payment-switch"><button className={paymentMode !== 'CREDIT' ? 'active' : ''} onClick={() => setPaymentMode('CASH')}><Wallet />{t.payNow}</button><button className={paymentMode === 'CREDIT' ? 'active' : ''} onClick={() => setPaymentMode('CREDIT')}><CreditCard />{t.onCredit}</button></div>
        <div className="total-row"><span>{t.total}</span><strong>{money(total)}</strong></div>
        <button className="primary large" onClick={checkout}><ShieldCheck /> {t.confirmSale}</button>
      </aside>
    </section>
    {receipt && <Receipt transaction={receipt} onClose={() => setReceipt(null)} />}
    {notice && <Notice {...notice} onClose={() => setNotice(null)} />}
  </>
}

function Catalog({ canEdit, t }: { canEdit: boolean; t: Record<string, string> }) {
  const [products, setProducts] = useState<Product[]>([])
  const [show, setShow] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const load = () => api<{ products: Product[] }>('/products?all=true').then(result => setProducts(result.products))
  useEffect(() => { load() }, [])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    try {
      await api('/products', { method: 'POST', body: JSON.stringify({
        name: data.get('name'), category: data.get('category'), currentPrice: Number(data.get('price')),
        currency: 'CDF', isAvailable: true, trackInventory: data.get('track') === 'on',
        stockQuantity: Number(data.get('stock') || 0), unit: data.get('unit'), minimumStock: 0, reorderLevel: Number(data.get('reorder') || 0)
      }) })
      setShow(false); load(); setNotice({ type: 'success', message: t.success })
    } catch (err) { setNotice({ type: 'error', message: (err as Error).message }) }
  }
  return <><section className="panel"><div className="section-heading"><div><span className="eyebrow">LIVE CATALOG</span><h2>{t.catalog}</h2></div>{canEdit && <button className="primary" onClick={() => setShow(true)}><Plus />{t.addProduct}</button>}</div>
    <div className="data-table catalog-table"><div className="table-head"><span>Product</span><span>Category</span><span>{t.price}</span><span>Stock</span><span>Status</span></div>
      {products.map(product => <div className="table-row" key={product.id}><span data-label="Product"><b>{product.name}</b><small>{product.description}</small></span><span data-label="Category">{product.category}</span><span data-label={t.price}><b>{money(product.currentPrice, product.currency)}</b></span><span data-label="Stock">{product.trackInventory ? product.stockQuantity + ' ' + product.unit : '—'}</span><span data-label="Status"><em className={product.isAvailable ? 'badge good' : 'badge'}>{product.isAvailable ? t.available : 'Disabled'}</em></span></div>)}
    </div></section>
    {show && <Modal onClose={() => setShow(false)}><form className="modal-form" onSubmit={save}><span className="eyebrow">CATALOG</span><h2>{t.addProduct}</h2><label>Name<input name="name" required /></label><div className="form-grid"><label>Category<select name="category"><option>FOOD</option><option>DRINK</option><option>SNACK</option><option>DESSERT</option><option>OTHER</option></select></label><label>{t.price}<input name="price" type="number" min="0" required /></label><label>Unit<select name="unit"><option>UNIT</option><option>BOTTLE</option><option>CAN</option><option>KG</option><option>LITER</option><option>PORTION</option></select></label><label>Opening stock<input name="stock" type="number" min="0" defaultValue="0" /></label><label>Reorder level<input name="reorder" type="number" min="0" defaultValue="0" /></label></div><label className="check"><input name="track" type="checkbox" /> Track inventory</label><button className="primary large">{t.save}</button></form></Modal>}
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
      {filtered.map(row => <button className="table-row" key={row.id} onClick={() => setSelected(row)}><span data-label="Transaction"><b>{row.transactionNumber}</b></span><span data-label="Date">{dateTime(row.createdAt)}</span><span data-label="Person">{row.personNameSnapshot}</span><span data-label="Mode">{row.paymentMode}</span><span data-label={t.total}><b>{money(row.total)}</b></span><span data-label="Status"><em className={'badge ' + (row.status === 'CONFIRMED' ? 'good' : 'warn')}>{row.status}</em></span></button>)}
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
    <div className="receipt-head"><img src="./images/kcs-logo.png" /><div><span>KINSHASA CHRISTIAN SCHOOL</span><h2>KCS KITCHEN RECEIPT</h2><b>{transaction.transactionNumber}</b></div></div>
    <div className="receipt-meta"><div><small>PERSON</small><b>{transaction.personNameSnapshot}</b></div><div><small>DATE / TIME</small><b>{dateTime(transaction.createdAt)}</b></div><div><small>CASHIER</small><b>{transaction.cashierNameSnapshot}</b></div><div><small>PAYMENT</small><b>{transaction.paymentMode} · {transaction.paymentStatus}</b></div></div>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Subtotal</th></tr></thead><tbody>{transaction.items.map(item => <tr key={item.id}><td>{item.productNameSnapshot}</td><td>{item.quantity}</td><td>{money(item.unitPriceAtPurchase)}</td><td>{money(item.subtotal)}</td></tr>)}</tbody></table>
    <div className="receipt-totals"><span>Subtotal <b>{money(transaction.subtotal)}</b></span><span>Discount <b>− {money(transaction.discount)}</b></span><strong>Total <b>{money(transaction.total)}</b></strong></div>
    <div className="receipt-proof"><ShieldCheck /> Digitally registered, timestamped and auditable. Original transaction records are never silently deleted.</div>
    {message && <div className="form-message">{message}</div>}
    <div className="receipt-actions"><button onClick={() => window.print()}><ReceiptText /> Print / PDF</button>{allowDispute && <button className="warning" onClick={() => setDispute(!dispute)}><AlertTriangle /> Dispute</button>}<button className="primary" onClick={onClose}>Close</button></div>
    {dispute && <form className="dispute-form" onSubmit={sendDispute}><select name="reason"><option value="I_DID_NOT_TAKE_THIS">I did not take this</option><option value="WRONG_ITEM">Wrong item</option><option value="WRONG_QUANTITY">Wrong quantity</option><option value="WRONG_PRICE">Wrong price</option><option value="WRONG_DATE">Wrong date</option><option value="OTHER">Other</option></select><textarea name="comment" placeholder="Explain the issue…" /><button className="warning">Submit dispute</button></form>}
  </div></Modal>
}

function Ledger({ user, t }: { user: User; t: Record<string, string> }) {
  const [data, setData] = useState<any>(null)
  useEffect(() => { api<any>('/ledger/' + encodeURIComponent(user.orbitPersonId)).then(setData) }, [user.orbitPersonId])
  if (!data) return <Loading />
  return <section className="panel statement"><div className="section-heading"><div><span className="eyebrow">KCS KITCHEN LEDGER</span><h2>{user.fullName}</h2><p>Every amount below is linked to an auditable operation.</p></div><button onClick={() => window.print()}><ReceiptText /> {t.print}</button></div>
    <div className="statement-balance"><small>{t.outstanding}</small><strong>{money(data.closingBalance)}</strong></div>
    <div className="data-table ledger-table"><div className="table-head"><span>Date</span><span>Type</span><span>Description</span><span>Amount</span></div>{data.entries.map((entry: any) => <div className="table-row" key={entry.id}><span data-label="Date">{dateTime(entry.createdAt)}</span><span data-label="Type"><em className="badge">{entry.type}</em></span><span data-label="Description">{entry.description}</span><span data-label="Amount" className={Number(entry.amount) < 0 ? 'negative' : 'positive'}><b>{money(entry.amount)}</b></span></div>)}</div>
    {!data.entries.length && <Empty text={t.noData} />}
  </section>
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
