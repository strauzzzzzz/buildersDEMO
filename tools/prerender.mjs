#!/usr/bin/env node
/*
 * prerender.mjs — bakes config.json into index.html (OPTIONAL but recommended).
 *
 * Why: the page renders from config.json in the browser, but baking the same
 * HTML into index.html means the page also works without JavaScript, loads
 * faster, and social/SEO crawlers see your real text and meta tags.
 * It uses the exact same code as the browser (assets/js/render.js).
 *
 * Usage:   node tools/prerender.mjs
 * Also writes sitemap.xml and robots.txt using site.url from config.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const R = createRequire(import.meta.url)(join(root, 'assets/js/render.js'));

const config = JSON.parse(readFileSync(join(root, 'config.json'), 'utf8'));
let html = readFileSync(join(root, 'index.html'), 'utf8');

// Swap everything between <!--render:NAME--> and <!--/render:NAME-->.
function fill(name, content) {
  const re = new RegExp(`(<!--render:${name}-->)[\\s\\S]*?(<!--/render:${name}-->)`);
  if (!re.test(html)) throw new Error(`Marker "render:${name}" not found in index.html`);
  html = html.replace(re, (_, a, b) => `${a}${content}${b}`);
}

const sections = R.renderAll(config);
for (const [name, content] of Object.entries(sections)) fill(name, content);
fill('head', '\n  ' + R.serializeHead(R.headTags(config)).split('\n').join('\n  ') + '\n  ');

// Keep <html lang> and the config hash in sync (the browser skips re-render when they match).
html = html.replace(/<html[^>]*>/, `<html lang="${config.site.lang || 'ru'}" data-cfg="${R.hashConfig(config)}">`);
writeFileSync(join(root, 'index.html'), html);

// sitemap.xml + robots.txt from site.url
const base = R.isFilled(config.site.url) ? config.site.url : 'https://example.com/';
const today = new Date().toISOString().slice(0, 10);
writeFileSync(join(root, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${base}</loc>\n    <lastmod>${today}</lastmod>\n  </url>\n</urlset>\n`);
writeFileSync(join(root, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap.xml', base).href}\n`);

console.log('index.html, sitemap.xml, robots.txt updated from config.json');
