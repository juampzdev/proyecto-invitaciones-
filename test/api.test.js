const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Los tests usan una base de datos aparte (TEST_DATABASE_URL) que se vacía en cada corrida.
// Nunca apuntes TEST_DATABASE_URL a tu base real.
const TEST_DB = process.env.TEST_DATABASE_URL;
if (!TEST_DB) {
  test('tests de la API', { skip: 'Definí TEST_DATABASE_URL para correrlos (ver README).' }, () => {});
  return;
}
process.env.DATABASE_URL = TEST_DB;
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cartitas-'));
const app = require('../server');
const db = require('../src/db');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

let base;
let server;
test.before(async () => {
  await db.migrate();
  await db.query('TRUNCATE invitations CASCADE');
  await new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
test.after(async () => {
  server.close();
  await db.pool.end();
});

function form(fields, images = []) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  images.forEach((buf, i) => fd.append('images', new Blob([buf], { type: 'image/png' }), `f${i}.png`));
  return fd;
}

const valid = { template: 'cumpleanos', name: 'Sofía', age: '30', date: '2030-11-14T21:00', note: 'Te espero', theme: 'noche' };

test('flujo completo: crear, pagar, ver y QR', async () => {
  let r = await fetch(`${base}/api/invitations`, { method: 'POST', body: form(valid, [PNG, PNG]) });
  assert.strictEqual(r.status, 201);
  const { id, ownerToken } = await r.json();

  // Antes de pagar: invitados no la ven, el dueño sí.
  assert.strictEqual((await fetch(`${base}/api/invitations/${id}`)).status, 402);
  assert.strictEqual((await fetch(`${base}/api/invitations/${id}?token=${ownerToken}`)).status, 200);
  assert.strictEqual((await fetch(`${base}/api/invitations/${id}/qr.png`)).status, 404);

  r = await fetch(`${base}/api/invitations/${id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: 'malo' }) });
  assert.strictEqual(r.status, 403);
  r = await fetch(`${base}/api/invitations/${id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ownerToken }) });
  assert.strictEqual(r.status, 200);

  r = await fetch(`${base}/api/invitations/${id}`);
  const body = await r.json();
  assert.strictEqual(body.invitation.status, 'paid');
  assert.strictEqual(body.invitation.ownerToken, undefined);
  assert.strictEqual(body.invitation.images.length, 2);
  assert.ok(body.url.endsWith(`/i/${id}`));

  r = await fetch(`${base}/api/invitations/${id}/qr.png`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers.get('content-type'), 'image/png');

  r = await fetch(base + body.invitation.images[0]);
  assert.strictEqual(r.status, 200);

  // Los datos quedaron en PostgreSQL: la invitación y sus 2 fotos, en orden.
  const { rows } = await db.query('SELECT position FROM invitation_images WHERE invitation_id = $1 ORDER BY position', [id]);
  assert.deepStrictEqual(rows.map((x) => x.position), [1, 2]);
  assert.strictEqual(body.invitation.date, '2030-11-14T21:00');
  assert.strictEqual(body.invitation.name, 'Sofía');

  // Pagar dos veces no cambia la fecha del primer pago.
  const before = (await db.query('SELECT paid_at FROM invitations WHERE id = $1', [id])).rows[0].paid_at;
  await fetch(`${base}/api/invitations/${id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ownerToken }) });
  const after = (await db.query('SELECT paid_at FROM invitations WHERE id = $1', [id])).rows[0].paid_at;
  assert.strictEqual(after.getTime(), before.getTime());
});

test('ids inexistentes o mal formados devuelven 404', async () => {
  assert.strictEqual((await fetch(`${base}/api/invitations/noexiste12345`)).status, 404);
  assert.strictEqual((await fetch(`${base}/api/invitations/${encodeURIComponent("x' OR '1'='1")}`)).status, 404);
});

test('rechaza más de 3 imágenes', async () => {
  const r = await fetch(`${base}/api/invitations`, { method: 'POST', body: form(valid, [PNG, PNG, PNG, PNG]) });
  assert.strictEqual(r.status, 400);
});

test('rechaza nota de más de 256 caracteres', async () => {
  const r = await fetch(`${base}/api/invitations`, { method: 'POST', body: form({ ...valid, note: 'a'.repeat(257) }) });
  assert.strictEqual(r.status, 400);
  const ok = await fetch(`${base}/api/invitations`, { method: 'POST', body: form({ ...valid, note: 'a'.repeat(256) }) });
  assert.strictEqual(ok.status, 201);
});

test('rechaza archivos que no son imágenes y fechas inválidas', async () => {
  let r = await fetch(`${base}/api/invitations`, { method: 'POST', body: form(valid, [Buffer.from('<script>alert(1)</script>')]) });
  assert.strictEqual(r.status, 400);
  r = await fetch(`${base}/api/invitations`, { method: 'POST', body: form({ ...valid, date: 'mañana' }) });
  assert.strictEqual(r.status, 400);
  r = await fetch(`${base}/api/invitations`, { method: 'POST', body: form({ ...valid, name: '' }) });
  assert.strictEqual(r.status, 400);
  r = await fetch(`${base}/api/invitations`, { method: 'POST', body: form({ ...valid, age: '500' }) });
  assert.strictEqual(r.status, 400);
});

test('vista previa para redes (Open Graph) en el inicio y en la invitación', async () => {
  let html = await (await fetch(`${base}/`)).text();
  assert.match(html, /<meta property="og:title" content="Cartitas · Invitaciones digitales" \/>/);
  assert.match(html, new RegExp(`<meta property="og:image" content="${base}/img/og-cartitas.jpg" />`));

  // Nombre con caracteres HTML: tiene que quedar escapado, sin romper la página.
  const r = await fetch(`${base}/api/invitations`, { method: 'POST', body: form({ ...valid, name: 'Ana "<b>"', place: 'Club & Bar' }, [PNG]) });
  const { id, ownerToken } = await r.json();

  // Antes de pagar: vista previa genérica, sin datos personales.
  html = await (await fetch(`${base}/i/${id}`)).text();
  assert.match(html, /<meta property="og:title" content="¡Estás invitado\/a! · Cartitas" \/>/);
  assert.doesNotMatch(html, /Ana/);

  await fetch(`${base}/api/invitations/${id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ownerToken }) });
  html = await (await fetch(`${base}/i/${id}`)).text();
  assert.match(html, /<meta property="og:title" content="¡Estás invitado\/a al cumpleaños de Ana &quot;&lt;b&gt;&quot;! 🎉" \/>/);
  assert.match(html, /<meta property="og:description" content="Jueves, 14 de noviembre · 21:00 hs · Club &amp; Bar" \/>/);
  assert.match(html, new RegExp(`<meta property="og:image" content="${base}/uploads/[A-Za-z0-9_-]+\\.png" />`));
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /Creá la tuya/);
});

