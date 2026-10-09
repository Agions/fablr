import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  base: './',
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    port: 1430,
    strictPort: true,
    host: true,
  },
  preview: {
    port: 1430,
    strictPort: true,
  },
  css: {
    devSourcemap: false,
    modules: {
      localsConvention: 'camelCase',
    },
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
  resolve: {
    alias: {
      '@/': path.resolve(__dirname, './src'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/core': path.resolve(__dirname, './src/core'),
      '@/store': path.resolve(__dirname, './src/stores'),
      '@/stores': path.resolve(__dirname, './src/stores'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/shared/constants': path.resolve(__dirname, './src/shared/constants'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/context': path.resolve(__dirname, './src/context'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/styles': path.resolve(__dirname, './src/styles'),
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 500,
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    assetsDir: 'assets',
    rollupOptions: {
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        inlineDynamicImports: false,
        manualChunks(id) {
          if (!id.includes('node_modules')) return null

          // Framework core
          if (/node_modules\/react(?:-dom)?\//.test(id)) return 'vendor-react'
          if (/node_modules\/react-router(?:-dom)?\//.test(id)) return 'vendor-router'
          if (/node_modules\/zustand\//.test(id)) return 'vendor-zustand'

          // Tauri
          if (/node_modules\/@tauri-apps\//.test(id)) return 'vendor-tauri'

          // shadcn/ui base — split into smaller chunks
          if (/node_modules\/@base-ui\//.test(id)) return 'vendor-ui-base'
          if (/node_modules\/class-variance-authority\//.test(id)) return 'vendor-ui-base'
          if (/node_modules\/clsx\//.test(id) || /node_modules\/tailwind-merge\//.test(id)) return 'vendor-ui-base'

          // Utilities
          if (/node_modules\/dayjs\//.test(id)) return 'vendor-dayjs'

          // Icon libraries
          if (/node_modules\/lucide-react\//.test(id)) return 'vendor-icons'

          // Animation / UI utilities
          if (/node_modules\/vaul\//.test(id)) return 'vendor-motion'

          // No catch-all — every node_modules module must have an explicit chunk above.
          return null
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'dayjs', 'zustand'],
  },
  // Only drop console/debugger in production builds for easier debugging
  esbuild: {
    legalComments: 'none',
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    target: 'esnext',
  },
})
