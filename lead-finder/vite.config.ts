import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { devApi } from './server/devApi.ts'

// base: './' lets the built site work from any folder.
export default defineConfig(({ mode }) => {
  // Let the dev API middleware see keys from .env.local
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of ['ANTHROPIC_API_KEY', 'LEADS_CONTACT_EMAIL', 'APP_ACCESS_KEY', 'OVERPASS_URLS', 'GEOAPIFY_API_KEY']) {
    if (env[key] && !process.env[key]) process.env[key] = env[key]
  }
  return {
    base: './',
    plugins: [react(), tailwindcss(), devApi()],
  }
})
