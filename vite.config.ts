import react from '@vitejs/plugin-react'
import { defineConfig, type Connect } from 'vite'
import { handleTransit } from './server/transit.ts'

// https://vite.dev/config/
const transitMiddleware: Connect.NextHandleFunction = async (_req, res) => {
  const r = await handleTransit()
  res.statusCode = r.status
  r.headers.forEach((v, k) => res.setHeader(k, v))
  res.end(await r.text())
}

export default defineConfig({
  plugins: [
    react(),
    {
      // Serve /api/transit in `npm run dev` / `npm run preview` the same way the deployed function does.
      name: 'tss-transit-proxy',
      configureServer(server) { server.middlewares.use('/api/transit', transitMiddleware) },
      configurePreviewServer(server) { server.middlewares.use('/api/transit', transitMiddleware) },
    },
  ],
})
