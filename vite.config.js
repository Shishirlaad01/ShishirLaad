import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only stand-in for the two things Vercel gives us in production:
//  - /api/download (the paid kit download), served from api/download.js
//  - /thanks, which vercel.json's cleanUrls maps to thanks.html
// Only /api/download is wired up: the other api/* handlers need Upstash and the
// client already tolerates them being absent locally.
function devApi() {
  return {
    name: 'dev-api',
    apply: 'serve',
    configResolved(config) {
      // .env values without the VITE_ prefix never reach process.env on their
      // own, and the handler reads them from there (STRIPE_SECRET_KEY, ...).
      const env = loadEnv(config.mode, config.root, '')
      for (const [key, value] of Object.entries(env)) {
        if (!(key in process.env)) process.env[key] = value
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')

        if (url.pathname === '/thanks') {
          req.url = `/thanks.html${url.search}`
          return next()
        }
        if (url.pathname !== '/api/download') return next()

        try {
          const { default: handler } = await server.ssrLoadModule('/api/download.js')
          req.query = Object.fromEntries(url.searchParams)
          res.status = (code) => { res.statusCode = code; return res }
          res.json = (body) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(body))
          }
          res.send = (body) => res.end(body)
          await handler(req, res)
        } catch (err) {
          server.config.logger.error(String(err?.stack || err))
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'internal error' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devApi()],
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
  },
  build: {
    // thanks.html is a second page (post-purchase download), served at /thanks
    // by vercel.json's cleanUrls.
    rollupOptions: {
      input: { main: 'index.html', thanks: 'thanks.html' },
    },
  },
})
