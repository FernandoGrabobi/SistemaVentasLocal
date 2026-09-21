import { showToast, formatearMoneda, formatearFecha } from '../toast.js';

let categoriasCache = [];

export async function renderCatalogos(root) {
  root.innerHTML = `
    <div class="p-6 flex flex-col gap-6 h-full overflow-y-auto">
      <div class="grid grid-cols-2 gap-6">
        <div class="card flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">Categorías</h2>
            <button id="btn-nueva-categoria" class="btn-primary text-sm">+ Nueva</button>
          </div>
          <div id="form-categoria-nueva" class="hidden flex gap-2">
            <input id="input-nueva-categoria" class="input" placeholder="Nombre de la categoría" />
            <button id="btn-guardar-categoria" class="btn-primary">Guardar</button>
          </div>
          <table class="table-base">
            <thead><tr><th>Nombre</th><th></th></tr></thead>
            <tbody id="categorias-body"></tbody>
          </table>
        </div>

        <div class="card flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">Proveedores</h2>
            <button id="btn-nuevo-proveedor" class="btn-primary text-sm">+ Nuevo</button>
          </div>
          <div id="form-proveedor-nuevo" class="hidden grid grid-cols-3 gap-2">
            <input id="input-nuevo-proveedor-nombre" class="input col-span-1" placeholder="Nombre" />
            <input id="input-nuevo-proveedor-contacto" class="input col-span-1" placeholder="Contacto" />
            <div class="flex gap-2">
              <input id="input-nuevo-proveedor-margen" type="number" step="0.1" class="input" placeholder="Margen %" />
              <button id="btn-guardar-proveedor" class="btn-primary">Guardar</button>
            </div>
          </div>
          <table class="table-base">
            <thead><tr><th>Nombre</th><th>Contacto</th><th class="text-right">Margen</th><th></th></tr></thead>
            <tbody id="proveedores-body"></tbody>
          </table>
        </div>
      </div>

      <div class="card flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Catálogos de proveedores</h2>
          <button id="btn-actualizar-precios" class="btn-secondary text-sm">Actualizar precios</button>
        </div>
        <p class="text-xs text-gray-400 -mt-2">
          Subí el CSV de cada proveedor (columnas: código, descripción, marca, costo) para poder buscar sus artículos y crear productos al vuelo. Al reimportar, reemplaza la lista anterior y actualiza el costo de los productos ya vinculados.
        </p>

        <div class="flex items-center gap-2">
          <select id="select-proveedor-catalogo" class="input w-64"></select>
          <button id="btn-importar-csv" class="btn-primary text-sm">Importar CSV...</button>
          <div class="flex-1"></div>
          <input id="buscar-catalogo" class="input w-80" placeholder="Buscar por código, descripción o marca en todos los proveedores..." />
        </div>

        <div class="overflow-y-auto max-h-96">
          <table class="table-base">
            <thead>
              <tr><th>Código</th><th>Descripción</th><th>Marca</th><th class="text-right">Costo</th><th>Proveedor</th><th></th></tr>
            </thead>
            <tbody id="catalogo-body"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal preview de importación -->
    <div id="modal-preview" class="fixed inset-0 z-40 hidden items-center justify-center bg-black/40">
      <div class="card w-full max-w-lg">
        <h2 class="text-lg font-semibold mb-2">Revisar antes de importar</h2>
        <p id="preview-resumen" class="text-sm text-gray-600 mb-3"></p>
        <div id="preview-errores" class="max-h-56 overflow-y-auto text-sm space-y-1 mb-3"></div>
        <div class="flex justify-end gap-2">
          <button id="btn-cancelar-preview" class="btn-secondary">Cancelar</button>
          <button id="btn-confirmar-preview" class="btn-primary">Confirmar importación</button>
        </div>
      </div>
    </div>

    <!-- Modal crear producto desde item -->
    <div id="modal-crear-producto" class="fixed inset-0 z-40 hidden items-center justify-center bg-black/40">
      <div class="card w-full max-w-md">
        <h2 class="text-lg font-semibold mb-1">Crear producto desde catálogo</h2>
        <p id="crear-producto-origen" class="text-xs text-gray-400 mb-3"></p>
        <form id="form-crear-producto" class="space-y-3">
          <div>
            <label class="text-sm font-medium text-gray-700">Código de barra propio</label>
            <input id="cp-codigo" required class="input mt-1" placeholder="Escaneá o escribí el código" />
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Nombre</label>
            <input id="cp-nombre" required class="input mt-1" />
          </div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="text-sm font-medium text-gray-700">Precio de venta</label>
              <input id="cp-precio" type="number" step="0.01" required class="input mt-1" />
              <p class="text-xs text-gray-400 mt-1">Sugerido por margen del proveedor</p>
            </div>
            <div class="flex-1">
              <label class="text-sm font-medium text-gray-700">Categoría</label>
              <select id="cp-categoria" class="input mt-1"><option value="">Sin categoría</option></select>
            </div>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Stock inicial (opcional)</label>
            <input id="cp-stock" type="number" step="0.01" min="0" class="input mt-1" placeholder="0" />
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" id="btn-cancelar-crear-producto" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary">Crear producto</button>
          </div>
        </form>
      </div>
    </div>
  `;

  await cargarCategorias();
  await cargarProveedores();
  await cargarSelectProveedorCatalogo();
  await cargarCatalogo();

  document.getElementById('btn-nueva-categoria').addEventListener('click', () => {
    document.getElementById('form-categoria-nueva').classList.toggle('hidden');
    document.getElementById('input-nueva-categoria').focus();
  });
  document.getElementById('btn-guardar-categoria').addEventListener('click', async () => {
    const input = document.getElementById('input-nueva-categoria');
    if (!input.value.trim()) return;
    const res = await window.api.categorias.crear(input.value);
    if (!res.ok) {
      showToast('No se pudo crear la categoría: ' + res.error, 'error');
      return;
    }
    input.value = '';
    showToast('Categoría creada', 'success');
    cargarCategorias();
  });

  document.getElementById('btn-nuevo-proveedor').addEventListener('click', () => {
    document.getElementById('form-proveedor-nuevo').classList.toggle('hidden');
    document.getElementById('input-nuevo-proveedor-nombre').focus();
  });
  document.getElementById('btn-guardar-proveedor').addEventListener('click', async () => {
    const nombre = document.getElementById('input-nuevo-proveedor-nombre');
    const contacto = document.getElementById('input-nuevo-proveedor-contacto');
    const margen = document.getElementById('input-nuevo-proveedor-margen');
    if (!nombre.value.trim()) return;
    const res = await window.api.proveedores.crear({
      nombre: nombre.value,
      contacto: contacto.value,
      margen_default: margen.value,
    });
    if (!res.ok) {
      showToast('No se pudo crear el proveedor: ' + res.error, 'error');
      return;
    }
    nombre.value = '';
    contacto.value = '';
    margen.value = '';
    showToast('Proveedor creado', 'success');
    cargarProveedores();
    cargarSelectProveedorCatalogo();
  });

  document.getElementById('btn-actualizar-precios').addEventListener('click', async () => {
    const res = await window.api.productos.actualizarPreciosDesdeCatalogo();
    if (!res.ok) {
      showToast('No se pudo actualizar precios: ' + res.error, 'error');
      return;
    }
    showToast(`${res.data} producto(s) actualizado(s) según el costo del proveedor`, 'success');
  });

  document.getElementById('btn-importar-csv').addEventListener('click', importarCSV);
  document.getElementById('buscar-catalogo').addEventListener('input', debounce(cargarCatalogo, 250));
  document.getElementById('select-proveedor-catalogo').addEventListener('change', cargarCatalogo);

  document.getElementById('btn-cancelar-preview').addEventListener('click', () => cerrarModal('modal-preview'));
  document.getElementById('btn-cancelar-crear-producto').addEventListener('click', () => cerrarModal('modal-crear-producto'));
  document.getElementById('form-crear-producto').addEventListener('submit', confirmarCrearProducto);
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function abrirModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}
function cerrarModal(id) {
  const modal = document.getElementById(id);
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function cargarCategorias() {
  const res = await window.api.categorias.listar();
  const body = document.getElementById('categorias-body');
  const categorias = res.ok ? res.data : [];
  categoriasCache = categorias;

  const selectCp = document.getElementById('cp-categoria');
  if (selectCp) {
    selectCp.innerHTML = '<option value="">Sin categoría</option>';
    categorias.forEach((c) => selectCp.insertAdjacentHTML('beforeend', `<option value="${c.id}">${c.nombre}</option>`));
  }

  if (categorias.length === 0) {
    body.innerHTML = `<tr><td colspan="2" class="text-center text-gray-400 py-6">Sin categorías cargadas.</td></tr>`;
    return;
  }

  body.innerHTML = categorias
    .map(
      (c) => `<tr>
      <td>${c.nombre}</td>
      <td class="text-right">
        <button class="text-brand-600 hover:underline text-sm" data-editar="${c.id}">Editar</button>
        <button class="text-red-500 hover:underline text-sm ml-2" data-borrar="${c.id}">Borrar</button>
      </td>
    </tr>`
    )
    .join('');

  body.querySelectorAll('[data-editar]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const actual = categorias.find((c) => c.id === Number(btn.dataset.editar));
      const nuevoNombre = prompt('Nuevo nombre de la categoría', actual.nombre);
      if (!nuevoNombre || !nuevoNombre.trim()) return;
      await window.api.categorias.actualizar(actual.id, nuevoNombre);
      showToast('Categoría actualizada', 'success');
      cargarCategorias();
    })
  );
  body.querySelectorAll('[data-borrar]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('¿Borrar esta categoría? Los productos que la usan quedarán sin categoría.')) return;
      await window.api.categorias.eliminar(Number(btn.dataset.borrar));
      showToast('Categoría eliminada', 'success');
      cargarCategorias();
    })
  );
}

