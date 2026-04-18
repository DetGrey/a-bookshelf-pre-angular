import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/a-bookshelf/',
  plugins: [
    react(),
    {
      name: 'redirect-missing-trailing-slash',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/a-bookshelf') {
            res.statusCode = 302
            res.setHeader('Location', '/a-bookshelf/')
            res.end()
            return
          }
          next()
        })
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/a-bookshelf') {
            res.statusCode = 302
            res.setHeader('Location', '/a-bookshelf/')
            res.end()
            return
          }
          next()
        })
      },
    },
  ],
})
