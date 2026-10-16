(function () {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const token = params.get('token');
  const errorsBox = document.getElementById('errors');
  const summary = document.getElementById('summary');
  const payBtn = document.getElementById('pay');

  function fail(msg) { errorsBox.textContent = msg; payBtn.disabled = true; }

  function row(label, value) {
    const li = document.createElement('li');
    li.append(Object.assign(document.createElement('span'), { textContent: label }),
      Object.assign(document.createElement('span'), { textContent: value }));
    summary.appendChild(li);
  }

  if (!id || !token) return fail('Link de pago inválido.');
  const listo = `/listo?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`;
  document.getElementById('previewLink').href = `/i/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`;

  fetch(`/api/invitations/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`)
    .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
    .then(({ ok, b }) => {
      if (!ok) return fail((b.errors || ['No encontramos la invitación.'])[0]);
      const inv = b.invitation;
      if (inv.status === 'paid') { location.replace(listo); return; }
      const d = Card.parseLocal(inv.date);
      row('Carta', 'Invitación de cumpleaños');
      row('Para', inv.name);
      if (d) row('Fecha', `${Card.formatDate(d)} · ${Card.formatTime(d)}`);
      row('Fotos', String(inv.images.length));
      row('Total', new Intl.NumberFormat('es-AR', { style: 'currency', currency: inv.currency, maximumFractionDigits: 0 }).format(inv.price));
      payBtn.textContent = 'Pagar ' + summary.lastChild.lastChild.textContent;
    })
    .catch(() => fail('No se pudo conectar con el servidor.'));

  payBtn.addEventListener('click', async () => {
    payBtn.disabled = true;
    payBtn.textContent = 'Procesando…';
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(id)}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error();
      location.href = listo;
    } catch {
      fail('No se pudo completar el pago. Probá de nuevo.');
      payBtn.disabled = false;
      payBtn.textContent = 'Pagar';
    }
  });
})();
