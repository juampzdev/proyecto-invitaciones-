# Cartitas 💌 — Cartas e invitaciones digitales

Sitio para vender cartas digitales personalizables (invitaciones de cumpleaños, pedidos de noviazgo, citas…).
El cliente personaliza la carta, paga, y obtiene un **link + código QR** para compartir con sus invitados.

## Estado actual

**Invitación de cumpleaños** (disponible):
- Nombre, edad, fecha y hora, lugar.
- Hasta **3 fotos** (JPG/PNG/WEBP/GIF; se optimizan en el navegador antes de subirse; máx. 5 MB c/u).
- Nota de hasta **256 caracteres** con contador.
- 4 estilos de tarjeta (Fiesta, Pastel, Noche, Dorado) con vista previa en vivo.
- Pago (por ahora **simulado**) → página con **código QR**, link, copiar, compartir, WhatsApp y descarga del QR.
- Vista del invitado: tarjeta animada, cuenta regresiva, "Agendar en mi calendario" (.ics) y "Cómo llegar" (Google Maps).
- Antes de pagar, solo el creador (con su token secreto) puede ver la vista previa; los invitados ven la carta recién cuando está paga.

Pedido de noviazgo y cita aparecen como "Próximamente".

## Correr localmente

**La forma más fácil:** doble clic en `iniciar-windows.bat` (Windows) o `iniciar-mac.command` (Mac).
La primera vez instala las dependencias; después arranca el servidor y abre el navegador solo.
En la ventana aparece también la dirección para abrir la web desde el celular (misma red WiFi).

Desde la terminal:

```bash
npm install
npm start          # http://localhost:3000
npm test           # tests de la API
```

Variables de entorno opcionales:

| Variable       | Default  | Uso |
|----------------|----------|-----|
| `PORT`         | `3000`   | Puerto del servidor |
| `PUBLIC_URL`   | (auto)   | URL pública (ej. `https://cartitas.com`); es la que va dentro del QR |
| `DATA_DIR`     | `./data` | Dónde se guardan las invitaciones (JSON) y las fotos |
| `PAYMENT_MODE` | `demo`   | `demo` aprueba el pago sin cobrar |

## Estructura

```
server.js            API + archivos estáticos (Express)
src/config.js        límites y configuración
src/templates.js     catálogo de cartas y precios
src/store.js         almacenamiento (JSON en disco; reemplazable por una base de datos)
src/payments.js      capa de pagos (acá se integra Mercado Pago / Stripe)
public/              frontend (HTML/CSS/JS sin build)
  crear.html         editor con vista previa
  pago.html          checkout
  listo.html         QR y opciones para compartir
  invitacion.html    lo que ven los invitados (/i/:id)
test/                tests de la API (node:test)
```

## Próximos pasos sugeridos

1. **Pagos reales**: implementar Mercado Pago (Checkout Pro) en `src/payments.js` y un webhook
   `POST /api/payments/webhook` que marque la invitación como `paid`.
2. **Deploy**: Render / Railway / Fly.io con un disco persistente para `DATA_DIR`
   (o migrar `store.js` a una base de datos y las fotos a S3/Cloudinary).
3. Nuevas plantillas: noviazgo, cita, etc.
4. Confirmación de asistencia (RSVP) de los invitados.
