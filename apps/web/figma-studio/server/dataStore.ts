import fs from 'fs';
import path from 'path';

export interface ProductEntity {
  id: string;
  title: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  inStock: boolean;
  stockCount: number;
  rating: number;
  reviewCount: number;
  images: string[];
  description: string;
  colors: { name: string; hex: string; available: boolean }[];
  volumes?: string[];
  likesCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
}

export interface CartItemEntity {
  id: string;
  productId: string;
  title: string;
  sellerName: string;
  sellerAvatar: string;
  price: number;
  quantity: number;
  image: string;
  selectedColor?: string;
  selectedVolume?: string;
  sellerNote?: string;
}

export interface OrderEntity {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: 'payment_success' | 'preparing' | 'in_transit' | 'delivered';
  trackingCode: string;
  shippingProvider: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  postalCode: string;
  items: CartItemEntity[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  paymentMethod: string;
}

export interface UserPersona {
  id: string;
  role: 'buyer' | 'seller';
  name: string;
  phone: string;
  avatar: string;
  address: string;
  city: string;
  walletBalance: number;
  stats: {
    ordersCount: number;
    badgesCount: number;
    savedCount: number;
  };
}

const DATA_FILE = path.resolve(process.cwd(), 'data_store.json');

const INITIAL_DATA = {
  currentRole: 'buyer' as 'buyer' | 'seller',
  personas: {
    buyer: {
      id: 'user-sara',
      role: 'buyer',
      name: 'سارا احمدی',
      phone: '۰۹۱۲۳۴۵۶۷۸۹',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      address: 'تهران، ستارخان، خیابان خسرو شمالی، کوچه توحید، پلاک ۲۴، واحد ۲',
      city: 'تهران، منطقه ۲',
      walletBalance: 250000,
      stats: {
        ordersCount: 12,
        badgesCount: 24,
        savedCount: 28,
      },
    } as UserPersona,
    seller: {
      id: 'seller-mazhoor',
      role: 'seller',
      name: 'خانه ماژور (صنایع دست‌ساز)',
      phone: '۰۹۱۲۹۸۷۶۵۴۳',
      avatar: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=300&q=80',
      address: 'تهران، خیابان شریعتی، کارگاه سفالگری ماژور',
      city: 'تهران',
      walletBalance: 5400000,
      stats: {
        ordersCount: 86,
        badgesCount: 12300,
        savedCount: 186,
      },
    } as UserPersona,
  },
  stories: [
    {
      id: 's1',
      sellerName: 'خانه ماژور',
      avatar: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=300&q=80',
      hasUnseen: true,
    },
    {
      id: 's2',
      sellerName: 'استودیو نقش',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
      hasUnseen: true,
    },
    {
      id: 's3',
      sellerName: 'کارگاه ماهور',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80',
      hasUnseen: false,
    },
    {
      id: 's4',
      sellerName: 'آتلیه خاک',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
      hasUnseen: true,
    },
    {
      id: 's5',
      sellerName: 'سرامیک بهار',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
      hasUnseen: false,
    },
  ],
  products: [
    {
      id: 'p1',
      title: 'ماگ سرامیکی زیتون',
      sellerId: 'seller1',
      sellerName: 'خانه ماژور',
      sellerAvatar: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=300&q=80',
      price: 680000,
      originalPrice: 750000,
      discountPercent: 10,
      inStock: true,
      stockCount: 18,
      rating: 4.8,
      reviewCount: 24,
      images: [
        'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80',
      ],
      description: 'ساخته شده با دست از گل رس سفید، لعاب مات بهداشتی با پخت کوره در دمای ۱۰۵۰ درجه، مقاوم در برابر حرارت و ماشین ظرفشویی.',
      colors: [
        { name: 'سبز زیتونی', hex: '#656d4a', available: true },
        { name: 'کرم خاکی', hex: '#d4a373', available: true },
        { name: 'طوسی مات', hex: '#a5a58d', available: false },
      ],
      volumes: ['۳۰۰ میلی‌لیتر', '۴۵۰ میلی‌لیتر'],
      likesCount: 318,
      isLiked: false,
      isSaved: true,
    },
    {
      id: 'p2',
      title: 'کارگاه سفالگری مقدماتی',
      sellerId: 'seller2',
      sellerName: 'استودیو نقش',
      sellerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
      price: 1250000,
      inStock: true,
      stockCount: 5,
      rating: 4.9,
      reviewCount: 42,
      images: [
        'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80',
      ],
      description: 'دوره جامع چرخ‌کاری و ساخت ظروف لعابی، شامل ۲ جلسه ۳ ساعته به همراه متریال و پخت رایگان آثار هنرجو.',
      colors: [],
      likesCount: 254,
      isLiked: true,
      isSaved: false,
    },
    {
      id: 'p3',
      title: 'کاسه سالادخوری دست‌ساز',
      sellerId: 'seller1',
      sellerName: 'خانه ماژور',
      sellerAvatar: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=300&q=80',
      price: 520000,
      inStock: true,
      stockCount: 12,
      rating: 4.7,
      reviewCount: 15,
      images: [
        'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=800&q=80',
      ],
      description: 'کاسه بزرگ با لبه نامنظم طبیعی و لعاب سفید شیری مناسب سرو سالاد و میوه.',
      colors: [{ name: 'سفید صدفی', hex: '#f8f9fa', available: true }],
      likesCount: 189,
      isLiked: false,
      isSaved: false,
    },
    {
      id: 'p4',
      title: 'ست دوعددی نمکدان سرامیکی',
      sellerId: 'seller1',
      sellerName: 'خانه ماژور',
      sellerAvatar: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=300&q=80',
      price: 340000,
      inStock: true,
      stockCount: 20,
      rating: 4.6,
      reviewCount: 9,
      images: [
        'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80',
      ],
      description: 'طراحی مینیمال با پایه‌های گرد و چوب‌پنبه طبیعی.',
      colors: [],
      likesCount: 95,
    },
    {
      id: 'p5',
      title: 'بشقاب پذیرایی دست‌ساز ۲۵ سانتی',
      sellerId: 'seller1',
      sellerName: 'خانه ماژور',
      sellerAvatar: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=300&q=80',
      price: 610000,
      inStock: true,
      stockCount: 14,
      rating: 4.9,
      reviewCount: 31,
      images: [
        'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=800&q=80',
      ],
      description: 'لعاب براق با رگه‌های خاکی طلایی.',
      colors: [],
      likesCount: 210,
    },
  ] as ProductEntity[],
  cart: {
    items: [
      {
        id: 'cart-1',
        productId: 'p1',
        title: 'ماگ سرامیکی زیتون',
        sellerName: 'خانه ماژور',
        sellerAvatar: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=300&q=80',
        price: 680000,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80',
        selectedColor: 'سبز زیتونی',
        selectedVolume: '۳۰۰ میلی‌لیتر',
        sellerNote: 'ارسال رایگان با پست پیشتاز',
      },
      {
        id: 'cart-2',
        productId: 'p2',
        title: 'کارگاه سفالگری مقدماتی',
        sellerName: 'استودیو نقش',
        sellerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
        price: 1250000,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=400&q=80',
        sellerNote: 'جلسه اول: شنبه ۱۰ صبح',
      },
    ] as CartItemEntity[],
    couponCode: '',
    discount: 0,
  },
  orders: [
    {
      id: 'ord-9271',
      orderNumber: '۹۲۷۱',
      createdAt: '۲۸ مهر ۱۴۰۳ • ۱۸:۴۲',
      status: 'in_transit' as const,
      trackingCode: '۳۸۲۷۱۰۰۲۹۴۸۱۹۰۲',
      shippingProvider: 'پست پیشتاز سراسری',
      customerName: 'سارا احمدی',
      customerPhone: '۰۹۱۲۳۴۵۶۷۸۹',
      shippingAddress: 'تهران، ستارخان، خیابان خسرو شمالی، کوچه توحید، پلاک ۲۴، واحد ۲',
      postalCode: '۱۴۵۲۶۹۸۳۲۱',
      items: [
        {
          id: 'item-1',
          productId: 'p1',
          title: 'ماگ سرامیکی زیتون',
          sellerName: 'خانه ماژور',
          sellerAvatar: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=300&q=80',
          price: 680000,
          quantity: 1,
          image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=300&q=80',
          selectedColor: 'سبز زیتونی',
          selectedVolume: '۳۰۰ میلی‌لیتر',
          sellerNote: 'ارسال با پست پیشتاز',
        },
        {
          id: 'item-2',
          productId: 'p2',
          title: 'کارگاه سفالگری مقدماتی',
          sellerName: 'استودیو نقش',
          sellerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
          price: 1250000,
          quantity: 1,
          image: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=300&q=80',
          sellerNote: 'شنبه ۱۰ صبح',
        },
      ],
      subtotal: 1930000,
      discount: 0,
      shippingFee: 0,
      total: 1930000,
      paymentMethod: 'درگاه اینترنتی شتاب',
    },
  ] as OrderEntity[],
  sellerAnalytics: {
    weeklySales: 12860000,
    growthPercent: 18.4,
    newOrdersCount: 24,
    pendingBalance: 5400000,
    chartPoints: [
      { day: 'شنبه', amount: 1400000 },
      { day: 'یکشنبه', amount: 2100000 },
      { day: 'دوشنبه', amount: 1850000 },
      { day: 'سه‌شنبه', amount: 3200000 },
      { day: 'چهارشنبه', amount: 2400000 },
      { day: 'پنج‌شنبه', amount: 1910000 },
      { day: 'امروز', amount: 12860000 },
    ],
    receivedOrders: [
      {
        id: 'ord-9350',
        orderNumber: '۹۳۵۰',
        customerName: 'سارینا رضایی',
        itemSummary: '۱ عدد ماگ سرامیکی زیتون',
        status: 'آماده بسته‌بندی',
        amount: 680000,
        timeAgo: '۲۰ دقیقه پیش',
      },
      {
        id: 'ord-9349',
        orderNumber: '۹۳۴۹',
        customerName: 'علی محمدی',
        itemSummary: 'ست بشقاب دست‌ساز',
        status: 'تحویل پست شد',
        amount: 1400000,
        timeAgo: '۲ ساعت پیش',
      },
      {
        id: 'ord-9348',
        orderNumber: '۹۳۴۸',
        customerName: 'مریم کبیری',
        itemSummary: 'کاسه سالادخوری',
        status: 'تکمیل‌شده',
        amount: 520000,
        timeAgo: '۵ ساعت پیش',
      },
    ],
  },
};

export class DataStore {
  private data: typeof INITIAL_DATA;

