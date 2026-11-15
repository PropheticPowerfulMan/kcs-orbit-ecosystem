import {type ReactNode} from 'react'
import {createPortal} from 'react-dom'
export default function GradebookFocusHost({expanded,children}:{expanded:boolean;children:ReactNode}){return expanded?createPortal(children,document.body):<>{children}</>}
