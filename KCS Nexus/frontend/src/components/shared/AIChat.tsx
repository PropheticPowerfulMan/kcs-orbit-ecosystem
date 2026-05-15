import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Send, Bot, User, Minimize2, Loader2 } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { aiAPI } from '@/services/api'
import type { ChatMessage } from '@/types'

const generateId = () => Math.random().toString(36).substring(2, 9)

const SCHOOL_CONTACT = {
  email: 'kinshasachristianschool@gmail.com',
  phone: '+243 895 326 011',
  address: 'Avenue de la Republique No. 1, Macampagne, Ngaliema, Kinshasa',
}

const WELCOME_MESSAGES: Record<string, string> = {
  en: `Hello! I am the KCS visitor assistant. Ask me about admissions, programs, fees, events, location, or KCS Nexus access.`,
  fr: `Bonjour ! Je suis l'assistant KCS pour les visiteurs. Posez-moi vos questions sur les admissions, les programmes, les frais, les evenements, l'adresse ou l'acces a KCS Nexus.`,
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const hasAny = (value: string, keywords: string[]) => keywords.some((keyword) => value.includes(keyword))

const getLocalSchoolResponse = (question: string, lang: 'en' | 'fr'): string => {
  const q = normalize(question)

  if (lang === 'fr') {
    if (hasAny(q, ['admission', 'inscription', 'inscrire', 'postuler'])) {
      return `Pour postuler a KCS:\n- ouvrez la page Admissions et completez le formulaire\n- preparez le certificat de naissance, le bulletin ou releve precedent, la classe souhaitee et les contacts du parent\n- contactez l'ecole au ${SCHOOL_CONTACT.phone} ou a ${SCHOOL_CONTACT.email}\n\nDonnez-moi l'age ou la classe de l'enfant et je vous oriente plus precisement.`
    }
    if (hasAny(q, ['frais', 'cout', 'prix', 'scolarite', 'paiement'])) {
      return `Les frais dependent de la classe et des modalites. Pour le montant officiel et a jour, contactez l'administration:\n- ${SCHOOL_CONTACT.email}\n- ${SCHOOL_CONTACT.phone}`
    }
    if (hasAny(q, ['programme', 'classe', 'maternelle', 'primaire', 'secondaire', 'ap', 'academ'])) {
      return `KCS propose:\n- Kindergarten: K3-K5\n- Elementary: Grade 1-Grade 5\n- Middle School: Grade 6-Grade 8\n- High School: Grade 9-Grade 12\n\nL'ecole combine education chretienne, academics americains, STEAM, leadership, arts, sports et opportunites AP au lycee.`
    }
    if (hasAny(q, ['contact', 'telephone', 'adresse', 'email', 'situe', 'localisation'])) {
      return `Contacts KCS:\n- Adresse: ${SCHOOL_CONTACT.address}\n- Telephone: ${SCHOOL_CONTACT.phone}\n- Email: ${SCHOOL_CONTACT.email}`
    }
    if (hasAny(q, ['horaire', 'calendrier', 'evenement', 'reunion', 'rentree'])) {
      return `Pour les horaires, evenements, reunions et dates importantes, consultez les pages News/Events de Nexus ou contactez l'ecole au ${SCHOOL_CONTACT.phone}.`
    }
    return `Je peux repondre sur les admissions, les programmes, les frais, les evenements, l'adresse, les contacts et l'acces a KCS Nexus.\n\nContact direct: ${SCHOOL_CONTACT.phone} | ${SCHOOL_CONTACT.email}`
  }

  if (hasAny(q, ['admission', 'apply', 'enroll', 'registration'])) {
    return `To apply to KCS:\n- open the Admissions page and complete the form\n- prepare the birth certificate, previous report/transcript, requested grade, and parent contacts\n- call ${SCHOOL_CONTACT.phone} or email ${SCHOOL_CONTACT.email}\n\nTell me the learner age or grade and I can guide you more precisely.`
  }
  if (hasAny(q, ['fee', 'fees', 'tuition', 'cost', 'price', 'payment'])) {
    return `Fees depend on the grade and payment option. For the official current amount, contact administration:\n- ${SCHOOL_CONTACT.email}\n- ${SCHOOL_CONTACT.phone}`
  }
  if (hasAny(q, ['program', 'grade', 'kindergarten', 'elementary', 'middle', 'high', 'ap', 'academic'])) {
    return `KCS offers:\n- Kindergarten: K3-K5\n- Elementary: Grade 1-Grade 5\n- Middle School: Grade 6-Grade 8\n- High School: Grade 9-Grade 12\n\nThe school combines Christian education, American academics, STEAM, leadership, arts, athletics, and AP opportunities in high school.`
  }
  if (hasAny(q, ['contact', 'phone', 'address', 'email', 'where', 'location'])) {
    return `KCS contact details:\n- Address: ${SCHOOL_CONTACT.address}\n- Phone: ${SCHOOL_CONTACT.phone}\n- Email: ${SCHOOL_CONTACT.email}`
  }
  if (hasAny(q, ['schedule', 'calendar', 'event', 'meeting', 'opening'])) {
    return `For schedules, events, meetings, and important dates, check the Nexus News/Events pages or call the school at ${SCHOOL_CONTACT.phone}.`
  }
  return `I can answer questions about admissions, programs, fees, events, location, contacts, and KCS Nexus access.\n\nDirect contact: ${SCHOOL_CONTACT.phone} | ${SCHOOL_CONTACT.email}`
}

const AIChat = () => {
  const { chatOpen, toggleChat, language } = useUIStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [chatLanguage, setChatLanguage] = useState<'en' | 'fr'>(language === 'fr' ? 'fr' : 'en')
  const [minimized, setMinimized] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMessages((current) => {
      if (current.length > 1) return current
      return [
        {
          id: generateId(),
          role: 'assistant',
          content: WELCOME_MESSAGES[chatLanguage],
          timestamp: new Date().toISOString(),
        },
      ]
    })
  }, [chatLanguage])

  useEffect(() => {
    if (chatOpen && !minimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [messages, chatOpen, minimized])

  const sendMessage = async (draft = input) => {
    const cleanInput = draft.trim()
    if (!cleanInput || isLoading) return

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: cleanInput,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const recentMessages = [...messages.slice(-6), userMessage].map((message) => ({
        role: message.role,
        content: message.content,
      }))

      const response = await aiAPI.chat(recentMessages, chatLanguage)
      const assistantContent =
        response.data?.data?.response ||
        response.data?.data?.message ||
        getLocalSchoolResponse(cleanInput, chatLanguage)

      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: assistantContent,
          timestamp: new Date().toISOString(),
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: getLocalSchoolResponse(cleanInput, chatLanguage),
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  const quickQuestions = chatLanguage === 'fr'
    ? ['Comment inscrire mon enfant ?', 'Quels programmes ?', 'Quels frais ?', 'Ou est KCS ?']
    : ['How do I apply?', 'What programs?', 'Tuition fees?', 'Where is KCS?']

  return (
    <>
      <AnimatePresence>
        {!chatOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={toggleChat}
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-kcs-lg transition-all duration-300 hover:scale-110 hover:shadow-kcs kcs-gradient"
            aria-label="Open KCS assistant"
          >
            <MessageCircle size={24} />
            <span className="absolute -right-1 -top-1 h-4 w-4 animate-pulse rounded-full bg-kcs-gold-400" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, height: minimized ? 'auto' : 540 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-6 right-6 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-kcs-lg dark:border-kcs-blue-800 dark:bg-kcs-blue-950"
            style={{ maxHeight: minimized ? undefined : 540 }}
          >
            <div className="flex flex-shrink-0 items-center justify-between p-4 kcs-gradient">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                  <Bot size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">KCS Assistant</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                    <span className="text-xs text-kcs-blue-200">School answers online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setChatLanguage(chatLanguage === 'en' ? 'fr' : 'en')}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-xs font-bold text-white transition-colors hover:bg-white/30"
                  title="Toggle language"
                  type="button"
                >
                  {chatLanguage.toUpperCase()}
                </button>
                <button
                  onClick={() => setMinimized(!minimized)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-white transition-colors hover:bg-white/30"
                  aria-label="Minimize assistant"
                  type="button"
                >
                  <Minimize2 size={14} />
                </button>
                <button
                  onClick={toggleChat}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-white transition-colors hover:bg-white/30"
                  aria-label="Close assistant"
                  type="button"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex gap-2.5 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div
                        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${
                          message.role === 'user'
                            ? 'bg-kcs-blue-600 text-white'
                            : 'bg-kcs-blue-100 text-kcs-blue-600 dark:bg-kcs-blue-800 dark:text-kcs-blue-300'
                        }`}
                      >
                        {message.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                      </div>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          message.role === 'user'
                            ? 'rounded-tr-sm bg-kcs-blue-600 text-white'
                            : 'rounded-tl-sm bg-gray-100 text-gray-800 dark:bg-kcs-blue-800/50 dark:text-gray-200'
                        }`}
                        style={{ whiteSpace: 'pre-line' }}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex gap-2.5">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-kcs-blue-100 dark:bg-kcs-blue-800">
                        <Bot size={14} className="text-kcs-blue-600 dark:text-kcs-blue-300" />
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3 dark:bg-kcs-blue-800/50">
                        <Loader2 size={14} className="animate-spin text-kcs-blue-600 dark:text-kcs-blue-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {chatLanguage === 'fr' ? 'Recherche de la meilleure reponse...' : 'Finding the best answer...'}
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {messages.length <= 1 && (
                  <div className="flex flex-wrap gap-2 px-4 pb-2">
                    {quickQuestions.map((question) => (
                      <button
                        key={question}
                        onClick={() => sendMessage(question)}
                        className="rounded-full bg-kcs-blue-50 px-3 py-1.5 text-xs text-kcs-blue-700 transition-colors hover:bg-kcs-blue-100 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-300 dark:hover:bg-kcs-blue-800/50"
                        type="button"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 border-t border-gray-100 p-3 dark:border-kcs-blue-800">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={chatLanguage === 'fr' ? 'Posez une question...' : 'Ask a question...'}
                    className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-kcs-blue-500 dark:border-kcs-blue-700 dark:bg-kcs-blue-900/50 dark:text-white dark:placeholder-gray-500"
                    disabled={isLoading}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isLoading}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white transition-all duration-200 hover:scale-105 hover:shadow-kcs active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 kcs-gradient"
                    aria-label="Send message"
                    type="button"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default AIChat
