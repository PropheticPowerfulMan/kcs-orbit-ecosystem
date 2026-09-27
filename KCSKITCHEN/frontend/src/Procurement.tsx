import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Building2, CircleDollarSign, PackagePlus, Plus, ReceiptText, RefreshCw, Truck, X } from 'lucide-react'
import { api, dateTime, money } from './api'
import type { Product, User } from './types'

type Supplier = { id: string; name: string; contactName?: string; phone?: string; email?: string }
type PurchaseItem = { id: string; description: string; quantity: string; unitCost: string; product?: { name: string } | null }
type Purchase = {
  id: string; purchaseNumber: string; invoiceNumber?: string; invoiceDate: string; dueDate?: string;
  currency: string; total: string; paidAmount: string; balance: string; status: string; createdAt: string;
  supplier: Supplier; items: PurchaseItem[]
}
type Line = { productId: string; description: string; quantity: number; unit: string; unitCost: number }

function Modal({ children, close }: { children: ReactNode; close: () => void }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal wide">
    <button className="icon-button modal-close" onClick={close} aria-label="Close"><X /></button>{children}
  </div></div>
}

export default function Procurement({ user, lang }: { user: User; lang: 'fr' | 'en' }) {
  const fr = lang === 'fr'
  const canWrite = ['KITCHEN_ADMIN', 'FINANCE'].includes(user.role)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [debt, setDebt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [payment, setPayment] = useState<Purchase | null>(null)
  const [lines, setLines] = useState<Line[]>([{ productId: '', description: '', quantity: 1, unit: 'UNIT', unitCost: 0 }])

  const load = async () => {
    setLoading(true); setMessage('')
    try {
      const [supplierResult, purchaseResult, productResult] = await Promise.all([
        api<{ suppliers: Supplier[] }>('/suppliers'),
        api<{ purchases: Purchase[]; outstandingSupplierDebt: string }>('/purchases'),
        api<{ products: Product[] }>('/products?all=true')
      ])
      setSuppliers(supplierResult.suppliers); setPurchases(purchaseResult.purchases)
      setDebt(Number(purchaseResult.outstandingSupplierDebt || 0)); setProducts(productResult.products)
    } catch (error) { setMessage((error as Error).message) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const total = useMemo(() => lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitCost || 0), 0), [lines])
  const due = purchases.filter(item => Number(item.balance) > 0)
  const overdue = due.filter(item => item.dueDate && new Date(item.dueDate) < new Date()).length

  const updateLine = (index: number, patch: Partial<Line>) => setLines(current => current.map((line, i) => i === index ? { ...line, ...patch } : line))
  const chooseProduct = (index: number, productId: string) => {
    const product = products.find(item => item.id === productId)
    updateLine(index, { productId, description: product?.name || lines[index].description, unit: product?.unit || 'UNIT' })
  }

  async function createSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    const data = new FormData(event.currentTarget)
    try {
      await api('/suppliers', { method: 'POST', body: JSON.stringify(Object.fromEntries(data)) })
      setSupplierOpen(false); await load(); setMessage(fr ? 'Fournisseur enregistré avec traçabilité.' : 'Supplier saved with full traceability.')
    } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }

  async function createPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    const data = new FormData(event.currentTarget)
    try {
      await api('/purchases', { method: 'POST', body: JSON.stringify({
        supplierId: data.get('supplierId'), invoiceNumber: data.get('invoiceNumber') || null,
        invoiceDate: data.get('invoiceDate'), dueDate: data.get('dueDate') || null,
        currency: data.get('currency'), paidAmount: Number(data.get('paidAmount') || 0),
        paymentMethod: data.get('paymentMethod'), paymentReference: data.get('paymentReference') || null,
        notes: data.get('notes') || null,
        items: lines.map(line => ({ ...line, productId: line.productId || null }))
      }) })
      setPurchaseOpen(false); setLines([{ productId: '', description: '', quantity: 1, unit: 'UNIT', unitCost: 0 }])
      await load(); setMessage(fr ? 'Approvisionnement reçu, stock et dette mis à jour.' : 'Purchase received; inventory and debt updated.')
    } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }

  async function paySupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!payment) return
    setBusy(true); setMessage(''); const data = new FormData(event.currentTarget)
    try {
      await api('/purchases/' + payment.id + '/payments', { method: 'POST', body: JSON.stringify({
        amount: Number(data.get('amount')), method: data.get('method'), reference: data.get('reference') || null, notes: data.get('notes') || null
      }) })
      setPayment(null); await load(); setMessage(fr ? 'Paiement fournisseur enregistré et audité.' : 'Supplier payment recorded and audited.')
    } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }

  return <div className="procurement-page">
    <section className="culinary-hero">
      <div><span className="eyebrow">KCS KITCHEN · PROCUREMENT</span>
        <h2>{fr ? 'Des achats maîtrisés, une cuisine toujours prête.' : 'Controlled purchasing, a kitchen always ready.'}</h2>
        <p>{fr ? 'Fournisseurs, réceptions, stock, factures et dettes dans un registre auditable.' : 'Suppliers, receipts, inventory, invoices and debt in one auditable register.'}</p>
      </div><Truck size={58}/>
    </section>
    <div className="stats procurement-stats">
      <article className="stat-card"><span><Building2/></span><div><small>{fr ? 'Fournisseurs actifs' : 'Active suppliers'}</small><strong>{suppliers.length}</strong></div></article>
      <article className="stat-card"><span><ReceiptText/></span><div><small>{fr ? 'Achats enregistrés' : 'Recorded purchases'}</small><strong>{purchases.length}</strong></div></article>
      <article className="stat-card warn"><span><CircleDollarSign/></span><div><small>{fr ? 'Dette fournisseurs' : 'Supplier debt'}</small><strong>{money(debt)}</strong></div></article>
      <article className="stat-card"><span><PackagePlus/></span><div><small>{fr ? 'Échéances dépassées' : 'Overdue invoices'}</small><strong>{overdue}</strong></div></article>
    </div>
    <section className="panel">
      <div className="section-heading"><div><span className="eyebrow">DAILY MANAGEMENT</span><h2>{fr ? 'Approvisionnements et factures' : 'Purchasing and supplier invoices'}</h2></div>
        <div className="button-row"><button onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'spin' : ''}/>{fr ? 'Actualiser' : 'Refresh'}</button>
          {canWrite && <><button onClick={() => setSupplierOpen(true)}><Plus/>{fr ? 'Fournisseur' : 'Supplier'}</button><button className="primary" onClick={() => setPurchaseOpen(true)}><PackagePlus/>{fr ? 'Nouvel achat' : 'New purchase'}</button></>}
        </div>
      </div>
      {message && <div className="form-message">{message}</div>}
      <div className="data-table procurement-table"><div className="table-head"><span>Reference</span><span>{fr ? 'Fournisseur' : 'Supplier'}</span><span>{fr ? 'Date / échéance' : 'Date / due'}</span><span>Total</span><span>{fr ? 'Solde' : 'Balance'}</span><span>Status</span></div>
        {purchases.map(row => <div className="table-row" key={row.id}><span data-label="Reference"><b>{row.purchaseNumber}</b><small>{row.invoiceNumber || '—'}</small></span><span data-label={fr ? 'Fournisseur' : 'Supplier'}>{row.supplier.name}</span><span data-label={fr ? 'Date / échéance' : 'Date / due'}>{new Date(row.invoiceDate).toLocaleDateString()}<small>{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '—'}</small></span><span data-label="Total"><b>{money(row.total, row.currency)}</b></span><span data-label={fr ? 'Solde' : 'Balance'}><b>{money(row.balance, row.currency)}</b></span><span data-label="Status"><em className={'badge ' + (row.status === 'PAID' ? 'good' : 'warn')}>{row.status}</em>{canWrite && Number(row.balance) > 0 && <button className="mini-action" onClick={() => setPayment(row)}>{fr ? 'Payer' : 'Pay'}</button>}</span></div>)}
      </div>
      {!loading && !purchases.length && <div className="empty"><Truck/><span>{fr ? 'Aucun approvisionnement enregistré.' : 'No purchase recorded yet.'}</span></div>}
    </section>

    {supplierOpen && <Modal close={() => setSupplierOpen(false)}><form className="modal-form" onSubmit={createSupplier}><span className="eyebrow">SUPPLIER DIRECTORY</span><h2>{fr ? 'Nouveau fournisseur' : 'New supplier'}</h2><div className="form-grid"><label>{fr ? 'Nom' : 'Name'}<input name="name" required/></label><label>{fr ? 'Contact' : 'Contact'}<input name="contactName"/></label><label>{fr ? 'Téléphone' : 'Phone'}<input name="phone"/></label><label>Email<input name="email" type="email"/></label></div><label>{fr ? 'Adresse' : 'Address'}<input name="address"/></label><label>NIF / Tax ID<input name="taxId"/></label><button className="primary large" disabled={busy}>{busy ? '…' : fr ? 'Enregistrer' : 'Save'}</button></form></Modal>}

    {purchaseOpen && <Modal close={() => setPurchaseOpen(false)}><form className="modal-form" onSubmit={createPurchase}><span className="eyebrow">AUDITED PURCHASE</span><h2>{fr ? 'Réceptionner un approvisionnement' : 'Receive a purchase'}</h2>
      <div className="form-grid"><label>{fr ? 'Fournisseur' : 'Supplier'}<select name="supplierId" required><option value="">{fr ? 'Choisir…' : 'Choose…'}</option>{suppliers.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>{fr ? 'Facture' : 'Invoice'}<input name="invoiceNumber"/></label><label>{fr ? 'Date facture' : 'Invoice date'}<input name="invoiceDate" type="date" required defaultValue={new Date().toISOString().slice(0,10)}/></label><label>{fr ? 'Échéance' : 'Due date'}<input name="dueDate" type="date"/></label></div>
      <div className="purchase-lines">{lines.map((line,index)=><div className="purchase-line" key={index}><select value={line.productId} onChange={event=>chooseProduct(index,event.target.value)}><option value="">{fr ? 'Article libre' : 'Unlinked item'}</option>{products.map(product=><option value={product.id} key={product.id}>{product.name}</option>)}</select><input value={line.description} onChange={event=>updateLine(index,{description:event.target.value})} placeholder={fr?'Description':'Description'} required/><input type="number" min=".001" step=".001" value={line.quantity} onChange={event=>updateLine(index,{quantity:Number(event.target.value)})}/><input type="number" min="0" value={line.unitCost} onChange={event=>updateLine(index,{unitCost:Number(event.target.value)})}/>{lines.length>1&&<button type="button" onClick={()=>setLines(current=>current.filter((_,i)=>i!==index))}><X/></button>}</div>)}</div>
      <button type="button" onClick={()=>setLines(current=>[...current,{productId:'',description:'',quantity:1,unit:'UNIT',unitCost:0}])}><Plus/>{fr ? 'Ajouter une ligne' : 'Add line'}</button>
      <div className="form-grid"><label>{fr ? 'Devise' : 'Currency'}<select name="currency"><option>CDF</option><option>USD</option></select></label><label>{fr ? 'Déjà payé' : 'Already paid'}<input name="paidAmount" type="number" min="0" max={total} defaultValue="0"/></label><label>{fr ? 'Mode de paiement' : 'Payment method'}<select name="paymentMethod"><option>CASH</option><option>MOBILE_MONEY</option><option>BANK</option><option>EDUPAY</option></select></label><label>{fr ? 'Référence paiement' : 'Payment reference'}<input name="paymentReference"/></label></div>
      <label>Notes<textarea name="notes"/></label><div className="purchase-total"><span>Total</span><strong>{money(total)}</strong></div>
      <button className="primary large" disabled={busy || total<=0}>{busy ? '…' : fr ? 'Réceptionner et mettre à jour le stock' : 'Receive and update inventory'}</button>
    </form></Modal>}

    {payment && <Modal close={() => setPayment(null)}><form className="modal-form" onSubmit={paySupplier}><span className="eyebrow">SUPPLIER PAYMENT</span><h2>{payment.supplier.name}</h2><p>{payment.purchaseNumber} · {fr ? 'solde' : 'balance'} <b>{money(payment.balance,payment.currency)}</b></p><label>{fr ? 'Montant' : 'Amount'}<input name="amount" type="number" min=".01" max={Number(payment.balance)} required/></label><label>{fr ? 'Mode' : 'Method'}<select name="method"><option>CASH</option><option>MOBILE_MONEY</option><option>BANK</option><option>EDUPAY</option></select></label><label>{fr ? 'Référence' : 'Reference'}<input name="reference"/></label><label>Notes<textarea name="notes"/></label><button className="primary large" disabled={busy}>{busy ? '…' : fr ? 'Enregistrer le paiement' : 'Record payment'}</button></form></Modal>}
  </div>
}
