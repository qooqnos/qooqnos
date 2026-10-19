import { Product, CartItem, Story } from '../types/qooqnos';

export const STORIES_DATA: Story[] = [
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
];

export const PRODUCTS_DATA: Product[] = [
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
    rating: 4.9,
    reviewCount: 31,
    images: [
      'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=800&q=80',
    ],
    description: 'لعاب براق با رگه‌های خاکی طلایی.',
    colors: [],
    likesCount: 210,
  },
];

export const INITIAL_CART_ITEMS: CartItem[] = [
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
    sellerNote: 'ارسال رایگان پست پیشتاز',
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
];

export function formatToman(amount: number): string {
  return new Intl.NumberFormat('fa-IR').format(amount) + ' تومان';
}

export function toPersianDigits(n: number | string): string {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return n.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x, 10)]);
}