async function cargarProveedores() {
  const res = await window.api.proveedores.listar();
  const body = document.getElementById('proveedores-body');
  const proveedores = res.ok ? res.data : [];

  if (proveedores.length === 0) {
    body.innerHTML = `<tr><td colspan="4" class="text-center text-gray-400 py-6">Sin proveedores cargados.</td></tr>`;
    return;
  }

  body.innerHTML = proveedores
    .map(
      (p) => `<tr>
      <td>${p.nombre}</td>
      <td class="text-gray-500">${p.contacto || '-'}</td>
      <td class="text-right text-gray-500">${p.margen_default}%</td>
      <td class="text-right">
        <button class="text-brand-600 hover:underline text-sm" data-editar="${p.id}">Editar</button>
        <button class="text-red-500 hover:underline text-sm ml-2" data-borrar="${p.id}">Borrar</button>
      </td>
    </tr>`
    )
    .join('');

  body.querySelectorAll('[data-editar]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const actual = proveedores.find((p) => p.id === Number(btn.dataset.editar));
      const nuevoNombre = prompt('Nombre del proveedor', actual.nombre);
      if (!nuevoNombre || !nuevoNombre.trim()) return;
      const nuevoContacto = prompt('Contacto', actual.contacto || '');
      const nuevoMargen = prompt('Margen por defecto (%)', actual.margen_default);
      await window.api.proveedores.actualizar(actual.id, {
        nombre: nuevoNombre,
        contacto: nuevoContacto,
        margen_default: nuevoMargen,
      });
      showToast('Proveedor actualizado', 'success');
      cargarProveedores();
      cargarSelectProveedorCatalogo();
    })
  );
  body.querySelectorAll('[data-borrar]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('¿Borrar este proveedor? Los productos que lo usan quedarán sin proveedor.')) return;
      await window.api.proveedores.eliminar(Number(btn.dataset.borrar));
      showToast('Proveedor eliminado', 'success');
      cargarProveedores();
      cargarSelectProveedorCatalogo();
    })
  );
}

