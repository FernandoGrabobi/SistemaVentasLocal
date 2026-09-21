const db = require('./index');

function listarPorProducto(productoId) {
  return db
    .prepare('SELECT * FROM lotes WHERE producto_id = ? ORDER BY fecha_vencimiento IS NULL, fecha_vencimiento ASC')
    .all(productoId);
}

function crear({ producto_id, cantidad, fecha_vencimiento }) {
  const info = db
    .prepare('INSERT INTO lotes (producto_id, cantidad, fecha_vencimiento) VALUES (?, ?, ?)')
    .run(producto_id, Number(cantidad) || 0, fecha_vencimiento || null);
  return db.prepare('SELECT * FROM lotes WHERE id = ?').get(info.lastInsertRowid);
}

function actualizar(id, { cantidad, fecha_vencimiento }) {
  db.prepare('UPDATE lotes SET cantidad = ?, fecha_vencimiento = ? WHERE id = ?').run(
    Number(cantidad) || 0,
    fecha_vencimiento || null,
    id
  );
  return db.prepare('SELECT * FROM lotes WHERE id = ?').get(id);
}

function eliminar(id) {
  db.prepare('DELETE FROM lotes WHERE id = ?').run(id);
  return { ok: true };
}

// Lotes activos (cantidad > 0) que vencen dentro de N dias (o ya vencidos),
// de productos activos. Usado para las alertas de la seccion de Stock.
function proximosAVencer(dias = 14) {
  return db
    .prepare(
      `SELECT l.*, p.nombre AS producto_nombre, p.codigo_barra,
              CAST(julianday(l.fecha_vencimiento) - julianday('now', 'localtime') AS INTEGER) AS dias_restantes
       FROM lotes l
       JOIN productos p ON p.id = l.producto_id
       WHERE l.cantidad > 0
         AND p.activo = 1
         AND l.fecha_vencimiento IS NOT NULL
         AND julianday(l.fecha_vencimiento) - julianday('now', 'localtime') <= ?
       ORDER BY l.fecha_vencimiento ASC`
    )
    .all(dias);
}

// Descuenta `cantidad` unidades de un producto siguiendo FEFO (primero
// vence, primero sale): consume lotes ordenados por fecha_vencimiento
// ascendente (los sin fecha quedan al final). Debe llamarse dentro de una
// transaccion. Devuelve el detalle de que lotes se usaron, o lanza error
// si no hay stock suficiente.
function descontarFEFO(productoId, cantidadASacar) {
  const lotesDisponibles = db
    .prepare(
      `SELECT * FROM lotes
       WHERE producto_id = ? AND cantidad > 0
       ORDER BY fecha_vencimiento IS NULL, fecha_vencimiento ASC`
    )
    .all(productoId);

  const stockTotal = lotesDisponibles.reduce((acc, l) => acc + l.cantidad, 0);
  if (stockTotal < cantidadASacar) {
    const error = new Error('STOCK_INSUFICIENTE');
    error.stockDisponible = stockTotal;
    throw error;
  }

  let restante = cantidadASacar;
  const movimientos = [];
  const updateStmt = db.prepare('UPDATE lotes SET cantidad = ? WHERE id = ?');

  for (const lote of lotesDisponibles) {
    if (restante <= 0) break;
    const tomar = Math.min(lote.cantidad, restante);
    updateStmt.run(lote.cantidad - tomar, lote.id);
    movimientos.push({ lote_id: lote.id, cantidad: tomar });
    restante -= tomar;
  }

  return movimientos;
}

module.exports = { listarPorProducto, crear, actualizar, eliminar, proximosAVencer, descontarFEFO };
