const db = require('./index');
const lotes = require('./lotes');
const caja = require('./caja');

/**
 * Procesa una venta completa: valida que haya un turno de caja abierto,
 * inserta la venta, su detalle, descuenta stock por FEFO y —si el pago es en
 * efectivo— registra el ingreso correspondiente en la caja del turno.
 * Todo dentro de una unica transaccion.
 *
 * items: [{ producto_id, cantidad, precio_unitario }]
 * metodoPago: 'efectivo' | 'transferencia' | 'debito'
 * montoRecibido: solo aplica si metodoPago === 'efectivo'
 * clienteId: opcional, id de cliente asignado a la venta
 */
const procesarVenta = db.transaction((items, metodoPago, montoRecibido, clienteId) => {
  if (!items || items.length === 0) {
    throw new Error('CARRITO_VACIO');
  }

  const turno = caja.turnoAbierto();
  if (!turno) {
    throw new Error('CAJA_CERRADA');
  }

  const total = items.reduce((acc, it) => acc + it.cantidad * it.precio_unitario, 0);
  let vuelto = null;

  if (metodoPago === 'efectivo') {
    if (montoRecibido == null || montoRecibido < total) {
      throw new Error('MONTO_INSUFICIENTE');
    }
    vuelto = Number((montoRecibido - total).toFixed(2));
  }

  const insertVenta = db.prepare(
    `INSERT INTO ventas (total, metodo_pago, monto_recibido, vuelto, turno_id, cliente_id) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const ventaInfo = insertVenta.run(
    Number(total.toFixed(2)),
    metodoPago,
    metodoPago === 'efectivo' ? montoRecibido : null,
    vuelto,
    turno.id,
    clienteId || null
  );
  const ventaId = ventaInfo.lastInsertRowid;

  const insertDetalle = db.prepare(
    `INSERT INTO venta_detalle (venta_id, producto_id, lote_id, cantidad, precio_unitario, subtotal)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  for (const item of items) {
    // Descuenta stock por FEFO y obtiene de que lote(s) salio
    const movimientos = lotes.descontarFEFO(item.producto_id, item.cantidad);

    for (const mov of movimientos) {
      insertDetalle.run(
        ventaId,
        item.producto_id,
        mov.lote_id,
        mov.cantidad,
        item.precio_unitario,
        Number((mov.cantidad * item.precio_unitario).toFixed(2))
      );
    }
  }

  // El efectivo que entra a la caja fisica es el total de la venta (lo que se
  // recibe menos el vuelto entregado ya es, por definicion, el total).
  if (metodoPago === 'efectivo') {
    caja.registrarMovimiento({
      turno_id: turno.id,
      tipo: 'ingreso',
      categoria: 'venta_efectivo',
      monto: Number(total.toFixed(2)),
      descripcion: `Venta #${ventaId}`,
    });
  }

  return {
    id: ventaId,
    total: Number(total.toFixed(2)),
    metodo_pago: metodoPago,
    monto_recibido: metodoPago === 'efectivo' ? montoRecibido : null,
    vuelto,
    turno_id: turno.id,
    cliente_id: clienteId || null,
  };
});

function listar({ desde = null, hasta = null, metodoPago = null } = {}) {
  let sql = `
    SELECT v.*, cl.nombre AS cliente_nombre
    FROM ventas v
    LEFT JOIN clientes cl ON cl.id = v.cliente_id
    WHERE 1=1
  `;
  const params = [];

  if (desde) {
    sql += " AND date(v.fecha) >= date(?)";
    params.push(desde);
  }
  if (hasta) {
    sql += " AND date(v.fecha) <= date(?)";
    params.push(hasta);
  }
  if (metodoPago) {
    sql += ' AND v.metodo_pago = ?';
    params.push(metodoPago);
  }
  sql += ' ORDER BY v.fecha DESC';

  return db.prepare(sql).all(...params);
}

function detalle(ventaId) {
  return db
    .prepare(
      `SELECT vd.*, p.nombre AS producto_nombre, p.codigo_barra
       FROM venta_detalle vd
       JOIN productos p ON p.id = vd.producto_id
       WHERE vd.venta_id = ?`
    )
    .all(ventaId);
}

function totales({ desde = null, hasta = null } = {}) {
  let sql = `
    SELECT
      COUNT(*) AS cantidad_ventas,
      COALESCE(SUM(total), 0) AS total_general,
      COALESCE(SUM(CASE WHEN metodo_pago = 'efectivo' THEN total ELSE 0 END), 0) AS total_efectivo,
      COALESCE(SUM(CASE WHEN metodo_pago = 'transferencia' THEN total ELSE 0 END), 0) AS total_transferencia,
      COALESCE(SUM(CASE WHEN metodo_pago = 'debito' THEN total ELSE 0 END), 0) AS total_debito
    FROM ventas WHERE 1=1
  `;
  const params = [];
  if (desde) {
    sql += " AND date(fecha) >= date(?)";
    params.push(desde);
  }
  if (hasta) {
    sql += " AND date(fecha) <= date(?)";
    params.push(hasta);
  }
  return db.prepare(sql).get(...params);
}

module.exports = { procesarVenta, listar, detalle, totales };
