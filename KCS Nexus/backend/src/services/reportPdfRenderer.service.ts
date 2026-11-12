import { request } from 'node:http'

// Only a network-isolated renderer sees the document. It has no application secrets or database access.
export function renderOfficialPdf(html: string): Promise<Buffer> {
  const socketPath = process.env.REPORT_PDF_RENDERER_SOCKET
  if (!socketPath) return Promise.reject(new Error('Official PDF renderer is not configured'))
  const body = Buffer.from(JSON.stringify({ html }), 'utf8')
  return new Promise((resolve, reject) => {
    const req = request({ socketPath, path: '/render', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': body.length }, timeout: 60_000 }, res => {
      const chunks: Buffer[] = []
      let size = 0
      res.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 20 * 1024 * 1024) { res.destroy(new Error('Official PDF exceeds the size limit')); return }; chunks.push(chunk) })
      res.on('error', reject)
      res.on('end', () => {
        const pdf = Buffer.concat(chunks)
        if (res.statusCode !== 200 || !pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) return reject(new Error('The official PDF service is temporarily unavailable. Please retry.'))
        resolve(pdf)
      })
    })
    req.on('timeout', () => req.destroy(new Error('Official PDF rendering timed out. Please retry.')))
    req.on('error', reject)
    req.end(body)
  })
}
