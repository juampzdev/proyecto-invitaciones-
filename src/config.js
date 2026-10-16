// Configuración central. Todo se puede sobreescribir con variables de entorno.
module.exports = {
  port: Number(process.env.PORT) || 3000,
  // URL pública del sitio; se usa para armar el link que va dentro del QR.
  // Si no se define, se deduce de la request.
  publicUrl: process.env.PUBLIC_URL ? process.env.PUBLIC_URL.replace(/\/$/, '') : null,
  dataDir: process.env.DATA_DIR || require('path').join(__dirname, '..', 'data'),
  // "demo" simula el pago. Más adelante se agrega "mercadopago", "stripe", etc.
  paymentMode: process.env.PAYMENT_MODE || 'demo',
  limits: {
    maxImages: 3,
    maxImageBytes: 5 * 1024 * 1024,
    maxNoteChars: 256,
    maxNameChars: 60,
    maxPlaceChars: 120,
  },
};
