const db = require('./index');

const SELECT_BASE = `
  SELECT
    p.*,
    c.nombre AS categoria_nombre,
    pr.nombre AS proveedor_nombre,
    COALESCE((SELECT SUM(l.cantidad) FROM lotes l WHERE l.producto_id = p.id), 0) AS stock_total
  FROM productos p
  LEFT JOIN categorias c ON c.id = p.categoria_id
  LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
`;

function listar({ incluirInactivos = false, busqueda = '', categoriaId = null, soloStockBajo = false } = {}) {
  let sql = SELECT_BASE + ' WHERE 1=1';
  const params = [];

  if (!incluirInactivos) {
    sql += ' AND p.activo = 1';
  }
  if (busqueda) {
    sql += ' AND (p.nombre LIKE ? OR p.codigo_barra LIKE ?)';
    params.push(`%${busqueda}%`, `%${busqueda}%`);
  }
  if (categoriaId) {
    sql += ' AND p.categoria_id = ?';
    params.push(categoriaId);
  }
  sql += ' ORDER BY p.nombre';

  let productos = db.prepare(sql).all(...params);
  if (soloStockBajo) {
    productos = productos.filter((p) => p.stock_minimo > 0 && p.stock_total < p.stock_minimo);
  }
  return productos;
}

// Devuelve productos activos cuyo stock total esta por debajo del minimo definido
// (stock_minimo = 0 significa "sin minimo configurado", no se alerta)
function stockBajo() {
  const productos = db.prepare(SELECT_BASE + ' WHERE p.activo = 1').all();
  return productos.filter((p) => p.stock_minimo > 0 && p.stock_total < p.stock_minimo);
}

// Busca un producto por codigo de barra para el POS. Si se pasa listaPrecioId,
// devuelve tambien precio_aplicado con el precio especial de esa lista (si existe),
// o el precio base si el producto no tiene precio especial en esa lista.
function buscarPorCodigo(codigoBarra, listaPrecioId = null) {
  const producto = db.prepare(SELECT_BASE + ' WHERE p.codigo_barra = ? AND p.activo = 1').get(codigoBarra);
  if (!producto) return producto;

  producto.precio_aplicado = producto.precio;
  if (listaPrecioId) {
    const especial = db
      .prepare('SELECT precio FROM precios_producto WHERE lista_precio_id = ? AND producto_id = ?')
      .get(listaPrecioId, producto.id);
    if (especial) producto.precio_aplicado = especial.precio;
  }
  return producto;
}

function obtenerPorId(id) {
  return db.prepare(SELECT_BASE + ' WHERE p.id = ?').get(id);
}

function crear(producto) {
  const info = db
    .prepare(
      `INSERT INTO productos
        (codigo_barra, nombre, descripcion, precio, costo, precio_manual, stock_minimo, categoria_id, proveedor_id, catalogo_item_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      producto.codigo_barra.trim(),
      producto.nombre.trim(),
      producto.descripcion || null,
      Number(producto.precio) || 0,
      Number(producto.costo) || 0,
      producto.precio_manual === false ? 0 : 1,
      Number(producto.stock_minimo) || 0,
      producto.categoria_id || null,
      producto.proveedor_id || null,
      producto.catalogo_item_id || null
    );
  return obtenerPorId(info.lastInsertRowid);
}

// Edicion manual desde la pantalla de Stock: siempre marca precio_manual = 1,
// asi "Actualizar precios" (que recalcula por margen de catalogo) no lo pisa despues.
function actualizar(id, producto) {
  db.prepare(
    `UPDATE productos SET
       codigo_barra = ?, nombre = ?, descripcion = ?, precio = ?, costo = ?,
       precio_manual = 1, stock_minimo = ?, categoria_id = ?, proveedor_id = ?
     WHERE id = ?`
  ).run(
    producto.codigo_barra.trim(),
    producto.nombre.trim(),
    producto.descripcion || null,
    Number(producto.precio) || 0,
    Number(producto.costo) || 0,
    Number(producto.stock_minimo) || 0,
    producto.categoria_id || null,
    producto.proveedor_id || null,
    id
  );
  return obtenerPorId(id);
}

// Actualizacion "del sistema" (no cuenta como edicion manual): la usa el
// reimport de catalogo para sincronizar costo, y "Actualizar precios" para
// recalcular precio de venta por margen.
function actualizarCostoYPrecioSistema(id, { costo, precio }) {
  db.prepare('UPDATE productos SET costo = ?, precio = ? WHERE id = ?').run(costo, precio, id);
}

function darDeBaja(id) {
  db.prepare('UPDATE productos SET activo = 0 WHERE id = ?').run(id);
  return obtenerPorId(id);
}

function reactivar(id) {
  db.prepare('UPDATE productos SET activo = 1 WHERE id = ?').run(id);
  return obtenerPorId(id);
}

// Recalcula el precio de venta de todos los productos vinculados a un catalogo
// de proveedor (catalogo_item_id no nulo) y que NO fueron editados a mano
// (precio_manual = 0), usando costo actual del item + margen del proveedor.
// Devuelve cuantos productos se actualizaron.
function actualizarPreciosDesdeCatalogo() {
  const candidatos = db
    .prepare(
      `SELECT p.id, ci.costo AS costo_actual, pr.margen_default
       FROM productos p
       JOIN catalogo_items ci ON ci.id = p.catalogo_item_id
       JOIN proveedores pr ON pr.id = ci.proveedor_id
       WHERE p.precio_manual = 0 AND p.activo = 1`
    )
    .all();

  let actualizados = 0;
  for (const c of candidatos) {
    const nuevoPrecio = Number((c.costo_actual * (1 + c.margen_default / 100)).toFixed(2));
    actualizarCostoYPrecioSistema(c.id, { costo: c.costo_actual, precio: nuevoPrecio });
    actualizados += 1;
  }
  return actualizados;
}

module.exports = {
  listar,
  stockBajo,
  buscarPorCodigo,
  obtenerPorId,
  crear,
  actualizar,
  actualizarCostoYPrecioSistema,
  darDeBaja,
  reactivar,
  actualizarPreciosDesdeCatalogo,
};
