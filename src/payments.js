// Capa de pagos. En modo "demo" el pago se aprueba al instante.
// Para producción: crear la preferencia en Mercado Pago / Stripe en
// createCheckout() y marcar como pagada desde el webhook del proveedor.
const config = require('./config');

async function createCheckout(inv, baseUrl) {
  if (config.paymentMode === 'demo') {
    return { mode: 'demo', url: `${baseUrl}/pago.html?id=${inv.id}&token=${inv.ownerToken}` };
  }
  throw new Error(`Modo de pago no soportado todavía: ${config.paymentMode}`);
}

module.exports = { createCheckout };
