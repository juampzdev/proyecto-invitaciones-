const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cartitas-'));
const app = require('../server');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

let base;
let server;
test.before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); }));
test.after(() => server.close());

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
});
