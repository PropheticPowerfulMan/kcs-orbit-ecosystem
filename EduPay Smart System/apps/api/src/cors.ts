import type { CorsOptions } from 'cors'

export function createCorsOptions(allowedOrigins: Set<string>): CorsOptions {
  return {
    origin(origin, callback) {
      let hostname = ''
      try {
        hostname = origin ? new URL(origin).hostname : ''
      } catch {
        hostname = ''
      }
      if (!origin || allowedOrigins.has(origin) || hostname.endsWith('.github.io')) {
        callback(null, true)
        return
      }
      const error = new Error('CORS origin not allowed') as Error & { status: number }
      error.status = 403
      callback(error)
    },
  }
}
