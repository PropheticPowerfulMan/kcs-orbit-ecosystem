import { useEffect, useState, type FormEvent } from 'react'
import { CalendarDays, CheckCircle2, ChefHat, Clock3, Edit3, History, LoaderCircle, RotateCcw, Trash2 } from 'lucide-react'
import { api } from './api'
import type { Product } from './types'
import { DisplayMoney } from './ExchangeRate'

type Menu = {
  id: string
  menuDate: string
  title: string
  description?: string | null
  status: string
  createdBy: string
  createdAt: string
  updatedAt: string
  items: Array<{ product: Product; unitPrice: string; currency: string }>
  _count?: { transactions: number }
}
type AuditEntry = { id: string; action: string; actorId: string; actorRole: string; createdAt: string; reason?: string | null }
type DeletedMenuAudit = AuditEntry & { entityId: string; oldValue?: Partial<Menu> | null }
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kinshasa', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const dateKey = (value: string) => new Date(value).toISOString().slice(0, 10)

function AuditTrail({ logs, fr }: { logs: AuditEntry[]; fr: boolean }) {
  return <div className="menu-audit"><b><Clock3 />{fr ? 'Piste d’audit' : 'Audit trail'}</b>{logs.length
    ? logs.map(log => <p key={log.id}><strong>{log.action.replaceAll('_', ' ')}</strong><span>{new Date(log.createdAt).toLocaleString()} · {log.actorRole}</span>{log.reason && <small>{log.reason}</small>}</p>)
    : <small>{fr ? 'Aucune trace disponible.' : 'No audit entry available.'}</small>}</div>
}

