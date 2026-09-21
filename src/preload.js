const { contextBridge, ipcRenderer } = require('electron');

// Expone una API segura y acotada al renderer. El renderer nunca toca
// Node.js ni la base de datos directamente, solo llama a estas funciones.
contextBridge.exposeInMainWorld('api', {
  // --- Productos ---
  productos: {
    listar: (filtros) => ipcRenderer.invoke('productos:listar', filtros),
    stockBajo: () => ipcRenderer.invoke('productos:stockBajo'),
    buscarPorCodigo: (codigo, listaPrecioId) => ipcRenderer.invoke('productos:buscarPorCodigo', codigo, listaPrecioId),
    crear: (producto) => ipcRenderer.invoke('productos:crear', producto),
    actualizar: (id, producto) => ipcRenderer.invoke('productos:actualizar', id, producto),
    darDeBaja: (id) => ipcRenderer.invoke('productos:darDeBaja', id),
    reactivar: (id) => ipcRenderer.invoke('productos:reactivar', id),
    actualizarPreciosDesdeCatalogo: () => ipcRenderer.invoke('productos:actualizarPreciosDesdeCatalogo'),
  },

  // --- Lotes ---
  lotes: {
    listarPorProducto: (productoId) => ipcRenderer.invoke('lotes:listarPorProducto', productoId),
    crear: (lote) => ipcRenderer.invoke('lotes:crear', lote),
    actualizar: (id, lote) => ipcRenderer.invoke('lotes:actualizar', id, lote),
    eliminar: (id) => ipcRenderer.invoke('lotes:eliminar', id),
    proximosAVencer: (dias) => ipcRenderer.invoke('lotes:proximosAVencer', dias),
  },

  // --- Categorias ---
  categorias: {
    listar: () => ipcRenderer.invoke('categorias:listar'),
    crear: (nombre) => ipcRenderer.invoke('categorias:crear', nombre),
    actualizar: (id, nombre) => ipcRenderer.invoke('categorias:actualizar', id, nombre),
    eliminar: (id) => ipcRenderer.invoke('categorias:eliminar', id),
  },

  // --- Proveedores ---
  proveedores: {
    listar: () => ipcRenderer.invoke('proveedores:listar'),
    crear: (proveedor) => ipcRenderer.invoke('proveedores:crear', proveedor),
    actualizar: (id, proveedor) => ipcRenderer.invoke('proveedores:actualizar', id, proveedor),
    eliminar: (id) => ipcRenderer.invoke('proveedores:eliminar', id),
  },

  // --- Ventas ---
  ventas: {
    procesar: (venta) => ipcRenderer.invoke('ventas:procesar', venta),
    listar: (filtros) => ipcRenderer.invoke('ventas:listar', filtros),
    detalle: (ventaId) => ipcRenderer.invoke('ventas:detalle', ventaId),
    totales: (filtros) => ipcRenderer.invoke('ventas:totales', filtros),
  },

  // --- Caja ---
  caja: {
    turnoAbierto: () => ipcRenderer.invoke('caja:turnoAbierto'),
    abrirTurno: (montoApertura) => ipcRenderer.invoke('caja:abrirTurno', montoApertura),
    totalesTurno: (turnoId) => ipcRenderer.invoke('caja:totalesTurno', turnoId),
    registrarMovimiento: (movimiento) => ipcRenderer.invoke('caja:registrarMovimiento', movimiento),
    movimientosDeTurno: (turnoId) => ipcRenderer.invoke('caja:movimientosDeTurno', turnoId),
    ventasPorMetodo: (turnoId) => ipcRenderer.invoke('caja:ventasPorMetodo', turnoId),
    cerrarTurno: (turnoId, montoDeclarado, notas) => ipcRenderer.invoke('caja:cerrarTurno', turnoId, montoDeclarado, notas),
    listarTurnos: (filtros) => ipcRenderer.invoke('caja:listarTurnos', filtros),
  },

  // --- Clientes ---
  clientes: {
    listar: (filtros) => ipcRenderer.invoke('clientes:listar', filtros),
    obtenerPorId: (id) => ipcRenderer.invoke('clientes:obtenerPorId', id),
    crear: (cliente) => ipcRenderer.invoke('clientes:crear', cliente),
    actualizar: (id, cliente) => ipcRenderer.invoke('clientes:actualizar', id, cliente),
    darDeBaja: (id) => ipcRenderer.invoke('clientes:darDeBaja', id),
    reactivar: (id) => ipcRenderer.invoke('clientes:reactivar', id),
    historialCompras: (id) => ipcRenderer.invoke('clientes:historialCompras', id),
  },

  // --- Listas de precio ---
  listasPrecio: {
    listar: () => ipcRenderer.invoke('listasPrecio:listar'),
    crear: (nombre) => ipcRenderer.invoke('listasPrecio:crear', nombre),
    actualizar: (id, nombre) => ipcRenderer.invoke('listasPrecio:actualizar', id, nombre),
    eliminar: (id) => ipcRenderer.invoke('listasPrecio:eliminar', id),
    listarPrecios: (listaId) => ipcRenderer.invoke('listasPrecio:listarPrecios', listaId),
    fijarPrecio: (listaId, productoId, precio) => ipcRenderer.invoke('listasPrecio:fijarPrecio', listaId, productoId, precio),
    quitarPrecio: (id) => ipcRenderer.invoke('listasPrecio:quitarPrecio', id),
  },

  // --- Catalogos de proveedores ---
  catalogos: {
    elegirArchivoCSV: () => ipcRenderer.invoke('catalogos:elegirArchivoCSV'),
    previsualizar: (textoCSV) => ipcRenderer.invoke('catalogos:previsualizar', textoCSV),
    confirmarImportacion: (proveedorId, items) => ipcRenderer.invoke('catalogos:confirmarImportacion', proveedorId, items),
    buscar: (query, proveedorId) => ipcRenderer.invoke('catalogos:buscar', query, proveedorId),
    listarPorProveedor: (proveedorId) => ipcRenderer.invoke('catalogos:listarPorProveedor', proveedorId),
    crearProductoDesdeItem: (catalogoItemId, datos) => ipcRenderer.invoke('catalogos:crearProductoDesdeItem', catalogoItemId, datos),
  },
});
