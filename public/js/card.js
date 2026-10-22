// Dibuja la tarjeta de cumpleaños. Se usa en la vista previa del editor y en la invitación final.
// Todo el contenido del cliente se inserta con textContent para evitar inyección de HTML.
(function () {
  const CONFETTI_COLORS = ['#ff6f91', '#ffc75f', '#845ec2', '#00c9a7', '#4d8076', '#f9f871'];

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // "2026-11-14T21:00" -> Date local (sin conversión de zona horaria)
  function parseLocal(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || '');
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  }

  function formatDate(d) {
    const s = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatTime(d) {
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' hs';
  }

  function confetti(n) {
    const box = el('div', 'confetti');
    for (let i = 0; i < n; i++) {
      const c = el('i');
      c.style.left = Math.random() * 100 + '%';
      c.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      c.style.animationDuration = 6 + Math.random() * 8 + 's';
      c.style.animationDelay = -Math.random() * 12 + 's';
      c.style.transform = `rotate(${Math.random() * 360}deg)`;
      box.appendChild(c);
    }
    return box;
  }

  function infoItem(label, value) {
    const item = el('div', 'info-item');
    item.append(el('span', 'lbl', label), el('span', 'val', value));
    return item;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function icsFor(data, d) {
    const end = new Date(d.getTime() + 4 * 3600 * 1000);
    const fmt = (x) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
    const esc = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cartas//Invitaciones//ES', 'BEGIN:VEVENT',
      `UID:${Date.now()}@cartas`, `DTSTART:${fmt(d)}`, `DTEND:${fmt(end)}`,
      `SUMMARY:${esc('Cumpleaños de ' + data.name)}`,
      data.place ? `LOCATION:${esc(data.place)}` : null,
      hasCoords(data) ? `GEO:${data.lat};${data.lng}` : null,
      data.note ? `DESCRIPTION:${esc(data.note)}` : null,
      'END:VEVENT', 'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');
  }

  function countdown(d) {
    const box = el('div', 'countdown');
    const parts = [['días', 86400], ['horas', 3600], ['min', 60]];
    const cells = parts.map(([lbl]) => {
      const c = el('div');
      const b = el('b', null, '0');
      c.append(b, el('small', null, lbl));
      box.appendChild(c);
      return b;
    });
    function tick() {
      let s = Math.max(0, Math.floor((d - Date.now()) / 1000));
      parts.forEach(([, secs], i) => { cells[i].textContent = Math.floor(s / secs); s %= secs; });
    }
    tick();
    setInterval(tick, 30000);
    return box;
  }

  // iPhone, iPad y Mac (los iPad nuevos se presentan como "Macintosh").
  function isApple() {
    return /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  }

  function mapLink(text, url, cls) {
    const a = el('a', cls, text);
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }

  function hasCoords(data) {
    return Number.isFinite(data.lat) && Number.isFinite(data.lng);
  }

  // Links de mapas. Con ubicación marcada llevan al punto exacto (con ruta);
  // si no, buscan el texto del campo "Lugar".
  function mapUrls(data) {
    if (hasCoords(data)) {
      const ll = `${data.lat},${data.lng}`;
      return {
        google: `https://www.google.com/maps/dir/?api=1&destination=${ll}`,
        apple: `https://maps.apple.com/?daddr=${ll}`,
      };
    }
    const q = encodeURIComponent(data.place);
    return {
      google: `https://www.google.com/maps/search/?api=1&query=${q}`,
      apple: `https://maps.apple.com/?q=${q}`,
    };
  }

  // "Cómo llegar": en Android y Windows abre Google Maps directo.
  // En dispositivos Apple pregunta si abrir Google Maps o Apple Maps.
  function mapsButton(data) {
    const { google, apple } = mapUrls(data);
    if (!isApple()) return mapLink('📍 Cómo llegar', google, 'btn secondary');

    const box = el('div', 'maps');
    const toggle = el('button', 'btn secondary', '📍 Cómo llegar');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    const choice = el('div', 'maps-choice');
    choice.hidden = true;
    choice.append(
      el('p', 'maps-question', '¿Con qué app querés abrirlo?'),
      mapLink('Google Maps', google, 'btn secondary'),
      mapLink('Apple Maps', apple, 'btn secondary')
    );
    toggle.addEventListener('click', () => {
      choice.hidden = !choice.hidden;
      toggle.setAttribute('aria-expanded', String(!choice.hidden));
    });
    box.append(toggle, choice);
    return box;
  }

  function renderCard(container, data, opts = {}) {
    container.replaceChildren();
    const card = el('article', `card theme-${data.theme || 'fiesta'}`);
    card.appendChild(confetti(opts.confetti ?? 24));

    const inner = el('div', 'card-inner');
    inner.appendChild(el('p', 'kicker', '¡Estás invitado/a a mi cumpleaños!'));
    inner.appendChild(el('h1', 'title', data.name || 'Tu nombre'));
    if (data.age) inner.appendChild(el('span', 'age', `${data.age} años`));

    const imgs = (data.images || []).slice(0, 3);
    if (imgs.length) {
      const gal = el('div', `photos-view n${imgs.length}`);
      imgs.forEach((src) => {
        const img = el('img');
        img.src = src;
        img.alt = 'Foto de la invitación';
        img.loading = 'lazy';
        gal.appendChild(img);
      });
      inner.appendChild(gal);
    }

    const d = parseLocal(data.date);
    const info = el('div', 'info');
    info.appendChild(infoItem('Fecha', d ? formatDate(d) : 'Elegí una fecha'));
    if (d) info.appendChild(infoItem('Hora', formatTime(d)));
    if (data.place) info.appendChild(infoItem('Lugar', data.place));
    inner.appendChild(info);

    // Mapita con el pin (solo en la vista del invitado; en el editor ya está el mapa del formulario).
    let mapBox = null;
    if (opts.interactive && hasCoords(data) && window.L) {
      mapBox = el('div', 'card-map');
      mapBox.setAttribute('aria-label', 'Mapa con la ubicación del lugar');
      inner.appendChild(mapBox);
    }

    inner.appendChild(el('p', 'note', data.note || ''));

    if (d && d > Date.now()) inner.appendChild(countdown(d));

    if (opts.interactive && d) {
      const actions = el('div', 'card-actions');
      const cal = el('a', 'btn', '📅 Agendar en mi calendario');
      cal.href = URL.createObjectURL(new Blob([icsFor(data, d)], { type: 'text/calendar' }));
      cal.download = 'cumpleanos.ics';
      actions.appendChild(cal);
      if (data.place || hasCoords(data)) actions.appendChild(mapsButton(data));
      inner.appendChild(actions);
    }

    card.appendChild(inner);
    container.appendChild(card);

    // Leaflet necesita que el contenedor ya esté en la página para dibujar el mapa.
    if (mapBox) {
      const map = L.map(mapBox, {
        scrollWheelZoom: false,
        dragging: !L.Browser.mobile, // en celular, deslizar el dedo sigue moviendo la página
        tap: false,
      }).setView([data.lat, data.lng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      L.marker([data.lat, data.lng]).addTo(map);
    }
  }

  window.Card = { renderCard, parseLocal, formatDate, formatTime };
})();
