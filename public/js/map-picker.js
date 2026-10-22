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
