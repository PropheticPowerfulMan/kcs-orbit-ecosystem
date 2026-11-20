import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

type Geometry = { max: number; top: number; height: number }
/** A visible, keyboard- and pointer-operable rail when the OS hides native overlay scrollbars. */
export default function RegistryViewScrollRail({ viewport, controls, label }: { viewport: RefObject<HTMLDivElement>; controls: string; label: string }) {
  const track = useRef<HTMLDivElement>(null)
  const dragOffset = useRef(0)
  const [geometry, setGeometry] = useState<Geometry>({ max: 0, top: 0, height: 28 })
  useLayoutEffect(() => {
    const element = viewport.current, rail = track.current
    if (!element || !rail) return
    let frame = 0
    const measure = () => {
      const max = Math.max(0, element.scrollHeight - element.clientHeight)
      const length = rail.clientHeight || element.clientHeight
      const height = Math.min(length, Math.max(28, length * element.clientHeight / Math.max(1, element.scrollHeight)))
      const next = { max, height, top: max ? Math.max(0, Math.min(max, element.scrollTop)) / max * Math.max(0, length - height) : 0 }
      setGeometry(previous => previous.max === next.max && previous.top === next.top && previous.height === next.height ? previous : next)
    }
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null
    observer?.observe(element); observer?.observe(rail)
    for (const child of Array.from(element.children)) observer?.observe(child)
    element.addEventListener('scroll', update, { passive: true }); element.addEventListener('load', update, true)
    window.addEventListener('resize', update); window.visualViewport?.addEventListener('resize', update)
    measure()
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); element.removeEventListener('scroll', update); element.removeEventListener('load', update, true); window.removeEventListener('resize', update); window.visualViewport?.removeEventListener('resize', update) }
  }, [viewport])
  const moveTo = (clientY: number) => {
    const element = viewport.current, rail = track.current
    if (!element || !rail) return
    const thumb = rail.firstElementChild as HTMLElement | null
    const distance = rail.clientHeight - (thumb?.offsetHeight ?? 0)
    if (distance <= 0) return
    element.scrollTop = Math.max(0, Math.min(1, (clientY - rail.getBoundingClientRect().top - dragOffset.current) / distance)) * Math.max(0, element.scrollHeight - element.clientHeight)
  }
  return <div ref={track} className="registry-view-scroll-rail" role="scrollbar" aria-label={label} aria-controls={controls} aria-orientation="vertical" aria-valuemin={0} aria-valuemax={100} aria-valuenow={geometry.max && viewport.current ? Math.round(100 * viewport.current.scrollTop / geometry.max) : 0} tabIndex={geometry.max > 1 ? 0 : -1} hidden={geometry.max <= 1}
    onPointerDown={event => {
      if (event.button !== 0) return
      const thumb = event.currentTarget.firstElementChild as HTMLElement
      dragOffset.current = event.target === thumb ? event.clientY - thumb.getBoundingClientRect().top : thumb.offsetHeight / 2
      event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus({ preventScroll: true }); moveTo(event.clientY); event.preventDefault()
    }}
    onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) moveTo(event.clientY) }}
    onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
    onKeyDown={event => {
      const element = viewport.current
      if (!element) return
      const changes: Record<string, number> = { ArrowDown: 44, ArrowUp: -44, PageDown: element.clientHeight * .85, PageUp: -element.clientHeight * .85 }
      if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); element.scrollTop = event.key === 'Home' ? 0 : element.scrollHeight }
      else if (event.key in changes) { event.preventDefault(); element.scrollBy({ top: changes[event.key], behavior: 'auto' }) }
    }}><span style={{ height: geometry.height, transform: `translateY(${geometry.top}px)` }}/></div>
}
