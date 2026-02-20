import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('app-root');

if (!rootElement) {
    throw new Error('Missing #app-root element');
}

const root = createRoot(rootElement);
root.render(<App />);
