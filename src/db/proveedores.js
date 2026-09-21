const db = require('./index');

function listar() {
  return db.prepare('SELECT * FROM proveedores ORDER BY nombre').all();
}

function obtenerPorId(id) {
  return db.prepare('SELECT * FROM proveedores WHERE id = ?').get(id);
}

function crear({ nombre, contacto, margen_default }) {
  const info = db
    .prepare('INSERT INTO proveedores (nombre, contacto, margen_default) VALUES (?, ?, ?)')
    .run(nombre.trim(), contacto || null, Number(margen_default) || 0);
  return obtenerPorId(info.lastInsertRowid);
}

function actualizar(id, { nombre, contacto, margen_default }) {
  db.prepare('UPDATE proveedores SET nombre = ?, contacto = ?, margen_default = ? WHERE id = ?').run(
    nombre.trim(),
    contacto || null,
    Number(margen_default) || 0,
    id
  );
  return obtenerPorId(id);
}

function eliminar(id) {
  db.prepare('DELETE FROM proveedores WHERE id = ?').run(id);
  return { ok: true };
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
