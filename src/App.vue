<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  createProduct,
  getProducts,
  loginAdministrator,
  logoutAdministrator,
  registerAdministrator,
} from './services/api'

const fallbackImage = 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80'
const products = ref([])
const cartItems = ref([])
const searchQuery = ref('')
const isCartOpen = ref(false)
const isLoading = ref(true)
const loadError = ref('')
const selectedVariantIds = ref({})
const selectedProduct = ref(null)
const detailVariantId = ref(null)
const cartNotice = ref('')
const isCheckoutOpen = ref(false)
const checkoutError = ref('')
const deliveryMethod = ref('retiro')
const customer = ref({ nombre: '', telefono: '', direccion: '', notas: '' })
const whatsappNumber = (import.meta.env.VITE_WHATSAPP_NUMBER || '').replace(/\D/g, '')
const currentUser = ref(readStoredUser())
const isAuthOpen = ref(false)
const authMode = ref('login')
const authLoading = ref(false)
const authError = ref('')
const isAdminPanelOpen = ref(false)
const productLoading = ref(false)
const productError = ref('')
const productSuccess = ref('')

const authForm = ref({
  nombre: '',
  email: '',
  password: '',
  password_confirmation: '',
  registration_key: '',
})

const productForm = ref(emptyProductForm())
const isAdministrator = computed(() => currentUser.value?.tipo === 'administrador')

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    return null
  }
}

function emptyProductForm() {
  return {
    nombre: '',
    descripcion: '',
    precio: '',
    categoria: '',
    imagen: '',
    variantes: [{ talle: '', color: '', stock: 0 }],
  }
}

const filteredProducts = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase('es')

  if (!query) return products.value

  return products.value.filter((product) => {
    const searchableText = `${product.nombre} ${product.descripcion}`.toLocaleLowerCase('es')
    return searchableText.includes(query)
  })
})

const cartCount = computed(() => cartItems.value.reduce((total, item) => total + item.quantity, 0))
const cartTotal = computed(() => cartItems.value.reduce((total, item) => total + item.precio * item.quantity, 0))
const whatsappConfigured = computed(() => whatsappNumber.length >= 10)
const detailVariant = computed(() => selectedProduct.value?.variantes?.find(
  (variant) => variant.id_variante === detailVariantId.value,
))

const formatPrice = (price) => new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
}).format(Number(price) || 0)

const loadCatalog = async () => {
  isLoading.value = true
  loadError.value = ''

  try {
    products.value = await getProducts()
    const selections = { ...selectedVariantIds.value }

    for (const product of products.value) {
      const variants = product.variantes || []
      const currentVariant = variants.find((variant) => variant.id_variante === selections[product.id_producto])

      if (!currentVariant || Number(currentVariant.stock) < 1) {
        const availableVariant = variants.find((variant) => Number(variant.stock) > 0)
        if (availableVariant) selections[product.id_producto] = availableVariant.id_variante
      }
    }

    selectedVariantIds.value = selections
  } catch (error) {
    loadError.value = error.message || 'No fue posible cargar el catálogo.'
  } finally {
    isLoading.value = false
  }
}

const saveCart = () => {
  localStorage.setItem('buena-energia-cart', JSON.stringify(cartItems.value))
}

const addToCart = (product) => {
  const variant = product.variantes?.find((item) => item.id_variante === selectedVariantIds.value[product.id_producto])

  if (!variant || Number(variant.stock) < 1) {
    cartNotice.value = 'Esta prenda no tiene variantes disponibles.'
    return false
  }

  const existingItem = cartItems.value.find((item) => item.id_variante === variant.id_variante)

  if (existingItem) {
    if (existingItem.quantity >= Number(variant.stock)) {
      cartNotice.value = `Solo hay ${variant.stock} unidades disponibles para esa variante.`
      return false
    }
    existingItem.quantity += 1
  } else {
    cartItems.value.push({
      id_producto: product.id_producto,
      id_variante: variant.id_variante,
      nombre: product.nombre,
      talle: variant.talle,
      color: variant.color,
      stock: Number(variant.stock),
      precio: Number(product.precio) || 0,
      imagen_url: product.imagen_url || fallbackImage,
      quantity: 1,
    })
  }

  cartNotice.value = ''
  saveCart()
  return true
}

