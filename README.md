# Punto de Venta

Sistema de punto de venta de escritorio (Electron + SQLite), 100% local — no requiere internet ni servidor.

## Requisitos

- [Node.js](https://nodejs.org) 18 o superior instalado en la PC.

## Primer uso

Abrí una terminal (CMD/PowerShell en Windows) dentro de esta carpeta y ejecutá:

```
npm install
```

Esto instala todo lo necesario, incluida la compilación de la base de datos para que funcione con Electron (lo hace solo, no hace falta ningún paso extra).

## Uso diario

```
npm start
```

Con eso se abre la aplicación. Podés crear un acceso directo más adelante si querés abrirla con doble clic (ver sección "Generar instalador").

## Primeros pasos dentro de la app

1. Entrá a **Proveedores** y cargá al menos una categoría y, si aplica, tus proveedores (con su margen de ganancia default).
2. Entrá a **Stock** → **+ Nuevo producto**. Cargá el código de barra (podés escanearlo directo con el lector apuntando al campo), nombre, costo, precio y opcionalmente un stock mínimo (para que te avise cuando esté por agotarse).
3. Hacé clic en el producto para desplegarlo y **+ Nuevo lote**: ahí cargás la cantidad y la fecha de vencimiento de esa partida. Un mismo producto puede tener varios lotes con vencimientos distintos.
4. Andá a **Caja** y abrí un turno con el monto inicial disponible. La venta está bloqueada hasta que haya una caja abierta.
5. Andá a **Venta**, escaneá productos y procesá la venta.

## Funciones agregadas

- **Caja**: apertura/cierre de turno, movimientos manuales (ingresos/egresos con categoría), y arqueo con diferencia al cerrar. No se puede vender sin un turno abierto.
- **Clientes**: ficha con historial de compras, y asignación opcional en el POS antes de escanear (buscador arriba del carrito).
- **Listas de precios**: creá listas (ej. "Mayorista") desde **Precios**, cargales precios especiales por producto, y asignale una lista a un cliente — el POS aplica ese precio automáticamente al escanear si el cliente está asignado.
- **Alertas de stock mínimo**: definí un mínimo por producto en Stock; si el stock total cae por debajo, aparece un aviso arriba de la lista.
- **Catálogos de proveedores (CSV)**: desde **Proveedores**, elegí un proveedor e importá su lista en CSV (columnas código/descripción/marca/costo — con o sin encabezados en español, separador coma o punto y coma). Podés buscar cualquier artículo del catálogo y crear el producto al vuelo con el costo y el precio sugerido por el margen del proveedor. Al reimportar una lista nueva, se actualiza el costo de los productos ya vinculados; el botón "Actualizar precios" recalcula el precio de venta de esos productos (nunca toca uno que hayas editado a mano).

## Dónde vive la base de datos

La base de datos (`pos.db`) se guarda automáticamente en la carpeta de datos de la aplicación en tu PC (fuera de esta carpeta de instalación), así que sobrevive si reinstalás o actualizás la app. Es un solo archivo — se puede hacer backup copiándolo.

## Generar un instalador (.exe)

Cuando quieras un instalable normal de Windows (para no tener que abrir la terminal cada vez):

```
npm run dist
```

El instalador queda en la carpeta `dist/`. (Esto hay que correrlo en una PC con Windows para generar el `.exe`, o configurar compilación cruzada más adelante si hace falta.)

## Estructura del proyecto

```
src/           proceso principal de Electron (ventana, IPC, acceso a datos)
  db/          capa de base de datos (SQLite vía better-sqlite3)
renderer/      interfaz (HTML/Tailwind/JS vanilla) — corre en la ventana
```

## Impresora térmica

La lógica de generación de ticket ya está armada (botón "Imprimir ticket" en la pantalla de Venta usa el diálogo de impresión del sistema). Cuando tengas la impresora térmica conectada, avisame para integrar impresión directa ESC/POS sin pasar por el diálogo de impresión de Windows.
