<script setup>
import { computed, onMounted, ref } from 'vue'
import { getProducts } from './services/api'

const fallbackImage = 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80'
const products = ref([])
const cartItems = ref([])
const searchQuery = ref('')
const isCartOpen = ref(false)
const isLoading = ref(true)
const loadError = ref('')

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

      <button class="cart-trigger" type="button" @click="isCartOpen = true" aria-label="Abrir carrito">
        <span>Tu bolsa</span>
        <span class="cart-count">{{ cartCount }}</span>
      </button>
    </header>

    <main>
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