  constructor() {
    this.data = this.loadData();
  }

  private loadData(): typeof INITIAL_DATA {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Using in-memory initial data due to file read error:', e);
    }
    return JSON.parse(JSON.stringify(INITIAL_DATA));
  }

  private saveData() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Failed to persist data file:', e);
    }
  }

  public getRole(): 'buyer' | 'seller' {
    return this.data.currentRole;
  }

  public setRole(role: 'buyer' | 'seller') {
    this.data.currentRole = role;
    this.saveData();
    return this.getCurrentPersona();
  }

  public getCurrentPersona(): UserPersona {
    return this.data.personas[this.data.currentRole];
  }

  public getStories() {
    return this.data.stories;
  }

  public getProducts(category?: string) {
    return this.data.products;
  }

  public getProductById(id: string) {
    return this.data.products.find(p => p.id === id);
  }

  public toggleLike(productId: string) {
    const product = this.getProductById(productId);
    if (product) {
      product.isLiked = !product.isLiked;
      product.likesCount += product.isLiked ? 1 : -1;
      this.saveData();
      return product;
    }
    return null;
  }

  public toggleSave(productId: string) {
    const product = this.getProductById(productId);
    if (product) {
      product.isSaved = !product.isSaved;
      this.saveData();
      return product;
    }
    return null;
  }

  public getCart() {
    const subtotal = this.data.cart.items.reduce((s, it) => s + it.price * it.quantity, 0);
    const shippingFee = subtotal > 1000000 || subtotal === 0 ? 0 : 45000;
    const total = Math.max(0, subtotal - this.data.cart.discount + shippingFee);

    return {
      items: this.data.cart.items,
      couponCode: this.data.cart.couponCode,
      subtotal,
      discount: this.data.cart.discount,
      shippingFee,
      total,
      itemCount: this.data.cart.items.reduce((c, it) => c + it.quantity, 0),
    };
  }

  public addToCart(productId: string, selectedColor?: string, selectedVolume?: string) {
    const product = this.getProductById(productId);
    if (!product) return null;

    const existing = this.data.cart.items.find(
      it => it.productId === productId && it.selectedColor === selectedColor && it.selectedVolume === selectedVolume
    );

    if (existing) {
      existing.quantity += 1;
    } else {
      this.data.cart.items.push({
        id: `cart-${Date.now()}`,
        productId: product.id,
        title: product.title,
        sellerName: product.sellerName,
        sellerAvatar: product.sellerAvatar,
        price: product.price,
        quantity: 1,
        image: product.images[0],
        selectedColor,
        selectedVolume,
        sellerNote: 'آماده ارسال با پست پیشتاز',
      });
    }

    this.saveData();
    return this.getCart();
  }

  public updateCartItemQuantity(cartItemId: string, delta: number) {
    const index = this.data.cart.items.findIndex(it => it.id === cartItemId);
    if (index !== -1) {
      const item = this.data.cart.items[index];
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        this.data.cart.items.splice(index, 1);
      } else {
        item.quantity = newQty;
      }
      this.saveData();
    }
    return this.getCart();
  }

  public removeCartItem(cartItemId: string) {
    this.data.cart.items = this.data.cart.items.filter(it => it.id !== cartItemId);
    this.saveData();
    return this.getCart();
  }

  public applyCoupon(code: string) {
    const normalized = code.trim().toUpperCase();
    if (normalized === 'QOOQNOS' || normalized === 'FIGMA') {
      const subtotal = this.data.cart.items.reduce((s, it) => s + it.price * it.quantity, 0);
      this.data.cart.couponCode = normalized;
      this.data.cart.discount = Math.round(subtotal * 0.1);
      this.saveData();
      return { success: true, cart: this.getCart() };
    }
    return { success: false, error: 'کد تخفیف نامعتبر است (کد QOOQNOS را تست کنید)' };
  }

  public createOrder(details: {
    customerName: string;
    customerPhone: string;
    shippingAddress: string;
    postalCode: string;
    paymentMethod: string;
    shippingProvider: string;
  }): OrderEntity {
    const cart = this.getCart();
    const orderNum = Math.floor(1000 + Math.random() * 9000).toString();
    const randomTracking = '۳۸۲' + Math.floor(100000000000 + Math.random() * 900000000000).toString();

    const newOrder: OrderEntity = {
      id: `ord-${Date.now()}`,
      orderNumber: orderNum,
      createdAt: 'امروز • ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      status: 'in_transit',
      trackingCode: randomTracking,
      shippingProvider: details.shippingProvider || 'پست پیشتاز سراسری',
      customerName: details.customerName || this.getCurrentPersona().name,
      customerPhone: details.customerPhone || this.getCurrentPersona().phone,
      shippingAddress: details.shippingAddress || this.getCurrentPersona().address,
      postalCode: details.postalCode || '۱۴۵۲۶۹۸۳۲۱',
      items: [...this.data.cart.items],
      subtotal: cart.subtotal,
      discount: cart.discount,
      shippingFee: cart.shippingFee,
      total: cart.total,
      paymentMethod: details.paymentMethod || 'درگاه اینترنتی شتاب',
    };

    this.data.orders.unshift(newOrder);

    // Add to seller dashboard received orders
    this.data.sellerAnalytics.newOrdersCount += 1;
    this.data.sellerAnalytics.weeklySales += cart.total;
    this.data.sellerAnalytics.receivedOrders.unshift({
      id: newOrder.id,
      orderNumber: newOrder.orderNumber,
      customerName: newOrder.customerName,
      itemSummary: newOrder.items.map(i => i.title).join(' + '),
      status: 'آماده بسته‌بندی',
      amount: newOrder.total,
      timeAgo: 'چند لحظه پیش',
    });

    // Clear cart
    this.data.cart.items = [];
    this.data.cart.couponCode = '';
    this.data.cart.discount = 0;

    this.saveData();
    return newOrder;
  }

  public getOrders() {
    return this.data.orders;
  }

  public getOrderById(id: string) {
    return this.data.orders.find(o => o.id === id || o.orderNumber === id);
  }

  public getSellerAnalytics() {
    return this.data.sellerAnalytics;
  }

  public updateSellerOrderStatus(orderId: string, newStatus: string) {
    const order = this.data.sellerAnalytics.receivedOrders.find(o => o.id === orderId || o.orderNumber === orderId);
    if (order) {
      order.status = newStatus;
      this.saveData();
      return order;
    }
    return null;
  }
}

export const store = new DataStore();
