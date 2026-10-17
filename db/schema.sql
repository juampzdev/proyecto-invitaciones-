-- Esquema de la base de datos. Se aplica solo al iniciar el servidor.
-- Es idempotente (IF NOT EXISTS): correrlo varias veces no rompe nada.

CREATE TABLE IF NOT EXISTS invitations (
  id           text PRIMARY KEY,                 -- público, va en el link y en el QR
  owner_token  text NOT NULL,                    -- secreto, solo lo tiene quien la creó
  template     text NOT NULL,                    -- 'cumpleanos', más adelante 'noviazgo', 'cita'...
  status       text NOT NULL DEFAULT 'pending_payment'
               CHECK (status IN ('pending_payment', 'paid')),
  price        integer NOT NULL CHECK (price >= 0),   -- en pesos, sin decimales
  currency     char(3) NOT NULL,                 -- 'ARS'
  name         varchar(60) NOT NULL,
  age          smallint CHECK (age BETWEEN 1 AND 120),
  event_at     timestamp NOT NULL,               -- hora local del evento, sin zona horaria
  place        varchar(120) NOT NULL DEFAULT '',
  note         varchar(256) NOT NULL DEFAULT '',
  theme        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  paid_at      timestamptz
);

-- Fotos de cada invitación (hasta 3). Tabla aparte = relación uno a muchos.
CREATE TABLE IF NOT EXISTS invitation_images (
  invitation_id text NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  position      smallint NOT NULL CHECK (position BETWEEN 1 AND 3),
  url           text NOT NULL,
  PRIMARY KEY (invitation_id, position)
);

-- Acelera los reportes de ventas ("pagadas este mes").
CREATE INDEX IF NOT EXISTS invitations_status_paid_at_idx ON invitations (status, paid_at);
