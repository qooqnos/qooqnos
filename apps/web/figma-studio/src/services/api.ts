import { Product, CartItem, Story, ScreenId } from '../types/qooqnos';

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

export interface CartResponse {
  items: CartItem[];
  couponCode: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  itemCount: number;
}

export interface OrderResponse {
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
  items: CartItem[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  paymentMethod: string;
}

export interface SellerAnalyticsResponse {
  weeklySales: number;
  growthPercent: number;
  newOrdersCount: number;
  pendingBalance: number;
  chartPoints: { day: string; amount: number }[];
  receivedOrders: {
    id: string;
    orderNumber: string;
    customerName: string;
    itemSummary: string;
    status: string;
    amount: number;
    timeAgo: string;
  }[];
}

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`/api${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      let errorMsg = `خطای سرور (${res.status})`;
      try {
        const body = await res.json();
        if (body.error) errorMsg = body.error;
      } catch {
        // fallback
      }
      throw new Error(errorMsg);
    }

    return res.json() as Promise<T>;
  }

  // Auth & Persona
  async getCurrentUser(): Promise<{ persona: UserPersona; currentRole: 'buyer' | 'seller' }> {
    return this.request('/auth/current-user');
  }

  async switchRole(role: 'buyer' | 'seller'): Promise<{ persona: UserPersona; currentRole: 'buyer' | 'seller' }> {
    return this.request('/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  }

  // Stories
  async getStories(): Promise<Story[]> {
    const data = await this.request<{ stories: Story[] }>('/stories');
    return data.stories;
  }

  // Products
  async getProducts(category?: string): Promise<Product[]> {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    const data = await this.request<{ products: Product[] }>(`/products${query}`);
    return data.products;
  }

  async getProductById(id: string): Promise<Product> {
    const data = await this.request<{ product: Product }>(`/products/${id}`);
    return data.product;
  }

  async toggleLike(id: string): Promise<{ product: Product; isLiked: boolean; likesCount: number }> {
    return this.request(`/products/${id}/like`, { method: 'POST' });
  }

  async toggleSave(id: string): Promise<{ product: Product; isSaved: boolean }> {
    return this.request(`/products/${id}/save`, { method: 'POST' });
  }

  // Cart
  async getCart(): Promise<CartResponse> {
    return this.request('/cart');
  }

  async addToCart(productId: string, selectedColor?: string, selectedVolume?: string): Promise<CartResponse> {
    const data = await this.request<{ success: boolean; cart: CartResponse }>('/cart/items', {
      method: 'POST',
      body: JSON.stringify({ productId, selectedColor, selectedVolume }),
    });
    return data.cart;
  }

  async updateQuantity(cartItemId: string, delta: number): Promise<CartResponse> {
    const data = await this.request<{ success: boolean; cart: CartResponse }>(`/cart/items/${cartItemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ delta }),
    });
    return data.cart;
  }

  async removeItem(cartItemId: string): Promise<CartResponse> {
    const data = await this.request<{ success: boolean; cart: CartResponse }>(`/cart/items/${cartItemId}`, {
      method: 'DELETE',
    });
    return data.cart;
  }

  async applyCoupon(code: string): Promise<{ success: boolean; cart: CartResponse }> {
    return this.request('/cart/coupon', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  // Orders
  async createOrder(orderData: {
    customerName: string;
    customerPhone: string;
    shippingAddress: string;
    postalCode: string;
    paymentMethod: string;
    shippingProvider: string;
  }): Promise<OrderResponse> {
    const data = await this.request<{ success: boolean; order: OrderResponse }>('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
    return data.order;
  }

  async getOrders(): Promise<OrderResponse[]> {
    const data = await this.request<{ orders: OrderResponse[] }>('/orders');
    return data.orders;
  }

  async getOrderById(id: string): Promise<OrderResponse> {
    const data = await this.request<{ order: OrderResponse }>(`/orders/${id}`);
    return data.order;
  }

  // Seller Studio
  async getSellerAnalytics(): Promise<SellerAnalyticsResponse> {
    return this.request('/seller/analytics');
  }

  async updateSellerOrderStatus(id: string, status: string) {
    return this.request(`/seller/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }
}

export const api = new ApiService();
