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

## Base de datos (PostgreSQL)

Las invitaciones se guardan en PostgreSQL. Las tablas se crean solas al iniciar el servidor
(ver `db/schema.sql`). Necesitás una base y su dirección de conexión (`DATABASE_URL`).
Elegí **una** de estas opciones:

**A. En la nube, gratis (lo más fácil):** creá una cuenta en [Neon](https://neon.tech) o
[Supabase](https://supabase.com), creá un proyecto y copiá la *connection string*
(algo como `postgresql://usuario:clave@ep-xxx.neon.tech/neondb?sslmode=require`).

**B. Instalado en tu computadora:** descargá PostgreSQL desde https://www.postgresql.org/download/,
recordá la contraseña que elegís para el usuario `postgres` y creá una base llamada `cartitas`
(con pgAdmin, que viene incluido, o con `psql -U postgres -c "CREATE DATABASE cartitas;"`).
La URL queda: `postgres://postgres:TU_CLAVE@localhost:5432/cartitas`.

**C. Con Docker:** `docker compose up -d` levanta una base con la URL que ya trae `.env.example`.

Después hacé doble clic en `configurar-base-de-datos.bat` (Windows) o `configurar-base-de-datos.command`
(Mac): te pide pegar la URL y crea el archivo `.env`. También podés copiar `.env.example` como `.env`
y editarlo a mano. El archivo `.env` no se sube a GitHub (contiene contraseñas).

## Correr localmente

**La forma más fácil:** doble clic en `iniciar-windows.bat` (Windows) o `iniciar-mac.command` (Mac).
Primero trae los últimos cambios de GitHub (`git pull`). Si no existe `.env`, te pide pegar la dirección de la base de datos. Después instala las dependencias,
arranca el servidor y abre el navegador solo. En la ventana aparece también la dirección para
abrir la web desde el celular (misma red WiFi).

Desde la terminal:

```bash
npm install
npm start          # http://localhost:3000
```

### Tests

Los tests usan una base **aparte**, que se vacía en cada corrida (nunca uses tu base real):

```bash
# crear la base de prueba una vez: CREATE DATABASE cartitas_test;
TEST_DATABASE_URL=postgres://postgres:TU_CLAVE@localhost:5432/cartitas_test npm test
```

En Windows (PowerShell): `$env:TEST_DATABASE_URL="postgres://..."; npm test`.
Sin `TEST_DATABASE_URL` los tests se saltean.

### Variables de entorno

| Variable            | Default  | Uso |
|---------------------|----------|-----|
| `DATABASE_URL`      | —        | **Obligatoria.** Conexión a PostgreSQL |
| `PORT`              | `3000`   | Puerto del servidor |
| `PUBLIC_URL`        | (auto)   | URL pública (ej. `https://cartitas.com`); es la que va dentro del QR |
| `DATA_DIR`          | `./data` | Dónde se guardan las fotos |
| `PAYMENT_MODE`      | `demo`   | `demo` aprueba el pago sin cobrar |
| `TEST_DATABASE_URL` | —        | Base de datos para `npm test` |

## Estructura

```
server.js            API + archivos estáticos (Express)
db/schema.sql        tablas de PostgreSQL (invitations, invitation_images)
src/config.js        límites y configuración (lee .env)
src/db.js            conexión a PostgreSQL (pool, transacciones, migración)
src/store.js         consultas SQL de las invitaciones
src/templates.js     catálogo de cartas y precios
src/payments.js      capa de pagos (acá se integra Mercado Pago / Stripe)
public/              frontend (HTML/CSS/JS sin build)
  crear.html         editor con vista previa
  pago.html          checkout
  listo.html         QR y opciones para compartir
  invitacion.html    lo que ven los invitados (/i/:id)
test/                tests de la API (node:test)
```

## Próximos pasos sugeridos

1. **Fotos en la nube**: guardarlas en Cloudflare R2 / S3 / Cloudinary en lugar de `data/uploads`
   (necesario para publicar la web; la base ya guarda solo la URL).
2. **Deploy**: Render / Railway con `DATABASE_URL` apuntando a Neon o Supabase.
3. **Pagos reales**: Mercado Pago (Checkout Pro) en `src/payments.js` y un webhook
   `POST /api/payments/webhook` que marque la invitación como `paid`.
4. Nuevas plantillas: noviazgo, cita, etc.
5. Confirmación de asistencia (RSVP) de los invitados.
