// Vista previa al compartir un link (WhatsApp, Instagram, Facebook, X...).
// Esas apps no ejecutan JavaScript: leen las etiquetas <meta property="og:..."> del HTML.
// Por eso el servidor las escribe en la página antes de enviarla.
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ogTags({ title, description, url, image }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  return [
    `<meta name="description" content="${d}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="Cartitas" />',
    '<meta property="og:locale" content="es_AR" />',
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
  ].join('\n  ');
}

// Lee una página de public/, reemplaza <!--og--> por las etiquetas y, si se indica, cambia el <title>.
function renderPage(file, { title, ...og }) {
  let html = fs.readFileSync(path.join(PUBLIC_DIR, file), 'utf8');
  html = html.replace('<!--og-->', ogTags({ title, ...og }));
  return html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
}

// "2026-11-14T21:00" -> "Sábado, 14 de noviembre · 21:00 hs"
function describeDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || '');
  if (!m) return '';
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const day = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${m[4]}:${m[5]} hs`;
}

module.exports = { escapeHtml, ogTags, renderPage, describeDate };
