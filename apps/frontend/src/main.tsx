import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './index.css';

/**
 * Entry point. The provider stack lives in App/AppProviders so the same
 * composition can be mounted in tests without duplicating it here.
 */
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root element missing in index.html');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
