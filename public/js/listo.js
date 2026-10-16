(function () {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const token = params.get('token');
  const errorsBox = document.getElementById('errors');
  if (!id) { errorsBox.textContent = 'Link inválido.'; return; }

  fetch(`/api/invitations/${encodeURIComponent(id)}?token=${encodeURIComponent(token || '')}`)
    .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
    .then(({ ok, b }) => {
      if (!ok) { errorsBox.textContent = (b.errors || ['No encontramos la invitación.'])[0]; return; }
      if (b.invitation.status !== 'paid') {
        location.replace(`/pago?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`);
        return;
      }
      const url = b.url;
      const qr = `/api/invitations/${encodeURIComponent(id)}/qr.png`;
      const text = `¡Estás invitado/a al cumpleaños de ${b.invitation.name}! 🎉`;
      document.getElementById('qr').src = qr;
      document.getElementById('link').value = url;
      document.getElementById('open').href = url;
      const dl = document.getElementById('download');
      dl.href = qr + '?download=1';
      dl.download = `invitacion-${id}.png`;
      document.getElementById('whatsapp').href = 'https://wa.me/?text=' + encodeURIComponent(`${text}\n${url}`);

      const copy = document.getElementById('copy');
      copy.onclick = async () => {
        try { await navigator.clipboard.writeText(url); }
        catch { const i = document.getElementById('link'); i.select(); document.execCommand('copy'); }
        copy.textContent = '¡Copiado!';
        setTimeout(() => (copy.textContent = 'Copiar'), 2000);
      };

      if (navigator.share) {
        const share = document.getElementById('share');
        share.hidden = false;
        share.onclick = () => navigator.share({ title: 'Invitación de cumpleaños', text, url }).catch(() => {});
      }
    })
    .catch(() => (errorsBox.textContent = 'No se pudo conectar con el servidor.'));
})();
