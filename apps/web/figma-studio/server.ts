import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { store } from './server/dataStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Routes
  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Qooqnos Marketplace API', timestamp: new Date().toISOString() });
  });

  // 2. Auth & Persona
  app.get('/api/auth/current-user', (req, res) => {
    const persona = store.getCurrentPersona();
    res.json({ persona, currentRole: store.getRole() });
  });

  app.post('/api/auth/switch-role', (req, res) => {
    const { role } = req.body;
    if (role !== 'buyer' && role !== 'seller') {
      return res.status(400).json({ error: 'Invalid role. Must be "buyer" or "seller"' });
    }
    const updated = store.setRole(role);
    res.json({ persona: updated, currentRole: role });
  });

  // 3. Stories
  app.get('/api/stories', (req, res) => {
    res.json({ stories: store.getStories() });
  });

  // 4. Products
  app.get('/api/products', (req, res) => {
    const { category } = req.query;
    const products = store.getProducts(category as string);
    res.json({ products });
  });

  app.get('/api/products/:id', (req, res) => {
    const product = store.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'محصول یافت نشد' });
    }
    res.json({ product });
  });

  app.post('/api/products/:id/like', (req, res) => {
    const product = store.toggleLike(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'محصول یافت نشد' });
    }
    res.json({ product, isLiked: product.isLiked, likesCount: product.likesCount });
  });

  app.post('/api/products/:id/save', (req, res) => {
    const product = store.toggleSave(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'محصول یافت نشد' });
    }
    res.json({ product, isSaved: product.isSaved });
  });

  // 5. Cart
  app.get('/api/cart', (req, res) => {
    res.json(store.getCart());
  });

  app.post('/api/cart/items', (req, res) => {
    const { productId, selectedColor, selectedVolume } = req.body;
    if (!productId) {
      return res.status(400).json({ error: 'شناسه محصول الزامی است' });
    }
    const cart = store.addToCart(productId, selectedColor, selectedVolume);
    if (!cart) {
      return res.status(404).json({ error: 'محصول جهت افزودن به سبد پیدا نشد' });
    }
    res.json({ success: true, cart });
  });

  app.patch('/api/cart/items/:id', (req, res) => {
    const { delta } = req.body;
    if (typeof delta !== 'number') {
      return res.status(400).json({ error: 'مقدار delta الزامی است' });
    }
    const cart = store.updateCartItemQuantity(req.params.id, delta);
    res.json({ success: true, cart });
  });

  app.delete('/api/cart/items/:id', (req, res) => {
    const cart = store.removeCartItem(req.params.id);
    res.json({ success: true, cart });
  });

  app.post('/api/cart/coupon', (req, res) => {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'کد تخفیف الزامی است' });
    }
    const result = store.applyCoupon(code);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  });

  // 6. Orders & Checkout
  app.get('/api/orders', (req, res) => {
    res.json({ orders: store.getOrders() });
  });

  app.get('/api/orders/:id', (req, res) => {
    const order = store.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'سفارش یافت نشد' });
    }
    res.json({ order });
  });

  app.post('/api/orders', (req, res) => {
    const { customerName, customerPhone, shippingAddress, postalCode, paymentMethod, shippingProvider } = req.body;
    const newOrder = store.createOrder({
      customerName,
      customerPhone,
      shippingAddress,
      postalCode,
      paymentMethod,
      shippingProvider,
    });
    res.status(201).json({ success: true, order: newOrder });
  });

  // 7. Seller Analytics
  app.get('/api/seller/analytics', (req, res) => {
    res.json(store.getSellerAnalytics());
  });

  app.patch('/api/seller/orders/:id/status', (req, res) => {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'وضعیت الزامی است' });
    }
    const updated = store.updateSellerOrderStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ error: 'سفارش در پنل فروشنده یافت نشد' });
    }
    res.json({ success: true, order: updated });
  });

  // Vite development middleware or static production serve
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Qooqnos Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
