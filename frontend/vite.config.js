import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const basePath = process.env.VITE_BASE_PATH || '/a-bookshelf-pre-angular/'

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    {
      name: 'redirect-missing-trailing-slash',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
          if (req.url === normalizedBase) {
            res.statusCode = 302
            res.setHeader('Location', basePath)
            res.end()
            return
          }
          next()
        })
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
          if (req.url === normalizedBase) {
            res.statusCode = 302
            res.setHeader('Location', basePath)
            res.end()
            return
          }
          next()
        })
      },
    },
  ],
})
