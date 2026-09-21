const db = require('./index');

function turnoAbierto() {
  return db.prepare("SELECT * FROM turnos_caja WHERE estado = 'abierto' ORDER BY id DESC LIMIT 1").get();
}

function abrirTurno(montoApertura) {
  if (turnoAbierto()) {
    throw new Error('YA_HAY_TURNO_ABIERTO');
  }
  const info = db
    .prepare("INSERT INTO turnos_caja (monto_apertura, estado) VALUES (?, 'abierto')")
    .run(Number(montoApertura) || 0);
  const turnoId = info.lastInsertRowid;

  db.prepare(
    `INSERT INTO movimientos_caja (turno_id, tipo, categoria, monto, descripcion) VALUES (?, 'ingreso', 'apertura', ?, 'Apertura de caja')`
  ).run(turnoId, Number(montoApertura) || 0);

  return db.prepare('SELECT * FROM turnos_caja WHERE id = ?').get(turnoId);
}

// Suma de ingresos - egresos de un turno (incluye el monto de apertura, que
// ya se registro como un movimiento de ingreso al abrir)
function totalesTurno(turnoId) {
  const fila = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) AS total_ingresos,
        COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END), 0) AS total_egresos
       FROM movimientos_caja WHERE turno_id = ?`
    )
    .get(turnoId);
  return {
    ...fila,
    saldo_sistema: Number((fila.total_ingresos - fila.total_egresos).toFixed(2)),
  };
}

function registrarMovimiento({ turno_id, tipo, categoria, monto, descripcion }) {
  const monto_num = Number(monto);
  if (!monto_num || monto_num <= 0) {
    throw new Error('MONTO_INVALIDO');
  }
  const info = db
    .prepare(
      `INSERT INTO movimientos_caja (turno_id, tipo, categoria, monto, descripcion) VALUES (?, ?, ?, ?, ?)`
    )
    .run(turno_id, tipo, categoria, monto_num, descripcion || null);
  return db.prepare('SELECT * FROM movimientos_caja WHERE id = ?').get(info.lastInsertRowid);
}

function movimientosDeTurno(turnoId) {
  return db.prepare('SELECT * FROM movimientos_caja WHERE turno_id = ? ORDER BY fecha ASC').all(turnoId);
}

// Ventas del turno agrupadas por metodo de pago, para mostrar en el arqueo
// junto con los movimientos manuales
function ventasPorMetodo(turnoId) {
  return db
    .prepare(
      `SELECT metodo_pago, COUNT(*) AS cantidad, COALESCE(SUM(total), 0) AS total
       FROM ventas WHERE turno_id = ? GROUP BY metodo_pago`
    )
    .all(turnoId);
}

function cerrarTurno(turnoId, montoDeclarado, notas) {
  const turno = db.prepare('SELECT * FROM turnos_caja WHERE id = ?').get(turnoId);
  if (!turno || turno.estado !== 'abierto') {
    throw new Error('TURNO_NO_ABIERTO');
  }
  const { saldo_sistema } = totalesTurno(turnoId);
  const declarado = Number(montoDeclarado) || 0;
  const diferencia = Number((declarado - saldo_sistema).toFixed(2));

  db.prepare(
    `UPDATE turnos_caja SET
       estado = 'cerrado', fecha_cierre = datetime('now', 'localtime'),
       monto_cierre_declarado = ?, monto_cierre_sistema = ?, diferencia = ?, notas = ?
     WHERE id = ?`
  ).run(declarado, saldo_sistema, diferencia, notas || null, turnoId);

  return db.prepare('SELECT * FROM turnos_caja WHERE id = ?').get(turnoId);
}

function listarTurnos({ desde = null, hasta = null } = {}) {
  let sql = 'SELECT * FROM turnos_caja WHERE 1=1';
  const params = [];
  if (desde) {
    sql += ' AND date(fecha_apertura) >= date(?)';
    params.push(desde);
  }
  if (hasta) {
    sql += ' AND date(fecha_apertura) <= date(?)';
    params.push(hasta);
  }
  sql += ' ORDER BY fecha_apertura DESC';
  return db.prepare(sql).all(...params);
}

module.exports = {
  turnoAbierto,
  abrirTurno,
  totalesTurno,
  registrarMovimiento,
  movimientosDeTurno,
  ventasPorMetodo,
  cerrarTurno,
  listarTurnos,
};
