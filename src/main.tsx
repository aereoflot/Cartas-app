import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/i18n'
import '@/styles/index.css'
import { App } from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const root = document.getElementById('root')
if (root === null) throw new Error('#root missing from index.html')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)

// The worker is what makes the app installable and what keeps the shell
// readable with no signal. Only in a build: in dev it would serve yesterday's
// bundle back to you and cost an afternoon.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* a blocked or unsupported worker costs the install offer, nothing else */
    })
  })
}
