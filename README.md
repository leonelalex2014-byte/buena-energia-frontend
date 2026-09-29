# Buena Energía · Frontend

Tienda online de Buena Energía, desarrollada con Vue 3 y Vite e integrada con el [backend Laravel](https://github.com/leonelalex2014-byte/buena-energia-backend).

## Funciones

- Catálogo de productos cargado desde la API, con imagen, descripción, precio y colores.
- Búsqueda de prendas por nombre o descripción.
- Bolsa de compra con cantidades, subtotal y persistencia en `localStorage`.
- Diseño adaptable a móvil y escritorio, con estados de carga, error y reintento.
- Formato de precios en pesos mexicanos.
- Acceso de administrador con registro protegido por clave y sesión Sanctum.
- Alta de productos con variantes de talle/color y stock.
- Pedidos por WhatsApp con datos del cliente, variantes, subtotal y retiro o entrega a domicilio.

La bolsa es local. Al continuar, el frontend abre WhatsApp con un mensaje listo para la dueña; no reserva inventario ni registra el pedido en la base de datos. La tienda confirma existencias y el costo de envío en esa conversación.

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
Copy-Item .env.example .env
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

El catálogo incluye los identificadores y el stock de cada variante. El alta usa `POST /api/admin/productos`; la sesión requiere `POST /api/admin/login` y el registro `POST /api/admin/register`.

El registro de administradores requiere configurar `ADMIN_REGISTRATION_KEY` en el `.env` del backend. Nunca incluyas esa clave en el frontend. El mensaje de WhatsApp incluye las prendas, talle, color, cantidades, subtotal y forma de entrega. El costo de envío se confirma con la tienda; no se usa `GET /api/test-pedido`, porque esa ruta de prueba modifica el inventario.

## Producción

```sh
npm run build
npm run preview
```
