import {ChartColumnBig,MessageSquareText,UserRoundSearch,GraduationCap,BriefcaseBusiness,Users} from 'lucide-react';
const icons={reports:ChartColumnBig,messages:MessageSquareText,tracking:UserRoundSearch,students:GraduationCap,employees:BriefcaseBusiness,parents:Users};
export function FinanceWorkspaceIcon({kind}:{kind:keyof typeof icons}){const Icon=icons[kind];return <span className="ep-page-emblem" aria-hidden="true"><Icon size={76} strokeWidth={1.2}/></span>}
