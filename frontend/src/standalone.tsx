/**
 * Offline single-file demo entry (docs/pitch/blind-side-standalone.html).
 * Renders the Listen page alone: no router, no auth, no API client.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ListenPage from '@/pages/listen/listen'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ListenPage />
  </StrictMode>,
)
