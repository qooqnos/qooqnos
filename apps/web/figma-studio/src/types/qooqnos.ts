export type ScreenId = 
  | 'feed'             // ۱. ویترین
  | 'product-detail'   // ۲. جزئیات کالا
  | 'cart'             // ۳. سبد خرید
  | 'checkout'         // ۴. تکمیل خرید
  | 'order-tracking'   // ۵. پیگیری سفارش
  | 'profile'          // ۶. پروفایل کاربر
  | 'store'            // ۷. صفحه غرفه
  | 'seller-studio';   // ۸. مدیریت فروشگاه

export interface Product {
  id: string;
  title: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  inStock: boolean;
  stockCount?: number;
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

export interface CartItem {
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

export interface Story {
  id: string;
  sellerName: string;
  avatar: string;
  hasUnseen: boolean;
}
