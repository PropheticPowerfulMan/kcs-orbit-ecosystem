const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')
const trimSlashes = (value: string) => value.replace(/^\/+/, '')

export const getBasePath = () => {
  const configuredBase = import.meta.env.BASE_URL

  if (configuredBase && configuredBase !== '/') {
    return trimTrailingSlash(configuredBase)
  }

  if (typeof document === 'undefined') {
    return ''
  }

  const scriptSource = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src
  const assetsSegment = '/assets/'

  if (scriptSource) {
    const scriptUrl = new URL(scriptSource)
    const assetsIndex = scriptUrl.pathname.indexOf(assetsSegment)

    if (assetsIndex > 0) {
      return trimTrailingSlash(scriptUrl.pathname.slice(0, assetsIndex))
    }
  }

  return ''
}

export const getAssetUrl = (path: string) => {
  const cleanPath = trimSlashes(path)
  const basePath = getBasePath()

  return basePath ? `${basePath}/${cleanPath}` : `/${cleanPath}`
}

export const getRouteUrl = (path: string) => {
  const cleanPath = trimSlashes(path)
  const basePath = getBasePath()

  return basePath ? `${basePath}/${cleanPath}` : `/${cleanPath}`
}
