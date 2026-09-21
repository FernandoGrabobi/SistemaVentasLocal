const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const Database = require('better-sqlite3');

// La base de datos vive en la carpeta de datos de usuario de la app
// (persiste entre actualizaciones y no depende de donde se instale el .exe)
const userDataPath = app.getPath('userData');
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}
const dbPath = path.join(userDataPath, 'pos.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS listas_precio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS proveedores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  contacto TEXT,
  margen_default REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS catalogo_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proveedor_id INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  descripcion TEXT,
  marca TEXT,
  costo REAL NOT NULL DEFAULT 0,
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE(proveedor_id, codigo)
);

CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_barra TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio REAL NOT NULL DEFAULT 0,
  costo REAL NOT NULL DEFAULT 0,
  precio_manual INTEGER NOT NULL DEFAULT 1,
  stock_minimo REAL NOT NULL DEFAULT 0,
  categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
  catalogo_item_id INTEGER REFERENCES catalogo_items(id) ON DELETE SET NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS precios_producto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lista_precio_id INTEGER NOT NULL REFERENCES listas_precio(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  precio REAL NOT NULL,
  UNIQUE(lista_precio_id, producto_id)
);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  cuit_dni TEXT,
  direccion TEXT,
  lista_precio_id INTEGER REFERENCES listas_precio(id) ON DELETE SET NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS lotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad REAL NOT NULL DEFAULT 0,
  fecha_vencimiento TEXT,
  fecha_ingreso TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS turnos_caja (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha_apertura TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  monto_apertura REAL NOT NULL DEFAULT 0,
  fecha_cierre TEXT,
  monto_cierre_declarado REAL,
  monto_cierre_sistema REAL,
  diferencia REAL,
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
  notas TEXT
);

CREATE TABLE IF NOT EXISTS movimientos_caja (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  turno_id INTEGER NOT NULL REFERENCES turnos_caja(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  categoria TEXT NOT NULL,
  monto REAL NOT NULL,
  descripcion TEXT,
  fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  total REAL NOT NULL,
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia', 'debito')),
  monto_recibido REAL,
  vuelto REAL,
  turno_id INTEGER REFERENCES turnos_caja(id) ON DELETE SET NULL,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS venta_detalle (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  lote_id INTEGER REFERENCES lotes(id),
  cantidad REAL NOT NULL,
  precio_unitario REAL NOT NULL,
  subtotal REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lotes_producto ON lotes(producto_id);
CREATE INDEX IF NOT EXISTS idx_lotes_vencimiento ON lotes(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_venta_detalle_venta ON venta_detalle(venta_id);
CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(codigo_barra);
CREATE INDEX IF NOT EXISTS idx_catalogo_items_codigo ON catalogo_items(codigo);
CREATE INDEX IF NOT EXISTS idx_catalogo_items_proveedor ON catalogo_items(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_caja_turno ON movimientos_caja(turno_id);
`;
// idx_ventas_turno e idx_ventas_cliente se crean mas abajo, DESPUES de las
// migraciones: en una DB de una version anterior, ventas.turno_id/cliente_id
// todavia no existen en este punto (recien los agrega agregarColumnaSiFalta).

db.exec(SCHEMA);

// --- Migraciones ---
// Agrega columnas nuevas a tablas que ya pueden existir de una version anterior
// de la app, sin tocar los datos que ya tiene el usuario. ALTER TABLE ADD COLUMN
// es seguro en SQLite; lo envolvemos en try/catch para que sea idempotente
// (si la columna ya existe, better-sqlite3 tira error y lo ignoramos).
function columnaExiste(tabla, columna) {
  const columnas = db.prepare(`PRAGMA table_info(${tabla})`).all();
  return columnas.some((c) => c.name === columna);
}

function agregarColumnaSiFalta(tabla, columna, definicion) {
  if (!columnaExiste(tabla, columna)) {
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
  }
}

agregarColumnaSiFalta('productos', 'costo', "REAL NOT NULL DEFAULT 0");
agregarColumnaSiFalta('productos', 'precio_manual', "INTEGER NOT NULL DEFAULT 1");
agregarColumnaSiFalta('productos', 'stock_minimo', "REAL NOT NULL DEFAULT 0");
agregarColumnaSiFalta('productos', 'catalogo_item_id', 'INTEGER REFERENCES catalogo_items(id) ON DELETE SET NULL');
agregarColumnaSiFalta('proveedores', 'margen_default', 'REAL NOT NULL DEFAULT 0');
agregarColumnaSiFalta('ventas', 'turno_id', 'INTEGER REFERENCES turnos_caja(id) ON DELETE SET NULL');
agregarColumnaSiFalta('ventas', 'cliente_id', 'INTEGER REFERENCES clientes(id) ON DELETE SET NULL');

// Estos indices dependen de columnas que recien pudieron haberse agregado arriba
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_ventas_turno ON ventas(turno_id);
  CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);
`);

module.exports = db;
