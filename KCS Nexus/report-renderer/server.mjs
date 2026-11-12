import http from 'node:http'
import { chmod, unlink } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const socket = process.env.REPORT_PDF_RENDERER_SOCKET || '/run/kcs-report/renderer.sock'
const maxBytes = 12 * 1024 * 1024
let browser
let active = 0
const waiters = []
async function getBrowser() {
  if (!browser?.connected) browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-background-networking', '--disable-extensions', '--no-first-run', '--no-default-browser-check', '--host-resolver-rules=MAP * ~NOTFOUND'] })
  return browser
}
async function render(html) {
  if (active || waiters.length) await new Promise((resolve, reject) => {
    const entry = { resolve, timer: setTimeout(() => { const index = waiters.indexOf(entry); if (index >= 0) waiters.splice(index, 1); reject(new Error('Renderer queue timed out')) }, 45_000) }
    waiters.push(entry)
  })
  active++
  let page
  try {
    page = await (await getBrowser()).newPage()
    await page.setJavaScriptEnabled(false)
    await page.setRequestInterception(true)
    page.on('request', req => /^(data:|about:)/i.test(req.url()) ? req.continue() : req.abort('blockedbyclient'))
    page.setDefaultTimeout(25_000)
    await page.setContent(html, { waitUntil: 'load', timeout: 25_000 })
    await page.emulateMediaType('print')
    await page.evaluate(() => document.fonts.ready)
    return Buffer.from(await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false, timeout: 25_000 }))
  } finally {
    await page?.close().catch(() => {})
    active--
    const next = waiters.shift()
    if (next) { clearTimeout(next.timer); next.resolve() }
  }
}
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') { res.writeHead(browser?.connected ? 200 : 503); return res.end('renderer') }
  if (req.method !== 'POST' || req.url !== '/render') { res.writeHead(404); return res.end() }
  if (waiters.length >= 20) { res.writeHead(503); return res.end('Renderer is busy') }
  let size = 0
  const chunks = []
  try {
    for await (const chunk of req) { size += chunk.length; if (size > maxBytes) { res.writeHead(413); res.end(); req.destroy(); return }; chunks.push(chunk) }
    const { html } = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (typeof html !== 'string' || !html.startsWith('<!doctype html>') || /<script[\s>]/i.test(html)) { res.writeHead(400); return res.end('Invalid report document') }
    const pdf = await render(html)
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': pdf.length, 'Cache-Control': 'no-store' })
    res.end(pdf)
  } catch { res.writeHead(503); res.end('Official PDF rendering is unavailable') }
})
await getBrowser()
await unlink(socket).catch(error => { if (error.code !== 'ENOENT') throw error })
server.listen(socket, async () => { await chmod(socket, 0o600); console.log('Nexus official report renderer ready') })
async function shutdown() { server.close(); await browser?.close(); process.exit(0) }
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
