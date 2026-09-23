const FLAG = '__kcsUnifiedButtonFeedbackInstalled'

if (typeof window !== 'undefined' && !window[FLAG]) {
  window[FLAG] = true
  const SELECTOR = 'button, [role="button"], a[href]'
  let candidate = null
  let sequence = 0
  const requestElements = new Map()
  const elementRequests = new Map()
  const startedAt = new Map()
  const failed = new WeakMap()
  const tapTimers = new WeakMap()

  const style = document.createElement('style')
  style.textContent = `
:is(button,[role="button"],a[href])[data-kcs-processing]{position:relative;isolation:isolate;transform:translateY(1px) scale(.985);cursor:wait!important;transition:transform 120ms ease,box-shadow 180ms ease}
:is(button,[role="button"],a[href])[data-kcs-processing]::after{content:"";position:absolute;z-index:20;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(105deg,transparent 18%,rgba(255,255,255,.42) 43%,rgba(255,255,255,.18) 56%,transparent 80%);background-size:240% 100%;animation:kcsButtonSweep 900ms linear infinite}
:is(button,[role="button"],a[href])[data-kcs-processing="request"]{box-shadow:0 0 0 3px rgba(56,189,248,.36),0 8px 22px rgba(3,57,96,.18)}
:is(button,[role="button"],a[href])[data-kcs-processing="request"]::before{content:"";position:absolute;z-index:21;top:.42rem;inset-inline-end:.42rem;width:.82rem;height:.82rem;border:2px solid rgba(255,255,255,.45);border-top-color:currentColor;border-radius:999px;pointer-events:none;animation:kcsButtonSpin 650ms linear infinite}
:is(button,[role="button"],a[href])[data-kcs-result="success"]{box-shadow:0 0 0 3px rgba(16,185,129,.42),0 8px 20px rgba(5,150,105,.16)}
:is(button,[role="button"],a[href])[data-kcs-result="error"]{box-shadow:0 0 0 3px rgba(239,68,68,.44),0 8px 20px rgba(220,38,38,.16);animation:kcsButtonShake 260ms ease-in-out}
#kcs-global-action-progress{position:fixed;z-index:2147483000;inset:0 0 auto;height:3px;pointer-events:none;overflow:hidden;background:rgba(125,211,252,.24)}
#kcs-global-action-progress[hidden]{display:none}
#kcs-global-action-progress::after{content:"";display:block;width:42%;height:100%;border-radius:999px;background:linear-gradient(90deg,#38bdf8,#f5c451,#10b981);box-shadow:0 0 12px rgba(56,189,248,.8);animation:kcsGlobalProgress 950ms ease-in-out infinite}
@keyframes kcsButtonSweep{from{background-position:140% 0}to{background-position:-140% 0}}@keyframes kcsButtonSpin{to{transform:rotate(360deg)}}@keyframes kcsButtonShake{35%{transform:translateX(-3px)}70%{transform:translateX(3px)}}@keyframes kcsGlobalProgress{from{transform:translateX(-115%)}to{transform:translateX(350%)}}
@media(prefers-reduced-motion:reduce){:is(button,[role="button"],a[href])[data-kcs-processing]::after,:is(button,[role="button"],a[href])[data-kcs-processing="request"]::before,#kcs-global-action-progress::after{animation-duration:2.2s}}`
  document.head.appendChild(style)

  const progress = document.createElement('div')
  progress.id = 'kcs-global-action-progress'
  progress.hidden = true
  progress.setAttribute('role', 'status')
  progress.setAttribute('aria-label', 'Traitement sécurisé en cours. Secure processing in progress.')
  document.body.appendChild(progress)
  const updateProgress = () => { progress.hidden = requestElements.size === 0 }

  const release = (element) => {
    const wait = Math.max(0, 480 - (Date.now() - (startedAt.get(element) || Date.now())))
    window.setTimeout(() => {
      if ((elementRequests.get(element)?.size || 0) > 0) return
      delete element.dataset.kcsProcessing
      if (element.dataset.kcsOwnedAriaBusy === 'true') {
        element.removeAttribute('aria-busy')
        delete element.dataset.kcsOwnedAriaBusy
      }
      if (!element.isConnected) return
      element.dataset.kcsResult = failed.get(element) ? 'error' : 'success'
      window.setTimeout(() => delete element.dataset.kcsResult, 1100)
      startedAt.delete(element)
      failed.delete(element)
    }, wait)
  }

  const beginRequest = () => {
    if (!candidate || Date.now() - candidate.at > 1250 || !candidate.element.isConnected) return null
    const element = candidate.element
    const token = ++sequence
    requestElements.set(token, element)
    const requests = elementRequests.get(element) || new Set()
    requests.add(token)
    elementRequests.set(element, requests)
    startedAt.set(element, startedAt.get(element) || Date.now())
    element.dataset.kcsProcessing = 'request'
    if (!element.hasAttribute('aria-busy')) {
      element.setAttribute('aria-busy', 'true')
      element.dataset.kcsOwnedAriaBusy = 'true'
    }
    const timer = tapTimers.get(element)
    if (timer) window.clearTimeout(timer)
    updateProgress()
    return token
  }

  const finishRequest = (token, ok) => {
    if (!token) return
    const element = requestElements.get(token)
    if (!element) return
    requestElements.delete(token)
    const requests = elementRequests.get(element)
    requests?.delete(token)
    if (!ok) failed.set(element, true)
    if (!requests?.size) {
      elementRequests.delete(element)
      release(element)
    }
    updateProgress()
  }

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return
    const element = event.target.closest(SELECTOR)
    if (!element || element.dataset.kcsNoProcessing === 'true' || element.getAttribute('aria-disabled') === 'true' || (element instanceof HTMLButtonElement && element.disabled)) return
    if (element.dataset.kcsProcessing === 'request') {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }
    delete element.dataset.kcsResult
    candidate = { element, at: Date.now() }
    element.dataset.kcsProcessing = 'tap'
    const oldTimer = tapTimers.get(element)
    if (oldTimer) window.clearTimeout(oldTimer)
    tapTimers.set(element, window.setTimeout(() => {
      if (element.dataset.kcsProcessing === 'tap') delete element.dataset.kcsProcessing
    }, 520))
  }, true)

  const nativeFetch = window.fetch?.bind(window)
  if (nativeFetch) window.fetch = (...args) => {
    const token = beginRequest()
    return nativeFetch(...args).then(
      (response) => { finishRequest(token, response.ok); return response },
      (error) => { finishRequest(token, false); throw error },
    )
  }

  const xhr = window.XMLHttpRequest?.prototype
  if (xhr) {
    const nativeSend = xhr.send
    xhr.send = function (...args) {
      const token = beginRequest()
      this.addEventListener('loadend', () => finishRequest(token, this.status >= 200 && this.status < 400), { once: true })
      try { return nativeSend.apply(this, args) }
      catch (error) { finishRequest(token, false); throw error }
    }
  }
}
