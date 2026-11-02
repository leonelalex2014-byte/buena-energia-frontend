<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import {
  createOrder,
  createProduct,
  getAdminOrders,
  getCaptchaChallenge,
  getProducts,
  loginAdministrator,
  logoutAdministrator,
  registerAdministrator,
  updateVariantStock,
  updateProduct,
  updateOrderStatus,
} from './services/api'

const fallbackImage = 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80'
const products = ref([])
const cartItems = ref([])
const searchQuery = ref('')
const selectedCategory = ref('Todos')
const isCartOpen = ref(false)
const isLoading = ref(true)
const loadError = ref('')
const selectedVariantIds = ref({})
const selectedProduct = ref(null)
const detailVariantId = ref(null)
const cartNotice = ref('')
const cartNoticeType = ref('info')
const cartFeedback = ref('')
const cartFeedbackType = ref('success')
const lastAddedVariantId = ref(null)
let cartFeedbackTimeout
let lastAddedTimeout
const isCheckoutOpen = ref(false)
const checkoutError = ref('')
const captchaChallenge = ref(null)
const captchaAnswer = ref('')
const captchaWebsite = ref('')
const captchaLoading = ref(false)
const orderSubmitting = ref(false)
const deliveryMethod = ref('retiro')
const customer = ref({ nombre: '', telefono: '', direccion: '', notas: '' })
const whatsappNumber = (import.meta.env.VITE_WHATSAPP_NUMBER || '').replace(/\D/g, '')
const currentUser = ref(readStoredUser())
const isAuthOpen = ref(false)
const authMode = ref('login')
const authLoading = ref(false)
const authError = ref('')
const isAdminPanelOpen = ref(false)
const adminTab = ref('pedidos')
const showProductForm = ref(false)
const editingProductId = ref(null)
const productManagementSearch = ref('')
const productLoading = ref(false)
const productError = ref('')
const productSuccess = ref('')
const productImageFile = ref(null)
const productImagePreview = ref('')
const productImageInput = ref(null)
const productEditorForm = ref(null)
const productNameInput = ref(null)
const stockDrafts = ref({})
const stockLoading = ref(false)
const stockError = ref('')
const stockSuccess = ref('')
const inventorySearch = ref('')
const inventoryFilter = ref('todos')
const expandedInventoryProductIds = ref([])
const orders = ref([])
const ordersView = ref('activos')
const ordersPage = ref(1)
const ordersPagination = ref({ current_page: 1, last_page: 1, per_page: 10, total: 0 })
const pendingOrderCount = ref(0)
const ordersLoading = ref(false)
const ordersError = ref('')
const ordersSuccess = ref('')
const updatingOrderId = ref(null)

const setSpanishValidationMessage = (event) => {
  const field = event.target

  if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return

  const { validity } = field

  if (validity.valueMissing) {
    field.setCustomValidity(field.type === 'checkbox' ? 'Marca esta opción para continuar.' : 'Completa este campo.')
  } else if (validity.typeMismatch && field.type === 'email') {
    field.setCustomValidity('Ingresa un correo electrónico válido.')
  } else if (validity.typeMismatch && field.type === 'url') {
    field.setCustomValidity('Ingresa una URL válida.')
  } else if (validity.tooShort) {
    field.setCustomValidity(`Ingresa al menos ${field.minLength} caracteres.`)
  } else if (validity.tooLong) {
    field.setCustomValidity(`Usa como máximo ${field.maxLength} caracteres.`)
  } else if (validity.rangeUnderflow) {
    field.setCustomValidity(`El valor debe ser como mínimo ${field.min}.`)
  } else if (validity.rangeOverflow) {
    field.setCustomValidity(`El valor debe ser como máximo ${field.max}.`)
  } else if (validity.stepMismatch || validity.badInput) {
    field.setCustomValidity('Ingresa un valor válido.')
  } else if (validity.patternMismatch) {
    field.setCustomValidity('Revisa el formato ingresado.')
  } else {
    field.setCustomValidity('Revisa el valor ingresado.')
  }
}

const clearSpanishValidationMessage = (event) => {
  if (typeof event.target?.setCustomValidity === 'function') {
    event.target.setCustomValidity('')
  }
}

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

const normalizeSearchText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es')

const categoryOptions = computed(() => {
  const categories = [...new Set(products.value.map((product) => product.categoria).filter(Boolean))]
    .sort((firstCategory, secondCategory) => firstCategory.localeCompare(secondCategory, 'es'))

  return [
    { name: 'Todos', count: products.value.length },
    ...categories.map((name) => ({
      name,
      count: products.value.filter((product) => product.categoria === name).length,
    })),
  ]
})

const filteredInventoryProducts = computed(() => {
  const query = normalizeSearchText(inventorySearch.value.trim())

  return products.value
    .map((product) => {
      const productMatches = normalizeSearchText(product.nombre).includes(query)
      const inventoryVariants = (product.variantes || []).filter((variant) => {
        const stock = Number(stockDrafts.value[variant.id_variante] ?? variant.stock)
        const matchesFilter = inventoryFilter.value === 'todos'
          || (inventoryFilter.value === 'poco' && stock > 0 && stock <= 5)
          || (inventoryFilter.value === 'agotado' && stock === 0)
        const matchesSearch = !query
          || productMatches
          || normalizeSearchText(`${variant.talle} ${variant.color}`).includes(query)

        return matchesFilter && matchesSearch
      })

      return { ...product, inventoryVariants }
    })
    .filter((product) => product.inventoryVariants.length > 0)
})

const filteredAdminProducts = computed(() => {
  const query = normalizeSearchText(productManagementSearch.value.trim())

  return products.value.filter((product) => !query
    || normalizeSearchText(`${product.nombre} ${product.categoria}`).includes(query))
})

