import { showToast, formatearMoneda, formatearFecha } from '../toast.js';

let productosCache = [];
let categoriasCache = [];
let proveedoresCache = [];
let filaExpandidaId = null;
let incluirInactivos = false;
let diasAlerta = 14;

export async function renderStock(root) {
  root.innerHTML = `
    <div class="p-6 flex flex-col gap-4 h-full overflow-y-auto">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">Stock</h1>
        <button id="btn-nuevo-producto" class="btn-primary">+ Nuevo producto</button>
      </div>

      <div id="alerta-stock-bajo" class="card border-red-200 bg-red-50 hidden"></div>
      <div id="alerta-vencimientos" class="card border-amber-200 bg-amber-50 hidden"></div>

      <div class="card flex items-center gap-3">
        <input id="busqueda" type="text" placeholder="Buscar por nombre o código..." class="input flex-1" />
        <select id="filtro-categoria" class="input w-56">
          <option value="">Todas las categorías</option>
        </select>
        <label class="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
          <input id="check-inactivos" type="checkbox" class="rounded" />
          Mostrar inactivos
        </label>
        <label class="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
          Alertar vencimiento en
          <input id="input-dias-alerta" type="number" min="1" value="${diasAlerta}" class="input w-20" />
          días
        </label>
      </div>

      <div class="card flex-1 overflow-hidden flex flex-col">
        <div class="flex-1 overflow-y-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th></th>
                <th>Producto</th>
                <th>Código</th>
                <th>Categoría</th>
                <th>Proveedor</th>
                <th class="text-right">Precio</th>
                <th class="text-right">Stock total</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="productos-body"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal producto -->
    <div id="modal-producto" class="fixed inset-0 z-40 hidden items-center justify-center bg-black/40">
      <div class="card w-full max-w-lg">
        <h2 id="modal-producto-titulo" class="text-lg font-semibold mb-4">Nuevo producto</h2>
        <form id="form-producto" class="space-y-3">
          <input type="hidden" id="f-id" />
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="text-sm font-medium text-gray-700">Código de barra</label>
              <input id="f-codigo" required class="input mt-1" placeholder="Escaneá o escribí el código" />
            </div>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Nombre</label>
            <input id="f-nombre" required class="input mt-1" />
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Descripción</label>
            <textarea id="f-descripcion" class="input mt-1" rows="2"></textarea>
          </div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="text-sm font-medium text-gray-700">Costo</label>
              <input id="f-costo" type="number" step="0.01" min="0" class="input mt-1" placeholder="0.00" />
            </div>
            <div class="flex-1">
              <label class="text-sm font-medium text-gray-700">Precio de venta</label>
              <input id="f-precio" type="number" step="0.01" min="0" required class="input mt-1" />
            </div>
            <div class="flex-1">
              <label class="text-sm font-medium text-gray-700">Stock mínimo</label>
              <input id="f-stock-minimo" type="number" step="0.01" min="0" class="input mt-1" placeholder="0" />
            </div>
          </div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="text-sm font-medium text-gray-700">Categoría</label>
              <select id="f-categoria" class="input mt-1"><option value="">Sin categoría</option></select>
            </div>
            <div class="flex-1">
              <label class="text-sm font-medium text-gray-700">Proveedor</label>
              <select id="f-proveedor" class="input mt-1"><option value="">Sin proveedor</option></select>
            </div>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" id="btn-cancelar-producto" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal lote -->
    <div id="modal-lote" class="fixed inset-0 z-40 hidden items-center justify-center bg-black/40">
      <div class="card w-full max-w-sm">
        <h2 id="modal-lote-titulo" class="text-lg font-semibold mb-4">Nuevo lote</h2>
        <form id="form-lote" class="space-y-3">
          <input type="hidden" id="l-id" />
          <input type="hidden" id="l-producto-id" />
          <div>
            <label class="text-sm font-medium text-gray-700">Cantidad</label>
            <input id="l-cantidad" type="number" step="0.01" required class="input mt-1" />
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Fecha de vencimiento</label>
            <input id="l-vencimiento" type="date" class="input mt-1" />
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" id="btn-cancelar-lote" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  `;

  await cargarCategoriasYProveedores();
  await cargarYRenderizarProductos();
  await renderizarAlertaVencimientos();
  await renderizarAlertaStockBajo();

  document.getElementById('busqueda').addEventListener('input', debounce(cargarYRenderizarProductos, 250));
  document.getElementById('filtro-categoria').addEventListener('change', cargarYRenderizarProductos);
  document.getElementById('check-inactivos').addEventListener('change', (e) => {
    incluirInactivos = e.target.checked;
    cargarYRenderizarProductos();
  });
  document.getElementById('input-dias-alerta').addEventListener('change', (e) => {
    diasAlerta = Number(e.target.value) || 14;
    renderizarAlertaVencimientos();
  });

  document.getElementById('btn-nuevo-producto').addEventListener('click', () => abrirModalProducto());
  document.getElementById('btn-cancelar-producto').addEventListener('click', cerrarModalProducto);
  document.getElementById('form-producto').addEventListener('submit', guardarProducto);

  document.getElementById('btn-cancelar-lote').addEventListener('click', cerrarModalLote);
  document.getElementById('form-lote').addEventListener('submit', guardarLote);
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function cargarCategoriasYProveedores() {
  const [resCat, resProv] = await Promise.all([window.api.categorias.listar(), window.api.proveedores.listar()]);
  categoriasCache = resCat.ok ? resCat.data : [];
  proveedoresCache = resProv.ok ? resProv.data : [];

  const filtroCategoria = document.getElementById('filtro-categoria');
  const selCategoria = document.getElementById('f-categoria');
  const selProveedor = document.getElementById('f-proveedor');

  categoriasCache.forEach((c) => {
    filtroCategoria.insertAdjacentHTML('beforeend', `<option value="${c.id}">${c.nombre}</option>`);
    selCategoria.insertAdjacentHTML('beforeend', `<option value="${c.id}">${c.nombre}</option>`);
  });
  proveedoresCache.forEach((p) => {
    selProveedor.insertAdjacentHTML('beforeend', `<option value="${p.id}">${p.nombre}</option>`);
  });
}

async function cargarYRenderizarProductos() {
  const busqueda = document.getElementById('busqueda').value.trim();
  const categoriaId = document.getElementById('filtro-categoria').value || null;

  const res = await window.api.productos.listar({ incluirInactivos, busqueda, categoriaId });
  productosCache = res.ok ? res.data : [];
  renderizarTablaProductos();
}

function renderizarTablaProductos() {
  const body = document.getElementById('productos-body');
  if (productosCache.length === 0) {
    body.innerHTML = `<tr><td colspan="8" class="text-center text-gray-400 py-8">No hay productos para mostrar.</td></tr>`;
    return;
  }

  body.innerHTML = productosCache
    .map((p) => {
      const inactivo = p.activo === 0;
      const filaClase = inactivo ? 'opacity-50' : '';
      return `
      <tr class="cursor-pointer hover:bg-gray-50 ${filaClase}" data-toggle-id="${p.id}">
        <td class="text-gray-400">${filaExpandidaId === p.id ? '▼' : '▶'}</td>
        <td class="font-medium">${p.nombre}${inactivo ? ' <span class=\"text-xs text-gray-400\">(inactivo)</span>' : ''}</td>
        <td class="text-gray-500">${p.codigo_barra}</td>
        <td class="text-gray-500">${p.categoria_nombre || '-'}</td>
        <td class="text-gray-500">${p.proveedor_nombre || '-'}</td>
        <td class="text-right">${formatearMoneda(p.precio)}</td>
        <td class="text-right font-semibold">${p.stock_total}</td>
        <td class="text-right">
          <button class="text-brand-600 hover:underline text-sm" data-action="editar" data-id="${p.id}">Editar</button>
          ${
            inactivo
              ? `<button class="text-green-600 hover:underline text-sm ml-2" data-action="reactivar" data-id="${p.id}">Reactivar</button>`
              : `<button class="text-red-500 hover:underline text-sm ml-2" data-action="baja" data-id="${p.id}">Dar de baja</button>`
          }
        </td>
      </tr>
      ${filaExpandidaId === p.id ? `<tr><td colspan="8" class="bg-gray-50">${renderLotesPlaceholder(p.id)}</td></tr>` : ''}
    `;
    })
    .join('');

  body.querySelectorAll('tr[data-toggle-id]').forEach((tr) => {
    tr.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const id = Number(tr.dataset.toggleId);
      filaExpandidaId = filaExpandidaId === id ? null : id;
      renderizarTablaProductos();
      if (filaExpandidaId === id) cargarLotes(id);
    });
  });

  body.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      if (btn.dataset.action === 'editar') {
        abrirModalProducto(productosCache.find((p) => p.id === id));
      } else if (btn.dataset.action === 'baja') {
        if (confirm('¿Dar de baja este producto? No se va a poder vender hasta reactivarlo.')) {
          await window.api.productos.darDeBaja(id);
          showToast('Producto dado de baja', 'success');
          cargarYRenderizarProductos();
        }
      } else if (btn.dataset.action === 'reactivar') {
        await window.api.productos.reactivar(id);
        showToast('Producto reactivado', 'success');
        cargarYRenderizarProductos();
      }
    });
  });
}