export default function DailyMenus({ lang }: { lang: 'fr' | 'en' }) {
  const fr = lang === 'fr'
  const [products, setProducts] = useState<Product[]>([])
  const [menus, setMenus] = useState<Menu[]>([])
  const [deletedMenus, setDeletedMenus] = useState<DeletedMenuAudit[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [date, setDate] = useState(today())
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [publish, setPublish] = useState(true)
  const [editingId, setEditingId] = useState('')
  const [auditMenuId, setAuditMenuId] = useState('')
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function load() {
    const [productResult, menuResult] = await Promise.all([
      api<{ products: Product[] }>('/products'),
      api<{ menus: Menu[]; deletedMenus: DeletedMenuAudit[] }>('/daily-menus'),
    ])
    setProducts(productResult.products.filter(product => product.isAvailable))
    setMenus(menuResult.menus)
    setDeletedMenus(menuResult.deletedMenus || [])
  }

  useEffect(() => { void load().catch(error => setMessage(error.message)) }, [])

  function resetEditor() {
    setEditingId('')
    setDate(today())
    setTitle('')
    setDescription('')
    setSelected([])
    setPublish(true)
  }

  function edit(menu: Menu) {
    if ((menu._count?.transactions || 0) > 0) {
      setMessage(fr ? 'Ce menu possède déjà des ventes : il reste consultable et traçable, mais il est verrouillé.' : 'This menu already has sales: it remains visible and traceable, but is locked.')
      return
    }
    const activeProductIds = new Set(products.map(product => product.id))
    const menuProductIds = menu.items.map(item => item.product.id)
    const selectableProductIds = menuProductIds.filter(id => activeProductIds.has(id))
    const unavailableCount = menuProductIds.length - selectableProductIds.length
    setEditingId(menu.id)
    setDate(dateKey(menu.menuDate))
    setTitle(menu.title)
    setDescription(menu.description || '')
    setSelected(selectableProductIds)
    setPublish(menu.status === 'PUBLISHED')
    setMessage(unavailableCount > 0
      ? (fr ? unavailableCount + ' ancien(s) produit(s) indisponible(s) ont été retiré(s) de l’éditeur. Choisissez au moins un produit actif avant d’enregistrer.' : unavailableCount + ' unavailable historical product(s) were removed from the editor. Select at least one active product before saving.')
      : '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function toggle(id: string) { setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]) }

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const payload = JSON.stringify({ date, title, description: description || null, productIds: selected, publish })
      await api(editingId ? `/daily-menus/${editingId}` : '/daily-menus', { method: editingId ? 'PUT' : 'POST', body: payload })
      await load()
      setMessage(editingId ? (fr ? 'Menu modifié et inscrit dans l’historique.' : 'Menu updated and recorded in the audit history.') : (fr ? 'Menu enregistré et activé.' : 'Menu saved and activated.'))
      resetEditor()
    } catch (error) { setMessage((error as Error).message) }
    finally { setBusy(false) }
  }

  async function history(menuId: string) {
    setAuditMenuId(menuId)
    setAuditLogs([])
    try {
      const result = await api<{ logs: AuditEntry[] }>(`/daily-menus/${menuId}/audit`)
      setAuditLogs(result.logs)
    } catch (error) { setMessage((error as Error).message) }
  }

  async function remove(menu: Menu) {
    if ((menu._count?.transactions || 0) > 0) {
      setMessage(fr ? 'Suppression interdite : ce menu est lié à des ventes et doit rester dans la piste comptable.' : 'Deletion blocked: this menu is linked to sales and must remain in the accounting trail.')
      return
    }
    if (!window.confirm(fr ? `Supprimer définitivement le menu « ${menu.title} » ? Une trace d’audit sera conservée.` : `Permanently delete “${menu.title}”? An audit record will be retained.`)) return
    setBusy(true)
    try {
      await api(`/daily-menus/${menu.id}`, { method: 'DELETE', body: JSON.stringify({ reason: fr ? 'Supprimé depuis le centre de contrôle du menu du jour' : 'Deleted from the Daily Menu control center' }) })
      if (editingId === menu.id) resetEditor()
      await load()
      await history(menu.id)
      setMessage(fr ? 'Menu supprimé ; sa trace d’audit reste consultable ci-dessous.' : 'Menu deleted; its audit trail remains available below.')
    } catch (error) { setMessage((error as Error).message) }
    finally { setBusy(false) }
  }

  return <>
    <section className="hero menu-hero"><div><span className="eyebrow">KCS KITCHEN · DAILY MENU</span><h2>{fr ? 'Le menu pilote chaque vente et chaque dette' : 'The menu governs every sale and every debt'}</h2><p>{fr ? 'Chaque création, modification ou suppression est désormais traçable.' : 'Every creation, update or deletion is now traceable.'}</p></div><CalendarDays size={70} /></section>
    <section className="menu-workspace">
      <form className="panel menu-editor" onSubmit={save}>
        <div className="menu-editor-heading"><div><span className="eyebrow">{editingId ? (fr ? 'MODIFICATION CONTRÔLÉE' : 'CONTROLLED UPDATE') : (fr ? 'NOUVEAU MENU' : 'NEW MENU')}</span><h2>{editingId ? (fr ? 'Modifier le menu' : 'Edit menu') : (fr ? 'Composer le menu' : 'Compose menu')}</h2></div>{editingId && <button type="button" className="secondary compact" onClick={resetEditor}><RotateCcw />{fr ? 'Annuler' : 'Cancel'}</button>}</div>
        <div className="form-grid"><label>{fr ? 'Date de service' : 'Service date'}<input type="date" value={date} onChange={event => setDate(event.target.value)} required /></label><label>{fr ? 'Titre du menu' : 'Menu title'}<input value={title} onChange={event => setTitle(event.target.value)} required minLength={2} /></label></div>
        <label>{fr ? 'Description' : 'Description'}<textarea value={description} onChange={event => setDescription(event.target.value)} /></label>
        <div className="menu-products">{products.map(product => <button type="button" key={product.id} className={selected.includes(product.id) ? 'menu-product selected' : 'menu-product'} onClick={() => toggle(product.id)}>{selected.includes(product.id) ? <CheckCircle2 /> : <ChefHat />}<b>{product.name}</b><small>{product.category}</small><DisplayMoney value={product.currentPrice} currency={product.currency} /></button>)}</div>
        <label className="publish-choice"><input type="checkbox" checked={publish} onChange={event => setPublish(event.target.checked)} /><span>{fr ? 'Publier immédiatement et figer les prix' : 'Publish now and freeze prices'}</span></label>
        {message && <p className="status-message">{message}</p>}
        <button className="primary large" disabled={busy || !selected.length}>{busy ? <LoaderCircle className="spin" /> : <CheckCircle2 />}{editingId ? (fr ? 'Enregistrer les modifications' : 'Save changes') : (fr ? 'Enregistrer le menu' : 'Save menu')}</button>
      </form>
      <aside className="panel menu-history">
        <h2>{fr ? 'Menus récents et traçabilité' : 'Recent menus and audit trail'}</h2>
        {menus.map(menu => {
          const locked = (menu._count?.transactions || 0) > 0
          return <article key={menu.id} className={auditMenuId === menu.id ? 'active' : ''}>
            <CalendarDays /><span><b>{menu.title}</b><small>{new Date(menu.menuDate).toLocaleDateString()} · {menu.items.length} {fr ? 'articles' : 'items'} · {menu._count?.transactions || 0} transactions</small><small>{fr ? 'Mis à jour' : 'Updated'} {new Date(menu.updatedAt).toLocaleString()}</small></span><em className={'badge ' + (menu.status === 'PUBLISHED' ? 'good' : '')}>{menu.status}</em>
            <div className="menu-row-actions"><button type="button" onClick={() => edit(menu)} disabled={locked || busy} title={fr ? 'Modifier' : 'Edit'}><Edit3 /></button><button type="button" onClick={() => void history(menu.id)} title={fr ? 'Historique' : 'History'}><History /></button><button type="button" className="danger" onClick={() => void remove(menu)} disabled={locked || busy} title={fr ? 'Supprimer' : 'Delete'}><Trash2 /></button></div>
            {auditMenuId === menu.id && <AuditTrail logs={auditLogs} fr={fr} />}
          </article>
        })}
        {deletedMenus.length > 0 && <div className="deleted-menu-register"><h3><Trash2 />{fr ? 'Menus supprimés — registre conservé' : 'Deleted menus — retained register'}</h3>{deletedMenus.map(entry => {
          const snapshot = entry.oldValue
          return <article key={entry.id} className={'deleted ' + (auditMenuId === entry.entityId ? 'active' : '')}>
            <Trash2 /><span><b>{snapshot?.title || (fr ? 'Menu supprimé' : 'Deleted menu')}</b><small>{snapshot?.menuDate ? new Date(snapshot.menuDate).toLocaleDateString() : '—'} · {fr ? 'supprimé le' : 'deleted on'} {new Date(entry.createdAt).toLocaleString()}</small><small>{entry.reason || (fr ? 'Suppression administrative auditée' : 'Audited administrative deletion')}</small></span><em className="badge">{fr ? 'SUPPRIMÉ' : 'DELETED'}</em>
            <div className="menu-row-actions"><button type="button" onClick={() => void history(entry.entityId)} title={fr ? 'Consulter toute la piste d’audit' : 'View the complete audit trail'}><History /></button></div>
            {auditMenuId === entry.entityId && <AuditTrail logs={auditLogs} fr={fr} />}
          </article>
        })}</div>}
      </aside>
    </section>
  </>
}