const filteredProducts = computed(() => {
  const queryTerms = normalizeSearchText(searchQuery.value).trim().split(/\s+/).filter(Boolean)

  return products.value.filter((product) => {
    const matchesCategory = selectedCategory.value === 'Todos' || product.categoria === selectedCategory.value
    if (!matchesCategory) return false
    if (!queryTerms.length) return true

    const searchableText = normalizeSearchText([
      product.nombre,
      product.descripcion,
      product.categoria,
      ...(product.variantes || []).flatMap((variant) => [variant.talle, formatSize(product.categoria, variant.talle), variant.color]),
      ...(product.colors || []).map((color) => color.name),
    ].join(' '))

    return queryTerms.every((term) => searchableText.includes(term))
  })
})

const cartCount = computed(() => cartItems.value.reduce((total, item) => total + item.quantity, 0))
const cartTotal = computed(() => cartItems.value.reduce((total, item) => total + item.precio * item.quantity, 0))
const cartLabel = computed(() => `Bolsa · ${cartCount.value} ${cartCount.value === 1 ? 'artículo' : 'artículos'}`)
const whatsappConfigured = computed(() => whatsappNumber.length >= 10)
const detailVariant = computed(() => selectedProduct.value?.variantes?.find(
  (variant) => variant.id_variante === detailVariantId.value,
))
const detailImage = computed(() => selectedProduct.value
  ? imageForVariant(selectedProduct.value, detailVariantId.value)
  : fallbackImage)

const formatPrice = (price) => new Intl.NumberFormat('es-UY', {
  style: 'currency',
  currency: 'UYU',
  maximumFractionDigits: 0,
}).format(Number(price) || 0)

const formatSize = (category, size) => category === 'Infantil' ? `${size} años` : size
const formatCartSize = (item) => {
  const category = item.categoria || products.value.find((product) => product.id_producto === item.id_producto)?.categoria
  return formatSize(category, item.talle)
}

const productStockTotal = (product, variants = product.variantes || []) => variants.reduce(
  (total, variant) => total + Number(variant.stock),
  0,
)

const imageForVariant = (product, variantId) => {
  const variant = product.variantes?.find((item) => item.id_variante === variantId)
  const color = product.colors?.find((item) => item.name?.toLocaleLowerCase('es') === variant?.color?.toLocaleLowerCase('es'))
  return variant?.imagen_url || color?.image || product.imagen_url || fallbackImage
}

const adminProductImage = (product) => {
  const selectedVariantId = selectedVariantIds.value[product.id_producto]
  const representativeVariant = product.variantes?.find((variant) => variant.id_variante === selectedVariantId)
    || product.variantes?.find((variant) => Number(variant.stock) > 0)
    || product.variantes?.[0]

  return representativeVariant
    ? imageForVariant(product, representativeVariant.id_variante)
    : product.imagen_url || fallbackImage
}

