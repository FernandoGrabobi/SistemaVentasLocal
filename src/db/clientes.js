const db = require('./index');

const SELECT_BASE = `
  SELECT cl.*, lp.nombre AS lista_precio_nombre
  FROM clientes cl
  LEFT JOIN listas_precio lp ON lp.id = cl.lista_precio_id
`;

function listar({ incluirInactivos = false, busqueda = '' } = {}) {
  let sql = SELECT_BASE + ' WHERE 1=1';
  const params = [];
  if (!incluirInactivos) sql += ' AND cl.activo = 1';
  if (busqueda) {
    sql += ' AND (cl.nombre LIKE ? OR cl.telefono LIKE ? OR cl.cuit_dni LIKE ?)';
    params.push(`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`);
  }
  sql += ' ORDER BY cl.nombre';
  return db.prepare(sql).all(...params);
}

function obtenerPorId(id) {
  return db.prepare(SELECT_BASE + ' WHERE cl.id = ?').get(id);
}

function crear(cliente) {
  const info = db
    .prepare(
      `INSERT INTO clientes (nombre, telefono, email, cuit_dni, direccion, lista_precio_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      cliente.nombre.trim(),
      cliente.telefono || null,
      cliente.email || null,
      cliente.cuit_dni || null,
      cliente.direccion || null,
      cliente.lista_precio_id || null
    );
  return obtenerPorId(info.lastInsertRowid);
}

function actualizar(id, cliente) {
  db.prepare(
    `UPDATE clientes SET nombre = ?, telefono = ?, email = ?, cuit_dni = ?, direccion = ?, lista_precio_id = ?
     WHERE id = ?`
  ).run(
    cliente.nombre.trim(),
    cliente.telefono || null,
    cliente.email || null,
    cliente.cuit_dni || null,
    cliente.direccion || null,
    cliente.lista_precio_id || null,
    id
  );
  return obtenerPorId(id);
}

function darDeBaja(id) {
  db.prepare('UPDATE clientes SET activo = 0 WHERE id = ?').run(id);
  return obtenerPorId(id);
}

function reactivar(id) {
  db.prepare('UPDATE clientes SET activo = 1 WHERE id = ?').run(id);
  return obtenerPorId(id);
}

// Historial de compras de un cliente: ventas + totales resumidos
function historialCompras(clienteId) {
  const ventas = db
    .prepare('SELECT * FROM ventas WHERE cliente_id = ? ORDER BY fecha DESC')
    .all(clienteId);
  const resumen = db
    .prepare(
      `SELECT COUNT(*) AS cantidad_compras, COALESCE(SUM(total), 0) AS total_gastado,
              MAX(fecha) AS ultima_compra
       FROM ventas WHERE cliente_id = ?`
    )
    .get(clienteId);
  return { ventas, resumen };
}

module.exports = { listar, obtenerPorId, crear, actualizar, darDeBaja, reactivar, historialCompras };
