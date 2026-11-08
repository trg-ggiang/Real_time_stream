import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@livekit/components-styles';
import './styles.css';
import { AuthApp } from './features/auth/AuthApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthApp />
  </StrictMode>,
);
