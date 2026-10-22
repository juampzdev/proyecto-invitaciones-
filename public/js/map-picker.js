// Mapa para marcar la ubicación exacta del lugar al crear la invitación.
// Usa Leaflet (librería de mapas) con mapas de OpenStreetMap: gratis y sin cuenta.
// Guarda las coordenadas en los campos ocultos "lat" y "lng" del formulario.
(function () {
  const mapBox = document.getElementById('pickerMap');
  if (!mapBox || !window.L) return;

  const latInput = document.getElementById('lat');
  const lngInput = document.getElementById('lng');
  const hint = document.getElementById('mapHint');
  const placeInput = document.getElementById('place');
  const clearBtn = document.getElementById('mapClear');
  const DEFAULT_HINT = hint.textContent;

  // Vista inicial: Argentina completa.
  const map = L.map(mapBox, { scrollWheelZoom: false }).setView([-38.4, -63.6], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  let marker = null;

  function say(text, isError) {
    hint.textContent = text;
    hint.classList.toggle('hint-error', !!isError);
  }

  function setPoint(lat, lng, zoom) {
    lat = Math.round(lat * 1e6) / 1e6; // 6 decimales ≈ 10 cm de precisión
    lng = Math.round(lng * 1e6) / 1e6;
    if (!marker) {
      marker = L.marker([lat, lng], { draggable: true, autoPan: true }).addTo(map);
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        setPoint(p.lat, p.lng);
      });
    } else {
      marker.setLatLng([lat, lng]);
    }
    latInput.value = lat;
    lngInput.value = lng;
    if (zoom) map.setView([lat, lng], zoom);
    clearBtn.hidden = false;
    say('✓ Ubicación marcada. Si no es exacta, arrastrá el pin o tocá otro punto del mapa.');
  }

  function clearPoint() {
    if (marker) map.removeLayer(marker);
    marker = null;
    latInput.value = '';
    lngInput.value = '';
    clearBtn.hidden = true;
    say(DEFAULT_HINT);
  }

  map.on('click', (e) => setPoint(e.latlng.lat, e.latlng.lng));
  clearBtn.addEventListener('click', clearPoint);

  // Busca la dirección escrita en "Lugar" con Nominatim (el buscador de OpenStreetMap).
  document.getElementById('mapSearch').addEventListener('click', async () => {
    const q = placeInput.value.trim();
    if (!q) {
      say('Primero escribí la dirección en el campo "Lugar".', true);
      placeInput.focus();
      return;
    }
    say('Buscando…');
    try {
      const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=es&q=' + encodeURIComponent(q);
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      const results = res.ok ? await res.json() : [];
      if (!results.length) {
        say('No encontramos esa dirección. Probá agregando la ciudad, o tocá el mapa para marcar el lugar.', true);
        return;
      }
      setPoint(Number(results[0].lat), Number(results[0].lon), 17);
    } catch {
      say('No se pudo buscar en este momento. Tocá el mapa para marcar el lugar.', true);
    }
  });

  // ---------- Autocompletar la dirección mientras se escribe ----------
  // Usa Photon (buscador de OpenStreetMap pensado para autocompletar; Nominatim no lo permite).
  // Prioriza resultados cerca de la zona que muestra el mapa.
  const list = document.getElementById('placeSuggestions');
  const form = placeInput.form;
  let results = [];
  let active = -1;
  let timer = null;
  let controller = null;

  function unique(parts) {
    return parts.filter((p, i) => p && parts.indexOf(p) === i);
  }

  // Convierte un resultado de Photon en { main, detail, full, lat, lng }.
  function describe(f) {
    const p = f.properties;
    const street = unique([p.street, p.housenumber]).join(' ');
    const main = unique([p.name, street]).join(', ') || p.city || p.state || '';
    const detail = unique([p.city || p.county, p.state, p.country]).filter((x) => x !== main).join(', ');
    const full = unique([p.name, street, p.city || p.county, p.state]).join(', ').slice(0, 120);
    return { main, detail, full, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
  }

  function closeList() {
    list.hidden = true;
    list.replaceChildren();
    placeInput.setAttribute('aria-expanded', 'false');
    placeInput.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function highlight(i) {
    active = i;
    [...list.children].forEach((li, j) => li.setAttribute('aria-selected', String(j === i)));
    if (i >= 0) placeInput.setAttribute('aria-activedescendant', list.children[i].id);
  }

  function choose(i) {
    const r = results[i];
    if (!r) return;
    placeInput.value = r.full;
    closeList();
    setPoint(r.lat, r.lng, 17);
    // Avisa al editor para que actualice la vista previa.
    form.dispatchEvent(new Event('input'));
  }

  function showList() {
    list.replaceChildren();
    results.forEach((r, i) => {
      const li = document.createElement('li');
      li.id = `place-opt-${i}`;
      li.setAttribute('role', 'option');
      const main = document.createElement('strong');
      main.textContent = r.main;
      const detail = document.createElement('span');
      detail.textContent = r.detail;
      li.append(main, detail);
      // mousedown (no click) para elegir antes de que el campo pierda el foco.
      li.addEventListener('mousedown', (e) => { e.preventDefault(); choose(i); });
      list.appendChild(li);
    });
    list.hidden = !results.length;
    placeInput.setAttribute('aria-expanded', String(!!results.length));
    active = -1;
  }

  // Minúsculas y sin tildes: "Colón" y "colon" cuentan igual.
  function normalize(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // Reordena: primero las sugerencias que contienen más palabras de lo que se escribió.
  function rank(list, q) {
    const words = normalize(q).split(/[\s,.]+/).filter((w) => w.length >= 2);
    const score = (r) => {
      const text = normalize(`${r.main} ${r.detail}`);
      return words.filter((w) => text.includes(w)).length;
    };
    return list
      .map((r, i) => ({ r, i, s: score(r) }))
      .sort((a, b) => b.s - a.s || a.i - b.i) // empate: se respeta el orden de Photon
      .map((x) => x.r);
  }

  async function suggest(q) {
    if (controller) controller.abort(); // cancela la búsqueda anterior si todavía no volvió
    controller = new AbortController();
    const c = map.getCenter();
    const url = `https://photon.komoot.io/api/?limit=8&lat=${c.lat.toFixed(4)}&lon=${c.lng.toFixed(4)}&q=` + encodeURIComponent(q);
    try {
      const res = await fetch(url, { signal: controller.signal });
      const data = res.ok ? await res.json() : { features: [] };
      results = rank(data.features.map(describe).filter((r) => r.main), q).slice(0, 5);
      if (document.activeElement === placeInput) showList();
    } catch (e) {
      if (e.name !== 'AbortError') closeList(); // sin conexión: se puede seguir escribiendo a mano
    }
  }

  placeInput.addEventListener('input', () => {
    clearTimeout(timer);
    const q = placeInput.value.trim();
    if (q.length < 3) return closeList();
    // Espera a que deje de tipear 300 ms para no buscar en cada letra.
    timer = setTimeout(() => suggest(q), 300);
  });

  placeInput.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight(Math.min(active + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') closeList();
  });

  placeInput.addEventListener('blur', () => setTimeout(closeList, 150));

  // Ubicación actual del dispositivo (útil si el cliente está en el salón).
  document.getElementById('mapLocate').addEventListener('click', () => {
    if (!navigator.geolocation || !window.isSecureContext) {
      say('Tu navegador no permite usar la ubicación acá. Buscá la dirección o tocá el mapa.', true);
      return;
    }
    say('Obteniendo tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      (pos) => setPoint(pos.coords.latitude, pos.coords.longitude, 17),
      () => say('No pudimos obtener tu ubicación (¿diste permiso?). Buscá la dirección o tocá el mapa.', true),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
})();
