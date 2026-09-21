// Utilidad simple de notificaciones (toasts) reusada por todas las paginas.
export function showToast(mensaje, tipo = 'info') {
  const container = document.getElementById('toast-container');
  const colors = {
    info: 'bg-gray-800',
    success: 'bg-green-600',
    error: 'bg-red-600',
  };

  const toast = document.createElement('div');
  toast.className = `${colors[tipo] || colors.info} text-white text-sm px-4 py-3 rounded-lg shadow-lg animate-fade-in`;
  toast.textContent = mensaje;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

export function formatearMoneda(valor) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(valor || 0);
}

export function formatearFecha(fechaStr) {
  if (!fechaStr) return '-';
  const d = new Date(fechaStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return fechaStr;
  return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}
