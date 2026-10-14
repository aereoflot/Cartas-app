import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  // loadEnv, not process.env: VITE_POLL lives in .env.local, which is not on the
  // shell environment of the config.
  const env = loadEnv(mode, process.cwd(), '')

  // A repo on a Windows drive mounted into WSL (/mnt/c/...) does not deliver
  // inotify events reliably: Vite misses edits and keeps serving the module it
  // transformed before, which looks exactly like a change that did nothing.
  // Polling costs some CPU and is the only thing that works there, so default it
  // on by location. VITE_POLL=0 forces it off, VITE_POLL=1 forces it on.
  const onMountedDrive = process.cwd().startsWith('/mnt/')
  const usePolling =
    env.VITE_POLL === '0' ? false : env.VITE_POLL === '1' || onMountedDrive

  return {
    plugins: [react(), tailwind()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      watch: usePolling ? { usePolling: true, interval: 300 } : {},
    },
  }
})
