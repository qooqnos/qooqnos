import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  MapPin, 
  CreditCard, 
  ShieldCheck, 
  Truck, 
  Check,
  Building2,
  Clock,
  Loader2
} from 'lucide-react';
import { api, CartResponse } from '../../services/api';
import { ScreenId } from '../../types/qooqnos';
import { formatToman } from '../../data/mockData';

interface CheckoutScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onOrderCreated: (orderId: string) => void;
}

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({
  onNavigate,
  onOrderCreated,
}) => {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<'gateway' | 'wallet'>('gateway');
  const [selectedShipping, setSelectedShipping] = useState<'pishtaz' | 'express'>('pishtaz');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    async function loadCheckoutData() {
      try {
        const cartData = await api.getCart();
        setCart(cartData);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load cart for checkout:', err);
        setLoading(false);
      }
    }
    loadCheckoutData();
  }, []);

  const handlePayAndSubmit = async () => {
    setIsProcessing(true);
    try {
      const order = await api.createOrder({
        customerName: 'سارا احمدی',
        customerPhone: '۰۹۱۲۳۴۵۶۷۸۹',
        shippingAddress: 'تهران، ستارخان، خیابان خسرو شمالی، کوچه توحید، پلاک ۲۴، واحد ۲',
        postalCode: '۱۴۵۲۶۹۸۳۲۱',
        paymentMethod: selectedPayment === 'gateway' ? 'درگاه اینترنتی شتاب (بانک سامان)' : 'کیف پول ققنوس',
        shippingProvider: selectedShipping === 'pishtaz' ? 'پست پیشتاز سراسری' : 'پیک اختصاصی تهران',
      });
      onOrderCreated(order.id);
      onNavigate('order-tracking');
    } catch (err) {
      console.error('Failed to submit order:', err);
      alert('خطا در ثبت سفارش. لطفاً دوباره تلاش کنید.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading || !cart) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs">در حال بارگذاری فرم تسویه‌حساب...</span>
        </div>
      </div>
    );
  }

  const shippingCost = selectedShipping === 'express' ? 65000 : cart.shippingFee;
  const grandTotal = cart.subtotal - cart.discount + shippingCost;

  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto flex flex-col justify-between">
      <div className="p-4 space-y-4">
        {/* Step progress */}
        <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-blue-600 font-bold">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">۱</span>
            <span>مشخصات</span>
          </div>
          <div className="w-8 h-0.5 bg-blue-600"></div>
          <div className="flex items-center gap-1.5 text-blue-600 font-bold">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">۲</span>
            <span>نشانی</span>
          </div>
          <div className="w-8 h-0.5 bg-blue-600"></div>
          <div className="flex items-center gap-1.5 text-blue-600 font-bold">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">۳</span>
            <span>پرداخت</span>
          </div>
        </div>

        {/* Customer Information */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <span>مشخصات خریدار</span>
            <span className="text-emerald-600 text-[11px] font-semibold">تأیید هویت شده</span>
          </div>
          <div className="text-xs text-slate-600 leading-relaxed">
            <p className="font-semibold text-slate-900">سارا احمدی</p>
            <p className="font-mono text-slate-500 text-[11px] mt-0.5">۰۹۱۲۳۴۵۶۷۸۹</p>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>نشانی دریافت کالا</span>
            </div>
            <button className="text-blue-600 font-normal hover:underline text-[11px]">تغییر نشانی</button>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            تهران، ستارخان، خیابان خسرو شمالی، کوچه توحید، پلاک ۲۴، واحد ۲
          </p>
          <div className="text-[10px] text-slate-400 font-mono">
            کد پستی: ۱۴۵۲۶۹۸۳۲۱
          </div>
        </div>

        {/* Delivery Options */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-sm space-y-2.5">
          <span className="text-xs font-bold text-slate-800 block">ارسال و دریافت سفارش</span>
          
          <div 
            onClick={() => setSelectedShipping('pishtaz')}
            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
              selectedShipping === 'pishtaz' ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600/30' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Truck className="w-4 h-4 text-blue-600" />
              <div>
                <div className="text-xs font-bold text-slate-900">پست پیشتاز سراسری</div>
                <div className="text-[10px] text-slate-500">تحویل ۲ الی ۳ روز کاری</div>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-600">
              {cart.shippingFee === 0 ? 'رایگان' : formatToman(cart.shippingFee)}
            </span>
          </div>

          <div 
            onClick={() => setSelectedShipping('express')}
            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
              selectedShipping === 'express' ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600/30' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-600" />
              <div>
                <div className="text-xs font-bold text-slate-900">پیک اختصاصی (تهران)</div>
                <div className="text-[10px] text-slate-500">تحویل فوری عصر امروز</div>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-700">۶۵,۰۰۰ تومان</span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-sm space-y-2.5">
          <span className="text-xs font-bold text-slate-800 block">روش پرداخت</span>

          {/* Gateway */}
          <div
            onClick={() => setSelectedPayment('gateway')}
            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
              selectedPayment === 'gateway' ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-600' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <div>
                <div className="text-xs font-bold text-slate-900">پرداخت اینترنتی شتاب</div>
                <div className="text-[10px] text-slate-500">تمامی کارت‌های بانکی عضو شاپرک</div>
              </div>
            </div>
            {selectedPayment === 'gateway' && (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                <Check className="w-3 h-3" />
              </span>
            )}
          </div>

          {/* Wallet */}
          <div
            onClick={() => setSelectedPayment('wallet')}
            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
              selectedPayment === 'wallet' ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-600' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <div>
                <div className="text-xs font-bold text-slate-900">کیف پول ققنوس</div>
                <div className="text-[10px] text-slate-500">موجودی: ۲۵۰,۰۰۰ تومان</div>
              </div>
            </div>
            {selectedPayment === 'wallet' && (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                <Check className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Payment Button */}
      <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex items-center justify-between gap-4 z-20 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div>
          <span className="text-[10px] text-slate-400 block">مبلغ نهایی پرداخت:</span>
          <span className="text-base font-black text-slate-900">
            {formatToman(grandTotal)}
          </span>
        </div>

        <button
          onClick={handlePayAndSubmit}
          disabled={isProcessing}
          className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm shadow-md shadow-blue-600/30 transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          {isProcessing ? (
            <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              <span>پرداخت و ثبت سفارش</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
