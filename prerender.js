// Bakes the rendered React output into dist/index.html at build time.
// Without this the deployed page is an empty <div id="root"></div>, which means
// crawlers, link-preview bots and text-only readers see no content at all.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = path.resolve('dist');
const htmlPath = path.join(dist, 'index.html');
const serverEntry = path.join(dist, 'server', 'entry-server.js');

if (!fs.existsSync(serverEntry)) {
  console.error('prerender: missing SSR bundle at %s', serverEntry);
  process.exit(1);
}

const { render } = await import(pathToFileURL(serverEntry).href);
const appHtml = render();

const html = fs.readFileSync(htmlPath, 'utf8');
const marker = '<div id="root"></div>';

if (!html.includes(marker)) {
  console.error('prerender: could not find %s in dist/index.html', marker);
  process.exit(1);
}

fs.writeFileSync(htmlPath, html.replace(marker, `<div id="root">${appHtml}</div>`));

// The SSR bundle is a build artifact only — don't ship it.
fs.rmSync(path.join(dist, 'server'), { recursive: true, force: true });

console.log('prerender: injected %d KB of markup into dist/index.html', Math.round(appHtml.length / 1024));