const openProductDetails = (product) => {
  selectedProduct.value = product
  const selectedId = selectedVariantIds.value[product.id_producto]
  const selectedVariant = product.variantes?.find((variant) => variant.id_variante === selectedId && Number(variant.stock) > 0)
  const firstAvailableVariant = product.variantes?.find((variant) => Number(variant.stock) > 0)
  detailVariantId.value = (selectedVariant || firstAvailableVariant || product.variantes?.[0])?.id_variante || null
}

const addDetailToCart = () => {
  if (!selectedProduct.value || !detailVariantId.value) return

  selectedVariantIds.value = {
    ...selectedVariantIds.value,
    [selectedProduct.value.id_producto]: detailVariantId.value,
  }

  if (addToCart(selectedProduct.value)) {
    selectedProduct.value = null
    isCartOpen.value = true
  }
}

const updateQuantity = (item, change) => {
  if (change > 0 && item.quantity >= item.stock) {
    cartNotice.value = `Solo hay ${item.stock} unidades disponibles de ${item.nombre} (${item.talle}, ${item.color}).`
    return
  }

  item.quantity += change

  if (item.quantity <= 0) {
    cartItems.value = cartItems.value.filter((cartItem) => cartItem.id_variante !== item.id_variante)
  }

  cartNotice.value = ''
  saveCart()
}

const removeFromCart = (variantId) => {
  cartItems.value = cartItems.value.filter((item) => item.id_variante !== variantId)
  cartNotice.value = ''
  saveCart()
}

const openCheckout = () => {
  checkoutError.value = ''
  isCheckoutOpen.value = true
}

const submitOrder = () => {
  checkoutError.value = ''

  if (!whatsappConfigured.value) {
    checkoutError.value = 'Falta configurar el WhatsApp de la tienda.'
    return
  }

  const itemLines = cartItems.value.map((item, index) => {
    const lineTotal = item.precio * item.quantity
    return `${index + 1}. ${item.nombre} | Talle: ${item.talle} | Color: ${item.color} | Cantidad: ${item.quantity} | ${formatPrice(lineTotal)}`
  })

  const deliveryText = deliveryMethod.value === 'retiro'
    ? 'Retiro en el local'
    : `Entrega a domicilio\nDirección: ${customer.value.direccion.trim()}\nEnvío: por confirmar con la tienda`

  const message = [
    '*NUEVO PEDIDO · BUENA ENERGÍA*',
    '',
    `Cliente: ${customer.value.nombre.trim()}`,
    `Teléfono: ${customer.value.telefono.trim()}`,
    `Entrega: ${deliveryText}`,
    '',
    '*PRODUCTOS*',
    ...itemLines,
    '',
    `*Subtotal: ${formatPrice(cartTotal.value)}*`,
    ...(customer.value.notas.trim() ? ['', `Notas: ${customer.value.notas.trim()}`] : []),
    '',
    'Por favor confirma disponibilidad y costo de envío.',
  ].join('\n')

  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
}

const handleImageError = (event) => {
  event.target.src = fallbackImage
}

const openAuth = () => {
  authMode.value = 'login'
  authError.value = ''
  isAuthOpen.value = true
}

const submitAuth = async () => {
  authLoading.value = true
  authError.value = ''

  try {
    const response = authMode.value === 'login'
      ? await loginAdministrator({ email: authForm.value.email, password: authForm.value.password })
      : await registerAdministrator(authForm.value)

    localStorage.setItem('auth_token', response.token)
    localStorage.setItem('user', JSON.stringify(response.user))
    currentUser.value = response.user
    isAuthOpen.value = false
    authForm.value = { nombre: '', email: '', password: '', password_confirmation: '', registration_key: '' }
  } catch (error) {
    const validationErrors = error.response?.data?.errors
    authError.value = validationErrors
      ? Object.values(validationErrors).flat().join(' ')
      : error.response?.data?.message || 'No fue posible autenticar al administrador.'
  } finally {
    authLoading.value = false
  }
}

const logout = async () => {
  try {
    await logoutAdministrator()
  } catch {
  } finally {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
    currentUser.value = null
    isAdminPanelOpen.value = false
  }
}

const addVariant = () => {
  if (productForm.value.variantes.length < 40) {
    productForm.value.variantes.push({ talle: '', color: '', stock: 0 })
  }
}

