import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api',
  headers: {
    Accept: 'application/json',
  },
  timeout: 10000,
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