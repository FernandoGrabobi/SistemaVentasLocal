import { showToast, formatearMoneda, formatearFecha } from '../toast.js';

let listasCache = [];

export async function renderClientes(root) {
  root.innerHTML = `
    <div class="p-6 flex flex-col gap-4 h-full overflow-y-auto">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">Clientes</h1>
        <button id="btn-nuevo-cliente" class="btn-primary">+ Nuevo cliente</button>
      </div>

      <div class="card flex items-center gap-3">
        <input id="busqueda" type="text" placeholder="Buscar por nombre, teléfono o CUIT/DNI..." class="input flex-1" />
      </div>

      <div class="card flex-1 overflow-hidden flex flex-col">
        <div class="flex-1 overflow-y-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th>Nombre</th><th>Teléfono</th><th>Lista de precios</th>
                <th class="text-right">Compras</th><th class="text-right">Total gastado</th><th></th>
              </tr>
            </thead>
            <tbody id="clientes-body"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal cliente -->
    <div id="modal-cliente" class="fixed inset-0 z-40 hidden items-center justify-center bg-black/40">
      <div class="card w-full max-w-lg">
        <h2 id="modal-titulo" class="text-lg font-semibold mb-4">Nuevo cliente</h2>
        <form id="form-cliente" class="space-y-3">
          <input type="hidden" id="c-id" />
          <div>
            <label class="text-sm font-medium text-gray-700">Nombre</label>
            <input id="c-nombre" required class="input mt-1" />
          </div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="text-sm font-medium text-gray-700">Teléfono</label>
              <input id="c-telefono" class="input mt-1" />
            </div>
            <div class="flex-1">
              <label class="text-sm font-medium text-gray-700">Email</label>
              <input id="c-email" type="email" class="input mt-1" />
            </div>
          </div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="text-sm font-medium text-gray-700">CUIT / DNI</label>
              <input id="c-cuit" class="input mt-1" />
            </div>
            <div class="flex-1">
              <label class="text-sm font-medium text-gray-700">Lista de precios</label>
              <select id="c-lista" class="input mt-1"><option value="">Precio base</option></select>
            </div>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Dirección</label>
            <input id="c-direccion" class="input mt-1" />
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" id="btn-cancelar" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal historial -->
    <div id="modal-historial" class="fixed inset-0 z-40 hidden items-center justify-center bg-black/40">
      <div class="card w-full max-w-lg">
        <h2 id="historial-titulo" class="text-lg font-semibold mb-1">Historial de compras</h2>
        <p id="historial-resumen" class="text-sm text-gray-500 mb-3"></p>
        <div id="historial-body" class="space-y-1 text-sm max-h-80 overflow-y-auto"></div>
        <div class="flex justify-end mt-4">
          <button id="btn-cerrar-historial" class="btn-secondary">Cerrar</button>
        </div>
      </div>
    </div>
  `;

  await cargarListas();
  await cargarClientes();

  document.getElementById('busqueda').addEventListener('input', debounce(cargarClientes, 250));
  document.getElementById('btn-nuevo-cliente').addEventListener('click', () => abrirModal());
  document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
  document.getElementById('form-cliente').addEventListener('submit', guardarCliente);
  document.getElementById('btn-cerrar-historial').addEventListener('click', () => {
    const modal = document.getElementById('modal-historial');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function cargarListas() {
  const res = await window.api.listasPrecio.listar();
  listasCache = res.ok ? res.data : [];
  const select = document.getElementById('c-lista');
  listasCache.forEach((l) => {
    select.insertAdjacentHTML('beforeend', `<option value="${l.id}">${l.nombre}</option>`);
  });
}

async function cargarClientes() {
  const busqueda = document.getElementById('busqueda').value.trim();
  const res = await window.api.clientes.listar({ busqueda });
  const clientes = res.ok ? res.data : [];
  const body = document.getElementById('clientes-body');

  if (clientes.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-8">No hay clientes cargados todavía.</td></tr>`;
    return;
  }

  const filas = await Promise.all(
    clientes.map(async (c) => {
      const hist = await window.api.clientes.historialCompras(c.id);
      const resumen = hist.ok ? hist.data.resumen : { cantidad_compras: 0, total_gastado: 0 };
      return { c, resumen };
    })
  );

  body.innerHTML = filas
    .map(
      ({ c, resumen }) => `<tr>
      <td class="font-medium cursor-pointer hover:underline" data-ver-historial="${c.id}">${c.nombre}</td>
      <td class="text-gray-500">${c.telefono || '-'}</td>
      <td class="text-gray-500">${c.lista_precio_nombre || 'Precio base'}</td>
      <td class="text-right">${resumen.cantidad_compras}</td>
      <td class="text-right font-semibold">${formatearMoneda(resumen.total_gastado)}</td>
      <td class="text-right">
        <button class="text-brand-600 hover:underline text-sm" data-editar="${c.id}">Editar</button>
        <button class="text-red-500 hover:underline text-sm ml-2" data-baja="${c.id}">Baja</button>
      </td>
    </tr>`
    )
    .join('');

  body.querySelectorAll('[data-ver-historial]').forEach((el) =>
    el.addEventListener('click', () => verHistorial(Number(el.dataset.verHistorial)))
  );
  body.querySelectorAll('[data-editar]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const res = await window.api.clientes.obtenerPorId(Number(btn.dataset.editar));
      if (res.ok) abrirModal(res.data);
    })
  );
  body.querySelectorAll('[data-baja]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('¿Dar de baja este cliente?')) return;
      await window.api.clientes.darDeBaja(Number(btn.dataset.baja));
      showToast('Cliente dado de baja', 'success');
      cargarClientes();
    })
  );
}

