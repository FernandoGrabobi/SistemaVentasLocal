import { formatearMoneda, formatearFecha } from '../toast.js';

const metodoLabel = { efectivo: 'Efectivo', transferencia: 'Transferencia', debito: 'Débito' };

export async function renderReportes(root) {
  const hoy = new Date().toISOString().slice(0, 10);
  const hace7dias = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  root.innerHTML = `
    <div class="p-6 flex flex-col gap-4 h-full overflow-y-auto">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">Reportes de ventas</h1>
        <div class="flex items-center gap-2">
          <input id="f-desde" type="date" class="input" value="${hace7dias}" />
          <span class="text-gray-400">a</span>
          <input id="f-hasta" type="date" class="input" value="${hoy}" />
          <select id="f-metodo" class="input">
            <option value="">Todos los métodos</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="debito">Débito</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-4" id="totales-cards"></div>

      <div class="card flex-1 overflow-hidden flex flex-col">
        <div class="flex-1 overflow-y-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Método</th>
                <th class="text-right">Total</th>
                <th class="text-right">Recibido</th>
                <th class="text-right">Vuelto</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="ventas-body"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div id="modal-detalle-venta" class="fixed inset-0 z-40 hidden items-center justify-center bg-black/40">
      <div class="card w-full max-w-md">
        <h2 class="text-lg font-semibold mb-3">Detalle de venta</h2>
        <div id="detalle-venta-body" class="space-y-1 text-sm max-h-80 overflow-y-auto"></div>
        <div class="flex justify-end mt-4">
          <button id="btn-cerrar-detalle" class="btn-secondary">Cerrar</button>
        </div>
      </div>
    </div>
  `;

  async function cargar() {
    const desde = document.getElementById('f-desde').value;
    const hasta = document.getElementById('f-hasta').value;
    const metodoPago = document.getElementById('f-metodo').value || null;

    const [resVentas, resTotales] = await Promise.all([
      window.api.ventas.listar({ desde, hasta, metodoPago }),
      window.api.ventas.totales({ desde, hasta }),
    ]);

    renderTotales(resTotales.ok ? resTotales.data : null);
    renderVentas(resVentas.ok ? resVentas.data : []);
  }

  function renderTotales(t) {
    const cont = document.getElementById('totales-cards');
    if (!t) {
      cont.innerHTML = '';
      return;
    }
    const cards = [
      { label: 'Cantidad de ventas', value: t.cantidad_ventas },
      { label: 'Total general', value: formatearMoneda(t.total_general) },
      { label: 'Efectivo', value: formatearMoneda(t.total_efectivo) },
      { label: 'Transferencia + Débito', value: formatearMoneda(t.total_transferencia + t.total_debito) },
    ];
    cont.innerHTML = cards
      .map(
        (c) => `<div class="card">
        <div class="text-xs text-gray-500 uppercase tracking-wide">${c.label}</div>
        <div class="text-2xl font-bold mt-1">${c.value}</div>
      </div>`
      )
      .join('');
  }

  function renderVentas(ventas) {
    const body = document.getElementById('ventas-body');
    if (ventas.length === 0) {
      body.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-8">No hay ventas en el período seleccionado.</td></tr>`;
      return;
    }
    body.innerHTML = ventas
      .map(
        (v) => `<tr>
        <td>${formatearFecha(v.fecha)}</td>
        <td class="capitalize">${metodoLabel[v.metodo_pago] || v.metodo_pago}</td>
        <td class="text-right font-semibold">${formatearMoneda(v.total)}</td>
        <td class="text-right text-gray-500">${v.monto_recibido != null ? formatearMoneda(v.monto_recibido) : '-'}</td>
        <td class="text-right text-gray-500">${v.vuelto != null ? formatearMoneda(v.vuelto) : '-'}</td>
        <td class="text-right"><button class="text-brand-600 hover:underline text-sm" data-ver="${v.id}">Ver detalle</button></td>
      </tr>`
      )
      .join('');

    body.querySelectorAll('[data-ver]').forEach((btn) =>
      btn.addEventListener('click', () => verDetalle(Number(btn.dataset.ver)))
    );
  }

  async function verDetalle(ventaId) {
    const res = await window.api.ventas.detalle(ventaId);
    const items = res.ok ? res.data : [];
    const cont = document.getElementById('detalle-venta-body');
    cont.innerHTML = items
      .map(
        (i) => `<div class="flex justify-between border-b border-gray-100 py-1">
        <span>${i.cantidad} x ${i.producto_nombre}</span>
        <span class="font-medium">${formatearMoneda(i.subtotal)}</span>
      </div>`
      )
      .join('');
    const modal = document.getElementById('modal-detalle-venta');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  document.getElementById('btn-cerrar-detalle').addEventListener('click', () => {
    const modal = document.getElementById('modal-detalle-venta');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  });

  document.getElementById('f-desde').addEventListener('change', cargar);
  document.getElementById('f-hasta').addEventListener('change', cargar);
  document.getElementById('f-metodo').addEventListener('change', cargar);

  await cargar();
}