async function cargarSelectProveedorCatalogo() {
  const res = await window.api.proveedores.listar();
  const proveedores = res.ok ? res.data : [];
  const select = document.getElementById('select-proveedor-catalogo');
  const actual = select.value;
  select.innerHTML =
    '<option value="">Todos los proveedores</option>' +
    proveedores.map((p) => `<option value="${p.id}">${p.nombre}</option>`).join('');
  if (actual) select.value = actual;
}

// --- Importación de CSV ---
async function importarCSV() {
  const proveedorId = Number(document.getElementById('select-proveedor-catalogo').value) || null;
  if (!proveedorId) {
    showToast('Elegí primero un proveedor específico para importarle su lista', 'error');
    return;
  }

  const archivo = await window.api.catalogos.elegirArchivoCSV();
  if (!archivo.ok || !archivo.data) return; // cancelado

  const preview = await window.api.catalogos.previsualizar(archivo.data.contenido);
  if (!preview.ok) {
    showToast('No se pudo leer el archivo: ' + preview.error, 'error');
    return;
  }

  const { items, errores, totalFilas } = preview.data;
  const resumenEl = document.getElementById('preview-resumen');
  resumenEl.textContent = `${items.length} de ${totalFilas} filas listas para importar. ${errores.length} error(es).`;

  const erroresEl = document.getElementById('preview-errores');
  if (errores.length === 0) {
    erroresEl.innerHTML = `<div class="text-green-600">Sin errores — todo listo para importar.</div>`;
  } else {
    erroresEl.innerHTML = errores
      .slice(0, 30)
      .map((e) => `<div class="text-red-600">Fila ${e.fila}: ${e.motivo}</div>`)
      .join('');
    if (errores.length > 30) {
      erroresEl.insertAdjacentHTML('beforeend', `<div class="text-gray-400">... y ${errores.length - 30} más</div>`);
    }
  }

  const btnConfirmar = document.getElementById('btn-confirmar-preview');
  btnConfirmar.disabled = items.length === 0;
  btnConfirmar.onclick = async () => {
    const res = await window.api.catalogos.confirmarImportacion(proveedorId, items);
    if (!res.ok) {
      showToast('No se pudo importar: ' + res.error, 'error');
      return;
    }
    showToast(`Catálogo importado: ${res.data.insertados} ítems (${res.data.borrados} quitados por no venir en el archivo nuevo)`, 'success');
    cerrarModal('modal-preview');
    cargarCatalogo();
  };

  abrirModal('modal-preview');
}

