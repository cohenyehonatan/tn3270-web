import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TerminalEmulator } from './components/TerminalEmulator.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TerminalEmulator />
  </StrictMode>,
);
