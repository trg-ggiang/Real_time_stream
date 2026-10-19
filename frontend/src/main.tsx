import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@livekit/components-styles';
import './styles.css';
import { MeetingPage } from './features/meeting/MeetingPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MeetingPage />
  </StrictMode>,
);
