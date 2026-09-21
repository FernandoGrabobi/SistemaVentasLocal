const db = require('./index');
const productos = require('./productos');

// --- Parser de CSV liviano (sin dependencias) ---
// Soporta separador coma o punto y coma (detecta el que predomine en la
// primera linea), y campos entre comillas dobles con comas adentro.
function detectarSeparador(primeraLinea) {
  const comas = (primeraLinea.match(/,/g) || []).length;
  const puntoYComa = (primeraLinea.match(/;/g) || []).length;
  return puntoYComa > comas ? ';' : ',';
}

function parsearLineaCSV(linea, sep) {
  const campos = [];
  let actual = '';
  let entreComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (ch === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (ch === sep && !entreComillas) {
      campos.push(actual.trim());
      actual = '';
    } else {
      actual += ch;
    }
  }
  campos.push(actual.trim());
  return campos;
}

const ALIAS_COLUMNAS = {
  codigo: ['codigo', 'código', 'cod', 'sku', 'code'],
  descripcion: ['descripcion', 'descripción', 'nombre', 'producto', 'detalle'],
  marca: ['marca', 'brand'],
  costo: ['costo', 'precio', 'precio_costo', 'cost', 'price'],
};

function mapearColumnas(headerRow) {
  const headersNorm = headerRow.map((h) => h.toLowerCase().trim());
  const indices = {};
  for (const [campo, alias] of Object.entries(ALIAS_COLUMNAS)) {
    const idx = headersNorm.findIndex((h) => alias.includes(h));
    indices[campo] = idx; // -1 si no se encontro
  }
  return indices;
}

// Parsea el texto del CSV y devuelve una preview: items validos + errores por
// fila, SIN tocar la base de datos todavia. Esto le permite al usuario revisar
// antes de confirmar la importacion.
function previsualizarCSV(textoCSV) {
  const lineas = textoCSV
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lineas.length === 0) {
    return { items: [], errores: [{ fila: 0, motivo: 'El archivo está vacío' }], totalFilas: 0 };
  }

  const sep = detectarSeparador(lineas[0]);
  const header = parsearLineaCSV(lineas[0], sep);
  const indices = mapearColumnas(header);

  const errores = [];
  if (indices.codigo === -1) {
    errores.push({ fila: 0, motivo: 'No se encontró una columna de código (código/sku/cod)' });
  }
  if (indices.costo === -1) {
    errores.push({ fila: 0, motivo: 'No se encontró una columna de costo (costo/precio)' });
  }
  if (errores.length > 0) {
    return { items: [], errores, totalFilas: lineas.length - 1 };
  }

  const items = [];
  const codigosVistos = new Set();

  for (let i = 1; i < lineas.length; i++) {
    const fila = i + 1; // numero de linea "humano" (1 = header)
    const campos = parsearLineaCSV(lineas[i], sep);

    const codigo = (campos[indices.codigo] || '').trim();
    const costoTexto = (campos[indices.costo] || '').trim().replace(',', '.');
    const costo = Number(costoTexto);

    if (!codigo) {
      errores.push({ fila, motivo: 'Código vacío' });
      continue;
    }
    if (codigosVistos.has(codigo)) {
      errores.push({ fila, motivo: `Código "${codigo}" duplicado dentro del archivo` });
      continue;
    }
    if (costoTexto === '' || isNaN(costo) || costo < 0) {
      errores.push({ fila, motivo: `Costo inválido ("${campos[indices.costo] || ''}")` });
      continue;
    }

    codigosVistos.add(codigo);
    items.push({
      codigo,
      descripcion: indices.descripcion >= 0 ? campos[indices.descripcion] || '' : '',
      marca: indices.marca >= 0 ? campos[indices.marca] || '' : '',
      costo,
    });
  }

  return { items, errores, totalFilas: lineas.length - 1 };
}

