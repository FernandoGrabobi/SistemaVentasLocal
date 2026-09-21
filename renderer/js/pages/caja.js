import { showToast, formatearMoneda, formatearFecha } from '../toast.js';

const CATEGORIAS_EGRESO = [
  { value: 'retiro', label: 'Retiro' },
  { value: 'gasto', label: 'Gasto' },
  { value: 'ajuste', label: 'Ajuste' },
];
const CATEGORIAS_INGRESO = [
  { value: 'ingreso_extra', label: 'Ingreso extra' },
  { value: 'ajuste', label: 'Ajuste' },
];

export async function renderCaja(root) {
  const resTurno = await window.api.caja.turnoAbierto();
  const turno = resTurno.ok ? resTurno.data : null;

  if (!turno) {
    root.innerHTML = `
      <div class="p-6 max-w-md mx-auto flex flex-col gap-4">
        <div class="card text-center">
          <div class="text-4xl mb-2">🔒</div>
          <h1 class="text-lg font-semibold mb-1">La caja está cerrada</h1>
          <p class="text-sm text-gray-500 mb-4">Abrí un turno para empezar a vender y registrar movimientos.</p>
          <label class="text-sm font-medium text-gray-700 block text-left mb-1">Monto inicial en caja</label>
          <input id="monto-apertura" type="number" min="0" step="0.01" class="input text-lg" placeholder="0.00" />
          <button id="btn-abrir" class="btn-primary w-full mt-4">Abrir caja</button>
        </div>
        <div id="historial-turnos"></div>
      </div>
    `;
    document.getElementById('btn-abrir').addEventListener('click', async () => {
      const monto = Number(document.getElementById('monto-apertura').value) || 0;
      const res = await window.api.caja.abrirTurno(monto);
      if (!res.ok) {
        showToast('No se pudo abrir la caja: ' + res.error, 'error');
        return;
      }
      showToast('Caja abierta', 'success');
      renderCaja(root);
    });
    await renderHistorialTurnos(document.getElementById('historial-turnos'));
    return;
  }

  root.innerHTML = `
    <div class="p-6 flex flex-col gap-4 h-full overflow-y-auto">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold">Caja abierta</h1>
          <p class="text-sm text-gray-500">Desde ${formatearFecha(turno.fecha_apertura)} · Apertura: ${formatearMoneda(turno.monto_apertura)}</p>
        </div>
        <button id="btn-cerrar-turno" class="btn-danger">Cerrar caja</button>
      </div>

      <div class="grid grid-cols-3 gap-4" id="resumen-caja"></div>

      <div class="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
        <div class="card flex flex-col overflow-hidden">
          <h2 class="font-semibold mb-3">Movimientos del turno</h2>
          <div class="flex-1 overflow-y-auto">
            <table class="table-base">
              <thead><tr><th>Hora</th><th>Tipo</th><th>Categoría</th><th class="text-right">Monto</th><th>Detalle</th></tr></thead>
              <tbody id="movimientos-body"></tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <h2 class="font-semibold mb-3">Registrar movimiento manual</h2>
          <form id="form-movimiento" class="space-y-3">
            <div class="grid grid-cols-2 gap-2">
              <button type="button" data-tipo="ingreso" class="tipo-btn btn-secondary">+ Ingreso</button>
              <button type="button" data-tipo="egreso" class="tipo-btn btn-secondary">− Egreso</button>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-700">Categoría</label>
              <select id="m-categoria" class="input mt-1"></select>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-700">Monto</label>
              <input id="m-monto" type="number" min="0" step="0.01" class="input mt-1" />
            </div>
            <div>
              <label class="text-sm font-medium text-gray-700">Descripción</label>
              <input id="m-descripcion" class="input mt-1" placeholder="Opcional" />
            </div>
            <button type="submit" class="btn-primary w-full">Registrar</button>
          </form>
        </div>
      </div>
    </div>

    <!-- Modal cierre de turno -->
    <div id="modal-cierre" class="fixed inset-0 z-40 hidden items-center justify-center bg-black/40">
      <div class="card w-full max-w-sm">
        <h2 class="text-lg font-semibold mb-3">Cerrar caja</h2>
        <div class="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2 mb-3">
          <span class="text-gray-500">Saldo según sistema</span>
          <span id="saldo-sistema-modal" class="font-semibold"></span>
        </div>
        <label class="text-sm font-medium text-gray-700">Monto contado (arqueo)</label>
        <input id="monto-declarado" type="number" step="0.01" class="input mt-1 text-lg" placeholder="0.00" />
        <div class="flex items-center justify-between text-sm px-1 mt-2">
          <span class="text-gray-500">Diferencia</span>
          <span id="diferencia-modal" class="font-semibold">${formatearMoneda(0)}</span>
        </div>
        <label class="text-sm font-medium text-gray-700 block mt-3">Notas (opcional)</label>
        <textarea id="notas-cierre" class="input mt-1" rows="2"></textarea>
        <div class="flex justify-end gap-2 mt-4">
          <button id="btn-cancelar-cierre" class="btn-secondary">Cancelar</button>
          <button id="btn-confirmar-cierre" class="btn-primary">Confirmar cierre</button>
        </div>
      </div>
    </div>
  `;

  let tipoSeleccionado = 'ingreso';
  const selectCategoria = document.getElementById('m-categoria');

  function actualizarCategorias() {
    const opciones = tipoSeleccionado === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;
    selectCategoria.innerHTML = opciones.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
  }
  actualizarCategorias();

  document.querySelectorAll('.tipo-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      tipoSeleccionado = btn.dataset.tipo;
      document.querySelectorAll('.tipo-btn').forEach((b) => b.classList.remove('ring-2', 'ring-brand-500'));
      btn.classList.add('ring-2', 'ring-brand-500');
      actualizarCategorias();
    });
  });
  document.querySelector('.tipo-btn[data-tipo="ingreso"]').classList.add('ring-2', 'ring-brand-500');

  document.getElementById('form-movimiento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const monto = Number(document.getElementById('m-monto').value);
    if (!monto || monto <= 0) {
      showToast('Ingresá un monto válido', 'error');
      return;
    }
    const res = await window.api.caja.registrarMovimiento({
      turno_id: turno.id,
      tipo: tipoSeleccionado,
      categoria: selectCategoria.value,
      monto,
      descripcion: document.getElementById('m-descripcion').value,
    });
    if (!res.ok) {
      showToast('No se pudo registrar el movimiento: ' + res.error, 'error');
      return;
    }
    showToast('Movimiento registrado', 'success');
    document.getElementById('form-movimiento').reset();
    actualizarCategorias();
    cargarResumenYMovimientos();
  });

  async function cargarResumenYMovimientos() {
    const [resTotales, resMov, resVentas] = await Promise.all([
      window.api.caja.totalesTurno(turno.id),
      window.api.caja.movimientosDeTurno(turno.id),
      window.api.caja.ventasPorMetodo(turno.id),
    ]);

    const totales = resTotales.ok ? resTotales.data : { total_ingresos: 0, total_egresos: 0, saldo_sistema: 0 };
    const ventasPorMetodo = resVentas.ok ? resVentas.data : [];
    const totalVendido = ventasPorMetodo.reduce((acc, v) => acc + v.total, 0);
    const movimientos = resMov.ok ? resMov.data : [];

    const movimientosManuales = movimientos.filter((m) => !['apertura', 'venta_efectivo'].includes(m.categoria));
    const netoManual = movimientosManuales.reduce(
      (acc, m) => acc + (m.tipo === 'ingreso' ? m.monto : -m.monto),
      0
    );

    document.getElementById('resumen-caja').innerHTML = `
      <div class="card">
        <div class="text-xs text-gray-500 uppercase tracking-wide">Saldo en caja (sistema)</div>
        <div class="text-2xl font-bold mt-1">${formatearMoneda(totales.saldo_sistema)}</div>
      </div>
      <div class="card">
        <div class="text-xs text-gray-500 uppercase tracking-wide">Vendido este turno</div>
        <div class="text-2xl font-bold mt-1">${formatearMoneda(totalVendido)}</div>
        <div class="text-xs text-gray-400 mt-1">${ventasPorMetodo.map((v) => `${v.metodo_pago}: ${formatearMoneda(v.total)}`).join(' · ') || 'Sin ventas aún'}</div>
      </div>
      <div class="card">
        <div class="text-xs text-gray-500 uppercase tracking-wide">Ingresos / Egresos manuales</div>
        <div class="text-lg font-bold mt-1 ${netoManual >= 0 ? 'text-green-600' : 'text-red-600'}">${netoManual >= 0 ? '+' : ''}${formatearMoneda(netoManual)}</div>
      </div>
    `;

    const body = document.getElementById('movimientos-body');
    if (movimientos.length === 0) {
      body.innerHTML = `<tr><td colspan="5" class="text-center text-gray-400 py-6">Sin movimientos todavía.</td></tr>`;
    } else {
      body.innerHTML = movimientos
        .map(
          (m) => `<tr>
          <td class="text-gray-400">${formatearFecha(m.fecha)}</td>
          <td class="${m.tipo === 'ingreso' ? 'text-green-600' : 'text-red-500'}">${m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}</td>
          <td class="capitalize">${m.categoria.replace('_', ' ')}</td>
          <td class="text-right ${m.tipo === 'ingreso' ? 'text-green-600' : 'text-red-500'}">${m.tipo === 'ingreso' ? '+' : '−'}${formatearMoneda(m.monto)}</td>
          <td class="text-gray-500">${m.descripcion || '-'}</td>
        </tr>`
        )
        .join('');
    }
  }
  await cargarResumenYMovimientos();

  // --- Cierre de turno ---
  const modalCierre = document.getElementById('modal-cierre');
  document.getElementById('btn-cerrar-turno').addEventListener('click', async () => {
    const res = await window.api.caja.totalesTurno(turno.id);
    const saldo = res.ok ? res.data.saldo_sistema : 0;
    document.getElementById('saldo-sistema-modal').textContent = formatearMoneda(saldo);
    document.getElementById('monto-declarado').value = '';
    document.getElementById('diferencia-modal').textContent = formatearMoneda(0);
    document.getElementById('notas-cierre').value = '';
    modalCierre.dataset.saldoSistema = saldo;
    modalCierre.classList.remove('hidden');
    modalCierre.classList.add('flex');
  });

  document.getElementById('monto-declarado').addEventListener('input', (e) => {
    const saldo = Number(modalCierre.dataset.saldoSistema) || 0;
    const declarado = Number(e.target.value) || 0;
    const diferencia = declarado - saldo;
    const el = document.getElementById('diferencia-modal');
    el.textContent = formatearMoneda(diferencia);
    el.classList.toggle('text-red-600', diferencia < 0);
    el.classList.toggle('text-green-600', diferencia > 0);
  });

  document.getElementById('btn-cancelar-cierre').addEventListener('click', () => {
    modalCierre.classList.add('hidden');
    modalCierre.classList.remove('flex');
  });

  document.getElementById('btn-confirmar-cierre').addEventListener('click', async () => {
    const declarado = Number(document.getElementById('monto-declarado').value);
    if (isNaN(declarado)) {
      showToast('Ingresá el monto contado', 'error');
      return;
    }
    const notas = document.getElementById('notas-cierre').value;
    const res = await window.api.caja.cerrarTurno(turno.id, declarado, notas);
    if (!res.ok) {
      showToast('No se pudo cerrar la caja: ' + res.error, 'error');
      return;
    }
    showToast(
      res.data.diferencia === 0 ? 'Caja cerrada sin diferencias' : `Caja cerrada con diferencia de ${formatearMoneda(res.data.diferencia)}`,
      res.data.diferencia === 0 ? 'success' : 'error'
    );
    renderCaja(root);
  });
}

async function renderHistorialTurnos(container) {
  if (!container) return;
  const res = await window.api.caja.listarTurnos({});
  const turnos = res.ok ? res.data.filter((t) => t.estado === 'cerrado').slice(0, 10) : [];

  if (turnos.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="card">
      <h2 class="font-semibold mb-2 text-sm text-gray-600">Últimos cierres</h2>
      <table class="table-base">
        <thead><tr><th>Fecha</th><th class="text-right">Sistema</th><th class="text-right">Contado</th><th class="text-right">Diferencia</th></tr></thead>
        <tbody>
          ${turnos
            .map(
              (t) => `<tr>
              <td class="text-gray-500">${formatearFecha(t.fecha_cierre)}</td>
              <td class="text-right">${formatearMoneda(t.monto_cierre_sistema)}</td>
              <td class="text-right">${formatearMoneda(t.monto_cierre_declarado)}</td>
              <td class="text-right ${t.diferencia < 0 ? 'text-red-600' : t.diferencia > 0 ? 'text-green-600' : ''}">${formatearMoneda(t.diferencia)}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}