const loadCatalog = async () => {
  isLoading.value = true
  loadError.value = ''

  try {
    products.value = await getProducts()
    cartItems.value = cartItems.value.map((item) => {
      const product = products.value.find((catalogProduct) => Number(catalogProduct.id_producto) === Number(item.id_producto))
      const variant = product?.variantes?.find((catalogVariant) => Number(catalogVariant.id_variante) === Number(item.id_variante))

      if (!product || !variant) return item

      return {
        ...item,
        nombre: product.nombre,
        categoria: product.categoria,
        talle: variant.talle,
        color: variant.color,
        precio: Number(product.precio) || 0,
        stock: Number(variant.stock),
        imagen_url: imageForVariant(product, variant.id_variante),
      }
    })
    saveCart()
    stockDrafts.value = Object.fromEntries(products.value.flatMap((product) =>
      (product.variantes || []).map((variant) => [variant.id_variante, Number(variant.stock)]),
    ))
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

const showCartFeedback = (message, type = 'success') => {
  cartFeedback.value = message
  cartFeedbackType.value = type

  if (cartFeedbackTimeout) window.clearTimeout(cartFeedbackTimeout)
  cartFeedbackTimeout = window.setTimeout(() => {
    cartFeedback.value = ''
  }, 3200)
}

const announceCartNotice = (message, type = 'error') => {
  cartNotice.value = message
  cartNoticeType.value = type
  showCartFeedback(message, type)
}

const flashAddedVariant = (variantId) => {
  lastAddedVariantId.value = variantId

  if (lastAddedTimeout) window.clearTimeout(lastAddedTimeout)
  lastAddedTimeout = window.setTimeout(() => {
    if (lastAddedVariantId.value === variantId) lastAddedVariantId.value = null
  }, 1400)
}

const addToCart = (product) => {
  const variant = product.variantes?.find((item) => item.id_variante === selectedVariantIds.value[product.id_producto])

  if (!variant || Number(variant.stock) < 1) {
    announceCartNotice('Esta prenda no tiene variantes disponibles.')
    return false
  }

  const existingItem = cartItems.value.find((item) => item.id_variante === variant.id_variante)

  if (existingItem) {
    if (existingItem.quantity >= Number(variant.stock)) {
      const availableText = Number(variant.stock) === 1 ? 'unidad disponible' : 'unidades disponibles'
      announceCartNotice(`Solo hay ${variant.stock} ${availableText} para esa variante.`)
      return false
    }
    existingItem.quantity += 1
  } else {
    cartItems.value.push({
      id_producto: product.id_producto,
      id_variante: variant.id_variante,
      nombre: product.nombre,
      categoria: product.categoria,
      talle: variant.talle,
      color: variant.color,
      stock: Number(variant.stock),
      precio: Number(product.precio) || 0,
      imagen_url: imageForVariant(product, variant.id_variante),
      quantity: 1,
    })
  }

  cartNotice.value = ''
  cartNoticeType.value = 'info'
  saveCart()
  flashAddedVariant(variant.id_variante)
  showCartFeedback(`${product.nombre} · ${formatSize(product.categoria, variant.talle)} · ${variant.color} agregado a la bolsa.`)
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
  }
}

const updateQuantity = (item, change) => {
  if (change > 0 && item.quantity >= item.stock) {
    const availableText = item.stock === 1 ? 'unidad disponible' : 'unidades disponibles'
    announceCartNotice(`Solo hay ${item.stock} ${availableText} de ${item.nombre} (${formatCartSize(item)}, ${item.color}).`)
    return
  }

  item.quantity += change

  if (item.quantity <= 0) {
    cartItems.value = cartItems.value.filter((cartItem) => cartItem.id_variante !== item.id_variante)
  }

  cartNotice.value = ''
  cartNoticeType.value = 'info'
  saveCart()
}

const removeFromCart = (variantId) => {
  cartItems.value = cartItems.value.filter((item) => item.id_variante !== variantId)
  cartNotice.value = ''
  cartNoticeType.value = 'info'
  saveCart()
}

const loadCaptchaChallenge = async () => {
  captchaChallenge.value = null
  captchaAnswer.value = ''
  captchaLoading.value = true

  try {
    captchaChallenge.value = await getCaptchaChallenge()
  } catch {
    checkoutError.value = 'No se pudo cargar la verificación. Inténtalo de nuevo.'
  } finally {
    captchaLoading.value = false
  }
}

const openCheckout = () => {
  checkoutError.value = ''
  isCheckoutOpen.value = true
  void loadCaptchaChallenge()
}

const submitOrder = async () => {
  checkoutError.value = ''

  if (!whatsappConfigured.value) {
    checkoutError.value = 'Falta configurar el WhatsApp de la tienda.'
    return
  }

  if (!captchaChallenge.value || captchaLoading.value) {
    checkoutError.value = 'Espera a que cargue la verificación.'
    return
  }

  const whatsappWindow = window.open('', '_blank')

  if (!whatsappWindow) {
    checkoutError.value = 'Permite las ventanas emergentes para continuar a WhatsApp.'
    return
  }

  whatsappWindow.opener = null
  orderSubmitting.value = true
  let orderResponse

  try {
    orderResponse = await createOrder({
      cliente: {
        nombre: customer.value.nombre.trim(),
        telefono: customer.value.telefono.trim(),
      },
      entrega: deliveryMethod.value,
      direccion: deliveryMethod.value === 'domicilio' ? customer.value.direccion.trim() : null,
      notas: customer.value.notas.trim() || null,
      items: cartItems.value.map((item) => ({
        id_variante: item.id_variante,
        cantidad: item.quantity,
      })),
      captcha_challenge_id: captchaChallenge.value.challenge_id,
      captcha_answer: Number(captchaAnswer.value),
      website: captchaWebsite.value,
    })
  } catch (error) {
    whatsappWindow.close()
    const validationErrors = error.response?.data?.errors
    checkoutError.value = validationErrors
      ? Object.values(validationErrors).flat().join(' ')
      : error.response?.data?.message || 'No se pudo registrar el pedido.'
    await loadCaptchaChallenge()
    if (error.response?.status === 422) await loadCatalog()
    return
  } finally {
    orderSubmitting.value = false
  }

  const order = orderResponse.order
  const itemLines = order.detalles.map((item, index) =>
    `${index + 1}. ${item.nombre} | Talle: ${formatSize(item.categoria, item.talle)} | Color: ${item.color} | Cantidad: ${item.cantidad} | ${formatPrice(Number(item.precio_unitario) * item.cantidad)}`,
  )

  const deliveryText = order.tipo_entrega === 'retiro'
    ? 'Retiro en el local'
    : `Entrega a domicilio\nDirección: ${order.cliente.direccion}\nEnvío: por confirmar con la tienda`

  const message = [
    `*PEDIDO #${order.id_pedido} · BUENA ENERGÍA*`,
    '',
    `Cliente: ${order.cliente.nombre}`,
    `Teléfono: ${order.cliente.telefono}`,
    `Entrega: ${deliveryText}`,
    '',
    '*PRODUCTOS*',
    ...itemLines,
    '',
    `*Subtotal: ${formatPrice(order.total)}*`,
    ...(order.notas ? ['', `Notas: ${order.notas}`] : []),
    '',
    'Pedido pendiente de confirmación de disponibilidad y costo de envío.',
  ].join('\n')

  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
  whatsappWindow.location.href = whatsappUrl
  cartItems.value = []
  saveCart()
  isCheckoutOpen.value = false
  isCartOpen.value = false
  captchaAnswer.value = ''
  captchaChallenge.value = null
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

const toggleAdminPanel = () => {
  isAdminPanelOpen.value = !isAdminPanelOpen.value

  if (isAdminPanelOpen.value) {
    void loadAdminOrders()
    void loadCatalog()
  }
}

const toggleInventoryProduct = (productId) => {
  expandedInventoryProductIds.value = expandedInventoryProductIds.value.includes(productId)
    ? expandedInventoryProductIds.value.filter((id) => id !== productId)
    : [...expandedInventoryProductIds.value, productId]
}

const openProductForm = () => {
  if (showProductForm.value) {
    closeProductForm()
    return
  }

  editingProductId.value = null
  productForm.value = emptyProductForm()
  clearProductImage()
  showProductForm.value = true
  productError.value = ''
  productSuccess.value = ''
}

const editProduct = async (product) => {
  clearProductImage()
  editingProductId.value = product.id_producto
  productForm.value = {
    nombre: product.nombre || '',
    descripcion: product.descripcion || '',
    precio: product.precio || '',
    categoria: product.categoria || '',
    imagen: product.imagen_url || '',
    variantes: (product.variantes || []).map((variant) => ({
      id_variante: variant.id_variante,
      talle: variant.talle,
      color: variant.color,
      stock: Number(variant.stock),
    })),
  }
  showProductForm.value = true
  productError.value = ''
  productSuccess.value = ''
  adminTab.value = 'productos'
  await nextTick()
  productEditorForm.value?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block: 'start',
  })
  productNameInput.value?.focus({ preventScroll: true })
}

const closeProductForm = () => {
  showProductForm.value = false
  editingProductId.value = null
  productForm.value = emptyProductForm()
  clearProductImage()
  productError.value = ''
}

