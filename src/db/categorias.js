const db = require('./index');

function listar() {
  return db.prepare('SELECT * FROM categorias ORDER BY nombre').all();
}

function crear(nombre) {
  const info = db.prepare('INSERT INTO categorias (nombre) VALUES (?)').run(nombre.trim());
  return { id: info.lastInsertRowid, nombre: nombre.trim() };
}

function actualizar(id, nombre) {
  db.prepare('UPDATE categorias SET nombre = ? WHERE id = ?').run(nombre.trim(), id);
  return { id, nombre: nombre.trim() };
}

function eliminar(id) {
  // Si hay productos usando esta categoria, se desvincula (SET NULL) automaticamente
  // gracias a la FK, así que borrar es seguro.
  db.prepare('DELETE FROM categorias WHERE id = ?').run(id);
  return { ok: true };
}

module.exports = { listar, crear, actualizar, eliminar };
