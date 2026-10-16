// Almacenamiento simple en archivos JSON + carpeta de imágenes.
// Suficiente para empezar; se puede reemplazar por una base de datos real
// (PostgreSQL, Firestore, etc.) manteniendo la misma interfaz.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { dataDir } = require('./config');

const invitationsDir = path.join(dataDir, 'invitations');
const uploadsDir = path.join(dataDir, 'uploads');
fs.mkdirSync(invitationsDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

const ID_RE = /^[A-Za-z0-9_-]{10,40}$/;

function newId(bytes = 9) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function fileFor(id) {
  if (!ID_RE.test(id)) return null;
  return path.join(invitationsDir, `${id}.json`);
}

function save(inv) {
  const file = fileFor(inv.id);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(inv, null, 2));
  fs.renameSync(tmp, file);
  return inv;
}

function get(id) {
  const file = fileFor(id);
  if (!file || !fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function create(data) {
  const inv = {
    id: newId(),
    // Token secreto: solo quien creó la invitación puede pagarla / verla antes de pagar.
    ownerToken: newId(18),
    status: 'pending_payment',
    createdAt: new Date().toISOString(),
    paidAt: null,
    ...data,
  };
  return save(inv);
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

module.exports = { create, get, save, newId, safeEqual, uploadsDir };
