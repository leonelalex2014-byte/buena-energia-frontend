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
  const existingItem = cartItems.value.find((item) => item.id_producto === product.id_producto)

  if (existingItem) {
    existingItem.quantity += 1
  } else {
    cartItems.value.push({
      id_producto: product.id_producto,
      nombre: product.nombre,
      precio: Number(product.precio) || 0,
      imagen_url: product.imagen_url || fallbackImage,
      quantity: 1,
    })
  }

  saveCart()
}

const updateQuantity = (item, change) => {
  item.quantity += change

  if (item.quantity <= 0) {
    cartItems.value = cartItems.value.filter((cartItem) => cartItem.id_producto !== item.id_producto)
  }

  saveCart()
}

const removeFromCart = (productId) => {
  cartItems.value = cartItems.value.filter((item) => item.id_producto !== productId)
  saveCart()
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
    cartItems.value = Array.isArray(savedCart) ? savedCart : []
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
              <img
                :src="product.imagen_url || fallbackImage"
                :alt="product.nombre"
                class="product-image"
                loading="lazy"
                @error="handleImageError"
              />
              <span class="product-number">0{{ index + 1 }}</span>
              <button class="quick-add" type="button" :aria-label="`Agregar ${product.nombre} a la bolsa`" @click="addToCart(product)">
                <span aria-hidden="true">+</span>
              </button>
            </div>
            <div class="product-details">
              <div>
                <h3>{{ product.nombre }}</h3>
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
            <article v-for="item in cartItems" :key="item.id_producto" class="cart-item">
              <img :src="item.imagen_url" :alt="item.nombre" @error="handleImageError" />
              <div class="cart-item-copy">
                <h3>{{ item.nombre }}</h3>
                <span>{{ formatPrice(item.precio) }}</span>
                <div class="quantity-control" :aria-label="`Cantidad de ${item.nombre}`">
                  <button type="button" :aria-label="`Quitar una unidad de ${item.nombre}`" @click="updateQuantity(item, -1)">−</button>
                  <span>{{ item.quantity }}</span>
                  <button type="button" :aria-label="`Agregar una unidad de ${item.nombre}`" @click="updateQuantity(item, 1)">+</button>
                </div>
              </div>
              <button class="remove-item" type="button" :aria-label="`Eliminar ${item.nombre}`" @click="removeFromCart(item.id_producto)">×</button>
            </article>
          </div>
          <div v-else class="empty-cart">
            <span aria-hidden="true">✳</span>
            <p>Tu bolsa está esperando algo bueno.</p>
            <button class="text-button" type="button" @click="isCartOpen = false">Seguir explorando <span aria-hidden="true">↗</span></button>
          </div>

          <div v-if="cartItems.length" class="cart-footer">
            <div class="cart-subtotal"><span>Subtotal</span><strong>{{ formatPrice(cartTotal) }}</strong></div>
            <p class="checkout-note">Los pedidos en línea estarán disponibles próximamente.</p>
            <button class="checkout-button" type="button" disabled>Finalizar pedido</button>
          </div>
        </aside>
      </div>
    </Transition>
  </div>
</template>
