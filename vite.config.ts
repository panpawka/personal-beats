import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { wasp } from 'wasp/client/vite'
import { lingui } from '@lingui/vite-plugin'

export default defineConfig({
  plugins: [
    wasp({
      reactOptions: {
        babel: {
          plugins: ['@lingui/babel-plugin-lingui-macro'],
        },
      },
    }),
    tailwindcss(),
    lingui(),
  ],
  server: {
    open: true,
  },
})