const removeVariant = (index) => {
  if (productForm.value.variantes.length > 1) {
    productForm.value.variantes.splice(index, 1)
  }
}

const submitProduct = async () => {
  productLoading.value = true
  productError.value = ''
  productSuccess.value = ''

  try {
    await createProduct({
      ...productForm.value,
      precio: Number(productForm.value.precio),
      descripcion: productForm.value.descripcion || null,
      imagen: productForm.value.imagen || null,
      variantes: productForm.value.variantes.map((variant) => ({
        talle: variant.talle,
        color: variant.color,
        stock: Number(variant.stock),
      })),
    })

    productForm.value = emptyProductForm()
    productSuccess.value = 'Producto creado y añadido al catálogo.'
    await loadCatalog()
  } catch (error) {
    const validationErrors = error.response?.data?.errors
    productError.value = validationErrors
      ? Object.values(validationErrors).flat().join(' ')
      : error.response?.data?.message || 'No se pudo crear el producto.'
  } finally {
    productLoading.value = false
  }
}

onMounted(() => {
  try {
    const savedCart = JSON.parse(localStorage.getItem('buena-energia-cart') || '[]')
    cartItems.value = Array.isArray(savedCart)
      ? savedCart.filter((item) => item.id_variante && Number(item.quantity) > 0)
      : []
    saveCart()
  } catch {
    cartItems.value = []
  }

  loadCatalog()
})
</script>

