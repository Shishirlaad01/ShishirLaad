import fs from 'node:fs'
import path from 'node:path'
import { parseEnv } from 'node:util'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only stand-in for Vercel's serverless functions, for the two routes the
// Delivery Cockpit purchase needs. The other api/* handlers need Upstash and the
// client already tolerates them being absent locally.
const DEV_API_ROUTES = new Set(['/api/create-order', '/api/download'])

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

// Vite restarts inside the same Node process when .env changes, so process.env
// still holds the previous run's values. Remember which keys came from .env so
// they can be refreshed, while variables set in the real shell environment still
// take precedence. Kept on globalThis because Vite re-imports this config file on
// every restart, which would reset a module-level variable.
const setFromDotenv = (globalThis.__devApiDotenvKeys ??= new Set())

function devApi() {
  return {
    name: 'dev-api',
    apply: 'serve',
    configResolved(config) {
      // .env values without the VITE_ prefix never reach process.env on their
      // own, and the handlers read them from there (RAZORPAY_KEY_SECRET, ...).
      // Read the files directly: Vite's loadEnv hands back stale values after an
      // in-process restart, which made edited prices/keys look ignored.
      const env = {}
      for (const name of ['.env', '.env.local']) {
        const file = path.join(config.root, name)
        if (fs.existsSync(file)) Object.assign(env, parseEnv(fs.readFileSync(file, 'utf8')))
      }
      for (const key of setFromDotenv) {
        if (!(key in env)) delete process.env[key] // line removed from .env
      }
      for (const [key, value] of Object.entries(env)) {
        if (!(key in process.env) || setFromDotenv.has(key)) {
          process.env[key] = value
          setFromDotenv.add(key)
        }
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        if (!DEV_API_ROUTES.has(url.pathname)) return next()

        try {
          const { default: handler } = await server.ssrLoadModule(`${url.pathname}.js`)
          req.query = Object.fromEntries(url.searchParams)
          const raw = req.method === 'POST' ? await readBody(req) : ''
          try { req.body = raw ? JSON.parse(raw) : undefined } catch { req.body = undefined }
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
})
