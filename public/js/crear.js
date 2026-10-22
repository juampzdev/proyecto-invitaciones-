(function () {
  const MAX_IMAGES = 3;
  const MAX_SIDE = 1600;
  const form = document.getElementById('form');
  const preview = document.getElementById('preview');
  const errorsBox = document.getElementById('errors');
  const note = document.getElementById('note');
  const counter = document.getElementById('counter');
  const photosBox = document.getElementById('photos');
  const fileInput = document.getElementById('fileInput');
  const submit = document.getElementById('submit');
  const dateInput = document.getElementById('date');

  const params = new URLSearchParams(location.search);
  const templateId = params.get('t') || 'cumpleanos';
  let photos = []; // { blob, url, name }

  // No permitir fechas pasadas.
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  dateInput.min = now.toISOString().slice(0, 16);

  fetch('/api/templates').then((r) => r.json()).then(({ templates }) => {
    const t = templates.find((x) => x.id === templateId);
    if (!t || !t.available) { location.href = '/'; return; }
    document.getElementById('price').textContent =
      new Intl.NumberFormat('es-AR', { style: 'currency', currency: t.currency, maximumFractionDigits: 0 }).format(t.price);
  });

  function data() {
    const fd = new FormData(form);
    return {
      name: (fd.get('name') || '').trim(),
      age: (fd.get('age') || '').trim(),
      date: fd.get('date') || '',
      place: (fd.get('place') || '').trim(),
      note: fd.get('note') || '',
      theme: fd.get('theme') || 'fiesta',
      lat: fd.get('lat') || '',
      lng: fd.get('lng') || '',
      images: photos.map((p) => p.url),
    };
  }

  function update() {
    counter.textContent = `${note.value.length} / 256`;
    counter.classList.toggle('over', note.value.length > 256);
    Card.renderCard(preview, data(), { confetti: 16 });
  }

  function renderPhotos() {
    photosBox.replaceChildren();
    for (let i = 0; i < MAX_IMAGES; i++) {
      const slot = document.createElement('div');
      slot.className = 'photo-slot';
      const p = photos[i];
      if (p) {
        const img = document.createElement('img');
        img.src = p.url;
        img.alt = `Foto ${i + 1}`;
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'remove';
        rm.setAttribute('aria-label', `Quitar foto ${i + 1}`);
        rm.textContent = '✕';
        rm.onclick = () => {
          URL.revokeObjectURL(p.url);
          photos.splice(i, 1);
          renderPhotos();
          update();
        };
        slot.append(img, rm);
      } else {
        slot.textContent = '+';
        slot.setAttribute('role', 'button');
        slot.setAttribute('tabindex', '0');
        slot.setAttribute('aria-label', 'Agregar foto');
        slot.onclick = () => fileInput.click();
        slot.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } };
      }
      photosBox.appendChild(slot);
    }
  }

  // Reduce fotos grandes (las de celular suelen pesar varios MB) antes de subirlas.
  async function optimize(file) {
    if (file.type === 'image/gif') return file;
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
      return blob && blob.size < file.size ? blob : file;
    } catch {
      return file;
    }
  }

  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files];
    fileInput.value = '';
    const room = MAX_IMAGES - photos.length;
    if (files.length > room) showErrors([`Podés subir como máximo ${MAX_IMAGES} fotos.`]);
    for (const f of files.slice(0, room)) {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) { showErrors(['Solo se aceptan imágenes JPG, PNG, WEBP o GIF.']); continue; }
      const blob = await optimize(f);
      if (blob.size > 5 * 1024 * 1024) { showErrors(['Cada imagen puede pesar como máximo 5 MB.']); continue; }
      photos.push({ blob, url: URL.createObjectURL(blob), name: f.name });
    }
    renderPhotos();
    update();
  });

  function showErrors(list) {
    errorsBox.replaceChildren();
    if (!list.length) return;
    const ul = document.createElement('ul');
    list.forEach((m) => ul.appendChild(Object.assign(document.createElement('li'), { textContent: m })));
    errorsBox.appendChild(ul);
    errorsBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function validate(d) {
    const errs = [];
    if (!d.name) errs.push('Ingresá el nombre del cumpleañero/a.');
    if (!d.date) errs.push('Elegí la fecha y hora del cumpleaños.');
    if (d.note.length > 256) errs.push('La nota no puede superar 256 caracteres.');
    return errs;
  }

  form.addEventListener('input', update);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = data();
    const errs = validate(d);
    if (errs.length) return showErrors(errs);
    showErrors([]);

    const fd = new FormData();
    fd.append('template', templateId);
    ['name', 'age', 'date', 'place', 'note', 'theme', 'lat', 'lng'].forEach((k) => fd.append(k, d[k]));
    photos.forEach((p, i) => fd.append('images', p.blob, p.blob.type === 'image/jpeg' ? `foto${i + 1}.jpg` : p.name));

    submit.disabled = true;
    submit.textContent = 'Guardando…';
    try {
      const res = await fetch('/api/invitations', { method: 'POST', body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw body.errors || ['Ocurrió un error. Probá de nuevo.'];
      location.href = body.checkoutUrl;
    } catch (err) {
      showErrors(Array.isArray(err) ? err : ['No se pudo conectar con el servidor.']);
      submit.disabled = false;
      submit.textContent = 'Continuar al pago';
    }
  });

  renderPhotos();
  update();
})();
