export type SchoolVideoSource = { kind: 'embed' | 'file' | 'external'; url: string }
/** Only known viewing URLs become embedded frames. Other HTTPS links open at their publisher. */
export function schoolVideoSource(value: string, origin = window.location.origin): SchoolVideoSource | null {
  try {
    const url = new URL(value, origin)
    if (url.username || url.password || !['https:', 'http:'].includes(url.protocol)) return null
    const local = url.origin === origin
    if (!local && url.protocol !== 'https:') return null
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    let id: string | null = null
    if (host === 'youtu.be') id = url.pathname.split('/')[1]
    if (['youtube.com', 'youtube-nocookie.com', 'm.youtube.com'].includes(host)) id = url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|live|shorts)\/([^/]+)/)?.[1] || null
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return {kind: 'embed', url: 'https://www.youtube-nocookie.com/embed/' + id}
    if (['vimeo.com', 'player.vimeo.com'].includes(host)) {
      const video = url.pathname.match(/(?:^|\/)([0-9]+)(?:$|\/)/)?.[1]
      if (video) return {kind: 'embed', url: 'https://player.vimeo.com/video/' + video}
    }
    if (/\.(mp4|webm)$/i.test(url.pathname)) return {kind: 'file', url: url.href}
    return {kind: 'external', url: url.href}
  } catch { return null }
}