test('ubicación exacta: se guarda si es válida y se rechaza si no', async () => {
  let r = await fetch(`${base}/api/invitations`, { method: 'POST', body: form({ ...valid, lat: '-31.416668', lng: '-64.183334' }) });
  assert.strictEqual(r.status, 201);
  const { id, ownerToken } = await r.json();
  const inv = (await (await fetch(`${base}/api/invitations/${id}?token=${ownerToken}`)).json()).invitation;
  assert.strictEqual(inv.lat, -31.416668);
  assert.strictEqual(inv.lng, -64.183334);

  // Sin ubicación: queda vacía.
  r = await fetch(`${base}/api/invitations`, { method: 'POST', body: form(valid) });
  const b = await r.json();
  const sin = (await (await fetch(`${base}/api/invitations/${b.id}?token=${b.ownerToken}`)).json()).invitation;
  assert.strictEqual(sin.lat, null);

  // Solo una coordenada, fuera de rango o texto: error.
  for (const bad of [{ lat: '-31.4' }, { lat: '95', lng: '10' }, { lat: 'abc', lng: '10' }]) {
    r = await fetch(`${base}/api/invitations`, { method: 'POST', body: form({ ...valid, ...bad }) });
    assert.strictEqual(r.status, 400, JSON.stringify(bad));
  }
});
