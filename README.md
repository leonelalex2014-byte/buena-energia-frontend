# Buena Energía · Frontend

Tienda online de Buena Energía, desarrollada con Vue 3 y Vite e integrada con el [backend Laravel](https://github.com/leonelalex2014-byte/buena-energia-backend).

Para estudiar el frontend archivo por archivo, consulta la [guía de estudio](docs/guia-estudio-frontend.md) o su [versión PDF](docs/guia-estudio-frontend.pdf). Explica Vue y los archivos relevantes del proyecto, con recorridos de catálogo, compras, API, administración y fragmentos comentados.

## Funciones

- Catálogo cargado desde la API, con búsqueda por nombre, descripción, categoría, talle y color.
- Bolsa de compra con cantidades, subtotal y persistencia en `localStorage`.
- Diseño adaptable a móvil y escritorio, con estados de carga, error y reintento.
- Formato de precios en pesos uruguayos.
- Acceso de administrador con registro protegido por clave.
- Gestión de productos, imágenes, variantes y stock, además de pedidos activos e historial paginado.
- Pedidos registrados en el backend y enviados a WhatsApp para coordinar la compra.

La bolsa es local hasta que se envía el checkout. El backend registra el pedido y valida existencias y precios; luego el frontend abre WhatsApp con el resumen para coordinar la compra. El costo de envío se confirma con la tienda.

## Requisitos

- Node.js 22.18 o superior
- Backend Laravel en ejecución y con CORS habilitado para el origen del frontend
- Git para clonar ambos repositorios

## Clonar ambos repositorios

Desde PowerShell, ejecuta el script y elige la carpeta donde guardar los repositorios:

```powershell
.\scripts\clone-buena-energia.ps1 -Destination "C:\Proyectos\Buena-Energia"
```

El script clona el frontend y el backend públicos. Si ya están clonados en esa carpeta con el `origin` correcto, los conserva sin sobrescribir cambios locales. Puedes revisar lo que haría sin clonar con `-WhatIf`.

## Desarrollo

```sh
npm install
Copy-Item '.env copy.example' .env
npm run dev
```

Configura `VITE_API_BASE_URL` en `.env`. Para el backend local:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
VITE_WHATSAPP_NUMBER=
```

Configura `VITE_WHATSAPP_NUMBER` con el número de la tienda en formato internacional, solo dígitos, sin `+`, espacios ni guiones. Reinicia Vite después de editar `.env`.

Para cambiar esta variable, reinicia el servidor de Vite.

## Integración con el backend

El catálogo consume `GET /api/productos`. Cada producto incluye `id_producto`, `nombre`, `descripcion`, `precio`, `imagen_url` y `colors`.

El catálogo incluye los identificadores y el stock de cada variante. La tienda registra pedidos con `POST /api/pedidos`; administración carga y actualiza pedidos, crea y edita productos y modifica stock mediante las rutas `/api/admin/*`.

El formulario acepta JPG, PNG y WebP de hasta 5 MB. El backend guarda los archivos en su disco público; ejecuta `php artisan storage:link` una vez para servir las imágenes.

El registro de administradores requiere configurar `ADMIN_REGISTRATION_KEY` en el `.env` del backend. Nunca incluyas esa clave en el frontend. El mensaje de WhatsApp incluye las prendas, talle, color, cantidades, subtotal y forma de entrega. El costo de envío se confirma con la tienda; las antiguas rutas públicas de prueba ya no existen.

## Producción

```sh
npm run build
npm run preview
```
