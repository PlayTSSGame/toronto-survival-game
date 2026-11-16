import react from '@vitejs/plugin-react'
import { defineConfig, type Connect } from 'vite'
import { handleStats, handleTrack, memoryStore } from './server/stats.ts'
import { handleTransit } from './server/transit.ts'

// https://vite.dev/config/
const transitMiddleware: Connect.NextHandleFunction = async (_req, res) => {
  const r = await handleTransit()
  res.statusCode = r.status
  r.headers.forEach((v, k) => res.setHeader(k, v))
  res.end(await r.text())
}

// Local stand-ins for the Netlify functions: counters live in memory and reset on restart.
const localStats = memoryStore()
const toRequest = async (req: Connect.IncomingMessage): Promise<Request> => {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const body = chunks.length ? Buffer.concat(chunks) : undefined
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
  return new Request(`http://localhost${req.originalUrl ?? req.url ?? '/'}`, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body })
}
const send = async (res: import('node:http').ServerResponse, r: Response) => {
  res.statusCode = r.status
  r.headers.forEach((v, k) => res.setHeader(k, v))
  res.end(Buffer.from(await r.arrayBuffer()))
}
const trackMiddleware: Connect.NextHandleFunction = async (req, res) => send(res, await handleTrack(await toRequest(req), localStats))
const statsMiddleware: Connect.NextHandleFunction = async (req, res) => send(res, await handleStats(await toRequest(req), localStats, process.env.STATS_PASSWORD ?? 'local'))

export default defineConfig({
  plugins: [
    react(),
    {
      // Serve /api/transit, /api/track and /stats in `npm run dev` / `npm run preview` like the deployed functions do.
      name: 'tss-local-functions',
      configureServer(server) {
        server.middlewares.use('/api/transit', transitMiddleware)
        server.middlewares.use('/api/track', trackMiddleware)
        server.middlewares.use('/stats', statsMiddleware)
      },
      configurePreviewServer(server) {
        server.middlewares.use('/api/transit', transitMiddleware)
        server.middlewares.use('/api/track', trackMiddleware)
        server.middlewares.use('/stats', statsMiddleware)
      },
    },
  ],
})
