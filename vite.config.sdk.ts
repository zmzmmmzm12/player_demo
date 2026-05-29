import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    outDir: 'dist-sdk',
    emptyOutDir: true,
    copyPublicDir: false,
    lib: {
      entry: resolve(__dirname, 'src/sdk/index.ts'),
      name: 'Player',
      formats: ['umd'],
      fileName: () => 'player.umd.js',
    },
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
    target: 'es2020',
  },
})
