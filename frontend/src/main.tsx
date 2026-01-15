import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Build version: 2026-01-15T22:30 - Force rebuild for cache clearing
console.log('[Konzern] Frontend version 2.0.0 (2026-01-15)');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
