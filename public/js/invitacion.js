(function () {
  const id = location.pathname.split('/').filter(Boolean).pop();
  const token = new URLSearchParams(location.search).get('token') || '';
  const errorsBox = document.getElementById('errors');

  fetch(`/api/invitations/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`)
    .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
    .then(({ ok, b }) => {
      if (!ok) { errorsBox.textContent = (b.errors || ['No encontramos la invitación.'])[0]; return; }
      const inv = b.invitation;
      if (inv.status !== 'paid') document.getElementById('ownerBanner').hidden = false;
      document.title = `Cumpleaños de ${inv.name} 🎉`;
      Card.renderCard(document.getElementById('card'), inv, { interactive: true, confetti: 30 });
      document.getElementById('madeWith').hidden = false;
    })
    .catch(() => (errorsBox.textContent = 'No se pudo conectar con el servidor.'));
})();
