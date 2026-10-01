import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Brain, Camera, Globe2, Heart, Loader2, MessageCircle, Mic, Paperclip, Search, Send, ShieldCheck, Sparkles, Video, X } from 'lucide-react'
import PortalSidebar from '@/components/layout/PortalSidebar'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { getLocalizedGreeting, getLocalizedPortalDate } from '@/utils/portalGreeting'
import { studentForumAPI } from '@/services/api'
import AudioRecorder from '@/components/shared/AudioRecorder'
import ForumMedia from '@/components/shared/ForumMedia'

type StudentForumPost = {
  id: string
  title: string
  category: string
  content: string
  sentiment: string
  priority: string
  author: string
  comments: { id: string; author: string; content: string; attachmentType?: string; attachmentName?: string; hasAttachment?: boolean }[]
  attachmentType?: 'image' | 'video' | 'audio'
  attachmentData?: string
  attachmentName?: string
  hasAttachment?: boolean
  likeCount: number
  likedByMe: boolean
}

const StudentForumPage = () => {
  const { user } = useAuthStore()
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const [posts, setPosts] = useState<StudentForumPost[]>([])
  const [draft, setDraft] = useState({ title: '', category: 'Academics', content: '' })
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [attachment, setAttachment] = useState<{ type: 'image' | 'video' | 'audio' | 'document'; data: string; name: string } | null>(null)
  const [commentAttachments, setCommentAttachments] = useState<Record<string, { type: 'image' | 'video' | 'audio' | 'document'; data: string; name: string } | null>>({})
  const [recordingFor, setRecordingFor] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

  const mapPosts = (records: any[]) => records.map((post: any) => ({ ...post, likeCount: Number(post.likeCount ?? 0), likedByMe: Boolean(post.likedByMe), author: `${post.author?.firstName ?? 'KCS'} ${post.author?.lastName?.[0] ?? ''}.`, comments: (post.comments ?? []).map((comment: any) => ({ ...comment, author: `${comment.author?.firstName ?? 'KCS'} ${comment.author?.lastName?.[0] ?? ''}.` })) }))

  const load = async () => {
    setLoading(true)
    setError('')
    let lastError: any
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await studentForumAPI.getPosts()
        setPosts(mapPosts(Array.isArray(response.data?.data) ? response.data.data : []))
        setLoading(false)
        return
      } catch (reason: any) {
        lastError = reason
        if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)))
      }
    }
    setError(lastError?.response?.data?.message ?? tr('Impossible de charger le forum. Réessayez avec Actualiser.','Unable to load the forum. Try Refresh.'))
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const report = useMemo(() => {
    const urgent = posts.filter((post) => post.priority === 'urgent').length
    const concerned = posts.filter((post) => post.sentiment.includes('concern')).length
    return {
      sentiment: urgent ? 'high concern' : concerned ? 'student support needed' : 'stable',
      summary: `${posts.length} student threads, ${concerned} concern signals, ${urgent} urgent threads.`,
    }
  }, [posts])
  const visiblePosts = useMemo(() => posts.filter((post) => {
    const matchesCategory = categoryFilter === 'ALL' || post.category === categoryFilter
    const searchable = `${post.title} ${post.content} ${post.author} ${post.category}`.toLowerCase()
    return matchesCategory && (!query.trim() || searchable.includes(query.trim().toLowerCase()))
  }), [posts, query, categoryFilter])

  const createPost = async (event: FormEvent) => {
    event.preventDefault()
    const title = draft.title.trim()
    const content = draft.content.trim()
    if (publishing) return
    if (title.length < 4) { setError(tr('Le titre doit contenir au moins 4 caractères.','The title must contain at least 4 characters.')); return }
    if (!content && !attachment) { setError(tr('Ajoutez un message ou une pièce jointe.','Add a message or an attachment.')); return }
    setPublishing(true)
    setError('')
    try {
      const response = await studentForumAPI.createPost({ ...draft, title, content, ...(attachment ? { attachmentType: attachment.type, attachmentData: attachment.data, attachmentName: attachment.name } : {}) })
      const created = response.data.data
      setPosts((current) => [{ ...created, likeCount: 0, likedByMe: false, author: `${user?.firstName ?? 'Student'} ${user?.lastName?.[0] ?? ''}.`.trim(), comments: [] }, ...current])
      setDraft({ title: '', category: 'Academics', content: '' })
      setAttachment(null)
    } catch (reason: any) {
      setError(reason?.response?.data?.message ?? tr('Publication impossible. Réessayez.','Unable to publish. Please try again.'))
    } finally {
      setPublishing(false)
    }
  }

  const addComment = async (postId: string) => {
    const content = commentDrafts[postId] ?? ''
    const media = commentAttachments[postId]
    if (!content.trim() && !media) { setError(tr('Écrivez une réponse ou joignez un média.','Write a reply or attach media.')); return }
    setBusyAction(postId)
    setError('')
    try {
      const response = await studentForumAPI.addComment(postId, { content: content.trim(), ...(media ? { attachmentType: media.type, attachmentData: media.data, attachmentName: media.name } : {}) })
      setPosts((current) => current.map((post) => post.id === postId
        ? { ...post, comments: [...post.comments, { ...response.data.data, author: user?.firstName ?? 'Student' }] }
        : post))
      setCommentDrafts((current) => ({ ...current, [postId]: '' }))
      setCommentAttachments((current) => ({ ...current, [postId]: null }))
      setRecordingFor('')
    } catch (reason: any) {
      setError(reason?.response?.data?.message ?? tr('Réponse impossible. Réessayez.','Unable to reply. Please try again.'))
    } finally {
      setBusyAction('')
    }
  }

  const readMedia = (file: File | undefined, type: 'image' | 'video' | 'audio') => {
    if (!file) return
    if (!file.type.startsWith(type + '/')) { alert('Please select a valid ' + type + ' file.'); return }
    if (file.size > 8_000_000) { alert('Media must be 8 MB or less.'); return }
    const reader = new FileReader()
    reader.onload = () => setAttachment({ type, data: String(reader.result), name: file.name })
    reader.readAsDataURL(file)
  }

  const readAnyMedia = (file: File | undefined, done: (media: { type: 'image' | 'video' | 'audio' | 'document'; data: string; name: string }) => void) => {
    if (!file) return
    if (file.size > 8_000_000) { alert(tr('Le fichier doit faire 8 Mo maximum.','The file must be 8 MB or less.')); return }
    const family = file.type.split('/')[0]
    const type = (['image','video','audio'].includes(family) ? family : 'document') as 'image' | 'video' | 'audio' | 'document'
    const reader = new FileReader(); reader.onload = () => done({ type, data: String(reader.result), name: file.name }); reader.readAsDataURL(file)
  }

  const toggleLike = async (postId: string) => {
    setError('')
    try {
      const response = await studentForumAPI.toggleLike(postId)
      const result = response.data.data
      setPosts((current) => current.map((post) => post.id === postId ? { ...post, likedByMe: Boolean(result.liked), likeCount: Number(result.likeCount) } : post))
    } catch (reason: any) {
      setError(reason?.response?.data?.message ?? tr('Interaction impossible. Réessayez.','Unable to update this interaction.'))
    }
  }

  return (
    <div className="portal-shell flex">
      <PortalSidebar />
      {publishing && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center bg-kcs-blue-950/65 p-4 backdrop-blur-md" role="status" aria-live="polite" aria-label={tr('Publication en cours', 'Publishing in progress')}>
          <motion.div initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-sm overflow-hidden rounded-3xl border border-cyan-300/40 bg-white p-6 text-center shadow-2xl dark:border-cyan-500/30 dark:bg-kcs-blue-900">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-cyan-400/20" />
              <span className="absolute inset-2 animate-pulse rounded-full bg-kcs-blue-100 dark:bg-kcs-blue-800" />
              <Loader2 className="relative animate-spin text-kcs-blue-700 dark:text-cyan-300" size={36} />
            </div>
            <h2 className="mt-4 font-display text-xl font-bold text-kcs-blue-950 dark:text-white">{tr('Publication sécurisée en cours', 'Secure publication in progress')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{tr('Le message et ses médias sont vérifiés puis ajoutés au forum. Merci de patienter.', 'The message and its media are being verified and added to the forum. Please wait.')}</p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-kcs-blue-100 dark:bg-kcs-blue-950">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-kcs-blue-700 via-cyan-400 to-kcs-blue-700" initial={{ x: '-100%', width: '70%' }} animate={{ x: '150%' }} transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }} />
            </div>
          </motion.div>
        </div>
      )}
      <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-kcs-blue-950">
        <div className="portal-dashboard-topbar sticky top-0 z-20 border-b px-4 py-3 backdrop-blur-2xl sm:px-6 sm:py-4">
          <h1 className="portal-dashboard-title font-display text-xl font-bold leading-tight sm:text-2xl">{getLocalizedGreeting(language)}{user?.firstName ? `, ${user.firstName}` : ''}</h1>
          <p className="mt-1 text-sm font-medium text-kcs-blue-700 dark:text-kcs-blue-100">{getLocalizedPortalDate(language)} - {tr('Un espace sécurisé pour échanger, commenter et faire entendre la voix des élèves.', 'A secure space to discuss, comment, and amplify student voice.')}</p>
        </div>

        <div className="grid min-w-0 gap-5 p-3 sm:p-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-kcs-blue-950 via-kcs-blue-900 to-cyan-800 p-5 text-white shadow-xl sm:p-7 xl:col-span-2">
            <div className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 rounded-full bg-cyan-300/15 blur-2xl"/>
            <div className="relative max-w-3xl"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-300"><ShieldCheck size={16}/>{tr('Communauté étudiante KCS','KCS student community')}</p><h2 className="mt-2 font-display text-3xl font-black sm:text-4xl">{tr('Forum des élèves', 'Student Forum')}</h2><p className="mt-2 text-sm leading-6 text-kcs-blue-100">{tr('Un fil social sécurisé pour partager, collaborer et faire entendre la voix des élèves avec une modération bienveillante.', 'A secure social feed to share, collaborate, and amplify student voice with supportive moderation.')}</p></div>
            <div className="relative mt-6 grid max-w-xl grid-cols-3 gap-2 sm:gap-3"><StudentForumMetric value={posts.length} label={tr('Discussions','Discussions')}/><StudentForumMetric value={posts.reduce((sum,post)=>sum+post.comments.length,0)} label={tr('Réponses','Replies')}/><StudentForumMetric value={posts.reduce((sum,post)=>sum+post.likeCount,0)} label={tr('Réactions','Reactions')}/></div>
          </header>
          {error && <div className="xl:col-span-2 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100 sm:flex-row sm:items-center sm:justify-between" role="alert"><span>{error}</span><button type="button" onClick={() => void load()} className="rounded-xl bg-red-700 px-4 py-2 text-white">{tr('Actualiser','Refresh')}</button></div>}
          <div className="space-y-6">
            <form onSubmit={createPost} className="min-w-0 rounded-3xl border border-kcs-blue-100 bg-white p-4 shadow-lg sm:p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/70">
              <div className="mb-5 flex items-center gap-3"><StudentForumAvatar name={`${user?.firstName??''} ${user?.lastName??''}`}/><div><p className="text-xs font-bold text-cyan-700 dark:text-cyan-300">{tr('Publier dans la communauté','Post to the community')}</p><h2 className="font-display text-lg font-black text-kcs-blue-950 dark:text-white">{tr('Lancer une discussion','Start a discussion')}</h2></div></div>
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder={tr('Titre de la discussion','Discussion title')} className="input-kcs mb-3" />
              <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="input-kcs mb-3">
                <option>Academics</option>
                <option>Wellbeing</option>
                <option>Student Life</option>
                <option>Safety</option>
                <option>Clubs</option>
                <option>Events</option>
              </select>
              <textarea value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder={tr('Partage une idée, une question ou une préoccupation…','Share an idea, question, or concern…')} className="input-kcs min-h-32 resize-none rounded-2xl" />
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => readMedia(event.target.files?.[0], 'image')} /><input ref={videoInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(event) => readMedia(event.target.files?.[0], 'video')} /><input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={(event) => readMedia(event.target.files?.[0], 'audio')} />
              <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => imageInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-kcs-blue-700"><Camera size={16}/> Photo</button><button type="button" onClick={() => videoInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-kcs-blue-700"><Video size={16}/> Video</button><button type="button" onClick={() => audioInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-kcs-blue-700"><Mic size={16}/> Audio</button></div>
              {attachment && <div className="mt-3 flex items-center justify-between rounded-xl bg-kcs-blue-50 p-3 text-sm"><span>{attachment.name}</span><button type="button" onClick={() => setAttachment(null)}><X size={16}/></button></div>}
              <AudioRecorder language={language} onRecorded={(file) => readAnyMedia(file, (media) => setAttachment(media))}/>
              <button disabled={publishing} aria-busy={publishing} className="btn-primary relative mt-4 inline-flex w-full items-center justify-center gap-2 overflow-hidden disabled:cursor-wait disabled:opacity-90">
                {publishing && <span className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/25 to-transparent" />}
                <span className="relative inline-flex items-center gap-2">
                  {publishing ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} />}
                  {publishing ? tr('Publication sécurisée…', 'Secure publishing…') : tr('Publier maintenant', 'Post now')}
                </span>
              </button>
            </form>

            <div className="rounded-3xl border border-kcs-blue-100 bg-gradient-to-br from-kcs-blue-50 to-cyan-50 p-5 dark:border-kcs-blue-800 dark:from-kcs-blue-900 dark:to-kcs-blue-950">
              <div className="mb-3 flex items-center gap-2 text-kcs-blue-800 dark:text-kcs-blue-200">
                <Brain size={18} />
                <h2 className="font-bold">{tr('Veille IA de la voix des élèves','AI Student Voice Monitor')}</h2>
              </div>
              <p className="text-sm text-kcs-blue-900 dark:text-kcs-blue-100">{report.summary}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">{tr('Tendance actuelle','Current pulse')}: {report.sentiment}</p>
            </div>
            <div className="rounded-3xl border border-kcs-blue-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900"><div className="mb-3 flex items-center gap-2"><Sparkles size={17} className="text-cyan-600"/><p className="text-sm font-black text-kcs-blue-950 dark:text-white">{tr('Explorer le fil','Explore the feed')}</p></div><div className="relative"><Search className="absolute left-3 top-3 text-gray-400" size={17}/><input value={query} onChange={(event)=>setQuery(event.target.value)} className="input-kcs pl-10" placeholder={tr('Sujet, auteur ou contenu…','Topic, author, or content…')}/></div><select value={categoryFilter} onChange={(event)=>setCategoryFilter(event.target.value)} className="input-kcs mt-3"><option value="ALL">{tr('Toutes les catégories','All categories')}</option>{['Academics','Wellbeing','Student Life','Safety','Clubs','Events'].map((item)=><option key={item}>{item}</option>)}</select></div>
          </div>

          <section className="min-w-0 space-y-4">
            {loading && posts.length === 0 && <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-8 text-center font-semibold text-kcs-blue-800 dark:border-cyan-800 dark:bg-kcs-blue-900 dark:text-cyan-100"><Loader2 className="mx-auto mb-3 animate-spin"/> {tr('Chargement sécurisé du forum…','Secure forum loading…')}</div>}
            {!loading && visiblePosts.length === 0 && <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center text-gray-600 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900 dark:text-gray-300">{tr('Aucune discussion ne correspond à cette recherche.','No discussion matches this search.')}</div>}
            {visiblePosts.map((post, index) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="min-w-0 overflow-hidden rounded-3xl border border-kcs-blue-100 bg-white p-4 shadow-sm transition hover:shadow-lg sm:p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/70"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3"><StudentForumAvatar name={post.author}/><div className="min-w-0"><p className="truncate font-black text-kcs-blue-950 dark:text-white">{post.author}</p><p className="flex items-center gap-1 text-xs text-gray-400"><Globe2 size={12}/>{tr('Visible par la communauté étudiante','Visible to the student community')} · {post.category}</p></div></div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${post.priority === 'urgent' ? 'bg-red-100 text-red-700' : post.priority === 'elevated' ? 'bg-kcs-gold-100 text-kcs-gold-700' : 'bg-green-100 text-green-700'}`}>
                    {post.priority}
                  </span>
                </div>
                <h2 className="mt-4 font-display text-xl font-black text-kcs-blue-950 dark:text-white">{post.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-600 dark:text-gray-300">{post.content}</p>
                <ForumMedia type={post.attachmentType} name={post.attachmentName} hasAttachment={post.hasAttachment} load={() => studentForumAPI.getPostAttachment(post.id)} language={language}/>
                <div className="mt-5 grid grid-cols-3 border-y border-slate-100 py-1 text-xs font-bold text-gray-500 dark:border-kcs-blue-800 dark:text-gray-300">
                  <button type="button" onClick={() => void toggleLike(post.id)} className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl transition hover:bg-slate-50 dark:hover:bg-kcs-blue-950 ${post.likedByMe ? 'font-black text-red-500' : ''}`}><Heart size={16} fill={post.likedByMe ? 'currentColor' : 'none'}/> {post.likeCount} <span className="hidden sm:inline">{tr('J’aime','Like')}</span></button>
                  <span className="flex min-h-10 items-center justify-center gap-1.5"><MessageCircle size={15} /> {post.comments.length} <span className="hidden sm:inline">{tr('Réponses','Replies')}</span></span>
                  <span className="flex min-h-10 items-center justify-center gap-1.5"><ShieldCheck size={15} /> IA: {post.sentiment}</span>
                </div>
                <div className="mt-4 space-y-2">
                  {post.comments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-2.5"><StudentForumAvatar name={comment.author} small/><div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-gray-50 p-3 text-sm dark:bg-kcs-blue-800/30"><span className="font-semibold text-kcs-blue-900 dark:text-white">{comment.author}</span><p className="mt-1 whitespace-pre-wrap text-gray-600 dark:text-gray-300">{comment.content}</p><ForumMedia compact type={comment.attachmentType} name={comment.attachmentName} hasAttachment={comment.hasAttachment} load={() => studentForumAPI.getCommentAttachment(comment.id)} language={language}/></div></div>
                  ))}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input value={commentDrafts[post.id] ?? ''} onChange={(event) => setCommentDrafts({ ...commentDrafts, [post.id]: event.target.value })} placeholder={tr('Répondre à cette discussion','Reply to this discussion')} className="input-kcs" />
                    <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-4 dark:text-white" title={tr('Joindre un média','Attach media')}><Paperclip size={17}/><input type="file" accept="image/*,audio/*,video/*,.pdf,.txt" className="hidden" onChange={(event)=>readAnyMedia(event.target.files?.[0],media=>setCommentAttachments(current=>({...current,[post.id]:media})))}/></label>
                    <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-4 dark:text-white" title={tr('Filmer maintenant','Record video now')}><Video size={17}/><input type="file" accept="video/*" capture="environment" className="hidden" onChange={(event)=>readAnyMedia(event.target.files?.[0],media=>setCommentAttachments(current=>({...current,[post.id]:media})))}/></label>
                    <button type="button" onClick={()=>setRecordingFor(recordingFor===post.id?'':post.id)} className="inline-flex min-h-11 items-center justify-center rounded-xl border px-4 dark:text-white" title={tr('Enregistrer un audio','Record audio')}><Mic size={17}/></button>
                    <button disabled={busyAction===post.id} onClick={() => void addComment(post.id)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-kcs-blue-700 px-4 text-white hover:bg-kcs-blue-800 disabled:opacity-60">{busyAction===post.id?<Loader2 size={16} className="animate-spin"/>:<Send size={16}/>}</button>
                  </div>
                  {commentAttachments[post.id] && <div className="flex items-center justify-between rounded-xl bg-cyan-50 p-3 text-sm dark:bg-kcs-blue-950 dark:text-white"><span className="truncate">{commentAttachments[post.id]?.name}</span><button type="button" onClick={()=>setCommentAttachments(current=>({...current,[post.id]:null}))}><X size={16}/></button></div>}
                  {recordingFor===post.id && <AudioRecorder language={language} onRecorded={(file)=>readAnyMedia(file,media=>setCommentAttachments(current=>({...current,[post.id]:media})))}/>}
                </div>
              </motion.article>
            ))}
          </section>
        </div>
      </main>
    </div>
  )
}

export default StudentForumPage

function StudentForumAvatar({ name, small = false }: { name: string; small?: boolean }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0,2).map((part)=>part[0]).join('').toUpperCase() || 'KCS'
  return <div className={`${small ? 'h-9 w-9 text-[11px]' : 'h-11 w-11 text-xs'} grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-kcs-blue-700 to-cyan-500 font-black text-white shadow-md ring-2 ring-white dark:ring-kcs-blue-800`} title={name}>{initials}</div>
}

function StudentForumMetric({ value, label }: { value: number; label: string }) {
  return <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-center backdrop-blur"><p className="font-display text-xl font-black sm:text-2xl">{value}</p><p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wide text-kcs-blue-100 sm:text-xs">{label}</p></div>
}