<template>
  <div class="site-shell">
    <div class="announcement-bar">
      <span>ROPA INTERIOR PARA SENTIRTE BIEN, TODOS LOS DÍAS</span>
      <span class="announcement-mark" aria-hidden="true">✳</span>
      <span>BUENA ENERGÍA, CERCA DE TI</span>
    </div>

    <header class="site-header">
      <a class="wordmark" href="#inicio" aria-label="Buena Energía, inicio">
        <span>BUENA</span>
        <span class="wordmark-second">ENERGÍA<span class="wordmark-dot">.</span></span>
      </a>

      <nav class="main-nav" aria-label="Navegación principal">
        <a href="#catalogo">Tienda</a>
        <a href="#historia">Nuestra esencia</a>
      </nav>

      <div class="header-actions">
        <button v-if="isAdministrator" class="account-trigger" type="button" @click="isAdminPanelOpen = !isAdminPanelOpen">
          {{ isAdminPanelOpen ? 'Cerrar panel' : 'Administración' }}
        </button>
        <button v-if="isAdministrator" class="account-trigger logout-trigger" type="button" @click="logout">Salir</button>
        <button v-else class="account-trigger" type="button" @click="openAuth">Mi cuenta</button>
        <button class="cart-trigger" type="button" @click="isCartOpen = true" aria-label="Abrir carrito">
          <span>Tu bolsa</span>
          <span class="cart-count">{{ cartCount }}</span>
        </button>
      </div>
    </header>

    <main>
      <section v-if="isAdministrator && isAdminPanelOpen" class="admin-section" aria-labelledby="admin-title">
        <div class="admin-heading">
          <div>
            <p class="eyebrow"><span class="eyebrow-line"></span> GESTIÓN DE TIENDA</p>
            <h2 id="admin-title">Agregar producto</h2>
            <p>Registra cada combinación de talle y color con su inventario.</p>
          </div>
          <span class="admin-badge">{{ currentUser.nombre }}</span>
        </div>

        <form class="admin-form" @submit.prevent="submitProduct">
          <div class="admin-fields">
            <label class="admin-field">
              <span>Nombre *</span>
              <input v-model.trim="productForm.nombre" type="text" maxlength="255" required />
            </label>
            <label class="admin-field">
              <span>Categoría *</span>
              <input v-model.trim="productForm.categoria" type="text" list="admin-categories" maxlength="255" required />
              <datalist id="admin-categories">
                <option value="Mujer" />
                <option value="Hombre" />
                <option value="Unisex" />
              </datalist>
            </label>
            <label class="admin-field">
              <span>Precio *</span>
              <input v-model="productForm.precio" type="number" min="0.01" max="99999999.99" step="0.01" required />
            </label>
            <label class="admin-field">
              <span>Imagen (URL o ruta)</span>
              <input v-model.trim="productForm.imagen" type="text" maxlength="255" placeholder="https://... o /images/prenda.jpg" />
            </label>
            <label class="admin-field admin-field-wide">
              <span>Descripción</span>
              <textarea v-model.trim="productForm.descripcion" rows="3"></textarea>
            </label>
          </div>

          <div class="admin-variant-heading">
            <div>
              <h3>Variantes *</h3>
              <p>Al menos una; máximo 40 por producto.</p>
            </div>
            <button class="admin-secondary" type="button" @click="addVariant">Añadir variante</button>
          </div>

          <div class="admin-variants">
            <div v-for="(variant, index) in productForm.variantes" :key="index" class="admin-variant-row">
              <label class="admin-field">
                <span>Talle *</span>
                <input v-model.trim="variant.talle" type="text" maxlength="255" placeholder="M" required />
              </label>
              <label class="admin-field">
                <span>Color *</span>
                <input v-model.trim="variant.color" type="text" maxlength="255" placeholder="Negro" required />
              </label>
              <label class="admin-field">
                <span>Stock *</span>
                <input v-model.number="variant.stock" type="number" min="0" max="2147483647" step="1" required />
              </label>
              <button class="admin-remove-variant" type="button" :disabled="productForm.variantes.length === 1" aria-label="Eliminar variante" @click="removeVariant(index)">×</button>
            </div>
          </div>

          <p v-if="productError" class="admin-message admin-error" role="alert">{{ productError }}</p>
          <p v-if="productSuccess" class="admin-message admin-success" role="status">{{ productSuccess }}</p>
          <button class="admin-submit" type="submit" :disabled="productLoading">
            {{ productLoading ? 'GUARDANDO...' : 'CREAR PRODUCTO' }}
          </button>
        </form>
      </section>

      <section id="inicio" class="hero-section">
        <div class="hero-copy">
          <p class="eyebrow"><span class="eyebrow-line"></span> PARA TODOS TUS DÍAS</p>
          <h1>Lo que llevas<br />también <span>se siente.</span></h1>
          <p class="hero-description">Prendas hechas para acompañarte con comodidad, confianza y un poquito más de energía.</p>
          <a class="hero-link" href="#catalogo">Descubre la colección <span aria-hidden="true">↘</span></a>
          <div class="hero-index"><span>01</span><span class="index-rule"></span><span>BUENA ENERGÍA</span></div>
        </div>
        <div class="hero-image-wrap">
          <img
            class="hero-image"
            :src="products[0]?.imagen_url || fallbackImage"
            alt="Prendas de la colección Buena Energía"
            @error="handleImageError"
          />
          <div class="hero-stamp" aria-label="Hecho para sentirte bien">
            <span>HECHO PARA</span>
            <strong>SENTIRTE<br />BIEN</strong>
            <span aria-hidden="true">✳</span>
          </div>
          <span class="image-caption">COMODIDAD QUE VA CONTIGO</span>
        </div>
        <div class="hero-side-note">BUENA ENERGÍA · DESDE ADENTRO</div>
      </section>

      <section id="catalogo" class="catalog-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow"><span class="eyebrow-line"></span> NUESTRA SELECCIÓN</p>
            <h2>Un buen comienzo.</h2>
          </div>
          <label class="search-field">
            <span class="search-icon" aria-hidden="true">⌕</span>
            <input v-model="searchQuery" type="search" placeholder="Buscar prendas" aria-label="Buscar prendas" />
            <button v-if="searchQuery" class="clear-search" type="button" aria-label="Limpiar búsqueda" @click="searchQuery = ''">×</button>
          </label>
        </div>

        <p class="catalog-count">{{ products.length }} {{ products.length === 1 ? 'prenda' : 'prendas' }} para elegir</p>

        <div v-if="isLoading" class="catalog-message" role="status">
          <span class="loading-mark" aria-hidden="true">✳</span>
          <p>Estamos preparando la colección...</p>
        </div>

        <div v-else-if="loadError" class="catalog-message catalog-error" role="alert">
          <p>{{ loadError }}</p>
          <button class="text-button" type="button" @click="loadCatalog">Volver a intentar <span aria-hidden="true">↗</span></button>
        </div>

        <div v-else-if="filteredProducts.length" class="product-grid">
          <article v-for="(product, index) in filteredProducts" :key="product.id_producto" class="product-item">
            <div class="product-image-wrap">
              <button class="product-image-trigger" type="button" :aria-label="`Ver detalles de ${product.nombre}`" @click="openProductDetails(product)">
                <img
                  :src="product.imagen_url || fallbackImage"
                  :alt="product.nombre"
                  class="product-image"
                  loading="lazy"
                  @error="handleImageError"
                />
                <span class="product-number">0{{ index + 1 }}</span>
                <span class="product-view-label">Ver detalles <span aria-hidden="true">↗</span></span>
              </button>
              <button class="quick-add" type="button" :aria-label="`Agregar ${product.nombre} a la bolsa`" :disabled="!product.variantes?.some((variant) => Number(variant.stock) > 0)" @click.stop="addToCart(product)">
                <span aria-hidden="true">+</span>
              </button>
            </div>
            <label v-if="product.variantes?.length" class="variant-picker">
              <span>Talle y color</span>
              <select v-model.number="selectedVariantIds[product.id_producto]" :aria-label="`Variante de ${product.nombre}`">
                <option v-for="variant in product.variantes" :key="variant.id_variante" :value="variant.id_variante" :disabled="Number(variant.stock) < 1">
                  {{ variant.talle }} · {{ variant.color }}{{ Number(variant.stock) < 1 ? ' · Agotado' : ` · ${variant.stock} disponibles` }}
                </option>
              </select>
            </label>
            <div class="product-details">
              <div>
                <h3><button class="product-title-trigger" type="button" @click="openProductDetails(product)">{{ product.nombre }}</button></h3>
                <p>{{ product.descripcion }}</p>
              </div>
              <span class="product-price">{{ formatPrice(product.precio) }}</span>
            </div>
            <div v-if="product.colors?.length" class="color-list" aria-label="Colores disponibles">
              <span
                v-for="color in product.colors"
                :key="color.name"
                class="color-swatch"
                :style="{ '--swatch-color': color.hex || '#d6d6d2' }"
                :title="color.name"
              ></span>
              <span class="color-caption">{{ product.colors.length }} {{ product.colors.length === 1 ? 'color' : 'colores' }}</span>
            </div>
          </article>
        </div>

        <div v-else class="catalog-message">
          <p>No encontramos prendas con “{{ searchQuery }}”.</p>
          <button class="text-button" type="button" @click="searchQuery = ''">Ver toda la colección <span aria-hidden="true">↗</span></button>
        </div>
      </section>

      <section id="historia" class="brand-note">
        <span class="brand-note-mark" aria-hidden="true">✳</span>
        <p>Sentirte bien empieza<br />con lo que eliges <em>para ti.</em></p>
        <span class="brand-note-signature">BUENA ENERGÍA, SIEMPRE.</span>
      </section>
    </main>

    <footer class="site-footer">
      <a class="footer-wordmark" href="#inicio">BUENA ENERGÍA<span>.</span></a>
      <span>Prendas para vivir a tu manera.</span>
      <a href="#catalogo">Volver arriba ↑</a>
    </footer>

    <Transition name="auth-modal">
      <div v-if="selectedProduct" class="auth-layer product-detail-layer" @click.self="selectedProduct = null">
        <section class="product-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="detail-title">
          <button class="close-cart detail-close" type="button" aria-label="Cerrar detalles" @click="selectedProduct = null">×</button>
          <div class="product-detail-layout">
            <div class="product-detail-image-wrap">
              <img
                :src="selectedProduct.imagen_url || fallbackImage"
                :alt="selectedProduct.nombre"
                @error="handleImageError"
              />
            </div>
            <div class="product-detail-copy">
              <p class="eyebrow"><span class="eyebrow-line"></span> {{ selectedProduct.categoria || 'BUENA ENERGÍA' }}</p>
              <h2 id="detail-title">{{ selectedProduct.nombre }}</h2>
              <p class="product-detail-description">{{ selectedProduct.descripcion || 'Una prenda pensada para acompañarte todos los días.' }}</p>
              <strong class="product-detail-price">{{ formatPrice(selectedProduct.precio) }}</strong>
              <label class="detail-variant-picker">
                <span>Talle y color</span>
                <select v-model.number="detailVariantId">
                  <option v-for="variant in selectedProduct.variantes || []" :key="variant.id_variante" :value="variant.id_variante" :disabled="Number(variant.stock) < 1">
                    {{ variant.talle }} · {{ variant.color }}{{ Number(variant.stock) < 1 ? ' · Agotado' : ` · ${variant.stock} disponibles` }}
                  </option>
                </select>
              </label>
              <p v-if="detailVariant && Number(detailVariant.stock) > 0" class="detail-stock">Disponible para agregar al carrito</p>
              <p v-else class="detail-stock detail-out-of-stock">Esta prenda está agotada</p>
              <p v-if="cartNotice" class="cart-notice" role="status">{{ cartNotice }}</p>
              <button class="detail-add-button" type="button" :disabled="!detailVariant || Number(detailVariant.stock) < 1" @click="addDetailToCart">
                Agregar al carrito
              </button>
            </div>
          </div>
        </section>
      </div>
    </Transition>

    <Transition name="auth-modal">
      <div v-if="isAuthOpen" class="auth-layer" @click.self="isAuthOpen = false">
        <section class="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <header class="auth-heading">
            <div>
              <p class="eyebrow"><span class="eyebrow-line"></span> BUENA ENERGÍA</p>
              <h2 id="auth-title">Acceso de administración</h2>
            </div>
            <button class="close-cart" type="button" aria-label="Cerrar" @click="isAuthOpen = false">×</button>
          </header>
          <div class="auth-tabs" role="tablist" aria-label="Acceso de administrador">
            <button type="button" :class="{ active: authMode === 'login' }" @click="authMode = 'login'; authError = ''">Iniciar sesión</button>
            <button type="button" :class="{ active: authMode === 'register' }" @click="authMode = 'register'; authError = ''">Registrar administrador</button>
          </div>
          <form class="auth-form" @submit.prevent="submitAuth">
            <label v-if="authMode === 'register'" class="admin-field">
              <span>Nombre *</span>
              <input v-model.trim="authForm.nombre" type="text" maxlength="255" autocomplete="name" required />
            </label>
            <label class="admin-field">
              <span>Correo electrónico *</span>
              <input v-model.trim="authForm.email" type="email" maxlength="255" autocomplete="email" required />
            </label>
            <label class="admin-field">
              <span>Contraseña *</span>
              <input v-model="authForm.password" type="password" :minlength="authMode === 'register' ? 12 : undefined" maxlength="72" :autocomplete="authMode === 'register' ? 'new-password' : 'current-password'" required />
            </label>
            <template v-if="authMode === 'register'">
              <label class="admin-field">
                <span>Confirmar contraseña *</span>
                <input v-model="authForm.password_confirmation" type="password" minlength="12" maxlength="72" autocomplete="new-password" required />
              </label>
              <label class="admin-field">
                <span>Clave de registro *</span>
                <input v-model="authForm.registration_key" type="password" maxlength="255" autocomplete="off" required />
              </label>
            </template>
            <p v-if="authError" class="admin-message admin-error" role="alert">{{ authError }}</p>
            <button class="admin-submit" type="submit" :disabled="authLoading">
              {{ authLoading ? 'PROCESANDO...' : authMode === 'login' ? 'INICIAR SESIÓN' : 'REGISTRAR ADMINISTRADOR' }}
            </button>
          </form>
        </section>
      </div>
    </Transition>

    <Transition name="drawer">
      <div v-if="isCartOpen" class="cart-layer" @click.self="isCartOpen = false">
        <aside class="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
          <div class="cart-header">
            <div>
              <p class="eyebrow">BUENA ENERGÍA</p>
              <h2 id="cart-title">Tu bolsa <span>({{ cartCount }})</span></h2>
            </div>
            <button class="close-cart" type="button" aria-label="Cerrar carrito" @click="isCartOpen = false">×</button>
          </div>

          <div v-if="cartItems.length" class="cart-items">
            <article v-for="item in cartItems" :key="item.id_variante" class="cart-item">
              <img :src="item.imagen_url" :alt="item.nombre" @error="handleImageError" />
              <div class="cart-item-copy">
                <h3>{{ item.nombre }}</h3>
                <span>{{ item.talle }} · {{ item.color }} · {{ formatPrice(item.precio) }}</span>
                <div class="quantity-control" :aria-label="`Cantidad de ${item.nombre}`">
                  <button type="button" :aria-label="`Quitar una unidad de ${item.nombre}`" @click="updateQuantity(item, -1)">−</button>
                  <span>{{ item.quantity }}</span>
                  <button type="button" :aria-label="`Agregar una unidad de ${item.nombre}`" @click="updateQuantity(item, 1)">+</button>
                </div>
              </div>
              <button class="remove-item" type="button" :aria-label="`Eliminar ${item.nombre}`" @click="removeFromCart(item.id_variante)">×</button>
            </article>
          </div>
          <p v-if="cartNotice" class="cart-notice" role="status">{{ cartNotice }}</p>
          <div v-if="!cartItems.length" class="empty-cart">
            <span aria-hidden="true">✳</span>
            <p>Tu bolsa está esperando algo bueno.</p>
            <button class="text-button" type="button" @click="isCartOpen = false">Seguir explorando <span aria-hidden="true">↗</span></button>
          </div>

          <div v-if="cartItems.length" class="cart-footer">
            <div class="cart-subtotal"><span>Subtotal</span><strong>{{ formatPrice(cartTotal) }}</strong></div>
            <p class="checkout-note">El envío se confirma con la tienda por WhatsApp.</p>
            <button class="checkout-button" type="button" @click="openCheckout">Continuar por WhatsApp</button>
          </div>
        </aside>
      </div>
    </Transition>

    <Transition name="auth-modal">
      <div v-if="isCheckoutOpen" class="auth-layer checkout-layer" @click.self="isCheckoutOpen = false">
        <section class="auth-dialog checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
          <header class="auth-heading">
            <div>
              <p class="eyebrow"><span class="eyebrow-line"></span> CASI LISTO</p>
              <h2 id="checkout-title">¿Cómo recibes tu pedido?</h2>
            </div>
            <button class="close-cart" type="button" aria-label="Cerrar" @click="isCheckoutOpen = false">×</button>
          </header>

          <form class="auth-form checkout-form" @submit.prevent="submitOrder">
            <label class="admin-field">
              <span>Tu nombre *</span>
              <input v-model.trim="customer.nombre" type="text" maxlength="255" autocomplete="name" required />
            </label>
            <label class="admin-field">
              <span>Teléfono de contacto *</span>
              <input v-model.trim="customer.telefono" type="tel" maxlength="30" autocomplete="tel" required />
            </label>

            <fieldset class="delivery-options">
              <legend>Forma de entrega *</legend>
              <label class="delivery-option" :class="{ selected: deliveryMethod === 'retiro' }">
                <input v-model="deliveryMethod" type="radio" value="retiro" />
                <span><strong>Retiro en el local</strong><small>Coordinamos por WhatsApp</small></span>
              </label>
              <label class="delivery-option" :class="{ selected: deliveryMethod === 'domicilio' }">
                <input v-model="deliveryMethod" type="radio" value="domicilio" />
                <span><strong>Entrega a domicilio</strong><small>El costo de envío se confirma por WhatsApp</small></span>
              </label>
            </fieldset>

            <label v-if="deliveryMethod === 'domicilio'" class="admin-field">
              <span>Dirección de entrega *</span>
              <textarea v-model.trim="customer.direccion" rows="2" maxlength="500" autocomplete="street-address" required></textarea>
            </label>
            <label class="admin-field">
              <span>Notas para la tienda</span>
              <textarea v-model.trim="customer.notas" rows="2" maxlength="500" placeholder="Referencia, horario preferido, etc."></textarea>
            </label>

            <div class="checkout-summary">
              <span>{{ cartCount }} {{ cartCount === 1 ? 'prenda' : 'prendas' }} · subtotal</span>
              <strong>{{ formatPrice(cartTotal) }}</strong>
            </div>
            <p v-if="!whatsappConfigured" class="admin-message admin-error" role="alert">
              Falta configurar VITE_WHATSAPP_NUMBER para activar los pedidos.
            </p>
            <p v-if="checkoutError" class="admin-message admin-error" role="alert">{{ checkoutError }}</p>
            <button class="admin-submit whatsapp-submit" type="submit" :disabled="!whatsappConfigured">
              Enviar pedido por WhatsApp
            </button>
          </form>
        </section>
      </div>
    </Transition>
  </div>
</template>
