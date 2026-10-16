// Catálogo de cartas. Por ahora solo cumpleaños está disponible.
const templates = {
  cumpleanos: {
    id: 'cumpleanos',
    name: 'Invitación de cumpleaños',
    price: 1500,
    currency: 'ARS',
    available: true,
    themes: ['fiesta', 'pastel', 'noche', 'dorado'],
  },
  noviazgo: { id: 'noviazgo', name: '¿Querés ser mi novio/a?', available: false },
  cita: { id: 'cita', name: 'Invitación a una cita', available: false },
};

module.exports = templates;