const loadAdminOrders = async () => {
  ordersLoading.value = true
  ordersError.value = ''
  ordersSuccess.value = ''

  try {
    const response = await getAdminOrders({ view: ordersView.value, page: ordersPage.value })
    orders.value = response.orders
    ordersPagination.value = response.pagination
    pendingOrderCount.value = response.pending_count
    ordersPage.value = response.pagination.current_page
  } catch (error) {
    orders.value = []
    ordersPagination.value = { current_page: 1, last_page: 1, per_page: 10, total: 0 }
    pendingOrderCount.value = 0
    ordersError.value = error.response?.data?.message || 'No se pudieron cargar los pedidos.'
  } finally {
    ordersLoading.value = false
  }
}

const setOrdersView = (view) => {
  if (ordersView.value === view || ordersLoading.value) return

  ordersView.value = view
  ordersPage.value = 1
  void loadAdminOrders()
}

const changeOrdersPage = (page) => {
  if (ordersLoading.value || page < 1 || page > ordersPagination.value.last_page) return

  ordersPage.value = page
  void loadAdminOrders()
}

const changeOrderStatus = async (order, status) => {
  updatingOrderId.value = order.id_pedido
  ordersError.value = ''
  ordersSuccess.value = ''

  try {
    const response = await updateOrderStatus(order.id_pedido, status)
    const successMessage = `El pedido #${order.id_pedido} quedó ${response.order.estado.toLowerCase()}.`

    if (status === 'Confirmado' || status === 'Cancelado') {
      await loadCatalog()
    }

    await loadAdminOrders()
    if (!ordersError.value) ordersSuccess.value = successMessage
  } catch (error) {
    const validationErrors = error.response?.data?.errors
    const errorMessage = validationErrors
      ? Object.values(validationErrors).flat().join(' ')
      : error.response?.data?.message || 'No se pudo actualizar el pedido.'
    await loadAdminOrders()
    ordersError.value = errorMessage
  } finally {
    updatingOrderId.value = null
  }
}

const formatOrderDate = (date) => new Intl.DateTimeFormat('es-UY', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(date))

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

const clearProductImage = () => {
  if (productImagePreview.value) URL.revokeObjectURL(productImagePreview.value)
  productImageFile.value = null
  productImagePreview.value = ''
  if (productImageInput.value) productImageInput.value.value = ''
}

const removeProductImage = () => {
  clearProductImage()
  productForm.value.imagen = ''
}

const handleProductImageSelection = (event) => {
  productError.value = ''
  const file = event.target.files?.[0]

  if (!file) return

  const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!acceptedTypes.includes(file.type)) {
    clearProductImage()
    productError.value = 'Selecciona una imagen JPG, PNG o WebP.'
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    clearProductImage()
    productError.value = 'La imagen debe pesar máximo 5 MB.'
    return
  }

  if (productImagePreview.value) URL.revokeObjectURL(productImagePreview.value)
  productImageFile.value = file
  productImagePreview.value = URL.createObjectURL(file)
}

const submitProduct = async () => {
  productLoading.value = true
  productError.value = ''
  productSuccess.value = ''
  const isEditing = editingProductId.value !== null

  try {
    const productData = {
      ...productForm.value,
      precio: Number(productForm.value.precio),
      descripcion: productForm.value.descripcion || null,
      imagen: productForm.value.imagen || null,
      imagen_archivo: productImageFile.value,
      variantes: productForm.value.variantes.map((variant) => ({
        id_variante: variant.id_variante,
        talle: variant.talle,
        color: variant.color,
        stock: Number(variant.stock),
      })),
    }

    if (isEditing) {
      await updateProduct(editingProductId.value, productData)
    } else {
      await createProduct(productData)
    }

    productForm.value = emptyProductForm()
    editingProductId.value = null
    clearProductImage()
    showProductForm.value = false
    productSuccess.value = isEditing
      ? 'Producto actualizado correctamente.'
      : 'Producto creado y añadido al catálogo.'
    await loadCatalog()
  } catch (error) {
    const validationErrors = error.response?.data?.errors
    productError.value = validationErrors
      ? Object.values(validationErrors).flat().join(' ')
      : error.response?.data?.message || (isEditing
        ? 'No se pudo actualizar el producto.'
        : 'No se pudo crear el producto.')
  } finally {
    productLoading.value = false
  }
}

