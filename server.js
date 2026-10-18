const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');

const config = require('./src/config');
const templates = require('./src/templates');
const db = require('./src/db');
const store = require('./src/store');
const payments = require('./src/payments');
const social = require('./src/social');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '20kb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.limits.maxImageBytes, files: config.limits.maxImages, fields: 20 },
});

// ---------- utilidades ----------

function baseUrl(req) {
  return config.publicUrl || `${req.protocol}://${req.get('host')}`;
}

function invitationUrl(req, inv) {
  return `${baseUrl(req)}/i/${inv.id}`;
}

// Detecta el tipo real de imagen por sus primeros bytes (no confiamos en el mimetype del cliente).
function detectImage(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf.toString('ascii', 0, 4) === 'GIF8') return 'gif';
  return null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

// Express 4 no atrapa los errores de funciones async: este envoltorio los pasa al manejador de errores.
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function validateBirthday(body) {
  const errors = [];
  const { limits } = config;
  const tpl = templates.cumpleanos;

  const name = str(body.name);
  const age = str(body.age);
  const date = str(body.date);
  const place = str(body.place);
  const note = str(body.note).replace(/\r\n/g, '\n');
  const theme = str(body.theme) || tpl.themes[0];

  if (!name) errors.push('Ingresá el nombre del cumpleañero/a.');
  if (name.length > limits.maxNameChars) errors.push(`El nombre no puede superar ${limits.maxNameChars} caracteres.`);
  if (age && !(/^\d{1,3}$/.test(age) && +age >= 1 && +age <= 120)) errors.push('La edad debe ser un número entre 1 y 120.');
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) errors.push('Elegí una fecha y hora válidas.');
  if (place.length > limits.maxPlaceChars) errors.push(`El lugar no puede superar ${limits.maxPlaceChars} caracteres.`);
  if ([...note].length > limits.maxNoteChars) errors.push(`La nota no puede superar ${limits.maxNoteChars} caracteres.`);
  if (!tpl.themes.includes(theme)) errors.push('Estilo de tarjeta inválido.');

  return { errors, data: { name, age: age ? Number(age) : null, date, place, note, theme } };
}

function publicView(inv) {
  const { ownerToken, ...rest } = inv;
  return rest;
}

// ---------- API ----------

app.get('/api/templates', (req, res) => {
  res.json({ templates: Object.values(templates), limits: config.limits });
});

app.post('/api/invitations', (req, res) => {
  upload.array('images', config.limits.maxImages)(req, res, async (err) => {
    if (err) {
      const msg =
        err.code === 'LIMIT_FILE_SIZE' ? 'Cada imagen puede pesar como máximo 5 MB.'
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? `Podés subir como máximo ${config.limits.maxImages} imágenes.`
        : 'No se pudo procesar el formulario.';
      return res.status(400).json({ errors: [msg] });
    }

    const templateId = str(req.body.template) || 'cumpleanos';
    const tpl = templates[templateId];
    if (!tpl || !tpl.available) return res.status(400).json({ errors: ['Esa carta todavía no está disponible.'] });

    const { errors, data } = validateBirthday(req.body);
    const files = req.files || [];
    const kinds = files.map((f) => detectImage(f.buffer));
    if (kinds.some((k) => !k)) errors.push('Solo se aceptan imágenes JPG, PNG, WEBP o GIF.');
    if (errors.length) return res.status(400).json({ errors });

    const filenames = files.map((f, i) => `${store.newId(12)}.${kinds[i]}`);
    let inv;
    try {
      files.forEach((f, i) => fs.writeFileSync(path.join(store.uploadsDir, filenames[i]), f.buffer));
      inv = await store.create({
        template: tpl.id,
        price: tpl.price,
        currency: tpl.currency,
        ...data,
        images: filenames.map((name) => `/uploads/${name}`),
      });
    } catch (e) {
      // Si no se pudo guardar, borramos las fotos para no dejar archivos huérfanos.
      filenames.forEach((name) => fs.rm(path.join(store.uploadsDir, name), { force: true }, () => {}));
      console.error(e);
      return res.status(500).json({ errors: ['No se pudo guardar la invitación. Probá de nuevo.'] });
    }

    try {
      const checkout = await payments.createCheckout(inv, baseUrl(req));
      res.status(201).json({ id: inv.id, ownerToken: inv.ownerToken, checkoutUrl: checkout.url });
    } catch (e) {
      console.error(e);
      res.status(500).json({ errors: ['No se pudo iniciar el pago.'] });
    }
  });
});

