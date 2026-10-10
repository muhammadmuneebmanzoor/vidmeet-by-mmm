import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent dev-server WebSocket HMR notices from triggering unhandled rejection warnings
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg = String(event.reason?.message || event.reason || '');
    if (msg.toLowerCase().includes('websocket')) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
