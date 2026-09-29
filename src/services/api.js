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

export const loginAdministrator = async (credentials) => {
  const { data } = await api.post('/admin/login', credentials)
  return data
}

export const registerAdministrator = async (details) => {
  const { data } = await api.post('/admin/register', details)
  return data
}

export const logoutAdministrator = () => api.post('/admin/logout')

export const createProduct = async (product) => {
  const { data } = await api.post('/admin/productos', product)
  return data
}