function renderLotesPlaceholder(productoId) {
  return `
    <div class="p-3" id="lotes-panel-${productoId}">
      <div class="text-sm text-gray-400">Cargando lotes...</div>
    </div>
  `;
}

async function cargarLotes(productoId) {
  const res = await window.api.lotes.listarPorProducto(productoId);
  const lotes = res.ok ? res.data : [];
  const panel = document.getElementById(`lotes-panel-${productoId}`);
  if (!panel) return;

  panel.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <div class="text-sm font-semibold text-gray-600">Lotes</div>
      <button class="btn-secondary text-xs" data-nuevo-lote="${productoId}">+ Nuevo lote</button>
    </div>
    ${
      lotes.length === 0
        ? '<div class="text-sm text-gray-400">Sin lotes cargados.</div>'
        : `<table class="table-base bg-white rounded-lg overflow-hidden">
        <thead><tr><th>Cantidad</th><th>Vencimiento</th><th>Ingreso</th><th></th></tr></thead>
        <tbody>
          ${lotes
            .map((l) => {
              const dias = l.fecha_vencimiento
                ? Math.ceil((new Date(l.fecha_vencimiento) - new Date()) / 86400000)
                : null;
              const alerta = dias !== null && dias <= diasAlerta;
              return `<tr class="${alerta ? 'bg-amber-50' : ''}">
              <td>${l.cantidad}</td>
              <td class="${alerta ? 'text-amber-700 font-medium' : ''}">${l.fecha_vencimiento || '-'} ${
                alerta ? (dias < 0 ? '(vencido)' : `(${dias} días)`) : ''
              }</td>
              <td class="text-gray-400">${formatearFecha(l.fecha_ingreso)}</td>
              <td class="text-right">
                <button class="text-brand-600 hover:underline text-xs" data-editar-lote="${l.id}" data-producto="${productoId}">Editar</button>
                <button class="text-red-500 hover:underline text-xs ml-2" data-borrar-lote="${l.id}">Borrar</button>
              </td>
            </tr>`;
            })
            .join('')}
        </tbody>
      </table>`
    }
  `;

  panel.querySelector(`[data-nuevo-lote]`).addEventListener('click', () => abrirModalLote(productoId));
  panel.querySelectorAll('[data-editar-lote]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const lote = lotes.find((l) => l.id === Number(btn.dataset.editarLote));
      abrirModalLote(productoId, lote);
    })
  );
  panel.querySelectorAll('[data-borrar-lote]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (confirm('¿Borrar este lote?')) {
        await window.api.lotes.eliminar(Number(btn.dataset.borrarLote));
        showToast('Lote eliminado', 'success');
        cargarLotes(productoId);
        cargarYRenderizarProductos();
      }
    })
  );
}

// --- Alertas de vencimiento (panel superior) ---
async function renderizarAlertaVencimientos() {
  const res = await window.api.lotes.proximosAVencer(diasAlerta);
  const el = document.getElementById('alerta-vencimientos');
  if (!res.ok || res.data.length === 0) {
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="font-semibold text-amber-800 mb-2">⚠️ ${res.data.length} lote(s) próximos a vencer o vencidos</div>
    <div class="flex flex-wrap gap-2">
      ${res.data
        .slice(0, 12)
        .map((l) => {
          const vencido = l.dias_restantes < 0;
          return `<span class="text-xs px-2 py-1 rounded-full ${vencido ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}">
          ${l.producto_nombre} · ${l.cantidad}u · ${vencido ? 'vencido' : `${l.dias_restantes}d`}
        </span>`;
        })
        .join('')}
    </div>
  `;
}

