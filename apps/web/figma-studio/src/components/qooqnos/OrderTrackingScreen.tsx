import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Truck, 
  MapPin, 
  FileText, 
  Copy, 
  Check, 
  Loader2 
} from 'lucide-react';
import { api, OrderResponse } from '../../services/api';
import { ScreenId } from '../../types/qooqnos';
import { formatToman } from '../../data/mockData';

interface OrderTrackingScreenProps {
  orderId?: string;
  onNavigate: (screen: ScreenId) => void;
}

export const OrderTrackingScreen: React.FC<OrderTrackingScreenProps> = ({
  orderId,
  onNavigate,
}) => {
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadOrder() {
      try {
        let fetched: OrderResponse | null = null;
        if (orderId) {
          fetched = await api.getOrderById(orderId);
        } else {
          const orders = await api.getOrders();
          if (orders.length > 0) fetched = orders[0];
        }
        if (isMounted) {
          setOrder(fetched);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load order:', err);
        if (isMounted) setLoading(false);
      }
    }
    loadOrder();
    return () => { isMounted = false; };
  }, [orderId]);

  const copyTracking = () => {
    if (!order) return;
    navigator.clipboard.writeText(order.trackingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !order) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs">در حال دریافت وضعیت سفارش...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto p-4 space-y-4">
      {/* Order Header Card */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-mono">شناسه: #{order.orderNumber}</span>
            <h2 className="text-base font-black text-slate-900 mt-0.5">سفارش شماره {order.orderNumber}</h2>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            پرداخت موفق
          </span>
        </div>
        <p className="text-xs text-slate-500">
          ثبت شده در {order.createdAt}
        </p>
      </div>

      {/* Real-time Status Card - Matches Figma Screen */}
      <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-md space-y-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
            <Truck className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="text-sm font-bold">بسته شما در مسیر ارسال است</div>
            <div className="text-[11px] text-blue-100">تحویل فردا بین ساعت ۱۴ تا ۱۸</div>
          </div>
        </div>
        
        {/* Progress Timeline Stepper */}
        <div className="pt-3 border-t border-white/20">
          <div className="flex items-center justify-between text-[11px] font-medium text-blue-100 relative">
            <div className="flex flex-col items-center gap-1 z-10">
              <span className="w-5 h-5 rounded-full bg-white text-blue-700 flex items-center justify-center text-[10px] font-bold">✓</span>
              <span>ثبت</span>
            </div>
            <div className="flex-1 h-0.5 bg-white/60 -mt-4"></div>
            <div className="flex flex-col items-center gap-1 z-10">
              <span className="w-5 h-5 rounded-full bg-white text-blue-700 flex items-center justify-center text-[10px] font-bold">✓</span>
              <span>آماده‌سازی</span>
            </div>
            <div className="flex-1 h-0.5 bg-white/60 -mt-4"></div>
            <div className="flex flex-col items-center gap-1 z-10">
              <span className="w-5 h-5 rounded-full bg-white text-blue-700 flex items-center justify-center text-[10px] font-bold">✓</span>
              <span>تحویل پست</span>
            </div>
            <div className="flex-1 h-0.5 bg-white/30 -mt-4"></div>
            <div className="flex flex-col items-center gap-1 z-10 text-white font-bold">
              <span className="w-5 h-5 rounded-full bg-blue-300 text-blue-900 flex items-center justify-center text-[10px] animate-pulse">●</span>
              <span>در مسیر</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ordered Items List */}
      <div className="space-y-3">
        {order.items.map((item, index) => (
          <div key={item.id || index} className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">بسته {index + 1}: {item.sellerName}</span>
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                ارسال با پست پیشتاز
              </span>
            </div>

            <div className="flex items-center gap-3">
              <img
                src={item.image}
                alt={item.title}
                className="w-16 h-16 rounded-xl object-cover border border-slate-200"
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {item.selectedColor ? `رنگ: ${item.selectedColor}` : ''}
                  {item.selectedColor && item.selectedVolume ? ' • ' : ''}
                  {item.selectedVolume || ''}
                </p>
                <div className="text-xs font-black text-slate-900 mt-1">{formatToman(item.price)}</div>
              </div>
            </div>

            {index === 0 && (
              <div className="p-2.5 bg-slate-50 rounded-xl text-[11px] text-slate-600 flex items-center justify-between font-mono">
                <span>کد رهگیری پست: {order.trackingCode}</span>
                <button onClick={copyTracking} className="text-blue-600 font-sans hover:underline flex items-center gap-1">
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'کپی شد' : 'کپی'}</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Shipping address & payment summary */}
      <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-sm space-y-2 text-xs text-slate-600">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-800 block">نشانی تحویل ({order.customerName}):</span>
            <span>{order.shippingAddress}</span>
          </div>
        </div>
        <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-slate-900">
          <span>مبلغ پرداخت شده ({order.paymentMethod}):</span>
          <span className="text-blue-600">{formatToman(order.total)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button 
          onClick={() => alert(`فاکتور الکترونیکی سفارش #${order.orderNumber} با موفقیت آماده دانلود شد.`)}
          className="py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
        >
          <FileText className="w-4 h-4" />
          <span>دریافت فاکتور</span>
        </button>
        <button 
          onClick={() => onNavigate('feed')}
          className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition-transform active:scale-95"
        >
          <span>بازگشت به ویترین</span>
        </button>
      </div>
    </div>
  );
};
