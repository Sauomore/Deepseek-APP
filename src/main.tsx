import { createRoot } from 'react-dom/client'

import 'katex/dist/katex.min.css'

import '@/styles/tokens.css'
import '@/styles/base.css'
import '@/styles/markdown.css'
import '@/styles/chat.css'
import '@/styles/blocks.css'
import '@/styles/composer.css'
import '@/styles/overlays.css'

import App from '@/App'

const container = document.getElementById('root')
if (!container) throw new Error('Root element not found')

createRoot(container).render(<App />)
