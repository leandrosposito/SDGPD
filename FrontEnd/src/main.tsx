import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/variables.css';
import './styles/reset.css';
import './styles/typography.css';
import './styles/global.css';
import App from './App';

// ============================================================
// main.tsx — Application bootstrap
// CSS import order matters: variables -> reset -> typography -> global
// ============================================================

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found. Check index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
