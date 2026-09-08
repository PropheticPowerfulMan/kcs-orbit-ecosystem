import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { MessageCircle, Plus, RefreshCw, Search, Send, ShieldCheck, Users } from 'lucide-react'
import PortalSidebar from '@/components/layout/PortalSidebar'
import { forumAPI } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'

const fullName = (person: any) => [person?.lastName, person?.middleName, person?.firstName].filter(Boolean).join(' ') || 'KCS'
const categories = ['Academics','Transport','Safety','Communication','Events']

export default function ParentForumPage() {
  const user = useAuthStore((state) => state.user)
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const [posts, setPosts] = useState<any[]>([])
  const [draft, setDraft] = useState({ title: '', category: 'Academics', content: '' })
  const [comments, setComments] = useState<Record<string,string>>({})
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try { const response = await forumAPI.getPosts(); setPosts(response.data?.data ?? []) }
    catch (reason: any) { setError(reason?.response?.data?.message ?? tr('Impossible de charger le forum.','Unable to load the forum.')) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const visible = useMemo(() => posts.filter((post) => {
    const text = [post.title,post.content,post.category,fullName(post.author)].join(' ').toLowerCase()
    return (category === 'ALL' || post.category === category) && (!query.trim() || text.includes(query.trim().toLowerCase()))
  }), [posts,query,category])

  const createPost = async (event: FormEvent) => {
    event.preventDefault()
    if (draft.title.trim().length < 4 || draft.content.trim().length < 8) return
    setBusy('create'); setError('')
    try { await forumAPI.createPost(draft); setDraft({ title:'',category:'Academics',content:'' }); await load() }
    catch (reason: any) { setError(reason?.response?.data?.message ?? tr('Publication impossible.','Unable to publish.')) }
    finally { setBusy('') }
  }

  const addComment = async (postId: string) => {
    const content = comments[postId]?.trim()
    if (!content) return
    setBusy(postId); setError('')
    try { await forumAPI.addComment(postId,{content}); setComments((current) => ({...current,[postId]:''})); await load() }
    catch (reason: any) { setError(reason?.response?.data?.message ?? tr('Réponse impossible.','Unable to reply.')) }
    finally { setBusy('') }
  }

  return <div className="portal-shell flex min-h-screen bg-slate-50 dark:bg-kcs-blue-950">
    <PortalSidebar/>
    <main className="min-w-0 flex-1 p-4 pt-24 sm:p-6 sm:pt-24 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm dark:bg-kcs-blue-900 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-bold uppercase text-cyan-700 dark:text-cyan-300">{user?.role === 'admin' ? tr('Vue de modération Superadmin','Superadmin moderation view') : tr('Espace familial vérifié','Verified family space')}</p><h1 className="mt-1 text-2xl font-bold text-kcs-blue-950 dark:text-white">{tr('Forum des parents','Parent Forum')}</h1><p className="text-sm text-gray-500 dark:text-gray-300">{tr('Toutes les discussions ci-dessous proviennent de la base Nexus.','Every discussion below comes from the Nexus database.')}</p></div>
          <button onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-bold text-white"><RefreshCw size={16} className={loading?'animate-spin':''}/>{tr('Actualiser','Refresh')}</button>
        </header>

        <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
          <aside className="space-y-4">
            <form onSubmit={createPost} className="rounded-2xl bg-white p-5 shadow-sm dark:bg-kcs-blue-900">
              <h2 className="flex items-center gap-2 font-bold text-kcs-blue-950 dark:text-white"><Plus size={18}/>{tr('Nouvelle discussion','New discussion')}</h2>
              <input className="input-kcs mt-4" value={draft.title} onChange={(e)=>setDraft({...draft,title:e.target.value})} placeholder={tr('Titre de la discussion','Discussion title')}/>
              <select className="input-kcs mt-3" value={draft.category} onChange={(e)=>setDraft({...draft,category:e.target.value})}>{categories.map((item)=><option key={item}>{item}</option>)}</select>
              <textarea className="input-kcs mt-3 min-h-32" value={draft.content} onChange={(e)=>setDraft({...draft,content:e.target.value})} placeholder={tr('Question, idée ou préoccupation','Question, idea or concern')}/>
              <button disabled={busy==='create'} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 font-bold text-white disabled:opacity-50"><Send size={16}/>{tr('Publier','Publish')}</button>
            </form>
            <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-kcs-blue-900"><div className="relative"><Search className="absolute left-3 top-3 text-gray-400" size={17}/><input className="input-kcs pl-10" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={tr('Titre, auteur, contenu…','Title, author, content…')}/></div><select className="input-kcs mt-3" value={category} onChange={(e)=>setCategory(e.target.value)}><option value="ALL">{tr('Toutes les catégories','All categories')}</option>{categories.map((item)=><option key={item}>{item}</option>)}</select><p className="mt-3 text-xs text-gray-500 dark:text-gray-300">{visible.length} / {posts.length} {tr('discussion(s)','discussion(s)')}</p></div>
          </aside>

          <section className="space-y-4">
            {error && <p className="rounded-xl bg-red-50 p-4 text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
            {!loading && !visible.length && <div className="rounded-2xl bg-white p-8 text-center dark:bg-kcs-blue-900"><Users className="mx-auto text-cyan-600"/><p className="mt-3 font-bold text-kcs-blue-950 dark:text-white">{tr('Aucune discussion réelle ne correspond.','No verified discussion matches.')}</p></div>}
            {visible.map((post)=><article key={post.id} className="rounded-2xl bg-white p-5 shadow-sm dark:bg-kcs-blue-900">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold text-cyan-700 dark:text-cyan-300">{post.category}</p><h2 className="text-lg font-bold text-kcs-blue-950 dark:text-white">{post.title}</h2><p className="text-xs text-gray-400">{fullName(post.author)} · {new Date(post.createdAt).toLocaleString(language==='fr'?'fr-FR':'en-US')}</p></div><span className={post.priority==='urgent'?'rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700':'rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700'}>{post.priority}</span></div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-200">{post.content}</p>
              <div className="mt-4 flex gap-4 text-xs text-gray-500 dark:text-gray-300"><span className="flex items-center gap-1"><MessageCircle size={14}/>{post.comments?.length??0}</span><span className="flex items-center gap-1"><ShieldCheck size={14}/>{post.sentiment}</span></div>
              <div className="mt-4 space-y-2">{post.comments?.map((comment:any)=><div key={comment.id} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-kcs-blue-950"><b className="text-kcs-blue-950 dark:text-white">{fullName(comment.author)}: </b><span className="text-gray-700 dark:text-gray-200">{comment.content}</span></div>)}</div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input className="input-kcs" value={comments[post.id]??''} onChange={(e)=>setComments({...comments,[post.id]:e.target.value})} placeholder={tr('Répondre à cette discussion','Reply to this discussion')}/><button disabled={busy===post.id} onClick={()=>void addComment(post.id)} className="inline-flex items-center justify-center rounded-xl bg-kcs-blue-700 px-5 py-3 text-white disabled:opacity-50"><Send size={16}/></button></div>
            </article>)}
          </section>
        </div>
      </div>
    </main>
  </div>
}
