const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const productos = require('./db/productos');
const lotes = require('./db/lotes');
const categorias = require('./db/categorias');
const proveedores = require('./db/proveedores');
const ventas = require('./db/ventas');
const caja = require('./db/caja');
const clientes = require('./db/clientes');
const listasPrecio = require('./db/listasPrecio');
const catalogos = require('./db/catalogos');

// Envuelve cada handler para devolver siempre { ok, data } o { ok: false, error }
// asi el renderer nunca tiene que lidiar con excepciones sin capturar de IPC.
function handle(canal, fn) {
  ipcMain.handle(canal, async (_event, ...args) => {
    try {
      const data = fn(...args);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err.message, meta: { stockDisponible: err.stockDisponible } };
    }
  });
}

// --- Productos ---
handle('productos:listar', (filtros) => productos.listar(filtros));
handle('productos:stockBajo', () => productos.stockBajo());
handle('productos:buscarPorCodigo', (codigo, listaPrecioId) => productos.buscarPorCodigo(codigo, listaPrecioId));
handle('productos:crear', (producto) => productos.crear(producto));
handle('productos:actualizar', (id, producto) => productos.actualizar(id, producto));
handle('productos:darDeBaja', (id) => productos.darDeBaja(id));
handle('productos:reactivar', (id) => productos.reactivar(id));
handle('productos:actualizarPreciosDesdeCatalogo', () => productos.actualizarPreciosDesdeCatalogo());

// --- Lotes ---
handle('lotes:listarPorProducto', (productoId) => lotes.listarPorProducto(productoId));
handle('lotes:crear', (lote) => lotes.crear(lote));
handle('lotes:actualizar', (id, lote) => lotes.actualizar(id, lote));
handle('lotes:eliminar', (id) => lotes.eliminar(id));
handle('lotes:proximosAVencer', (dias) => lotes.proximosAVencer(dias));

// --- Categorias ---
handle('categorias:listar', () => categorias.listar());
handle('categorias:crear', (nombre) => categorias.crear(nombre));
handle('categorias:actualizar', (id, nombre) => categorias.actualizar(id, nombre));
handle('categorias:eliminar', (id) => categorias.eliminar(id));

// --- Proveedores ---
handle('proveedores:listar', () => proveedores.listar());
handle('proveedores:crear', (proveedor) => proveedores.crear(proveedor));
handle('proveedores:actualizar', (id, proveedor) => proveedores.actualizar(id, proveedor));
handle('proveedores:eliminar', (id) => proveedores.eliminar(id));

// --- Ventas ---
handle('ventas:procesar', (venta) =>
  ventas.procesarVenta(venta.items, venta.metodoPago, venta.montoRecibido, venta.clienteId)
);
handle('ventas:listar', (filtros) => ventas.listar(filtros));
handle('ventas:detalle', (ventaId) => ventas.detalle(ventaId));
handle('ventas:totales', (filtros) => ventas.totales(filtros));

// --- Caja ---
handle('caja:turnoAbierto', () => caja.turnoAbierto());
handle('caja:abrirTurno', (montoApertura) => caja.abrirTurno(montoApertura));
handle('caja:totalesTurno', (turnoId) => caja.totalesTurno(turnoId));
handle('caja:registrarMovimiento', (movimiento) => caja.registrarMovimiento(movimiento));
handle('caja:movimientosDeTurno', (turnoId) => caja.movimientosDeTurno(turnoId));
handle('caja:ventasPorMetodo', (turnoId) => caja.ventasPorMetodo(turnoId));
handle('caja:cerrarTurno', (turnoId, montoDeclarado, notas) => caja.cerrarTurno(turnoId, montoDeclarado, notas));
handle('caja:listarTurnos', (filtros) => caja.listarTurnos(filtros));

// --- Clientes ---
handle('clientes:listar', (filtros) => clientes.listar(filtros));
handle('clientes:obtenerPorId', (id) => clientes.obtenerPorId(id));
handle('clientes:crear', (cliente) => clientes.crear(cliente));
handle('clientes:actualizar', (id, cliente) => clientes.actualizar(id, cliente));
handle('clientes:darDeBaja', (id) => clientes.darDeBaja(id));
handle('clientes:reactivar', (id) => clientes.reactivar(id));
handle('clientes:historialCompras', (id) => clientes.historialCompras(id));

// --- Listas de precio ---
handle('listasPrecio:listar', () => listasPrecio.listar());
handle('listasPrecio:crear', (nombre) => listasPrecio.crear(nombre));
handle('listasPrecio:actualizar', (id, nombre) => listasPrecio.actualizar(id, nombre));
handle('listasPrecio:eliminar', (id) => listasPrecio.eliminar(id));
handle('listasPrecio:listarPrecios', (listaId) => listasPrecio.listarPrecios(listaId));
handle('listasPrecio:fijarPrecio', (listaId, productoId, precio) => listasPrecio.fijarPrecio(listaId, productoId, precio));
handle('listasPrecio:quitarPrecio', (id) => listasPrecio.quitarPrecio(id));

// --- Catalogos de proveedores ---
handle('catalogos:elegirArchivoCSV', async () => {
  const res = await dialog.showOpenDialog({
    title: 'Elegir lista de precios (CSV)',
    filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }],
    properties: ['openFile'],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  const ruta = res.filePaths[0];
  const contenido = fs.readFileSync(ruta, 'utf-8');
  return { ruta, contenido };
});
handle('catalogos:previsualizar', (textoCSV) => catalogos.previsualizarCSV(textoCSV));
handle('catalogos:confirmarImportacion', (proveedorId, items) => catalogos.confirmarImportacion(proveedorId, items));
handle('catalogos:buscar', (query, proveedorId) => catalogos.buscar(query, proveedorId));
handle('catalogos:listarPorProveedor', (proveedorId) => catalogos.listarPorProveedor(proveedorId));
handle('catalogos:crearProductoDesdeItem', (catalogoItemId, datos) => catalogos.crearProductoDesdeItem(catalogoItemId, datos));
