import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { MessageCircle, X, Send, Bot, User, Globe, Minimize2, Loader2 } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { aiAPI } from '@/services/api'
import type { ChatMessage } from '@/types'

const generateId = () => Math.random().toString(36).substring(2, 9)

const WELCOME_MESSAGES: Record<string, string> = {
  en: "Hello! I'm the KCS AI Assistant. I can help you with:\n• Admissions information\n• Academic programs\n• School schedules & events\n• General inquiries\n\nHow can I assist you today?",
  fr: "Bonjour ! Je suis l'Assistant IA de KCS. Je peux vous aider avec :\n• Informations sur les admissions\n• Programmes académiques\n• Horaires et événements scolaires\n• Renseignements généraux\n\nComment puis-je vous aider aujourd'hui ?",
}

const AIChat = () => {
  const { t } = useTranslation()
  const { chatOpen, toggleChat, language } = useUIStore()
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [chatLanguage, setChatLanguage] = useState<'en' | 'fr'>(language as 'en' | 'fr')
  const [minimized, setMinimized] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: generateId(),
          role: 'assistant',
          content: WELCOME_MESSAGES[chatLanguage] || WELCOME_MESSAGES.en,
          timestamp: new Date().toISOString(),
        },
      ])
    }
  }, [chatLanguage])

  useEffect(() => {
    if (chatOpen && !minimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [messages, chatOpen, minimized])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const recentMessages = [...messages.slice(-6), userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const response = await aiAPI.chat(recentMessages, chatLanguage)
      const assistantContent = response.data?.data?.message || 
        (chatLanguage === 'fr' 
          ? "Je suis désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer."
          : "I'm sorry, I couldn't process your request. Please try again.")

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      // Fallback response when API is unavailable
      const fallbackResponse = getFallbackResponse(input.trim(), chatLanguage)
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: fallbackResponse,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const getFallbackResponse = (question: string, lang: string): string => {
    const q = question.toLowerCase()
    
    if (lang === 'fr') {
      if (q.includes('admission') || q.includes('inscrip')) {
        return "Pour les admissions à KCS, vous pouvez:\n• Soumettre une demande en ligne via notre page Admissions\n• Appeler le +243 895 326 011\n• Envoyer un email à kinshasachristianschool@gmail.com\n\nPréparez le certificat de naissance, les relevés scolaires et la classe demandée."
      }
      if (q.includes('frais') || q.includes('coût') || q.includes('prix')) {
        return "Pour obtenir des informations sur les frais de scolarité, veuillez contacter l'école:\n• Email: kinshasachristianschool@gmail.com\n• Téléphone: +243 895 326 011"
      }
      return "Merci pour votre question ! Pour une assistance personnalisée, veuillez:\n• Visiter notre page Contact\n• Appeler le +243 895 326 011\n• Email: kinshasachristianschool@gmail.com\n• Adresse: Avenue de la Republique n° 1, Macampagne, Ngaliema, Kinshasa."
    }

    if (q.includes('admission') || q.includes('apply') || q.includes('enroll')) {
      return "To apply to KCS:\n• Complete the online registration form\n• Submit required documents, including birth certificate and previous transcript\n• Add the requested class and parent contact information\n\nContact: kinshasachristianschool@gmail.com | +243 895 326 011"
    }
    if (q.includes('tuition') || q.includes('fees') || q.includes('cost')) {
      return "For tuition and fee information, please contact the school:\n• Email: kinshasachristianschool@gmail.com\n• Phone: +243 895 326 011"
    }
    if (q.includes('program') || q.includes('curriculum') || q.includes('grade')) {
      return "KCS offers:\n• Kindergarten K1-K5: faith, readiness, and early learning\n• Elementary Grade 1-Grade 5: strong academic foundations and spiritual growth\n• Middle School Grade 6-Grade 8: academic growth, biblical principles, and character\n• High School Grade 9-Grade 12: rigorous academics and Christ-centered leadership preparation."
    }
    return "Thank you for reaching out! For personalized assistance:\n• Visit our Contact page\n• Call: +243 895 326 011\n• Email: kinshasachristianschool@gmail.com\n• Address: Avenue de la Republique n° 1, Macampagne, Ngaliema, Kinshasa."
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const quickQuestions = chatLanguage === 'fr' 
    ? ['Comment postuler ?', 'Quels programmes ?', 'Horaires ?', 'Contact']
    : ['How to apply?', 'What programs?', 'School schedule?', 'Contact info']

  return (
    <>
      {/* Chat Toggle Button */}
      <AnimatePresence>
        {!chatOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={toggleChat}
            className="fixed bottom-6 right-6 w-14 h-14 kcs-gradient rounded-2xl shadow-kcs-lg flex items-center justify-center text-white hover:shadow-kcs transition-all duration-300 hover:scale-110 z-50"
            aria-label="Open AI Chat"
          >
            <MessageCircle size={24} />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-kcs-gold-400 rounded-full animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              height: minimized ? 'auto' : 520
            }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-6 right-6 w-[360px] bg-white dark:bg-kcs-blue-950 rounded-2xl shadow-kcs-lg border border-gray-100 dark:border-kcs-blue-800 overflow-hidden z-50 flex flex-col"
            style={{ maxHeight: minimized ? undefined : 520 }}
          >
            {/* Header */}
            <div className="kcs-gradient p-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                  <Bot size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">KCS Assistant</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-kcs-blue-200 text-xs">Online • AI Powered</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setChatLanguage(chatLanguage === 'en' ? 'fr' : 'en')}
                  className="w-7 h-7 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center text-white text-xs font-bold transition-colors"
                  title="Toggle Language"
                >
                  {chatLanguage.toUpperCase()}
                </button>
                <button
                  onClick={() => setMinimized(!minimized)}
                  className="w-7 h-7 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center text-white transition-colors"
                >
                  <Minimize2 size={14} />
                </button>
                <button
                  onClick={toggleChat}
                  className="w-7 h-7 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-2.5 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          message.role === 'user'
                            ? 'bg-kcs-blue-600 text-white'
                            : 'bg-kcs-blue-100 dark:bg-kcs-blue-800 text-kcs-blue-600 dark:text-kcs-blue-300'
                        }`}
                      >
                        {message.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                      </div>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          message.role === 'user'
                            ? 'bg-kcs-blue-600 text-white rounded-tr-sm'
                            : 'bg-gray-100 dark:bg-kcs-blue-800/50 text-gray-800 dark:text-gray-200 rounded-tl-sm'
                        }`}
                        style={{ whiteSpace: 'pre-line' }}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-kcs-blue-100 dark:bg-kcs-blue-800 flex items-center justify-center flex-shrink-0">
                        <Bot size={14} className="text-kcs-blue-600 dark:text-kcs-blue-300" />
                      </div>
                      <div className="bg-gray-100 dark:bg-kcs-blue-800/50 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-kcs-blue-600 dark:text-kcs-blue-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {chatLanguage === 'fr' ? 'En train de réfléchir...' : 'Thinking...'}
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Questions */}
                {messages.length <= 1 && (
                  <div className="px-4 pb-2 flex flex-wrap gap-2">
                    {quickQuestions.map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          setInput(q)
                          inputRef.current?.focus()
                        }}
                        className="text-xs px-3 py-1.5 bg-kcs-blue-50 dark:bg-kcs-blue-900/30 text-kcs-blue-700 dark:text-kcs-blue-300 rounded-full hover:bg-kcs-blue-100 dark:hover:bg-kcs-blue-800/50 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <div className="p-3 border-t border-gray-100 dark:border-kcs-blue-800 flex items-center gap-2">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={chatLanguage === 'fr' ? 'Posez une question...' : 'Ask a question...'}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-kcs-blue-900/50 border border-gray-200 dark:border-kcs-blue-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-kcs-blue-500 focus:border-transparent"
                    disabled={isLoading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading}
                    className="w-10 h-10 rounded-xl kcs-gradient flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-kcs hover:scale-105 active:scale-95 flex-shrink-0"
                  >
                    {isLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
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
