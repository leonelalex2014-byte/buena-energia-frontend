# Buena Energía · Frontend

Tienda online de Buena Energía, desarrollada con Vue 3 y Vite e integrada con el [backend Laravel](https://github.com/leonelalex2014-byte/buena-energia-backend).

## Funciones

- Catálogo de productos cargado desde la API, con imagen, descripción, precio y colores.
- Búsqueda de prendas por nombre o descripción.
- Bolsa de compra con cantidades, subtotal y persistencia en `localStorage`.
- Diseño adaptable a móvil y escritorio, con estados de carga, error y reintento.
- Formato de precios en pesos mexicanos.

El checkout está deshabilitado hasta que el backend tenga un endpoint de pedidos. La bolsa es local y no reserva inventario ni crea pedidos.

## Requisitos

- Node.js 22.18 o superior
- Backend Laravel en ejecución y con CORS habilitado para el origen del frontend

## Desarrollo

```sh
npm install
Copy-Item .env.example .env
npm run dev
```

Configura `VITE_API_BASE_URL` en `.env`. Para el backend local:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

Para cambiar esta variable, reinicia el servidor de Vite.

## Integración con el backend

El catálogo consume `GET /api/productos`. Cada producto incluye `id_producto`, `nombre`, `descripcion`, `precio`, `imagen_url` y `colors`.

El endpoint actual no expone variantes ni stock. Tampoco se usa `GET /api/test-pedido`, porque es una ruta de prueba que modifica el inventario.

## Producción

```sh
npm run build
npm run preview
```
