import { BookOpen, GraduationCap, UserRound } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
export default function PortalWorkspaceHeading({ title, audience }: { title: string; audience: 'teacher' | 'parent' | 'student' }) {
 const fr = useUIStore(state => state.language) === 'fr'
 const translations: Record<string,string> = {'Grades & Academic Reports':'Notes et bulletins','Assignments':'Travaux à remettre','My Timetable':'Mon emploi du temps','Attendance History':'Historique des présences','School Messages':'Messages de l’école','My Profile':'Mon profil','Account Settings':'Paramètres du compte'}
 const heading = fr ? translations[title] || title : title
 const Icon = audience === 'parent' ? UserRound : audience === 'student' ? GraduationCap : BookOpen
 const label = audience === 'parent' ? (fr ? 'Espace famille' : 'Family workspace') : audience === 'student' ? (fr ? 'Espace élève' : 'Learner workspace') : (fr ? 'Espace enseignant' : 'Teaching workspace')
 return <header className="nexus-workspace-heading mb-5"><span className="nexus-workspace-heading-icon"><Icon size={24}/></span><div><p className="nexus-workspace-kicker">KCS Nexus · {label}</p><h2>{heading}</h2></div></header>
}
