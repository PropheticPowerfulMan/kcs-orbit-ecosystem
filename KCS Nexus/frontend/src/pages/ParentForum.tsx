import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Camera, Globe2, Loader2, MessageCircle, Mic, Paperclip, RefreshCw, Search, Send, ShieldCheck, Sparkles, Users, Video, X } from 'lucide-react'
import PortalSidebar from '@/components/layout/PortalSidebar'
import { forumAPI } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import AudioRecorder from '@/components/shared/AudioRecorder'
import ForumMedia from '@/components/shared/ForumMedia'

const fullName = (person: any) => [person?.lastName, person?.middleName, person?.firstName].filter(Boolean).join(' ') || 'KCS'
const categories = ['Academics','Transport','Safety','Communication','Events']

export default function ParentForumPage() {
  const user = useAuthStore((state) => state.user)
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const [posts, setPosts] = useState<any[]>([])
  const [draft, setDraft] = useState({ title: '', category: 'Academics', content: '' })
  const [comments, setComments] = useState<Record<string,string>>({})
  const [attachment, setAttachment] = useState<any>(null)
  const [commentAttachments, setCommentAttachments] = useState<Record<string,any>>({})
  const [recordingFor, setRecordingFor] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    let lastError: any
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await forumAPI.getPosts()
        setPosts(Array.isArray(response.data?.data) ? response.data.data : [])
        setLoading(false)
        return
      } catch (reason: any) {
        lastError = reason
        if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)))
      }
    }
    setError(lastError?.response?.data?.message ?? lastError?.message ?? tr('Impossible de charger le forum. Réessayez avec Actualiser.','Unable to load the forum. Try Refresh.'))
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  const visible = useMemo(() => posts.filter((post) => {
    const text = [post.title,post.content,post.category,fullName(post.author)].join(' ').toLowerCase()
    return (category === 'ALL' || post.category === category) && (!query.trim() || text.includes(query.trim().toLowerCase()))
  }), [posts,query,category])
  const totalComments = useMemo(() => posts.reduce((sum, post) => sum + (post.comments?.length ?? 0), 0), [posts])
  const urgentCount = useMemo(() => posts.filter((post) => post.priority === 'urgent').length, [posts])

  const createPost = async (event: FormEvent) => {
    event.preventDefault()
    const title = draft.title.trim()
    const content = draft.content.trim()
    if (title.length < 4) { setError(tr('Le titre doit contenir au moins 4 caractères.','The title must contain at least 4 characters.')); return }
    if (!content && !attachment) { setError(tr('Ajoutez un message ou une pièce jointe.','Add a message or an attachment.')); return }
    setBusy('create'); setError('')
    try { await forumAPI.createPost({ ...draft, title, content, ...(attachment ? { attachmentType: attachment.type, attachmentData: attachment.data, attachmentName: attachment.name } : {}) }); setDraft({ title:'',category:'Academics',content:'' }); setAttachment(null); await load() }
    catch (reason: any) { setError(reason?.response?.data?.message ?? tr('Publication impossible.','Unable to publish.')) }
    finally { setBusy('') }
  }

  const addComment = async (postId: string) => {
    const content = comments[postId]?.trim() ?? ''
    const media = commentAttachments[postId]
    if (!content && !media) return
    setBusy(postId); setError('')
    try { await forumAPI.addComment(postId,{content,...(media?{attachmentType:media.type,attachmentData:media.data,attachmentName:media.name}:{})}); setComments((current) => ({...current,[postId]:''})); setCommentAttachments((current)=>({...current,[postId]:null})); setRecordingFor(''); await load() }
    catch (reason: any) { setError(reason?.response?.data?.message ?? tr('Réponse impossible.','Unable to reply.')) }
    finally { setBusy('') }
  }

  const readMedia = (file: File | undefined, done: (media:any)=>void) => {
    if (!file) return
    if (file.size > 8_000_000) { setError(tr('Le fichier doit faire 8 Mo maximum.','The file must be 8 MB or less.')); return }
    const family=file.type.split('/')[0]; const type=['image','video','audio'].includes(family)?family:'document'
    const reader=new FileReader(); reader.onload=()=>done({type,data:String(reader.result),name:file.name}); reader.readAsDataURL(file)
  }

  return <div className="portal-shell flex min-h-screen bg-slate-50 dark:bg-kcs-blue-950">
    <PortalSidebar/>
    <main className="min-w-0 flex-1 p-4 pt-24 sm:p-6 sm:pt-24 lg:p-8">
      <div className="w-full max-w-none space-y-5">
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-kcs-blue-950 via-kcs-blue-900 to-cyan-800 p-5 text-white shadow-xl sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-300/15 blur-2xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-300"><ShieldCheck size={16}/>{user?.role === 'admin' ? tr('Vue de modération Superadmin','Superadmin moderation view') : tr('Communauté familiale vérifiée','Verified family community')}</p><h1 className="mt-2 font-display text-3xl font-black sm:text-4xl">{tr('Forum des parents','Parent Forum')}</h1><p className="mt-2 text-sm leading-6 text-kcs-blue-100">{tr('Un espace moderne, respectueux et sécurisé pour partager les idées, suivre les réponses et renforcer le lien école-famille.','A modern, respectful, and secure space to share ideas, follow responses, and strengthen the school-family partnership.')}</p></div>
            <button onClick={() => void load()} disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-2xl bg-white px-5 py-3 text-sm font-black text-kcs-blue-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-50 disabled:cursor-wait disabled:opacity-70"><RefreshCw size={17} className={loading?'animate-spin':''}/>{tr('Actualiser le fil','Refresh feed')}</button>
          </div>
          <div className="relative mt-6 grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3">
            <ForumMetric value={posts.length} label={tr('Discussions','Discussions')} />
            <ForumMetric value={totalComments} label={tr('Réponses','Replies')} />
            <ForumMetric value={urgentCount} label={tr('À surveiller','Needs review')} />
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <form onSubmit={createPost} className="rounded-3xl border border-kcs-blue-100 bg-white p-5 shadow-lg dark:border-kcs-blue-800 dark:bg-kcs-blue-900">
              <div className="flex items-center gap-3"><ForumAvatar person={user}/><div><p className="text-xs font-bold text-cyan-700 dark:text-cyan-300">{tr('Publier dans la communauté','Post to the community')}</p><h2 className="font-display text-lg font-black text-kcs-blue-950 dark:text-white">{tr('Lancer une discussion','Start a discussion')}</h2></div></div>
              <input className="input-kcs mt-4" value={draft.title} onChange={(e)=>setDraft({...draft,title:e.target.value})} placeholder={tr('Titre de la discussion','Discussion title')}/>
              <select className="input-kcs mt-3" value={draft.category} onChange={(e)=>setDraft({...draft,category:e.target.value})}>{categories.map((item)=><option key={item}>{item}</option>)}</select>
              <textarea className="input-kcs mt-3 min-h-32 resize-none rounded-2xl" value={draft.content} onChange={(e)=>setDraft({...draft,content:e.target.value})} placeholder={tr('Que souhaitez-vous partager avec la communauté KCS ?','What would you like to share with the KCS community?')}/>
              <div className="mt-3 grid grid-cols-3 gap-2">{[['image',Camera,tr('Photo','Photo')],['video',Video,tr('Vidéo','Video')],['audio',Mic,tr('Audio','Audio')]].map(([kind,Icon,label]:any)=><label key={kind} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1 rounded-xl bg-cyan-50 text-xs font-bold text-cyan-800 dark:bg-kcs-blue-950 dark:text-cyan-200"><Icon size={15}/>{label}<input type="file" accept={`${kind}/*`} capture={kind==='video'?'environment':undefined} className="hidden" onChange={(e)=>readMedia(e.target.files?.[0],setAttachment)}/></label>)}</div>
              {attachment&&<div className="mt-2 flex items-center justify-between rounded-xl bg-slate-100 p-3 text-sm dark:bg-kcs-blue-950 dark:text-white"><span className="truncate">{attachment.name}</span><button type="button" onClick={()=>setAttachment(null)}><X size={16}/></button></div>}
              <div className="mt-3"><AudioRecorder language={language} onRecorded={(file)=>readMedia(file,setAttachment)}/></div>
              <button disabled={busy==='create'} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-kcs-blue-700 to-cyan-600 px-4 py-3 font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{busy==='create'?<Loader2 size={17} className="animate-spin"/>:<Send size={17}/>} {busy==='create'?tr('Publication sécurisée…','Secure publishing…'):tr('Publier maintenant','Post now')}</button>
            </form>
            <div className="rounded-3xl border border-kcs-blue-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900"><div className="mb-3 flex items-center gap-2"><Sparkles size={17} className="text-cyan-600"/><p className="text-sm font-black text-kcs-blue-950 dark:text-white">{tr('Explorer les discussions','Explore discussions')}</p></div><div className="relative"><Search className="absolute left-3 top-3 text-gray-400" size={17}/><input className="input-kcs pl-10" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={tr('Titre, auteur, contenu…','Title, author, content…')}/></div><select className="input-kcs mt-3" value={category} onChange={(e)=>setCategory(e.target.value)}><option value="ALL">{tr('Toutes les catégories','All categories')}</option>{categories.map((item)=><option key={item}>{item}</option>)}</select><p className="mt-3 text-xs font-semibold text-gray-500 dark:text-gray-300">{visible.length} / {posts.length} {tr('discussion(s) affichée(s)','discussion(s) shown')}</p></div>
          </aside>

          <section className="space-y-4">
            {error && <p className="rounded-xl bg-red-50 p-4 text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
            {loading && posts.length === 0 && <div className="rounded-3xl border border-kcs-blue-100 bg-white p-6 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900"><div className="flex items-center gap-3"><Loader2 className="animate-spin text-cyan-600"/><div><p className="font-black text-kcs-blue-950 dark:text-white">{tr('Chargement sécurisé du fil…','Secure feed loading…')}</p><p className="text-sm text-gray-500 dark:text-gray-300">{tr('Récupération des discussions et médias','Retrieving discussions and media')}</p></div></div><div className="mt-5 space-y-3"><div className="h-4 w-2/3 animate-pulse rounded-full bg-kcs-blue-100 dark:bg-kcs-blue-800"/><div className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-kcs-blue-950"/></div></div>}
            {!loading && !visible.length && <div className="rounded-2xl bg-white p-8 text-center dark:bg-kcs-blue-900"><Users className="mx-auto text-cyan-600"/><p className="mt-3 font-bold text-kcs-blue-950 dark:text-white">{tr('Aucune discussion réelle ne correspond.','No verified discussion matches.')}</p></div>}
            {visible.map((post,index)=><motion.article key={post.id} initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:Math.min(index*0.035,0.2)}} className="overflow-hidden rounded-3xl border border-kcs-blue-100 bg-white shadow-sm transition hover:shadow-lg dark:border-kcs-blue-800 dark:bg-kcs-blue-900">
              <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><ForumAvatar person={post.author}/><div className="min-w-0"><p className="truncate font-black text-kcs-blue-950 dark:text-white">{fullName(post.author)}</p><p className="flex items-center gap-1 text-xs text-gray-400"><Globe2 size={12}/>{new Date(post.createdAt).toLocaleString(language==='fr'?'fr-FR':'en-US')} · {post.category}</p></div></div><span className={post.priority==='urgent'?'rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700 dark:bg-red-950/50 dark:text-red-200':'rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-200'}>{post.priority==='urgent'?tr('Prioritaire','Priority'):tr('Communauté','Community')}</span></div>
              <h2 className="mt-4 font-display text-xl font-black text-kcs-blue-950 dark:text-white">{post.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-700 dark:text-gray-200">{post.content}</p>
              <ForumMedia type={post.attachmentType} name={post.attachmentName} hasAttachment={post.hasAttachment} load={()=>forumAPI.getPostAttachment(post.id)} language={language}/>
              <div className="mt-5 flex items-center justify-between border-y border-slate-100 py-3 text-xs font-bold text-gray-500 dark:border-kcs-blue-800 dark:text-gray-300"><span className="flex items-center gap-1.5"><MessageCircle size={15}/>{post.comments?.length??0} {tr('réponse(s)','reply/replies')}</span><span className="flex items-center gap-1.5"><ShieldCheck size={15}/>{tr('Modération IA','AI moderation')}: {post.sentiment}</span></div>
              <div className="mt-4 space-y-3">{post.comments?.map((comment:any)=><div key={comment.id} className="flex items-start gap-2.5"><ForumAvatar person={comment.author} small/><div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-slate-50 p-3 text-sm dark:bg-kcs-blue-950"><b className="text-kcs-blue-950 dark:text-white">{fullName(comment.author)}</b><p className="mt-1 whitespace-pre-wrap text-gray-700 dark:text-gray-200">{comment.content}</p><ForumMedia compact type={comment.attachmentType} name={comment.attachmentName} hasAttachment={comment.hasAttachment} load={()=>forumAPI.getCommentAttachment(comment.id)} language={language}/></div></div>)}</div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input className="input-kcs" value={comments[post.id]??''} onChange={(e)=>setComments({...comments,[post.id]:e.target.value})} placeholder={tr('Répondre à cette discussion','Reply to this discussion')}/><label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-4 dark:text-white"><Paperclip size={17}/><input type="file" accept="image/*,audio/*,video/*,.pdf,.txt" className="hidden" onChange={(e)=>readMedia(e.target.files?.[0],media=>setCommentAttachments(current=>({...current,[post.id]:media})))}/></label><label title={tr('Filmer maintenant','Record video now')} className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-4 dark:text-white"><Video size={17}/><input type="file" accept="video/*" capture="environment" className="hidden" onChange={(e)=>readMedia(e.target.files?.[0],media=>setCommentAttachments(current=>({...current,[post.id]:media})))}/></label><button type="button" onClick={()=>setRecordingFor(recordingFor===post.id?'':post.id)} className="inline-flex min-h-11 items-center justify-center rounded-xl border px-4 dark:text-white"><Mic size={17}/></button><button disabled={busy===post.id} onClick={()=>void addComment(post.id)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-kcs-blue-700 px-5 py-3 text-white disabled:opacity-50"><Send size={16}/></button></div>
              {commentAttachments[post.id]&&<div className="mt-2 flex items-center justify-between rounded-xl bg-cyan-50 p-3 text-sm dark:bg-kcs-blue-950 dark:text-white"><span className="truncate">{commentAttachments[post.id].name}</span><button type="button" onClick={()=>setCommentAttachments(current=>({...current,[post.id]:null}))}><X size={16}/></button></div>}
              {recordingFor===post.id&&<div className="mt-2"><AudioRecorder language={language} onRecorded={(file)=>readMedia(file,media=>setCommentAttachments(current=>({...current,[post.id]:media})))}/></div>}
              </div>
            </motion.article>)}
          </section>
        </div>
      </div>
    </main>
  </div>
}

function ForumAvatar({ person, small = false }: { person?: any; small?: boolean }) {
  const label = fullName(person)
  const initials = [person?.firstName?.[0], person?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'KCS'
  const size = small ? 'h-9 w-9 text-[11px]' : 'h-11 w-11 text-xs'
  return <div className={`${size} grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-kcs-blue-700 to-cyan-500 font-black text-white shadow-md ring-2 ring-white dark:ring-kcs-blue-800`} title={label}>{person?.avatar ? <img src={person.avatar} alt={label} className="h-full w-full object-cover"/> : initials}</div>
}

function ForumMetric({ value, label }: { value: number; label: string }) {
  return <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-center backdrop-blur"><p className="font-display text-xl font-black sm:text-2xl">{value}</p><p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wide text-kcs-blue-100 sm:text-xs">{label}</p></div>
}