// --- Alertas de stock mínimo (panel superior) ---
async function renderizarAlertaStockBajo() {
  const res = await window.api.productos.stockBajo();
  const el = document.getElementById('alerta-stock-bajo');
  if (!res.ok || res.data.length === 0) {
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="font-semibold text-red-800 mb-2">🔻 ${res.data.length} producto(s) por debajo del stock mínimo</div>
    <div class="flex flex-wrap gap-2">
      ${res.data
        .slice(0, 12)
        .map(
          (p) => `<span class="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">
          ${p.nombre} · stock ${p.stock_total} / mín. ${p.stock_minimo}
        </span>`
        )
        .join('')}
    </div>
  `;
}

// --- Modal producto ---
function abrirModalProducto(producto = null) {
  const modal = document.getElementById('modal-producto');
  document.getElementById('modal-producto-titulo').textContent = producto ? 'Editar producto' : 'Nuevo producto';
  document.getElementById('f-id').value = producto?.id || '';
  document.getElementById('f-codigo').value = producto?.codigo_barra || '';
  document.getElementById('f-nombre').value = producto?.nombre || '';
  document.getElementById('f-descripcion').value = producto?.descripcion || '';
  document.getElementById('f-costo').value = producto?.costo || '';
  document.getElementById('f-precio').value = producto?.precio ?? '';
  document.getElementById('f-stock-minimo').value = producto?.stock_minimo || '';
  document.getElementById('f-categoria').value = producto?.categoria_id || '';
  document.getElementById('f-proveedor').value = producto?.proveedor_id || '';
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function cerrarModalProducto() {
  const modal = document.getElementById('modal-producto');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function guardarProducto(e) {
  e.preventDefault();
  const id = document.getElementById('f-id').value;
  const producto = {
    codigo_barra: document.getElementById('f-codigo').value,
    nombre: document.getElementById('f-nombre').value,
    descripcion: document.getElementById('f-descripcion').value,
    costo: document.getElementById('f-costo').value,
    precio: document.getElementById('f-precio').value,
    stock_minimo: document.getElementById('f-stock-minimo').value,
    categoria_id: document.getElementById('f-categoria').value || null,
    proveedor_id: document.getElementById('f-proveedor').value || null,
  };

  const res = id
    ? await window.api.productos.actualizar(Number(id), producto)
    : await window.api.productos.crear(producto);

  if (!res.ok) {
    if (String(res.error).includes('UNIQUE')) {
      showToast('Ya existe un producto con ese código de barra', 'error');
    } else {
      showToast('No se pudo guardar el producto: ' + res.error, 'error');
    }
    return;
  }

  showToast('Producto guardado', 'success');
  cerrarModalProducto();
  cargarYRenderizarProductos();
  renderizarAlertaVencimientos();
  renderizarAlertaStockBajo();
}

// --- Modal lote ---
function abrirModalLote(productoId, lote = null) {
  const modal = document.getElementById('modal-lote');
  document.getElementById('modal-lote-titulo').textContent = lote ? 'Editar lote' : 'Nuevo lote';
  document.getElementById('l-id').value = lote?.id || '';
  document.getElementById('l-producto-id').value = productoId;
  document.getElementById('l-cantidad').value = lote?.cantidad ?? '';
  document.getElementById('l-vencimiento').value = lote?.fecha_vencimiento || '';
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function cerrarModalLote() {
  const modal = document.getElementById('modal-lote');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function guardarLote(e) {
  e.preventDefault();
  const id = document.getElementById('l-id').value;
  const productoId = Number(document.getElementById('l-producto-id').value);
  const lote = {
    producto_id: productoId,
    cantidad: document.getElementById('l-cantidad').value,
    fecha_vencimiento: document.getElementById('l-vencimiento').value || null,
  };

  const res = id ? await window.api.lotes.actualizar(Number(id), lote) : await window.api.lotes.crear(lote);

  if (!res.ok) {
    showToast('No se pudo guardar el lote: ' + res.error, 'error');
    return;
  }

  showToast('Lote guardado', 'success');
  cerrarModalLote();
  cargarLotes(productoId);
  cargarYRenderizarProductos();
  renderizarAlertaVencimientos();
  renderizarAlertaStockBajo();
}
