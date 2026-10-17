// Conexión a PostgreSQL con un "pool": un grupo de conexiones abiertas que se reutilizan
// entre peticiones, en lugar de abrir y cerrar una conexión cada vez.
const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');
const config = require('./config');

// Las columnas "timestamp" (sin zona horaria) se devuelven como texto tal cual ("2026-11-14 21:00:00"),
// para que la hora del evento no se corra según la zona horaria del servidor.
types.setTypeParser(types.builtins.TIMESTAMP, (value) => value);

const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });

function query(text, params) {
  return pool.query(text, params);
}

// Ejecuta varias consultas como una sola unidad: o se guardan todas, o ninguna.
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Crea las tablas si no existen.
async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = { pool, query, transaction, migrate };
