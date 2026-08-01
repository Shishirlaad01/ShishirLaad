import { renderToString } from 'react-dom/server';
import App from './App.jsx';

// Used only at build time by prerender.js — bakes the rendered markup into
// dist/index.html so crawlers and text-only readers get real content.
export function render() {
  return renderToString(<App />);
}
