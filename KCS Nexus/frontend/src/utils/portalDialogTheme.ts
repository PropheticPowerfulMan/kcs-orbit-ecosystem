/** Presentation attributes only: never move React-owned nodes or replace event handlers. */
export function decoratePortalDialogs(root: ParentNode = document) {
 const candidates=root.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"], .fixed.inset-0')
 for(const dialog of candidates) {
  if(dialog.matches('[data-entity-dialog], [data-portal-action-dialog]') || dialog.classList.contains('gradebook-focus-window')) continue
  const semantic=dialog.matches('[role="dialog"], [role="alertdialog"]')
  const overlay=dialog.classList.contains('fixed')&&dialog.classList.contains('inset-0')
  const centered=/items-center|place-items-center|justify-center/.test(dialog.className)
  if(!semantic&&(!overlay||!centered||!/bg-(?:black|slate|kcs-blue)|backdrop-blur/.test(dialog.className)))continue
  const directPanel=Array.from(dialog.children).find(child=>child instanceof HTMLElement && /rounded|bg-white|bg-kcs-blue|bg-slate/.test(child.className)) as HTMLElement|undefined
  const panel=overlay?directPanel:(semantic?dialog:undefined)
  if(!panel || panel.classList.contains('gradebook-focus-window') || panel.querySelector('[data-gradebook-focus-window]'))continue
  // Full-screen workspaces keep their own table sizing; nested confirmation dialogs still receive the theme.
  if(panel.matches('.gradebook-focus-window')||panel.querySelector('table')&&panel.matches('[class*="h-screen"]'))continue
  // Preserve the composition and colors of windows that already use a modern custom design.
  const polished=dialog.hasAttribute('data-gradebook-overlay')||dialog.hasAttribute('data-nexus-dialog-preserve')||panel.hasAttribute('data-nexus-dialog-preserve')||Boolean(panel.querySelector('header[class*="bg-kcs-blue"], header[class*="bg-gradient"]'))||/parent-meeting|credential|report-card|certificate/i.test(dialog.className+' '+panel.className)||Boolean(panel.querySelector('[class*="bg-gradient"]'))
  const level=polished?'polish':'full'
  dialog.dataset.nexusDialogLevel=level
  panel.dataset.nexusDialogLevel=level
  dialog.dataset.nexusDialog=overlay?'overlay':'surface'
  panel.dataset.nexusDialogPanel='true'
  const viewport=Math.max(1,Math.round(Math.min(window.innerHeight,window.visualViewport?.height??window.innerHeight)))
  const padding=overlay?parseFloat(getComputedStyle(dialog).paddingTop)+parseFloat(getComputedStyle(dialog).paddingBottom):24
  dialog.style.setProperty('--nexus-dialog-room',Math.max(1,viewport-(Number.isFinite(padding)?padding:24))+'px')
  dialog.dataset.nexusDialogCompact=String(viewport<520)
  panel.dataset.nexusDialogCompact=String(viewport<520)
  const title=panel.querySelector<HTMLElement>('h1,h2,h3,[role="heading"]')
  if(title){title.dataset.nexusDialogTitle='true';let header=title.parentElement;while(header&&header.parentElement!==panel)header=header.parentElement;if(header&&header!==panel&&/border-b|justify-between/.test(header.className))header.dataset.nexusDialogHeader='true'}
  for(const footer of panel.querySelectorAll<HTMLElement>(':scope > footer, :scope > div[class*="justify-end"], :scope > div[class*="bottom-0"]'))if(footer.querySelector('button'))footer.dataset.nexusDialogActions='true'
 }
}
