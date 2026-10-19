import React, { useState, useEffect } from 'react';
import { 
  User, 
  MapPin, 
  Package, 
  Heart, 
  CreditCard, 
  ChevronLeft, 
  HelpCircle, 
  LogOut,
  Edit3,
  Clock,
  CheckCircle,
  Truck,
  Loader2
} from 'lucide-react';
import { api, UserPersona, OrderResponse } from '../../services/api';
import { ScreenId } from '../../types/qooqnos';
import { formatToman } from '../../data/mockData';

interface ProfileScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onSwitchRole?: (role: 'buyer' | 'seller') => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onNavigate,
  onSwitchRole,
}) => {
  const [persona, setPersona] = useState<UserPersona | null>(null);
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      try {
        const [userData, ordersData] = await Promise.all([
          api.getCurrentUser(),
          api.getOrders(),
        ]);
        if (isMounted) {
          setPersona(userData.persona);
          setOrders(ordersData);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        if (isMounted) setLoading(false);
      }
    }
    loadProfile();
    return () => { isMounted = false; };
  }, []);

  if (loading || !persona) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs">در حال بارگذاری اطلاعات حساب...</span>
        </div>
      </div>
    );
  }

  const latestOrder = orders.length > 0 ? orders[0] : null;

  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto p-4 space-y-4">
      {/* Profile Header */}
      <div className="p-4 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={persona.avatar}
              alt={persona.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-blue-600"
            />
            <button className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] shadow">
              <Edit3 className="w-3 h-3" />
            </button>
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">{persona.name}</h2>
            <p className="text-xs text-slate-400 font-mono">{persona.phone}</p>
            <div className="text-[11px] text-slate-500 mt-1">{persona.city} • عضو فعال ققنوس</div>
          </div>
        </div>

        {/* 3 Stats from Figma */}
        <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-100 border-y border-slate-100 py-3 text-center">
          <div>
            <div className="text-base font-black text-slate-900">{orders.length || persona.stats.ordersCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">سفارش ثبت‌شده</div>
          </div>
          <div>
            <div className="text-base font-black text-slate-900">{persona.stats.badgesCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">نشان‌ها</div>
          </div>
          <div>
            <div className="text-base font-black text-slate-900">{persona.stats.savedCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">ذخیره‌شده</div>
          </div>
        </div>

        {/* Profile Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button className="py-2 px-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors">
            ویرایش پروفایل
          </button>
          <button 
            onClick={() => {
              if (onSwitchRole) onSwitchRole('seller');
              onNavigate('seller-studio');
            }}
            className="py-2 px-3 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
          >
            پنل فروشندگی (غرفه)
          </button>
        </div>
      </div>

      {/* Orders Status Matrix */}
      <div className="p-4 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
          <span>خریدهای من</span>
          <button 
            onClick={() => onNavigate('order-tracking')}
            className="text-blue-600 font-normal hover:underline text-[11px]"
          >
            مشاهده همه ({orders.length})
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center text-[10px] text-slate-600">
          <div className="p-2.5 rounded-xl bg-slate-50 flex flex-col items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>پرداخت‌شده (۱)</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 flex flex-col items-center gap-1.5">
            <Package className="w-4 h-4 text-blue-500" />
            <span>آماده‌سازی (۲)</span>
          </div>
          <div 
            onClick={() => onNavigate('order-tracking')}
            className="p-2.5 rounded-xl bg-blue-50 text-blue-700 cursor-pointer flex flex-col items-center gap-1.5 font-bold"
          >
            <Truck className="w-4 h-4 text-blue-600" />
            <span>در مسیر ({orders.length > 0 ? 1 : 0})</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 flex flex-col items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span>تحویل‌شده (۸)</span>
          </div>
        </div>

        {/* Recent order preview snippet */}
        {latestOrder && (
          <div 
            onClick={() => onNavigate('order-tracking')}
            className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-colors"
          >
            <div className="flex items-center gap-3">
              <img
                src={latestOrder.items[0]?.image || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=150&q=80'}
                alt="سفارش اخیر"
                className="w-10 h-10 rounded-xl object-cover border border-slate-200"
              />
              <div>
                <div className="text-xs font-bold text-slate-900">سفارش #{latestOrder.orderNumber} ({latestOrder.items.length} قلم کالا)</div>
                <div className="text-[10px] text-emerald-600 font-medium">بسته در مسیر تحویل • {latestOrder.shippingProvider}</div>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          </div>
        )}
      </div>

      {/* Account Settings Menu List */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm divide-y divide-slate-100 overflow-hidden text-xs text-slate-700">
        <button className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 text-right">
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span>نشانی‌های من (ستارخان، تهران)</span>
          </div>
          <ChevronLeft className="w-4 h-4 text-slate-400" />
        </button>

        <button className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 text-right">
          <div className="flex items-center gap-3">
            <Heart className="w-4 h-4 text-slate-400" />
            <span>لیست علاقه‌مندی‌ها و نشان‌شده‌ها</span>
          </div>
          <ChevronLeft className="w-4 h-4 text-slate-400" />
        </button>

        <button className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 text-right">
          <div className="flex items-center gap-3">
            <CreditCard className="w-4 h-4 text-slate-400" />
            <span>کیف پول و کارت‌های متصل</span>
          </div>
          <span className="text-[11px] font-bold text-emerald-600">{formatToman(persona.walletBalance)}</span>
        </button>

        <button className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 text-right">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span>پشتیبانی و سوالات متداول ققنوس</span>
          </div>
          <ChevronLeft className="w-4 h-4 text-slate-400" />
        </button>

        <button className="w-full p-3.5 flex items-center justify-between hover:bg-rose-50 text-right text-rose-600">
          <div className="flex items-center gap-3">
            <LogOut className="w-4 h-4 text-rose-500" />
            <span>خروج از حساب کاربری</span>
          </div>
        </button>
      </div>
    </div>
  );
};
