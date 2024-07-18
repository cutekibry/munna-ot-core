import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, './lib/main.ts'),
      name: 'MunnaOTCore',
      fileName: 'munna-ot-core'
    }
  },
  plugins: [dts({ rollupTypes: true })]
})
