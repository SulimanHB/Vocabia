import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { App } from './App';
import './styles.css';

// Vercel Web Analytics (visitas a la demo, sin cookies): su script solo existe en el despliegue de Vercel.
const onVercel = import.meta.env.MODE === 'demo' && location.hostname.endsWith('.vercel.app');

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App />{onVercel && <Analytics />}</React.StrictMode>);
