import { showToast, formatearMoneda } from '../toast.js';

let listaSeleccionadaId = null;

export async function renderPrecios(root) {
  root.innerHTML = `
    <div class="p-6 grid grid-cols-[280px_1fr] gap-6 h-full overflow-hidden">
      <div class="card flex flex-col gap-3 overflow-hidden">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold">Listas de precios</h2>
        </div>
        <div class="flex gap-2">
          <input id="nueva-lista" class="input" placeholder="Nueva lista (ej: Mayorista)" />
          <button id="btn-crear-lista" class="btn-primary px-3">+</button>
        </div>
        <div id="listas-container" class="flex-1 overflow-y-auto flex flex-col gap-1"></div>
      </div>

      <div class="card flex flex-col overflow-hidden" id="panel-lista">
        <div class="text-gray-400 text-center py-12">Elegí o creá una lista de precios para ver sus productos.</div>
      </div>
    </div>
  `;

  document.getElementById('btn-crear-lista').addEventListener('click', async () => {
    const input = document.getElementById('nueva-lista');
    if (!input.value.trim()) return;
    const res = await window.api.listasPrecio.crear(input.value);
    if (!res.ok) {
      showToast('No se pudo crear la lista: ' + res.error, 'error');
      return;
    }
    input.value = '';
    showToast('Lista creada', 'success');
    listaSeleccionadaId = res.data.id;
    await cargarListas();
    await cargarPanelLista();
  });

  await cargarListas();
}

async function cargarListas() {
  const res = await window.api.listasPrecio.listar();
  const listas = res.ok ? res.data : [];
  const cont = document.getElementById('listas-container');

  if (listas.length === 0) {
    cont.innerHTML = `<div class="text-sm text-gray-400 py-4 text-center">Sin listas todavía.</div>`;
    return;
  }

  cont.innerHTML = listas
    .map(
      (l) => `<div class="flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer ${
        listaSeleccionadaId === l.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-gray-50'
      }" data-lista="${l.id}">
      <span class="text-sm font-medium">${l.nombre}</span>
      <button class="text-red-400 hover:text-red-600 text-xs" data-borrar-lista="${l.id}">✕</button>
    </div>`
    )
    .join('');

  cont.querySelectorAll('[data-lista]').forEach((el) =>
    el.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      listaSeleccionadaId = Number(el.dataset.lista);
      cargarListas();
      cargarPanelLista();
    })
  );
  cont.querySelectorAll('[data-borrar-lista]').forEach((btn) =>
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('¿Borrar esta lista de precios? Los clientes que la tenían asignada quedan sin lista.')) return;
      await window.api.listasPrecio.eliminar(Number(btn.dataset.borrarLista));
      if (listaSeleccionadaId === Number(btn.dataset.borrarLista)) listaSeleccionadaId = null;
      showToast('Lista eliminada', 'success');
      cargarListas();
      cargarPanelLista();
    })
  );
}

async function cargarPanelLista() {
  const panel = document.getElementById('panel-lista');
  if (!listaSeleccionadaId) {
    panel.innerHTML = `<div class="text-gray-400 text-center py-12">Elegí o creá una lista de precios para ver sus productos.</div>`;
    return;
  }

  panel.innerHTML = `
    <div class="flex items-center gap-2 mb-3">
      <input id="buscar-producto" class="input flex-1" placeholder="Buscar producto por nombre o código para agregar un precio especial..." />
    </div>
    <div id="resultados-busqueda" class="mb-3"></div>
    <div class="flex-1 overflow-y-auto">
      <table class="table-base">
        <thead><tr><th>Producto</th><th class="text-right">Precio base</th><th class="text-right">Precio especial</th><th></th></tr></thead>
        <tbody id="precios-body"></tbody>
      </table>
    </div>
  `;

  document.getElementById('buscar-producto').addEventListener('input', debounce(buscarProductos, 250));
  await cargarPrecios();
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function buscarProductos(e) {
  const busqueda = e.target.value.trim();
  const cont = document.getElementById('resultados-busqueda');
  if (!busqueda) {
    cont.innerHTML = '';
    return;
  }
  const res = await window.api.productos.listar({ busqueda });
  const productos = res.ok ? res.data.slice(0, 6) : [];

  if (productos.length === 0) {
    cont.innerHTML = `<div class="text-sm text-gray-400">Sin resultados.</div>`;
    return;
  }

  cont.innerHTML = `<div class="border border-gray-200 rounded-lg divide-y">
    ${productos
      .map(
        (p) => `<div class="flex items-center justify-between px-3 py-2 text-sm">
        <span>${p.nombre} <span class="text-gray-400">· ${formatearMoneda(p.precio)}</span></span>
        <button class="text-brand-600 hover:underline text-xs" data-agregar="${p.id}" data-precio-base="${p.precio}">+ Agregar precio especial</button>
      </div>`
      )
      .join('')}
  </div>`;

  cont.querySelectorAll('[data-agregar]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const sugerido = prompt('Precio especial para esta lista:', btn.dataset.precioBase);
      if (sugerido === null) return;
      const precio = Number(sugerido);
      if (isNaN(precio) || precio < 0) {
        showToast('Precio inválido', 'error');
        return;
      }
      await window.api.listasPrecio.fijarPrecio(listaSeleccionadaId, Number(btn.dataset.agregar), precio);
      showToast('Precio especial guardado', 'success');
      document.getElementById('buscar-producto').value = '';
      cont.innerHTML = '';
      cargarPrecios();
    })
  );
}

async function cargarPrecios() {
  const res = await window.api.listasPrecio.listarPrecios(listaSeleccionadaId);
  const precios = res.ok ? res.data : [];
  const body = document.getElementById('precios-body');

  if (precios.length === 0) {
    body.innerHTML = `<tr><td colspan="4" class="text-center text-gray-400 py-8">Sin precios especiales cargados. Buscá un producto arriba para agregar uno.</td></tr>`;
    return;
  }

  body.innerHTML = precios
    .map(
      (p) => `<tr>
      <td class="font-medium">${p.producto_nombre}</td>
      <td class="text-right text-gray-400">${formatearMoneda(p.precio_base)}</td>
      <td class="text-right font-semibold">${formatearMoneda(p.precio)}</td>
      <td class="text-right">
        <button class="text-brand-600 hover:underline text-sm" data-editar-precio="${p.id}" data-producto="${p.producto_id}" data-actual="${p.precio}">Editar</button>
        <button class="text-red-500 hover:underline text-sm ml-2" data-quitar="${p.id}">Quitar</button>
      </td>
    </tr>`
    )
    .join('');

  body.querySelectorAll('[data-editar-precio]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const nuevo = prompt('Nuevo precio especial:', btn.dataset.actual);
      if (nuevo === null) return;
      const precio = Number(nuevo);
      if (isNaN(precio) || precio < 0) {
        showToast('Precio inválido', 'error');
        return;
      }
      await window.api.listasPrecio.fijarPrecio(listaSeleccionadaId, Number(btn.dataset.producto), precio);
      showToast('Precio actualizado', 'success');
      cargarPrecios();
    })
  );
  body.querySelectorAll('[data-quitar]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      await window.api.listasPrecio.quitarPrecio(Number(btn.dataset.quitar));
      showToast('Precio especial quitado', 'success');
      cargarPrecios();
    })
  );
}