// --- Búsqueda / listado de catálogo ---
let itemSeleccionado = null;

async function cargarCatalogo() {
  const query = document.getElementById('buscar-catalogo').value.trim();
  const proveedorId = Number(document.getElementById('select-proveedor-catalogo').value) || null;

  const res = await window.api.catalogos.buscar(query, proveedorId);
  const items = res.ok ? res.data : [];
  const body = document.getElementById('catalogo-body');

  if (items.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-8">${
      query ? 'Sin resultados.' : 'Importá un CSV o buscá un artículo.'
    }</td></tr>`;
    return;
  }

  body.innerHTML = items
    .map(
      (it) => `<tr>
      <td class="font-mono text-xs">${it.codigo}</td>
      <td>${it.descripcion || '-'}</td>
      <td class="text-gray-500">${it.marca || '-'}</td>
      <td class="text-right">${formatearMoneda(it.costo)}</td>
      <td class="text-gray-500">${it.proveedor_nombre}</td>
      <td class="text-right">
        ${
          it.producto_id
            ? `<span class="text-xs text-gray-400">Ya vinculado a "${it.producto_nombre}"</span>`
            : `<button class="text-brand-600 hover:underline text-sm" data-crear="${it.id}">Crear producto</button>`
        }
      </td>
    </tr>`
    )
    .join('');

  body.querySelectorAll('[data-crear]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const item = items.find((i) => i.id === Number(btn.dataset.crear));
      abrirModalCrearProducto(item);
    })
  );
}

function abrirModalCrearProducto(item) {
  itemSeleccionado = item;
  const precioSugerido = Number((item.costo * (1 + item.margen_default / 100)).toFixed(2));
  document.getElementById('crear-producto-origen').textContent = `De: ${item.proveedor_nombre} · Costo: ${formatearMoneda(item.costo)} · Margen: ${item.margen_default}%`;
  document.getElementById('cp-codigo').value = item.codigo;
  document.getElementById('cp-nombre').value = item.descripcion || item.codigo;
  document.getElementById('cp-precio').value = precioSugerido;
  document.getElementById('cp-categoria').value = '';
  document.getElementById('cp-stock').value = '';
  abrirModal('modal-crear-producto');
}

async function confirmarCrearProducto(e) {
  e.preventDefault();
  if (!itemSeleccionado) return;

  const datos = {
    codigo_barra: document.getElementById('cp-codigo').value,
    nombre: document.getElementById('cp-nombre').value,
    precio: Number(document.getElementById('cp-precio').value),
    categoria_id: document.getElementById('cp-categoria').value || null,
    stock_inicial: Number(document.getElementById('cp-stock').value) || 0,
  };

  const res = await window.api.catalogos.crearProductoDesdeItem(itemSeleccionado.id, datos);
  if (!res.ok) {
    if (String(res.error).includes('UNIQUE')) {
      showToast('Ya existe un producto con ese código de barra', 'error');
    } else {
      showToast('No se pudo crear el producto: ' + res.error, 'error');
    }
    return;
  }

  showToast(`Producto "${res.data.nombre}" creado`, 'success');
  cerrarModal('modal-crear-producto');
  cargarCatalogo();
}
