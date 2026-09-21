const db = require('./index');

function listar() {
  return db.prepare('SELECT * FROM listas_precio ORDER BY nombre').all();
}

function crear(nombre) {
  const info = db.prepare('INSERT INTO listas_precio (nombre) VALUES (?)').run(nombre.trim());
  return { id: info.lastInsertRowid, nombre: nombre.trim() };
}

function actualizar(id, nombre) {
  db.prepare('UPDATE listas_precio SET nombre = ? WHERE id = ?').run(nombre.trim(), id);
  return { id, nombre: nombre.trim() };
}

function eliminar(id) {
  db.prepare('DELETE FROM listas_precio WHERE id = ?').run(id);
  return { ok: true };
}

// Precios especiales cargados para una lista, con datos del producto para mostrar en UI
function listarPrecios(listaPrecioId) {
  return db
    .prepare(
      `SELECT pp.*, p.nombre AS producto_nombre, p.codigo_barra, p.precio AS precio_base
       FROM precios_producto pp
       JOIN productos p ON p.id = pp.producto_id
       WHERE pp.lista_precio_id = ?
       ORDER BY p.nombre`
    )
    .all(listaPrecioId);
}

// Crea o actualiza el precio especial de un producto en una lista (upsert)
function fijarPrecio(listaPrecioId, productoId, precio) {
  db.prepare(
    `INSERT INTO precios_producto (lista_precio_id, producto_id, precio)
     VALUES (?, ?, ?)
     ON CONFLICT(lista_precio_id, producto_id) DO UPDATE SET precio = excluded.precio`
  ).run(listaPrecioId, productoId, Number(precio) || 0);
  return { ok: true };
}

function quitarPrecio(id) {
  db.prepare('DELETE FROM precios_producto WHERE id = ?').run(id);
  return { ok: true };
}

module.exports = { listar, crear, actualizar, eliminar, listarPrecios, fijarPrecio, quitarPrecio };
