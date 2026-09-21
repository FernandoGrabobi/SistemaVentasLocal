import { showToast, formatearMoneda } from '../toast.js';

// Estado del carrito: [{ producto_id, codigo_barra, nombre, precio, cantidad, stock_disponible }]
let carrito = [];
let ultimaVenta = null;
let clienteSeleccionado = null; // { id, nombre, lista_precio_id, lista_precio_nombre }

export async function renderPOS(root) {
  carrito = [];
  clienteSeleccionado = null;

  const resTurno = await window.api.caja.turnoAbierto();
  const turno = resTurno.ok ? resTurno.data : null;

  if (!turno) {
    root.innerHTML = `
      <div class="p-6 h-full flex items-center justify-center">
        <div class="card max-w-sm text-center">
          <div class="text-4xl mb-2">🔒</div>
          <h1 class="text-lg font-semibold mb-1">La caja está cerrada</h1>
          <p class="text-sm text-gray-500 mb-4">Antes de vender, abrí un turno de caja con el monto inicial disponible.</p>
          <input id="monto-apertura-rapida" type="number" min="0" step="0.01" class="input text-lg" placeholder="Monto inicial" />
          <button id="btn-abrir-rapido" class="btn-primary w-full mt-3">Abrir caja y empezar a vender</button>
        </div>
      </div>
    `;
    document.getElementById('btn-abrir-rapido').addEventListener('click', async () => {
      const monto = Number(document.getElementById('monto-apertura-rapida').value) || 0;
      const res = await window.api.caja.abrirTurno(monto);
      if (!res.ok) {
        showToast('No se pudo abrir la caja: ' + res.error, 'error');
        return;
      }
      showToast('Caja abierta', 'success');
      renderPOS(root);
    });
    return;
  }

  root.innerHTML = `
    <div class="flex h-full flex-col p-6 gap-4">
      <div class="flex items-center gap-3">
        <div class="flex-1">
          <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Escanear producto</label>
          <input id="scan-input" type="text" autocomplete="off"
            class="input mt-1 text-lg"
            placeholder="Escaneá el código de barras o escribilo y presioná Enter" />
        </div>
        <div class="text-right">
          <div class="text-xs text-gray-500 uppercase tracking-wide">Total</div>
          <div id="total-carrito" class="text-3xl font-bold text-brand-700">${formatearMoneda(0)}</div>
        </div>
      </div>

      <div class="card flex items-center gap-3 py-2">
        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Cliente</span>
        <div class="relative flex-1">
          <input id="buscar-cliente" class="input" placeholder="Buscar cliente (opcional)..." />
          <div id="resultados-cliente" class="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 hidden"></div>
        </div>
        <div id="cliente-chip" class="hidden items-center gap-2 bg-brand-50 text-brand-700 rounded-full px-3 py-1 text-sm whitespace-nowrap">
          <span id="cliente-chip-nombre"></span>
          <button id="btn-quitar-cliente" class="text-brand-400 hover:text-brand-700">✕</button>
        </div>
      </div>

      <div class="card flex-1 overflow-hidden flex flex-col">
        <div class="flex-1 overflow-y-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Código</th>
                <th class="text-center">Cantidad</th>
                <th class="text-right">Precio unit.</th>
                <th class="text-right">Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="carrito-body">
              <tr><td colspan="6" class="text-center text-gray-400 py-8">El carrito está vacío. Escaneá un producto para empezar.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="flex justify-end gap-3">
        <button id="btn-vaciar" class="btn-secondary">Vaciar carrito</button>
        <button id="btn-procesar" class="btn-primary text-base px-8" disabled>Procesar venta</button>
      </div>
    </div>

    <!-- Modal de pago -->
    <div id="modal-pago" class="fixed inset-0 z-40 hidden items-center justify-center bg-black/40">
      <div class="card w-full max-w-md">
        <h2 class="text-lg font-semibold mb-4">Procesar venta</h2>
        <div class="mb-4 flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
          <span class="text-gray-500">Total a cobrar</span>
          <span id="modal-total" class="text-2xl font-bold">${formatearMoneda(0)}</span>
        </div>

        <label class="text-sm font-medium text-gray-700">Método de pago</label>
        <div class="mt-2 grid grid-cols-3 gap-2 mb-4">
          <button data-metodo="efectivo" class="metodo-btn btn-secondary">Efectivo</button>
          <button data-metodo="transferencia" class="metodo-btn btn-secondary">Transferencia</button>
          <button data-metodo="debito" class="metodo-btn btn-secondary">Débito</button>
        </div>

        <div id="panel-efectivo" class="hidden mb-4 space-y-2">
          <label class="text-sm font-medium text-gray-700">Monto recibido</label>
          <input id="monto-recibido" type="number" min="0" step="0.01" class="input text-lg" placeholder="0.00" />
          <div class="flex items-center justify-between text-sm px-1">
            <span class="text-gray-500">Vuelto</span>
            <span id="vuelto-calculado" class="font-semibold">${formatearMoneda(0)}</span>
          </div>
        </div>

        <div class="flex justify-end gap-2 mt-6">
          <button id="btn-cancelar-pago" class="btn-secondary">Cancelar</button>
          <button id="btn-confirmar-venta" class="btn-primary" disabled>Confirmar venta</button>
        </div>
      </div>
    </div>

    <!-- Modal de venta OK -->
    <div id="modal-ok" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/40">
      <div class="card w-full max-w-sm text-center">
        <div class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 text-3xl">✓</div>
        <h2 class="text-xl font-semibold mb-1">Venta OK</h2>
        <p id="ok-detalle" class="text-gray-500 text-sm mb-4"></p>
        <div class="flex justify-center gap-2">
          <button id="btn-imprimir" class="btn-secondary">Imprimir ticket</button>
          <button id="btn-cerrar-ok" class="btn-primary">Nueva venta</button>
        </div>
      </div>
    </div>

    <!-- Área de impresión (oculta, solo visible al imprimir) -->
    <div id="ticket-print" class="hidden"></div>
  `;

  const scanInput = document.getElementById('scan-input');
  const carritoBody = document.getElementById('carrito-body');
  const totalEl = document.getElementById('total-carrito');
  const btnProcesar = document.getElementById('btn-procesar');
  const btnVaciar = document.getElementById('btn-vaciar');

  const modalPago = document.getElementById('modal-pago');
  const modalTotal = document.getElementById('modal-total');
  const panelEfectivo = document.getElementById('panel-efectivo');
  const montoRecibidoInput = document.getElementById('monto-recibido');
  const vueltoEl = document.getElementById('vuelto-calculado');
  const btnConfirmarVenta = document.getElementById('btn-confirmar-venta');
  let metodoSeleccionado = null;

  const modalOk = document.getElementById('modal-ok');

  function focusScan() {
    scanInput.focus();
  }
  focusScan();
  // Si el usuario clickea en cualquier parte de la pantalla (fuera de inputs),
  // devolvemos el foco al scanner para que el lector siga funcionando.
  root.addEventListener('click', (e) => {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
      focusScan();
    }
  });

  // --- Asignación de cliente ---
  const inputCliente = document.getElementById('buscar-cliente');
  const resultadosCliente = document.getElementById('resultados-cliente');
  const chipCliente = document.getElementById('cliente-chip');
  const chipClienteNombre = document.getElementById('cliente-chip-nombre');

  inputCliente.addEventListener('input', debounce(async (e) => {
    const q = e.target.value.trim();
    if (!q) {
      resultadosCliente.classList.add('hidden');
      return;
    }
    const res = await window.api.clientes.listar({ busqueda: q });
    const clientes = res.ok ? res.data.slice(0, 6) : [];
    if (clientes.length === 0) {
      resultadosCliente.innerHTML = `<div class="px-3 py-2 text-sm text-gray-400">Sin resultados.</div>`;
    } else {
      resultadosCliente.innerHTML = clientes
        .map(
          (c) => `<div class="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer" data-cliente="${c.id}">
          ${c.nombre} ${c.lista_precio_nombre ? `<span class="text-xs text-gray-400">· ${c.lista_precio_nombre}</span>` : ''}
        </div>`
        )
        .join('');
      resultadosCliente.querySelectorAll('[data-cliente]').forEach((el) =>
        el.addEventListener('click', () => {
          const cliente = clientes.find((c) => c.id === Number(el.dataset.cliente));
          asignarCliente(cliente);
        })
      );
    }
    resultadosCliente.classList.remove('hidden');
  }, 250));

  function asignarCliente(cliente) {
    clienteSeleccionado = cliente;
    inputCliente.value = '';
    resultadosCliente.classList.add('hidden');
    chipClienteNombre.textContent = cliente.nombre + (cliente.lista_precio_nombre ? ` (${cliente.lista_precio_nombre})` : '');
    chipCliente.classList.remove('hidden');
    chipCliente.classList.add('flex');
    inputCliente.classList.add('hidden');

    // Si ya hay productos en el carrito, no reajustamos precios retroactivamente
    // (serian precios ya mostrados/aceptados); el nuevo precio aplica desde el proximo escaneo.
  }

  document.getElementById('btn-quitar-cliente').addEventListener('click', () => {
    clienteSeleccionado = null;
    chipCliente.classList.add('hidden');
    chipCliente.classList.remove('flex');
    inputCliente.classList.remove('hidden');
    inputCliente.value = '';
  });

  function calcularTotal() {
    return carrito.reduce((acc, item) => acc + item.cantidad * item.precio, 0);
  }

  function renderCarrito() {
    if (carrito.length === 0) {
      carritoBody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-8">El carrito está vacío. Escaneá un producto para empezar.</td></tr>`;
    } else {
      carritoBody.innerHTML = carrito
        .map(
          (item, idx) => `
        <tr>
          <td class="font-medium">${item.nombre}</td>
          <td class="text-gray-400">${item.codigo_barra}</td>
          <td class="text-center">
            <div class="inline-flex items-center gap-2">
              <button class="btn-secondary px-2 py-1 text-xs" data-action="dec" data-idx="${idx}">−</button>
              <span class="w-8 text-center">${item.cantidad}</span>
              <button class="btn-secondary px-2 py-1 text-xs" data-action="inc" data-idx="${idx}">+</button>
            </div>
          </td>
          <td class="text-right">${formatearMoneda(item.precio)}</td>
          <td class="text-right font-semibold">${formatearMoneda(item.cantidad * item.precio)}</td>
          <td class="text-right">
            <button class="text-red-500 hover:text-red-700 text-sm" data-action="del" data-idx="${idx}">Quitar</button>
          </td>
        </tr>`
        )
        .join('');
    }
    const total = calcularTotal();
    totalEl.textContent = formatearMoneda(total);
    btnProcesar.disabled = carrito.length === 0;
  }

  carritoBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    const item = carrito[idx];
    if (!item) return;

    if (btn.dataset.action === 'inc') {
      if (item.cantidad + 1 > item.stock_disponible) {
        showToast(`No hay más stock disponible de "${item.nombre}" (stock: ${item.stock_disponible})`, 'error');
        return;
      }
      item.cantidad += 1;
    } else if (btn.dataset.action === 'dec') {
      item.cantidad -= 1;
      if (item.cantidad <= 0) carrito.splice(idx, 1);
    } else if (btn.dataset.action === 'del') {
      carrito.splice(idx, 1);
    }
    renderCarrito();
    focusScan();
  });

  btnVaciar.addEventListener('click', () => {
    carrito = [];
    renderCarrito();
    focusScan();
  });

  scanInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const codigo = scanInput.value.trim();
    scanInput.value = '';
    if (!codigo) return;

    const listaPrecioId = clienteSeleccionado?.lista_precio_id || null;
    const res = await window.api.productos.buscarPorCodigo(codigo, listaPrecioId);
    if (!res.ok || !res.data) {
      showToast(`No se encontró ningún producto activo con el código "${codigo}"`, 'error');
      return;
    }
    const producto = res.data;
    if (producto.stock_total <= 0) {
      showToast(`"${producto.nombre}" no tiene stock disponible`, 'error');
      return;
    }

    const existente = carrito.find((i) => i.producto_id === producto.id);
    if (existente) {
      if (existente.cantidad + 1 > producto.stock_total) {
        showToast(`No hay más stock disponible de "${producto.nombre}" (stock: ${producto.stock_total})`, 'error');
        return;
      }
      existente.cantidad += 1;
    } else {
      carrito.push({
        producto_id: producto.id,
        codigo_barra: producto.codigo_barra,
        nombre: producto.nombre,
        precio: producto.precio_aplicado,
        cantidad: 1,
        stock_disponible: producto.stock_total,
      });
    }
    renderCarrito();
  });

  // --- Modal de pago ---
  function abrirModalPago() {
    modalTotal.textContent = formatearMoneda(calcularTotal());
    metodoSeleccionado = null;
    panelEfectivo.classList.add('hidden');
    montoRecibidoInput.value = '';
    vueltoEl.textContent = formatearMoneda(0);
    btnConfirmarVenta.disabled = true;
    document.querySelectorAll('.metodo-btn').forEach((b) => b.classList.remove('ring-2', 'ring-brand-500', 'bg-brand-50'));
    modalPago.classList.remove('hidden');
    modalPago.classList.add('flex');
  }

  function cerrarModalPago() {
    modalPago.classList.add('hidden');
    modalPago.classList.remove('flex');
    focusScan();
  }

  btnProcesar.addEventListener('click', abrirModalPago);
  document.getElementById('btn-cancelar-pago').addEventListener('click', cerrarModalPago);

  document.querySelectorAll('.metodo-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      metodoSeleccionado = btn.dataset.metodo;
      document.querySelectorAll('.metodo-btn').forEach((b) => b.classList.remove('ring-2', 'ring-brand-500', 'bg-brand-50'));
      btn.classList.add('ring-2', 'ring-brand-500', 'bg-brand-50');

      if (metodoSeleccionado === 'efectivo') {
        panelEfectivo.classList.remove('hidden');
        btnConfirmarVenta.disabled = true;
        montoRecibidoInput.focus();
      } else {
        panelEfectivo.classList.add('hidden');
        btnConfirmarVenta.disabled = false;
      }
    });
  });

  montoRecibidoInput.addEventListener('input', () => {
    const total = calcularTotal();
    const recibido = Number(montoRecibidoInput.value) || 0;
    const vuelto = recibido - total;
    vueltoEl.textContent = formatearMoneda(Math.max(vuelto, 0));
    vueltoEl.classList.toggle('text-red-600', recibido < total);
    btnConfirmarVenta.disabled = recibido < total || recibido <= 0;
  });

  btnConfirmarVenta.addEventListener('click', async () => {
    if (!metodoSeleccionado) return;
    btnConfirmarVenta.disabled = true;

    const items = carrito.map((i) => ({
      producto_id: i.producto_id,
      cantidad: i.cantidad,
      precio_unitario: i.precio,
    }));
    const montoRecibido = metodoSeleccionado === 'efectivo' ? Number(montoRecibidoInput.value) : null;

    const res = await window.api.ventas.procesar({
      items,
      metodoPago: metodoSeleccionado,
      montoRecibido,
      clienteId: clienteSeleccionado?.id || null,
    });

    if (!res.ok) {
      if (res.error === 'STOCK_INSUFICIENTE') {
        showToast('Stock insuficiente para completar la venta. Revisá el carrito.', 'error');
      } else if (res.error === 'MONTO_INSUFICIENTE') {
        showToast('El monto recibido es menor al total.', 'error');
      } else if (res.error === 'CAJA_CERRADA') {
        showToast('La caja se cerró. Abrí un nuevo turno para seguir vendiendo.', 'error');
        cerrarModalPago();
        renderPOS(root);
        return;
      } else {
        showToast('No se pudo procesar la venta: ' + res.error, 'error');
      }
      btnConfirmarVenta.disabled = false;
      return;
    }

    ultimaVenta = { ...res.data, items: carrito.map((i) => ({ ...i })) };
    cerrarModalPago();
    mostrarVentaOk(res.data);
    carrito = [];
    renderCarrito();
  });

  // --- Modal venta OK ---
  function mostrarVentaOk(venta) {
    const detalleEl = document.getElementById('ok-detalle');
    let texto = `Total: ${formatearMoneda(venta.total)} · ${venta.metodo_pago}`;
    if (venta.metodo_pago === 'efectivo') {
      texto += ` · Vuelto: ${formatearMoneda(venta.vuelto)}`;
    }
    detalleEl.textContent = texto;
    modalOk.classList.remove('hidden');
    modalOk.classList.add('flex');
  }

  document.getElementById('btn-cerrar-ok').addEventListener('click', () => {
    modalOk.classList.add('hidden');
    modalOk.classList.remove('flex');
    focusScan();
  });

  document.getElementById('btn-imprimir').addEventListener('click', () => {
    if (!ultimaVenta) return;
    imprimirTicket(ultimaVenta);
  });

  function imprimirTicket(venta) {
    const ticketEl = document.getElementById('ticket-print');
    const fecha = new Date().toLocaleString('es-AR');
    ticketEl.innerHTML = `
      <div style="font-family: monospace; width: 280px; font-size: 12px;">
        <div style="text-align:center; font-weight:bold; margin-bottom:4px;">TICKET DE VENTA</div>
        <div style="text-align:center; margin-bottom:8px;">${fecha}</div>
        <hr />
        ${venta.items
          .map(
            (i) => `<div style="display:flex; justify-content:space-between;">
              <span>${i.cantidad} x ${i.nombre}</span>
              <span>${formatearMoneda(i.cantidad * i.precio)}</span>
            </div>`
          )
          .join('')}
        <hr />
        <div style="display:flex; justify-content:space-between; font-weight:bold;">
          <span>TOTAL</span><span>${formatearMoneda(venta.total)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>Pago</span><span>${venta.metodo_pago}</span>
        </div>
        ${
          venta.metodo_pago === 'efectivo'
            ? `<div style="display:flex; justify-content:space-between;"><span>Recibido</span><span>${formatearMoneda(
                venta.monto_recibido
              )}</span></div>
               <div style="display:flex; justify-content:space-between;"><span>Vuelto</span><span>${formatearMoneda(
                 venta.vuelto
               )}</span></div>`
            : ''
        }
        <div style="text-align:center; margin-top:8px;">¡Gracias por su compra!</div>
      </div>
    `;
    ticketEl.classList.remove('hidden');
    window.print();
    ticketEl.classList.add('hidden');
  }

  renderCarrito();
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