const saveVariantStock = async (variant) => {
  const stock = stockDrafts.value[variant.id_variante]

  if (!Number.isInteger(stock) || stock < 0 || stock > 2147483647) {
    stockError.value = 'Ingresa una cantidad entera entre 0 y 2147483647.'
    stockSuccess.value = ''
    return
  }

  stockLoading.value = true
  stockError.value = ''
  stockSuccess.value = ''

  try {
    const response = await updateVariantStock(variant.id_variante, stock)
    variant.stock = Number(response.variant.stock)
    stockDrafts.value[variant.id_variante] = variant.stock
    stockSuccess.value = `Stock actualizado para ${variant.talle} · ${variant.color}.`
  } catch (error) {
    const validationErrors = error.response?.data?.errors
    stockError.value = validationErrors
      ? Object.values(validationErrors).flat().join(' ')
      : error.response?.data?.message || 'No se pudo actualizar el stock.'
  } finally {
    stockLoading.value = false
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

onUnmounted(() => {
  clearProductImage()
  if (cartFeedbackTimeout) window.clearTimeout(cartFeedbackTimeout)
  if (lastAddedTimeout) window.clearTimeout(lastAddedTimeout)
})
</script>

<template>
  <div
    class="site-shell"
    @invalid.capture="setSpanishValidationMessage"
    @input.capture="clearSpanishValidationMessage"
    @change.capture="clearSpanishValidationMessage"
  >
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
        <a href="#contacto">Contacto</a>
      </nav>

      <div class="header-actions">
        <button v-if="isAdministrator" class="account-trigger" type="button" @click="toggleAdminPanel">
          {{ isAdminPanelOpen ? 'Cerrar panel' : 'Administración' }}
        </button>
        <button v-if="isAdministrator" class="account-trigger logout-trigger" type="button" @click="logout">Salir</button>
        <button v-else class="account-trigger" type="button" @click="openAuth">Mi cuenta</button>
        <button class="cart-trigger" type="button" aria-label="Abrir carrito" :aria-expanded="isCartOpen" @click="isCartOpen = true">
          <span>Tu bolsa</span>
          <span class="cart-count" :class="{ 'cart-count-bump': cartCount > 0 }">{{ cartCount }}</span>
        </button>
      </div>
    </header>

    <main>
      <section v-if="isAdministrator && isAdminPanelOpen" class="admin-section" aria-labelledby="admin-title">
        <div class="admin-heading">
          <div>
            <p class="eyebrow"><span class="eyebrow-line"></span> GESTIÓN DE TIENDA</p>
            <h2 id="admin-title">Panel de administración</h2>
            <p>Pedidos, productos e inventario en un solo lugar.</p>
          </div>
          <span class="admin-badge">{{ currentUser.nombre }}</span>
        </div>

        <nav class="admin-tabs" aria-label="Secciones de administración">
          <button
            type="button"
            :class="{ active: adminTab === 'pedidos' }"
            :aria-pressed="adminTab === 'pedidos'"
            aria-controls="admin-orders"
            @click="adminTab = 'pedidos'"
          >
            Pedidos <span v-if="pendingOrderCount" class="admin-tab-count">{{ pendingOrderCount }}</span>
          </button>
          <button
            type="button"
            :class="{ active: adminTab === 'inventario' }"
            :aria-pressed="adminTab === 'inventario'"
            aria-controls="admin-inventory"
            @click="adminTab = 'inventario'"
          >
            Inventario
          </button>
          <button
            type="button"
            :class="{ active: adminTab === 'productos' }"
            :aria-pressed="adminTab === 'productos'"
            aria-controls="admin-products"
            @click="adminTab = 'productos'"
          >
            Productos
          </button>
        </nav>

        <div v-if="adminTab === 'pedidos'" id="admin-orders" class="admin-tab-panel">
          <div class="admin-variant-heading orders-heading">
            <div>
              <h3>{{ ordersView === 'activos' ? 'Pedidos activos' : 'Historial de pedidos' }}</h3>
              <p>
                {{ ordersView === 'activos'
                  ? 'Confirma la disponibilidad para descontar el stock o cancela pedidos que no puedas atender.'
                  : 'Pedidos entregados y cancelados se conservan aquí como historial.' }}
              </p>
            </div>
            <button class="admin-secondary" type="button" :disabled="ordersLoading" @click="loadAdminOrders">
              {{ ordersLoading ? 'CARGANDO...' : 'Actualizar pedidos' }}
            </button>
          </div>
          <div class="order-view-tabs" role="group" aria-label="Filtrar pedidos por estado">
            <button
              type="button"
              :class="{ active: ordersView === 'activos' }"
              :aria-pressed="ordersView === 'activos'"
              :disabled="ordersLoading"
              @click="setOrdersView('activos')"
            >
              Activos
              <span v-if="pendingOrderCount" class="admin-tab-count">{{ pendingOrderCount }}</span>
            </button>
            <button
              type="button"
              :class="{ active: ordersView === 'historial' }"
              :aria-pressed="ordersView === 'historial'"
              :disabled="ordersLoading"
              @click="setOrdersView('historial')"
            >
              Historial
            </button>
          </div>
          <p v-if="ordersError" class="admin-message admin-error" role="alert">{{ ordersError }}</p>
          <p v-if="ordersSuccess" class="admin-message admin-success" role="status">{{ ordersSuccess }}</p>
          <p v-if="ordersLoading && !orders.length" class="admin-message" role="status">Cargando pedidos...</p>
          <p v-else-if="!ordersLoading && !ordersError && !orders.length" class="admin-message">
            {{ ordersView === 'activos' ? 'No hay pedidos activos.' : 'Todavía no hay pedidos en el historial.' }}
          </p>
          <div v-if="orders.length" class="orders-list">
            <article v-for="order in orders" :key="order.id_pedido" class="order-card">
              <header class="order-card-heading">
                <div>
                  <h4>Pedido #{{ order.id_pedido }}</h4>
                  <span>{{ formatOrderDate(order.fecha) }}</span>
                </div>
                <span class="order-status" :class="`order-status-${order.estado.toLowerCase()}`">{{ order.estado }}</span>
              </header>
              <div class="order-customer">
                <strong>{{ order.cliente.nombre }}</strong>
                <a :href="`tel:${order.cliente.telefono}`">{{ order.cliente.telefono }}</a>
                <span>{{ order.tipo_entrega === 'retiro' ? 'Retiro en el local' : `Entrega: ${order.cliente.direccion}` }}</span>
              </div>
              <ul class="order-lines">
                <li v-for="(item, index) in order.detalles" :key="`${order.id_pedido}-${index}`">
                  <span>{{ item.nombre }} · {{ formatSize(item.categoria, item.talle) }} · {{ item.color }} × {{ item.cantidad }}</span>
                  <strong>{{ formatPrice(Number(item.precio_unitario) * item.cantidad) }}</strong>
                </li>
              </ul>
              <p v-if="order.notas" class="order-notes"><strong>Notas:</strong> {{ order.notas }}</p>
              <footer class="order-card-footer">
                <strong>Total {{ formatPrice(order.total) }}</strong>
                <div class="order-actions">
                  <button
                    v-if="order.estado === 'Pendiente'"
                    class="admin-secondary"
                    type="button"
                    :disabled="updatingOrderId === order.id_pedido"
                    @click="changeOrderStatus(order, 'Cancelado')"
                  >
                    Cancelar
                  </button>
                  <button
                    v-if="order.estado === 'Pendiente'"
                    class="admin-submit order-action-primary"
                    type="button"
                    :disabled="updatingOrderId === order.id_pedido"
                    @click="changeOrderStatus(order, 'Confirmado')"
                  >
                    {{ updatingOrderId === order.id_pedido ? 'ACTUALIZANDO...' : 'Confirmar pedido' }}
                  </button>
                  <template v-else-if="order.estado === 'Confirmado'">
                    <button
                      class="admin-secondary"
                      type="button"
                      :disabled="updatingOrderId === order.id_pedido"
                      @click="changeOrderStatus(order, 'Cancelado')"
                    >
                      Cancelar y devolver stock
                    </button>
                    <button
                      class="admin-submit order-action-primary"
                      type="button"
                      :disabled="updatingOrderId === order.id_pedido"
                      @click="changeOrderStatus(order, 'Entregado')"
                    >
                      {{ updatingOrderId === order.id_pedido ? 'ACTUALIZANDO...' : 'Marcar entregado' }}
                    </button>
                  </template>
                </div>
              </footer>
            </article>
          </div>
          <nav v-if="ordersPagination.total" class="orders-pagination" aria-label="Paginación de pedidos">
            <span>
              Página {{ ordersPagination.current_page }} de {{ ordersPagination.last_page }}
              · {{ ordersPagination.total }} {{ ordersPagination.total === 1 ? 'pedido' : 'pedidos' }}
            </span>
            <div>
              <button
                class="admin-secondary"
                type="button"
                :disabled="ordersLoading || ordersPagination.current_page <= 1"
                @click="changeOrdersPage(ordersPagination.current_page - 1)"
              >
                Anterior
              </button>
              <button
                class="admin-secondary"
                type="button"
                :disabled="ordersLoading || ordersPagination.current_page >= ordersPagination.last_page"
                @click="changeOrdersPage(ordersPagination.current_page + 1)"
              >
                Siguiente
              </button>
            </div>
          </nav>
        </div>

        <div v-else-if="adminTab === 'productos'" id="admin-products" class="admin-tab-panel">
          <div class="product-form-toggle">
            <div>
              <h3>{{ editingProductId ? 'Editar producto' : 'Agregar producto' }}</h3>
              <p>{{ editingProductId ? 'Actualiza los datos, la foto, el precio y sus variantes.' : 'Registra una prenda nueva con sus variantes e inventario inicial.' }}</p>
            </div>
            <button
              class="admin-submit product-toggle-button"
              type="button"
              aria-controls="product-editor-form"
              :aria-expanded="showProductForm"
              @click="openProductForm"
            >
              {{ showProductForm ? 'Cerrar formulario' : '+ Agregar producto' }}
            </button>
          </div>
          <p v-if="productSuccess" class="admin-message admin-success" role="status">{{ productSuccess }}</p>
          <div class="product-manager">
            <label class="inventory-search">
              <span>Buscar producto para editar</span>
              <input v-model="productManagementSearch" type="search" placeholder="Nombre o categoría" />
            </label>
            <div v-if="filteredAdminProducts.length" class="admin-product-list">
              <article v-for="product in filteredAdminProducts" :key="product.id_producto" class="admin-product-row">
                <img
                  :src="adminProductImage(product)"
                  :alt="`Imagen de ${product.nombre}`"
                  class="admin-product-image"
                  @error="handleImageError"
                />
                <div class="admin-product-copy">
                  <strong>{{ product.nombre }}</strong>
                  <span>{{ product.categoria }} · {{ formatPrice(product.precio) }} · {{ product.variantes?.length || 0 }} variantes</span>
                </div>
                <button class="admin-secondary admin-product-edit" type="button" @click="editProduct(product)">
                  Editar
                </button>
              </article>
            </div>
            <p v-else class="inventory-help">No encontramos productos con esa búsqueda.</p>
          </div>
          <form
            v-if="showProductForm"
            id="product-editor-form"
            ref="productEditorForm"
            class="admin-form product-create-form"
            @submit.prevent="submitProduct"
          >
            <div class="admin-fields">
              <label class="admin-field">
                <span>Nombre *</span>
                <input ref="productNameInput" v-model.trim="productForm.nombre" type="text" maxlength="255" required />
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
                <span>Imagen del producto</span>
                <input
                  ref="productImageInput"
                  class="image-file-input"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  @change="handleProductImageSelection"
                />
                <span class="image-upload-hint">JPG, PNG o WebP · máximo 5 MB</span>
                <div v-if="productImagePreview || productForm.imagen" class="image-preview-row">
                  <img :src="productImagePreview || productForm.imagen" alt="Vista previa de la imagen del producto" class="image-preview" @error="handleImageError" />
                  <button class="admin-secondary" type="button" @click="removeProductImage">Quitar imagen</button>
                </div>
                <input v-model.trim="productForm.imagen" type="url" maxlength="255" placeholder="O pega una URL de imagen" />
              </label>
              <label class="admin-field admin-field-wide">
                <span>Descripción</span>
                <textarea v-model.trim="productForm.descripcion" rows="3"></textarea>
              </label>
            </div>

            <div class="admin-variant-heading">
              <div>
                <h3>Variantes *</h3>
                <p>Al menos una; máximo 40. Las variantes incluidas en pedidos anteriores no se pueden quitar ni cambiar de talle o color.</p>
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
            <div class="product-form-actions">
              <button class="admin-submit" type="submit" :disabled="productLoading">
                {{ productLoading ? 'GUARDANDO...' : editingProductId ? 'GUARDAR CAMBIOS' : 'CREAR PRODUCTO' }}
              </button>
              <button class="admin-secondary product-cancel-button" type="button" :disabled="productLoading" @click="closeProductForm">
                Cancelar
              </button>
            </div>
          </form>
        </div>

        <div v-else id="admin-inventory" class="admin-tab-panel inventory-tab">
          <div class="inventory-toolbar">
            <label class="inventory-search">
              <span>Buscar por producto, talle o color</span>
              <input v-model="inventorySearch" type="search" placeholder="Ej. azul, M, bóxer" />
            </label>
            <label class="inventory-filter">
              <span>Mostrar</span>
              <select v-model="inventoryFilter">
                <option value="todos">Todas las variantes</option>
                <option value="poco">Poco stock (1–5)</option>
                <option value="agotado">Agotadas</option>
              </select>
            </label>
          </div>
          <p class="inventory-help">Expande un producto para ajustar unidades por talle y color. Usa 0 para agotarlo.</p>
          <p v-if="stockError" class="admin-message admin-error" role="alert">{{ stockError }}</p>
          <p v-if="stockSuccess" class="admin-message admin-success" role="status">{{ stockSuccess }}</p>
          <div v-if="filteredInventoryProducts.length" class="inventory-list">
            <div
              v-for="product in filteredInventoryProducts"
              :key="product.id_producto"
              class="inventory-product"
            >
              <button
                class="inventory-product-toggle"
                type="button"
                :aria-controls="`inventory-variants-${product.id_producto}`"
                :aria-expanded="expandedInventoryProductIds.includes(product.id_producto)"
                @click="toggleInventoryProduct(product.id_producto)"
              >
                <span class="inventory-product-name">{{ product.nombre }}</span>
                <span class="inventory-product-summary">
                  {{ product.inventoryVariants.length }} {{ product.inventoryVariants.length === 1 ? 'variante' : 'variantes' }}
                  <span aria-hidden="true">·</span>
                  {{ productStockTotal(product, product.inventoryVariants) }} unidades
                </span>
                <span class="inventory-expand-mark" aria-hidden="true">{{ expandedInventoryProductIds.includes(product.id_producto) ? '−' : '+' }}</span>
              </button>
              <div
                v-if="expandedInventoryProductIds.includes(product.id_producto)"
                :id="`inventory-variants-${product.id_producto}`"
                class="inventory-variants"
              >
                <div
                  v-for="variant in product.inventoryVariants"
                  :key="variant.id_variante"
                  class="inventory-row"
                >
                  <span class="inventory-variant">{{ formatSize(product.categoria, variant.talle) }} · {{ variant.color }}</span>
                  <label class="inventory-stock-field" :for="`stock-${variant.id_variante}`">
                    <span>Unidades</span>
                    <input
                      :id="`stock-${variant.id_variante}`"
                      v-model.number="stockDrafts[variant.id_variante]"
                      type="number"
                      min="0"
                      max="2147483647"
                      step="1"
                      required
                      :disabled="stockLoading"
                    />
                  </label>
                  <span
                    class="inventory-status"
                    :class="{
                      'inventory-out-of-stock': Number(stockDrafts[variant.id_variante]) === 0,
                      'inventory-low-stock': Number(stockDrafts[variant.id_variante]) > 0 && Number(stockDrafts[variant.id_variante]) <= 5,
                    }"
                  >
                    {{ Number(stockDrafts[variant.id_variante]) === 0 ? 'Agotado' : Number(stockDrafts[variant.id_variante]) <= 5 ? 'Poco stock' : 'Disponible' }}
                  </span>
                  <button
                    class="admin-secondary inventory-save"
                    type="button"
                    :disabled="stockLoading || Number(stockDrafts[variant.id_variante]) === Number(variant.stock)"
                    @click="saveVariantStock(variant)"
                  >
                    {{ stockLoading ? 'GUARDANDO...' : 'Guardar' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <p v-else-if="!products.length" class="admin-message">Todavía no hay productos para administrar.</p>
          <p v-else class="admin-message">No encontramos variantes con esos filtros.</p>
        </div>
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
            :src="products[6]?.imagen_url || fallbackImage"
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
            <input v-model="searchQuery" type="search" placeholder="Nombre, categoría, talle o color" aria-label="Buscar por nombre, categoría, talle o color" />
            <button v-if="searchQuery" class="clear-search" type="button" aria-label="Limpiar búsqueda" @click="searchQuery = ''">×</button>
          </label>
        </div>

        <nav v-if="!isLoading && !loadError && categoryOptions.length > 1" class="category-tabs" aria-label="Filtrar productos por categoría">
          <button
            v-for="category in categoryOptions"
            :key="category.name"
            class="category-tab"
            type="button"
            :aria-pressed="selectedCategory === category.name"
            @click="selectedCategory = category.name"
          >
            <span>{{ category.name }}</span>
            <span class="category-tab-count">{{ category.count }}</span>
          </button>
        </nav>

        <p class="catalog-count" aria-live="polite">
          <template v-if="searchQuery.trim()">
            {{ filteredProducts.length }} {{ filteredProducts.length === 1 ? 'resultado encontrado' : 'resultados encontrados' }}
          </template>
          <template v-else>
            {{ filteredProducts.length }} {{ filteredProducts.length === 1 ? 'prenda' : 'prendas' }} para elegir
          </template>
        </p>

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
                  :src="imageForVariant(product, selectedVariantIds[product.id_producto])"
                  :alt="product.nombre"
                  class="product-image"
                  loading="lazy"
                  @error="handleImageError"
                />
                <span class="product-number">0{{ index + 1 }}</span>
                <span class="product-view-label">Ver detalles <span aria-hidden="true">↗</span></span>
              </button>
              <button
                class="quick-add"
                :class="{ 'quick-add-added': product.variantes?.some((variant) => variant.id_variante === lastAddedVariantId) }"
                type="button"
                :aria-label="product.variantes?.some((variant) => variant.id_variante === lastAddedVariantId) ? `${product.nombre} agregado a la bolsa` : `Agregar ${product.nombre} a la bolsa`"
                :disabled="!product.variantes?.some((variant) => Number(variant.stock) > 0)"
                @click.stop="addToCart(product)"
              >
                <span aria-hidden="true">{{ product.variantes?.some((variant) => variant.id_variante === lastAddedVariantId) ? '✓' : '+' }}</span>
              </button>
            </div>
            <label v-if="product.variantes?.length" class="variant-picker">
              <span>Talle y color</span>
              <select v-model.number="selectedVariantIds[product.id_producto]" :aria-label="`Variante de ${product.nombre}`">
                <option v-for="variant in product.variantes" :key="variant.id_variante" :value="variant.id_variante" :disabled="Number(variant.stock) < 1">
                  {{ formatSize(product.categoria, variant.talle) }} · {{ variant.color }}{{ Number(variant.stock) < 1 ? ' · Agotado' : ` · ${variant.stock} disponibles` }}
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
          <p v-if="searchQuery">No encontramos prendas con “{{ searchQuery }}”.</p>
          <p v-else>No hay prendas en la categoría “{{ selectedCategory }}”.</p>
          <button class="text-button" type="button" @click="searchQuery = ''; selectedCategory = 'Todos'">Ver toda la colección <span aria-hidden="true">↗</span></button>
        </div>
      </section>

      <section id="historia" class="brand-note">
        <span class="brand-note-mark" aria-hidden="true">✳</span>
        <p>Sentirte bien empieza<br />con lo que eliges <em>para ti.</em></p>
        <span class="brand-note-signature">BUENA ENERGÍA, SIEMPRE.</span>
      </section>

      <section id="contacto" class="contact-section" aria-labelledby="contact-title">
        <div class="contact-copy">
          <p class="eyebrow"><span class="eyebrow-line"></span> CONTACTO DIRECTO</p>
          <h2 id="contact-title">¿Te ayudamos con tu pedido?</h2>
          <p>Comunícate con Fernanda para consultas sobre talles, prendas o disponibilidad.</p>
          <a class="contact-phone" href="tel:094449306">Llamar al 094 449 306 <span aria-hidden="true">↗</span></a>
        </div>
        <img
          class="contact-image"
          src="/contacto-buena-energia.jpeg"
          alt="Tarjeta de contacto de Buena Energía con Fernanda y el teléfono 094 449 306"
          loading="lazy"
        />
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
                :src="detailImage"
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
                    {{ formatSize(selectedProduct.categoria, variant.talle) }} · {{ variant.color }}{{ Number(variant.stock) < 1 ? ' · Agotado' : ` · ${variant.stock} disponibles` }}
                  </option>
                </select>
              </label>
              <p v-if="detailVariant && Number(detailVariant.stock) > 0" class="detail-stock">Disponible para agregar al carrito</p>
              <p v-else class="detail-stock detail-out-of-stock">Esta prenda está agotada</p>
              <p v-if="cartNotice" class="cart-notice" :class="`cart-notice-${cartNoticeType}`" role="status">{{ cartNotice }}</p>
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
                <span>{{ formatCartSize(item) }} · {{ item.color }} · {{ formatPrice(item.precio) }}</span>
                <div class="quantity-control" :aria-label="`Cantidad de ${item.nombre}`">
                  <button type="button" :aria-label="`Quitar una unidad de ${item.nombre}`" @click="updateQuantity(item, -1)">−</button>
                  <span>{{ item.quantity }}</span>
                  <button type="button" :aria-label="`Agregar una unidad de ${item.nombre}`" @click="updateQuantity(item, 1)">+</button>
                </div>
              </div>
              <button class="remove-item" type="button" :aria-label="`Eliminar ${item.nombre}`" @click="removeFromCart(item.id_variante)">×</button>
            </article>
          </div>
          <p v-if="cartNotice" class="cart-notice" :class="`cart-notice-${cartNoticeType}`" role="status">{{ cartNotice }}</p>
          <div v-if="!cartItems.length" class="empty-cart">
            <span aria-hidden="true">✳</span>
            <p>Tu bolsa está esperando algo bueno.</p>
            <button class="text-button" type="button" @click="isCartOpen = false">Seguir explorando <span aria-hidden="true">↗</span></button>
          </div>

          <div v-if="cartItems.length" class="cart-footer">
            <div class="cart-subtotal"><span>Subtotal</span><strong>{{ formatPrice(cartTotal) }}</strong></div>
            <p class="checkout-note">El pedido queda pendiente; la tienda confirmará stock y envío por WhatsApp.</p>
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
            <label v-if="captchaChallenge" class="admin-field">
              <span>Verificación anti-spam: {{ captchaChallenge.question }} = ?</span>
              <input
                v-model="captchaAnswer"
                type="number"
                inputmode="numeric"
                min="2"
                max="18"
                step="1"
                autocomplete="off"
                required
              />
            </label>
            <p v-else-if="captchaLoading" class="admin-message" role="status">Cargando verificación...</p>
            <label class="captcha-honeypot" aria-hidden="true">
              <span>Deja este campo vacío</span>
              <input v-model="captchaWebsite" type="text" tabindex="-1" autocomplete="off" />
            </label>
            <p v-if="!whatsappConfigured" class="admin-message admin-error" role="alert">
              Falta configurar VITE_WHATSAPP_NUMBER para activar los pedidos.
            </p>
            <p v-if="checkoutError" class="admin-message admin-error" role="alert">{{ checkoutError }}</p>
            <button
              class="admin-submit whatsapp-submit"
              type="submit"
              :disabled="!whatsappConfigured || captchaLoading || orderSubmitting || !captchaChallenge"
            >
              {{ orderSubmitting ? 'Registrando pedido...' : 'Enviar pedido por WhatsApp' }}
            </button>
          </form>
        </section>
      </div>
    </Transition>

    <Transition name="cart-feedback">
      <p v-if="cartFeedback && !isCartOpen && !isCheckoutOpen && !selectedProduct" class="cart-feedback-toast" :class="`cart-feedback-${cartFeedbackType}`" role="status" aria-live="polite">
        <span aria-hidden="true">{{ cartFeedbackType === 'success' ? '✓' : '!' }}</span>
        {{ cartFeedback }}
        <button class="cart-feedback-open" type="button" @click="isCartOpen = true">Ver bolsa</button>
      </p>
    </Transition>

    <button
      v-if="cartCount > 0 && !isCartOpen && !isCheckoutOpen"
      class="floating-cart"
      type="button"
      :aria-label="`Abrir bolsa, ${cartCount} ${cartCount === 1 ? 'artículo' : 'artículos'}`"
      @click="isCartOpen = true"
    >
      <span class="floating-cart-icon" aria-hidden="true">▱</span>
      <span>{{ cartLabel }}</span>
      <span class="floating-cart-total">{{ formatPrice(cartTotal) }}</span>
    </button>
  </div>
</template>
