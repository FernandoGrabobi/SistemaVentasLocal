import { renderPOS } from './pages/pos.js';
import { renderCaja } from './pages/caja.js';
import { renderStock } from './pages/stock.js';
import { renderClientes } from './pages/clientes.js';
import { renderCatalogos } from './pages/catalogos.js';
import { renderPrecios } from './pages/precios.js';
import { renderReportes } from './pages/reportes.js';

const pages = {
  pos: renderPOS,
  caja: renderCaja,
  stock: renderStock,
  clientes: renderClientes,
  catalogos: renderCatalogos,
  precios: renderPrecios,
  reportes: renderReportes,
};

const root = document.getElementById('page-root');
const navButtons = document.querySelectorAll('.nav-item');

async function navigate(pageName) {
  navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.page === pageName);
  });
  root.innerHTML = '';
  const renderFn = pages[pageName];
  if (renderFn) {
    await renderFn(root);
  }
}

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => navigate(btn.dataset.page));
});

// Pagina inicial: el punto de venta
navigate('pos');