// Reemplaza el catalogo de un proveedor por la lista de items nueva. Usa
// upsert por (proveedor_id, codigo) para que los productos ya vinculados a
// un item no pierdan el vinculo (y su costo se actualice solo); los items que
// ya no vienen en el archivo nuevo se borran (y sus productos vinculados
// quedan sin catalogo_item_id, por ON DELETE SET NULL).
const confirmarImportacion = db.transaction((proveedorId, items) => {
  const upsert = db.prepare(
    `INSERT INTO catalogo_items (proveedor_id, codigo, descripcion, marca, costo, actualizado_en)
     VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
     ON CONFLICT(proveedor_id, codigo) DO UPDATE SET
       descripcion = excluded.descripcion,
       marca = excluded.marca,
       costo = excluded.costo,
       actualizado_en = excluded.actualizado_en`
  );

  for (const item of items) {
    upsert.run(proveedorId, item.codigo, item.descripcion || null, item.marca || null, item.costo);
  }

  const codigosNuevos = items.map((i) => i.codigo);
  const existentes = db
    .prepare('SELECT id, codigo FROM catalogo_items WHERE proveedor_id = ?')
    .all(proveedorId);

  const borrarStmt = db.prepare('DELETE FROM catalogo_items WHERE id = ?');
  let borrados = 0;
  for (const ex of existentes) {
    if (!codigosNuevos.includes(ex.codigo)) {
      borrarStmt.run(ex.id);
      borrados += 1;
    }
  }

  return { insertados: items.length, borrados };
});

// Busca items de catalogo por codigo/descripcion/marca, en todos los
// proveedores (o uno solo si se pasa proveedorId). Marca si el item ya tiene
// un producto creado a partir de el.
function buscar(query, proveedorId = null) {
  let sql = `
    SELECT ci.*, pr.nombre AS proveedor_nombre, pr.margen_default,
           p.id AS producto_id, p.nombre AS producto_nombre
    FROM catalogo_items ci
    JOIN proveedores pr ON pr.id = ci.proveedor_id
    LEFT JOIN productos p ON p.catalogo_item_id = ci.id
    WHERE 1=1
  `;
  const params = [];
  if (query) {
    sql += ' AND (ci.codigo LIKE ? OR ci.descripcion LIKE ? OR ci.marca LIKE ?)';
    params.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }
  if (proveedorId) {
    sql += ' AND ci.proveedor_id = ?';
    params.push(proveedorId);
  }
  sql += ' ORDER BY ci.codigo LIMIT 200';
  return db.prepare(sql).all(...params);
}

function listarPorProveedor(proveedorId) {
  return db
    .prepare('SELECT * FROM catalogo_items WHERE proveedor_id = ? ORDER BY codigo')
    .all(proveedorId);
}

// Crea un producto nuevo a partir de un item de catalogo: copia costo,
// sugiere precio de venta por el margen del proveedor, y opcionalmente carga
// un lote inicial de stock. Queda vinculado (catalogo_item_id) para que
// "Actualizar precios" lo mantenga sincronizado con el costo del proveedor.
const crearProductoDesdeItem = db.transaction((catalogoItemId, datos) => {
  const item = db
    .prepare(
      `SELECT ci.*, pr.margen_default FROM catalogo_items ci
       JOIN proveedores pr ON pr.id = ci.proveedor_id WHERE ci.id = ?`
    )
    .get(catalogoItemId);
  if (!item) throw new Error('ITEM_NO_ENCONTRADO');

  const precioSugerido = Number((item.costo * (1 + item.margen_default / 100)).toFixed(2));

  const producto = productos.crear({
    codigo_barra: datos.codigo_barra || item.codigo,
    nombre: datos.nombre || item.descripcion || item.codigo,
    descripcion: item.marca || null,
    precio: datos.precio != null ? datos.precio : precioSugerido,
    costo: item.costo,
    precio_manual: false,
    stock_minimo: datos.stock_minimo || 0,
    categoria_id: datos.categoria_id || null,
    proveedor_id: item.proveedor_id,
    catalogo_item_id: item.id,
  });

  if (datos.stock_inicial && Number(datos.stock_inicial) > 0) {
    const lotes = require('./lotes');
    lotes.crear({
      producto_id: producto.id,
      cantidad: Number(datos.stock_inicial),
      fecha_vencimiento: datos.fecha_vencimiento || null,
    });
  }

  return productos.obtenerPorId(producto.id);
});

module.exports = {
  previsualizarCSV,
  confirmarImportacion,
  buscar,
  listarPorProveedor,
  crearProductoDesdeItem,
};
