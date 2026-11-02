import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api',
  headers: {
    Accept: 'application/json',
  },
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

export const getProducts = async () => {
  try {
    const { data } = await api.get('/productos')

    if (!Array.isArray(data)) {
      throw new Error('El backend respondió con un formato de catálogo inesperado.')
    }

    return data
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data?.message || 'No fue posible cargar el catálogo.')
    }

    if (error.code === 'ECONNABORTED') {
      throw new Error('El catálogo tardó demasiado en responder. Inténtalo de nuevo.')
    }

    throw new Error('No pudimos conectar con el backend. Revisa la URL y que el servidor esté disponible.')
  }
}

export const getCaptchaChallenge = async () => {
  const { data } = await api.get('/captcha/challenge')
  return data
}

export const verifyCaptcha = (challenge) => api.post('/captcha/verify', challenge)

export const loginAdministrator = async (credentials) => {
  const { data } = await api.post('/admin/login', credentials)
  return data
}

export const registerAdministrator = async (details) => {
  const { data } = await api.post('/admin/register', details)
  return data
}

export const logoutAdministrator = () => api.post('/admin/logout')

const productFormData = (product, includeVariantIds = false) => {
  const formData = new FormData()

  for (const field of ['nombre', 'precio', 'categoria']) {
    formData.append(field, product[field])
  }

  if (product.descripcion) formData.append('descripcion', product.descripcion)
  formData.append('imagen', product.imagen || '')
  if (product.imagen_archivo) formData.append('imagen_archivo', product.imagen_archivo)

  product.variantes.forEach((variant, index) => {
    if (includeVariantIds && variant.id_variante) {
      formData.append(`variantes[${index}][id_variante]`, variant.id_variante)
    }

    formData.append(`variantes[${index}][talle]`, variant.talle)
    formData.append(`variantes[${index}][color]`, variant.color)
    formData.append(`variantes[${index}][stock]`, variant.stock)
  })

  return formData
}

export const createProduct = async (product) => {
  const formData = productFormData(product)
  const { data } = await api.post('/admin/productos', formData)
  return data
}

export const updateProduct = async (productId, product) => {
  const formData = productFormData(product, true)
  formData.append('_method', 'PATCH')

  const { data } = await api.post(`/admin/productos/${productId}`, formData)
  return data
}

export const updateVariantStock = async (variantId, stock) => {
  const { data } = await api.patch(`/admin/variantes/${variantId}/stock`, { stock })
  return data
}

export const createOrder = async (order) => {
  const { data } = await api.post('/pedidos', order)
  return data
}

export const getAdminOrders = async () => {
  const { data } = await api.get('/admin/pedidos')
  return data
}

export const updateOrderStatus = async (orderId, status) => {
  const { data } = await api.patch(`/admin/pedidos/${orderId}`, { estado: status })
  return data
}