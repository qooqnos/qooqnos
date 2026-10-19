import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  Plus, 
  Minus, 
  Tag, 
  Store, 
  ArrowLeft,
  Loader2,
  Check
} from 'lucide-react';
import { api, CartResponse } from '../../services/api';
import { ScreenId } from '../../types/qooqnos';
import { formatToman, toPersianDigits } from '../../data/mockData';

interface CartScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onCartChange?: () => void;
}

export const CartScreen: React.FC<CartScreenProps> = ({
  onNavigate,
  onCartChange,
}) => {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponSuccess, setCouponSuccess] = useState(false);
  const [couponError, setCouponError] = useState('');

  const loadCart = async () => {
    try {
      const data = await api.getCart();
      setCart(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load cart:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCart();
  }, []);

  const handleUpdateQuantity = async (id: string, delta: number) => {
    try {
      const updated = await api.updateQuantity(id, delta);
      setCart(updated);
      if (onCartChange) onCartChange();
    } catch (err) {
      console.error('Failed to update quantity:', err);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const updated = await api.removeItem(id);
      setCart(updated);
      if (onCartChange) onCartChange();
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    setCouponLoading(true);
    setCouponError('');
    setCouponSuccess(false);

    try {
      const res = await api.applyCoupon(couponCode);
      if (res.success) {
        setCart(res.cart);
        setCouponSuccess(true);
        if (onCartChange) onCartChange();
      }
    } catch (err: any) {
      setCouponError(err.message || 'کد تخفیف نامعتبر است');
    } finally {
      setCouponLoading(false);
    }
  };

  if (loading || !cart) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs">در حال دریافت سبد خرید...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto flex flex-col justify-between">
      <div className="p-4 space-y-4">
        {/* Subtitle count */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
          <span>{toPersianDigits(cart.itemCount)} مورد در سبد خرید شما</span>
          <span className="text-blue-600 cursor-pointer" onClick={() => onNavigate('feed')}>
            افزودن محصولات بیشتر
          </span>
        </div>

        {cart.items.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Store className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">سبد خرید شما خالی است</h3>
            <p className="text-xs text-slate-400">از ویترین ققنوس دیدن کنید و آثار دست‌ساز را انتخاب کنید.</p>
            <button
              onClick={() => onNavigate('feed')}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow transition-transform active:scale-95"
            >
              بازگشت به ویترین
            </button>
          </div>
        ) : (
          <>
            {/* List of items */}
            <div className="space-y-3">
              {cart.items.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-3"
                >
                  {/* Seller Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <img
                        src={item.sellerAvatar}
                        alt={item.sellerName}
                        className="w-5 h-5 rounded-full object-cover"
                      />
                      <span className="text-xs font-bold text-slate-800">{item.sellerName}</span>
                    </div>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                      title="حذف از سبد"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Product row */}
                  <div className="flex items-start gap-3">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-20 h-20 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{item.title}</h4>
                      
                      {(item.selectedColor || item.selectedVolume) && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {item.selectedColor && `رنگ: ${item.selectedColor}`}
                          {item.selectedColor && item.selectedVolume && ' • '}
                          {item.selectedVolume}
                        </p>
                      )}

                      <div className="mt-2 text-xs font-black text-slate-900">
                        {formatToman(item.price)}
                      </div>
                    </div>
                  </div>

                  {/* Quantity Stepper & Seller Note */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[10px] text-emerald-600 font-medium">
                      {item.sellerNote || 'آماده ارسال'}
                    </div>

                    <div className="flex items-center gap-3 bg-slate-100 rounded-xl px-2.5 py-1">
                      <button
                        onClick={() => handleUpdateQuantity(item.id, 1)}
                        className="w-6 h-6 rounded-lg bg-white shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold text-slate-800 font-mono w-4 text-center">
                        {toPersianDigits(item.quantity)}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(item.id, -1)}
                        className="w-6 h-6 rounded-lg bg-white shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-50"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Discount Code input */}
            <form onSubmit={handleApplyCoupon} className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="کد تخفیف (کد QOOQNOS برای ۱۰٪ تخفیف)"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  disabled={couponLoading}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors shrink-0 flex items-center gap-1"
                >
                  {couponLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>اعمال</span>
                </button>
              </div>
              {couponSuccess && (
                <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>کد تخفیف با موفقیت اعمال شد!</span>
                </p>
              )}
              {couponError && (
                <p className="text-[11px] text-rose-500 font-medium">{couponError}</p>
              )}
            </form>

            {/* Price breakdown summary */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>جمع اقلام سبد:</span>
                <span className="font-bold text-slate-800">{formatToman(cart.subtotal)}</span>
              </div>
              {cart.discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>تخفیف کوپن:</span>
                  <span className="font-bold">- {formatToman(cart.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>هزینه بسته‌بندی و ارسال:</span>
                <span className={cart.shippingFee === 0 ? 'text-emerald-600 font-bold' : 'font-bold text-slate-800'}>
                  {cart.shippingFee === 0 ? 'رایگان (خرید بالای ۱ میلیون)' : formatToman(cart.shippingFee)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between text-sm font-black text-slate-900">
                <span>مبلغ قابل پرداخت:</span>
                <span className="text-blue-600">{formatToman(cart.total)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sticky Bottom Bar */}
      {cart.items.length > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex items-center justify-between gap-4 z-20 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div>
            <span className="text-[10px] text-slate-400 block">مبلغ نهایی:</span>
            <span className="text-base font-black text-slate-900">{formatToman(cart.total)}</span>
          </div>

          <button
            onClick={() => onNavigate('checkout')}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/30 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <span>ادامه و ثبت سفارش</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
