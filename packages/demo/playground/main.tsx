import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.js';
import './styles.css';

const container = document.querySelector('#root');
if (!(container instanceof HTMLElement)) {
  throw new TypeError('The playground page is missing its #root element.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
