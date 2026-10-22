// Acceso a los datos de las invitaciones (PostgreSQL).
// El resto de la app solo usa estas funciones; no sabe nada de SQL.
// Las fotos todavía se guardan en disco (data/uploads); la base guarda solo su URL.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { dataDir } = require('./config');
const db = require('./db');

const uploadsDir = path.join(dataDir, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const ID_RE = /^[A-Za-z0-9_-]{10,40}$/;

function newId(bytes = 9) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// Fila de la base (snake_case) -> objeto que usa la app (camelCase).
function fromRow(row) {
  return {
    id: row.id,
    ownerToken: row.owner_token,
    template: row.template,
    status: row.status,
    price: row.price,
    currency: row.currency,
    name: row.name,
    age: row.age,
    date: row.event_at.slice(0, 16).replace(' ', 'T'), // "2026-11-14 21:00:00" -> "2026-11-14T21:00"
    place: row.place,
    note: row.note,
    theme: row.theme,
    lat: row.lat,
    lng: row.lng,
    images: row.images,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

const SELECT_INVITATION = `
  SELECT i.*,
         COALESCE(array_agg(img.url ORDER BY img.position) FILTER (WHERE img.url IS NOT NULL), '{}') AS images
    FROM invitations i
    LEFT JOIN invitation_images img ON img.invitation_id = i.id
   WHERE i.id = $1
   GROUP BY i.id`;

async function get(id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) return null;
  const { rows } = await db.query(SELECT_INVITATION, [id]);
  return rows.length ? fromRow(rows[0]) : null;
}

async function create(data) {
  const id = newId();
  const ownerToken = newId(18);
  await db.transaction(async (client) => {
    await client.query(
      `INSERT INTO invitations (id, owner_token, template, price, currency, name, age, event_at, place, note, theme, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, ownerToken, data.template, data.price, data.currency, data.name, data.age, data.date, data.place, data.note, data.theme,
        data.lat ?? null, data.lng ?? null]
    );
    for (const [i, url] of data.images.entries()) {
      await client.query(
        'INSERT INTO invitation_images (invitation_id, position, url) VALUES ($1, $2, $3)',
        [id, i + 1, url]
      );
    }
  });
  return get(id);
}

// Marca la invitación como paga. Es idempotente: pagar dos veces no cambia la fecha del primer pago.
async function markPaid(id) {
  const { rowCount } = await db.query(
    `UPDATE invitations SET status = 'paid', paid_at = COALESCE(paid_at, now()) WHERE id = $1`,
    [id]
  );
  return rowCount === 1;
}

module.exports = { create, get, markPaid, newId, safeEqual, uploadsDir };
