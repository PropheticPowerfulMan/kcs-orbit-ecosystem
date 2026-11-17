import {portalHome} from '@/utils/accountScope'
import {useEffect,useMemo,useState} from 'react'
import {Link,useNavigate} from 'react-router-dom'
import {useForm} from 'react-hook-form'
import {zodResolver} from '@hookform/resolvers/zod'
import {z} from 'zod'
import {ArrowLeft,ArrowRight,BookOpen,Eye,EyeOff,Globe2,GraduationCap,LockKeyhole,Mail,Moon,ShieldCheck,Sun,Users,Loader2} from 'lucide-react'
import {authAPI} from '@/services/api'
import {useAuthStore} from '@/store/authStore'
import {useUIStore} from '@/store/uiStore'
import './signIn.css'

type LoginFormValues={email:string;password:string;twoFactorCode?:string}
export default function LoginPage(){
 const navigate=useNavigate(),{login,user,isAuthenticated,setLoading,isLoading}=useAuthStore()
 const{language,setLanguage,theme,toggleTheme}=useUIStore(),tr=(fr:string,en:string)=>language==='fr'?fr:en
 const[showPassword,setShowPassword]=useState(false),[errorMessage,setErrorMessage]=useState(''),[requiresTwoFactor,setRequiresTwoFactor]=useState(false)
 const[recoveryOpen,setRecoveryOpen]=useState(false),[recoveryEmail,setRecoveryEmail]=useState(''),[recoveryChannel,setRecoveryChannel]=useState<'email'|'sms'>('email')
 const[resetToken,setResetToken]=useState(''),[newPassword,setNewPassword]=useState(''),[recoveryMessage,setRecoveryMessage]=useState(''),[recoveryError,setRecoveryError]=useState('')
 const loginSchema=useMemo(()=>z.object({email:z.string().min(1,language==='fr'?'E-mail ou code d’accès requis':'Email or access code is required'),password:z.string().min(6,language==='fr'?'Le mot de passe doit contenir au moins 6 caractères':'Password must contain at least 6 characters'),twoFactorCode:z.string().regex(/^\d{6}$/,language==='fr'?'Saisissez le code à 6 chiffres':'Enter the 6-digit code').optional()}),[language])
 const form=useForm<LoginFormValues>({resolver:zodResolver(loginSchema),defaultValues:{email:'',password:''}})
 useEffect(()=>{const token=new URLSearchParams(window.location.search).get('resetToken')||'';if(token){setResetToken(token);setRecoveryOpen(true)}},[])
 const loginError=(error:any)=>{
  const message=error?.response?.data?.message
  const known:Record<string,string>={
   'Two-factor authentication code required':tr('Saisissez votre code d’authentification à 6 chiffres.','Enter your 6-digit authentication code.'),
   'Invalid two-factor authentication code':tr('Code d’authentification invalide. Réessayez avec le code actuel.','Invalid authentication code. Try again with the current code.'),
   'Identifiant ou mot de passe incorrect.':tr('Identifiant ou mot de passe incorrect.','Incorrect identifier or password.'),
  }
  if(message)return known[message]||message
  if(error?.code==='ERR_NETWORK'||error?.message==='Network Error')return tr('Connexion indisponible. Vérifiez votre connexion et réessayez.','Connection unavailable. Check your connection and try again.')
  if(error?.code==='ECONNABORTED')return tr('Le service met trop de temps à répondre. Réessayez.','The service is taking too long to respond. Please try again.')
  return error?.message||tr('Identifiant ou mot de passe incorrect.','Incorrect identifier or password.')
 }
 const onSubmit=async(values:LoginFormValues)=>{
  setLoading(true);setErrorMessage('')
  try{const response=await authAPI.login(values.email.trim(),values.password,values.twoFactorCode),data=response.data?.data
   if(!data?.user||!data?.token||!data?.refreshToken)throw new Error(tr('Réponse d’authentification invalide.','Invalid authentication response.'))
   login(data.user,data.token,data.refreshToken);navigate(portalHome({...data.user,role:data.user.role.toLowerCase()}),{replace:true})
  }catch(error:any){if(error?.response?.status===428){setRequiresTwoFactor(true);setErrorMessage(loginError(error))}else setErrorMessage(loginError(error))}finally{setLoading(false)}
 }
 const requestRecovery=async()=>{
  setLoading(true);setRecoveryError('');setRecoveryMessage('')
  try{await authAPI.forgotPassword((recoveryEmail||form.getValues('email')).trim(),recoveryChannel);setRecoveryMessage(recoveryChannel==='sms'?tr('Si ce compte existe, les instructions de récupération ont été envoyées par SMS.','If this account exists, recovery instructions have been sent by SMS.'):tr('Si ce compte existe, les instructions de récupération ont été envoyées par e-mail.','If this account exists, recovery instructions have been sent by email.'))}
  catch(error:any){setRecoveryError(error?.response?.data?.message||tr('Récupération temporairement indisponible.','Recovery is temporarily unavailable.'))}finally{setLoading(false)}
 }
 const completeRecovery=async()=>{
  setLoading(true);setRecoveryError('');setRecoveryMessage('')
  try{await authAPI.resetPassword(resetToken.trim(),newPassword);setRecoveryMessage(tr('Mot de passe réinitialisé. Vous pouvez maintenant vous connecter.','Password reset. You can now sign in.'));setResetToken('');setNewPassword('');window.history.replaceState({},document.title,window.location.pathname)}catch(error:any){setRecoveryError(error?.response?.data?.message||tr('Lien invalide ou expiré.','Invalid or expired link.'))}finally{setLoading(false)}
 }
 return <div className="nexus-signin" data-signin-page>
  <nav className="signin-topbar" aria-label={tr('Navigation de connexion','Sign-in navigation')}>
   <Link to="/" className="signin-brand"><img src="/images/kcs.jpg" alt="KCS" width="44" height="44"/><span><strong>KCS Nexus <span>AI</span></strong><small>Kinshasa Christian School</small></span></Link>
   <div className="signin-tools"><button type="button" onClick={()=>setLanguage(language==='fr'?'en':'fr')} aria-label={tr('Passer en anglais','Switch to French')}><Globe2 size={17}/><span>{language==='fr'?'EN':'FR'}</span></button><button type="button" onClick={toggleTheme} aria-label={tr(theme==='dark'?'Activer le mode clair':'Activer le mode sombre',theme==='dark'?'Switch to light mode':'Switch to dark mode')}>{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button><Link to="/" className="signin-home"><ArrowLeft size={16}/><span>{tr('Le site KCS','KCS website')}</span></Link></div>
  </nav>
  <main className="signin-stage"><div className="signin-layout">
   <aside className="signin-story" aria-label={tr('Bienvenue à KCS','Welcome to KCS')}>
    <img className="signin-story-photo" src="/images/kcs/high-school.jpg" alt="" width="900" height="1100" fetchPriority="low"/>
    <div className="signin-story-shade"/><div className="signin-story-content"><span className="signin-eyebrow"><span/>KCS ORBIT ECOSYSTEM</span><div className="signin-story-title"><span className="signin-story-line"/><h1>{tr('Une école.','One school.')}<br/><em>{tr('Toutes vos possibilités.','Every possibility.')}</em></h1><p>{tr('Apprendre, accompagner, partager. Votre communauté scolaire se retrouve ici.','Learn, support, connect. Your school community comes together here.')}</p></div><div className="signin-community">{[[GraduationCap,tr('Élèves','Students')],[Users,tr('Familles','Families')],[BookOpen,tr('Équipe KCS','KCS team')]].map(([Icon,label]:any)=><span key={label}><Icon size={18}/>{label}</span>)}</div><p className="signin-story-footer">KINSHASA CHRISTIAN SCHOOL <span>KINSHASA · DRC</span></p></div>
   </aside>
   <section className="signin-panel" aria-labelledby="signin-title"><div className="signin-panel-inner">
    <span className="signin-secure"><ShieldCheck size={15}/>{tr('Votre espace sécurisé','Your secure workspace')}</span>
    <header className="signin-heading"><p>KCS NEXUS AI</p><h2 id="signin-title">{tr('Heureux de vous revoir.','Welcome back.')}</h2><span>{tr('Connectez-vous à votre espace personnel.','Sign in to your personal workspace.')}</span></header>
    {errorMessage&&<div className="signin-notice signin-error" role="alert">{errorMessage}</div>}
    {isAuthenticated&&user&&<div className="signin-notice" role="status">{tr('Session active :','Active session:')} {user.firstName} {user.lastName}. {tr('Une nouvelle connexion remplacera cette session.','A new sign-in will replace this session.')}</div>}
    <form onSubmit={form.handleSubmit(onSubmit)} autoComplete="off" noValidate>
     <div className="signin-field"><label htmlFor="nexus-login-identifier">{tr('E-mail ou code d’accès','Email or access code')}</label><div className="signin-input"><Mail size={18} aria-hidden="true"/><input id="nexus-login-identifier" {...form.register('email')} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder={tr('Votre e-mail ou code Orbit','Your email or Orbit code')} aria-invalid={Boolean(form.formState.errors.email)} aria-describedby={form.formState.errors.email?'signin-identifier-error':undefined}/></div>{form.formState.errors.email&&<p id="signin-identifier-error" className="signin-field-error" role="alert">{form.formState.errors.email.message}</p>}</div>
     <div className="signin-field"><label htmlFor="nexus-login-password">{tr('Mot de passe','Password')}</label><div className="signin-input"><LockKeyhole size={18} aria-hidden="true"/><input id="nexus-login-password" {...form.register('password')} type={showPassword?'text':'password'} autoComplete="new-password" placeholder={tr('Votre mot de passe','Your password')} aria-invalid={Boolean(form.formState.errors.password)} aria-describedby={form.formState.errors.password?'signin-password-error':undefined}/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-pressed={showPassword} aria-label={showPassword?tr('Masquer le mot de passe','Hide password'):tr('Afficher le mot de passe','Show password')}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>{form.formState.errors.password&&<p id="signin-password-error" className="signin-field-error" role="alert">{form.formState.errors.password.message}</p>}</div>
     {requiresTwoFactor&&<div className="signin-field"><label htmlFor="nexus-login-2fa">{tr('Code d’authentification','Authentication code')}</label><div className="signin-input"><ShieldCheck size={18}/><input id="nexus-login-2fa" {...form.register('twoFactorCode')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" autoFocus/></div>{form.formState.errors.twoFactorCode&&<p className="signin-field-error" role="alert">{form.formState.errors.twoFactorCode.message}</p>}</div>}
     <div className="signin-forgot"><button type="button" aria-expanded={recoveryOpen} aria-controls="signin-recovery" onClick={()=>{setRecoveryEmail(form.getValues('email'));setRecoveryOpen(v=>!v);setRecoveryError('');setRecoveryMessage('')}}>{tr('Mot de passe oublié ?','Forgot password?')}</button></div>
     <button type="submit" data-kcs-no-processing="true" className="signin-submit" disabled={isLoading} aria-busy={isLoading}><span className="signin-submit-glow" aria-hidden="true"/>{isLoading?<Loader2 size={19} className="animate-spin"/>:<LockKeyhole size={17}/>}<span>{isLoading?tr('Connexion sécurisée…','Signing in securely…'):tr('Se connecter','Sign in')}</span>{!isLoading&&<ArrowRight size={18} className="signin-submit-arrow"/>}</button>
    </form>
    {recoveryOpen&&<section id="signin-recovery" className="signin-recovery" aria-labelledby="signin-recovery-title"><h3 id="signin-recovery-title">{tr('Récupération sécurisée','Secure account recovery')}</h3>{!resetToken?<><div className="signin-recovery-channels" role="group" aria-label={tr('Canal de récupération','Recovery channel')}>{(['email','sms']as const).map(channel=><button type="button" key={channel} aria-pressed={recoveryChannel===channel} onClick={()=>setRecoveryChannel(channel)}>{channel==='sms'?'SMS':tr('E-mail','Email')}</button>)}</div><label htmlFor="signin-recovery-email">{tr('Adresse e-mail du compte','Account email address')}</label><input id="signin-recovery-email" type="email" value={recoveryEmail} onChange={e=>setRecoveryEmail(e.target.value)} autoComplete="off"/><button type="button" className="signin-recovery-action" disabled={isLoading} onClick={()=>void requestRecovery()}>{tr('Recevoir les instructions','Send recovery instructions')}</button></>:<><label htmlFor="signin-new-password">{tr('Nouveau mot de passe','New password')}</label><input id="signin-new-password" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} autoComplete="new-password" minLength={12}/><p>{tr('12 caractères minimum, avec majuscule, minuscule, chiffre et symbole.','At least 12 characters, including uppercase, lowercase, a number and a symbol.')}</p><button type="button" className="signin-recovery-action" disabled={isLoading||newPassword.length<12} onClick={()=>void completeRecovery()}>{tr('Réinitialiser le mot de passe','Reset password')}</button></>}{recoveryMessage&&<p className="signin-recovery-success" role="status">{recoveryMessage}</p>}{recoveryError&&<p className="signin-field-error" role="alert">{recoveryError}</p>}</section>}
    <p className="signin-privacy"><ShieldCheck size={15}/>{tr('Vos identifiants personnels, votre espace KCS.','Your personal credentials. Your KCS workspace.')}</p><div className="signin-help">{tr('Besoin d’un coup de main ?','Need a hand?')} <Link to="/contact">{tr('Contacter l’école','Contact the school')}<ArrowRight size={13}/></Link></div>
   </div></section>
  </div></main><footer className="signin-footer"><span>© {new Date().getFullYear()} Kinshasa Christian School</span><span>KCS Orbit · {tr('Unis pour apprendre.','Connected to learn.')}</span></footer>
 </div>
}