function abrirModal(cliente = null) {
  document.getElementById('modal-titulo').textContent = cliente ? 'Editar cliente' : 'Nuevo cliente';
  document.getElementById('c-id').value = cliente?.id || '';
  document.getElementById('c-nombre').value = cliente?.nombre || '';
  document.getElementById('c-telefono').value = cliente?.telefono || '';
  document.getElementById('c-email').value = cliente?.email || '';
  document.getElementById('c-cuit').value = cliente?.cuit_dni || '';
  document.getElementById('c-lista').value = cliente?.lista_precio_id || '';
  document.getElementById('c-direccion').value = cliente?.direccion || '';
  const modal = document.getElementById('modal-cliente');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function cerrarModal() {
  const modal = document.getElementById('modal-cliente');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function guardarCliente(e) {
  e.preventDefault();
  const id = document.getElementById('c-id').value;
  const cliente = {
    nombre: document.getElementById('c-nombre').value,
    telefono: document.getElementById('c-telefono').value,
    email: document.getElementById('c-email').value,
    cuit_dni: document.getElementById('c-cuit').value,
    lista_precio_id: document.getElementById('c-lista').value || null,
    direccion: document.getElementById('c-direccion').value,
  };
  const res = id ? await window.api.clientes.actualizar(Number(id), cliente) : await window.api.clientes.crear(cliente);
  if (!res.ok) {
    showToast('No se pudo guardar el cliente: ' + res.error, 'error');
    return;
  }
  showToast('Cliente guardado', 'success');
  cerrarModal();
  cargarClientes();
}

async function verHistorial(clienteId) {
  const [resCliente, resHist] = await Promise.all([
    window.api.clientes.obtenerPorId(clienteId),
    window.api.clientes.historialCompras(clienteId),
  ]);
  if (!resCliente.ok || !resHist.ok) return;

  const cliente = resCliente.data;
  const { ventas, resumen } = resHist.data;

  document.getElementById('historial-titulo').textContent = `Historial de ${cliente.nombre}`;
  document.getElementById('historial-resumen').textContent =
    `${resumen.cantidad_compras} compra(s) · ${formatearMoneda(resumen.total_gastado)} en total` +
    (resumen.ultima_compra ? ` · última: ${formatearFecha(resumen.ultima_compra)}` : '');

  const body = document.getElementById('historial-body');
  if (ventas.length === 0) {
    body.innerHTML = `<div class="text-gray-400 text-center py-6">Todavía no tiene compras registradas.</div>`;
  } else {
    body.innerHTML = ventas
      .map(
        (v) => `<div class="flex justify-between border-b border-gray-100 py-2">
        <span>${formatearFecha(v.fecha)} · ${v.metodo_pago}</span>
        <span class="font-medium">${formatearMoneda(v.total)}</span>
      </div>`
      )
      .join('');
  }

  const modal = document.getElementById('modal-historial');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}