// Vista de la invitación. Si no está paga, solo la puede ver su dueño (con token) como vista previa.
app.get('/api/invitations/:id', asyncRoute(async (req, res) => {
  const inv = await store.get(req.params.id);
  if (!inv) return res.status(404).json({ errors: ['Invitación no encontrada.'] });
  const isOwner = store.safeEqual(req.query.token, inv.ownerToken);
  if (inv.status !== 'paid' && !isOwner) {
    return res.status(402).json({ errors: ['Esta invitación todavía no está activa.'] });
  }
  res.json({ invitation: publicView(inv), url: invitationUrl(req, inv), isOwner });
}));

// Pago simulado (solo en modo demo).
app.post('/api/invitations/:id/pay', asyncRoute(async (req, res) => {
  if (config.paymentMode !== 'demo') return res.status(404).end();
  const inv = await store.get(req.params.id);
  if (!inv) return res.status(404).json({ errors: ['Invitación no encontrada.'] });
  if (!store.safeEqual(req.body && req.body.token, inv.ownerToken)) {
    return res.status(403).json({ errors: ['No autorizado.'] });
  }
  await store.markPaid(inv.id);
  res.json({ ok: true, url: invitationUrl(req, inv) });
}));

// Código QR (PNG) que apunta a la invitación. Solo existe una vez paga.
app.get('/api/invitations/:id/qr.png', asyncRoute(async (req, res) => {
  const inv = await store.get(req.params.id);
  if (!inv || inv.status !== 'paid') return res.status(404).end();
  const png = await QRCode.toBuffer(invitationUrl(req, inv), {
    type: 'png',
    width: 600,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'public, max-age=86400');
  if (req.query.download) res.set('Content-Disposition', `attachment; filename="invitacion-${inv.id}.png"`);
  res.send(png);
}));

// ---------- archivos estáticos ----------

app.use('/uploads', express.static(store.uploadsDir, {
  maxAge: '7d',
  setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
}));
const SITE_DESCRIPTION = 'Creá invitaciones digitales personalizadas con fotos, fecha y un mensaje, y compartilas con un código QR.';

// Inicio con vista previa para redes sociales.
app.get('/', (req, res) => {
  res.type('html').send(social.renderPage('index.html', {
    title: 'Cartitas · Invitaciones digitales',
    description: SITE_DESCRIPTION,
    url: `${baseUrl(req)}/`,
    image: `${baseUrl(req)}/img/og-cartitas.jpg`,
  }));
});

// Página del invitado. La vista previa muestra el nombre, la fecha y la primera foto,
// pero solo si la invitación está paga (si no, una vista previa genérica).
app.get('/i/:id', asyncRoute(async (req, res) => {
  const inv = await store.get(req.params.id);
  const base = baseUrl(req);
  let og = {
    title: '¡Estás invitado/a! · Cartitas',
    description: SITE_DESCRIPTION,
    url: `${base}/i/${encodeURIComponent(req.params.id)}`,
    image: `${base}/img/og-cartitas.jpg`,
  };
  if (inv && inv.status === 'paid') {
    og = {
      title: `¡Estás invitado/a al cumpleaños de ${inv.name}! 🎉`,
      description: [social.describeDate(inv.date), inv.place].filter(Boolean).join(' · '),
      url: invitationUrl(req, inv),
      image: inv.images.length ? `${base}${inv.images[0]}` : `${base}/img/og-cartitas.jpg`,
    };
  }
  res.type('html').send(social.renderPage('invitacion.html', og));
}));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

// Errores inesperados (por ejemplo, la base de datos no responde).
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ errors: ['Error interno del servidor. Probá de nuevo en unos minutos.'] });
});

// Direcciones IPv4 de la red local (ej. 192.168.1.35), para abrir la web desde el celular.
function localIps() {
  return Object.values(require('os').networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

function openBrowser(url) {
  const { exec } = require('child_process');
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

async function start() {
  if (!config.databaseUrl) {
    console.error('\nFalta configurar la base de datos.');
    console.error('Copiá el archivo .env.example como .env y completá DATABASE_URL (ver README).\n');
    process.exit(1);
  }
  try {
    await db.migrate();
  } catch (e) {
    console.error('\nNo se pudo conectar a PostgreSQL:', e.message);
    console.error('Revisá que la base esté encendida y que DATABASE_URL en .env sea correcta.\n');
    process.exit(1);
  }
  app.listen(config.port, () => {
    const url = `http://localhost:${config.port}`;
    console.log(`\nServidor listo (pagos: ${config.paymentMode})`);
    console.log(`  En esta computadora:  ${url}`);
    localIps().forEach((ip) => console.log(`  Desde tu celular:     http://${ip}:${config.port}  (misma red WiFi)`));
    console.log('\nPara apagarlo, cerrá esta ventana o apretá Ctrl + C.\n');
    if (process.env.ABRIR_NAVEGADOR) openBrowser(url);
  });
}

if (require.main === module) start();

module.exports = app;
