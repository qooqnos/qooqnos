import React, { useState, useEffect } from 'react';
import { 
  Package, 
  DollarSign, 
  Settings, 
  ArrowUpRight, 
  Check, 
  Loader2 
} from 'lucide-react';
import { api, SellerAnalyticsResponse } from '../../services/api';
import { ScreenId } from '../../types/qooqnos';
import { formatToman } from '../../data/mockData';

interface SellerStudioScreenProps {
  onNavigate: (screen: ScreenId) => void;
}

export const SellerStudioScreen: React.FC<SellerStudioScreenProps> = ({
  onNavigate,
}) => {
  const [analytics, setAnalytics] = useState<SellerAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month'>('week');

  const loadAnalytics = async () => {
    try {
      const data = await api.getSellerAnalytics();
      setAnalytics(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load seller analytics:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const handleUpdateStatus = async (orderId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'آماده بسته‌بندی' ? 'تحویل پست شد' : 'تکمیل‌شده';
    try {
      await api.updateSellerOrderStatus(orderId, nextStatus);
      await loadAnalytics();
    } catch (err) {
      console.error('Failed to update seller order status:', err);
    }
  };

  if (loading || !analytics) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs">در حال بارگذاری داشبورد فروشگاه...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto p-4 space-y-4">
      {/* Total Sales Overview - Matches Figma Screen 8 */}
      <div className="p-4 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>نمای کلی فروش غرفه (خانه ماژور)</span>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px]">
            <button
              onClick={() => setSelectedPeriod('week')}
              className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                selectedPeriod === 'week' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              هفتگی
            </button>
            <button
              onClick={() => setSelectedPeriod('month')}
              className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                selectedPeriod === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              ماهانه
            </button>
          </div>
        </div>

        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-2xl font-black text-slate-900">{formatToman(analytics.weeklySales)}</div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold mt-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+{analytics.growthPercent}٪ نسبت به دوره قبل</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400">سفارش‌ها:</span>
            <div className="text-base font-black text-slate-800">{analytics.newOrdersCount} سفارش</div>
          </div>
        </div>

        {/* Sales Chart Curve - Clean SVG Line with gradient under-area matching Figma */}
        <div className="h-28 w-full pt-2">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 300 90">
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {/* Area */}
            <path
              d="M 0,75 Q 40,80 75,55 T 150,45 T 225,25 T 300,10 L 300,90 L 0,90 Z"
              fill="url(#salesGrad)"
            />
            {/* Stroke */}
            <path
              d="M 0,75 Q 40,80 75,55 T 150,45 T 225,25 T 300,10"
              fill="none"
              stroke="#2563eb"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Dots */}
            <circle cx="75" cy="55" r="4" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
            <circle cx="150" cy="45" r="4" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
            <circle cx="225" cy="25" r="4" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
            <circle cx="300" cy="10" r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
          </svg>
          <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-1">
            <span>شنبه</span>
            <span>دوشنبه</span>
            <span>چهارشنبه</span>
            <span>امروز</span>
          </div>
        </div>
      </div>

      {/* Quick Action Cards - Matches Figma */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div 
          onClick={() => onNavigate('store')}
          className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-blue-500 transition-colors"
        >
          <Package className="w-5 h-5 text-blue-600" />
          <span className="font-bold text-slate-800 text-[11px]">مدیریت کالاها</span>
          <span className="text-[10px] text-slate-400">۸۶ محصول</span>
        </div>

        <div className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-blue-500 transition-colors">
          <DollarSign className="w-5 h-5 text-emerald-600" />
          <span className="font-bold text-slate-800 text-[11px]">تسویه‌حساب</span>
          <span className="text-[10px] text-emerald-600 font-bold">{formatToman(analytics.pendingBalance)}</span>
        </div>

        <div className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-blue-500 transition-colors">
          <Settings className="w-5 h-5 text-slate-600" />
          <span className="font-bold text-slate-800 text-[11px]">تنظیمات غرفه</span>
          <span className="text-[10px] text-slate-400">ویرایش</span>
        </div>
      </div>

      {/* Recent Received Orders - Matches Figma with Status Update */}
      <div className="p-4 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
          <span>آخرین سفارش‌های دریافتی</span>
          <span className="text-blue-600 font-normal text-[11px]">تعداد ({analytics.receivedOrders.length})</span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {analytics.receivedOrders.map((rec) => (
            <div key={rec.id} className="py-2.5 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900">{rec.customerName}</div>
                <div className="text-[11px] text-slate-400">سفارش #{rec.orderNumber} • {rec.itemSummary}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{rec.timeAgo}</div>
              </div>
              <div className="text-left flex flex-col items-end gap-1">
                <button
                  onClick={() => handleUpdateStatus(rec.id, rec.status)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                    rec.status === 'آماده بسته‌بندی'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                      : rec.status === 'تحویل پست شد'
                      ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                  title="کلیک برای تغییر وضعیت"
                >
                  {rec.status}
                </button>
                <div className="text-[11px] font-bold text-slate-800">{formatToman(rec.amount)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
