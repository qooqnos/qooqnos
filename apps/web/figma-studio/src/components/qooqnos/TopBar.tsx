import React from 'react';
import { Wifi, Battery, Signal, ArrowRight, Bookmark, Share2, Heart, Search, Bell, MoreVertical } from 'lucide-react';
import { ScreenId } from '../../types/qooqnos';

interface TopBarProps {
  activeScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  title?: string;
  cartCount?: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeScreen,
  onNavigate,
  title,
  cartCount = 0,
}) => {
  return (
    <div className="w-full bg-white text-slate-900 border-b border-slate-100 select-none sticky top-0 z-30">
      {/* iOS Status Bar */}
      <div className="flex items-center justify-between px-6 pt-2 pb-1 text-xs font-semibold text-slate-800">
        <span className="font-mono text-[13px] tracking-tight">9:41</span>
        <div className="flex items-center gap-1.5">
          <Signal className="w-3.5 h-3.5 fill-current text-slate-800" />
          <Wifi className="w-3.5 h-3.5 text-slate-800" />
          <Battery className="w-4 h-4 text-slate-800 fill-current" />
        </div>
      </div>

      {/* Screen App Bar */}
      <div className="h-12 px-4 flex items-center justify-between">
        {activeScreen === 'feed' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-slate-900">ویترین</span>
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            </div>
            <div className="flex items-center gap-3 text-slate-700">
              <button 
                onClick={() => onNavigate('cart')} 
                className="relative p-1 hover:text-blue-600 transition-colors"
                title="سبد خرید"
              >
                <div className="text-xs font-medium border border-slate-300 rounded-lg px-2 py-0.5">
                  سبد
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                      {cartCount}
                    </span>
                  )}
                </div>
              </button>
              <button className="p-1 hover:text-blue-600 transition-colors" title="جستجو">
                <Search className="w-5 h-5" />
              </button>
              <button className="p-1 hover:text-red-500 transition-colors" title="علاقه‌مندی‌ها">
                <Heart className="w-5 h-5" />
              </button>
            </div>
          </>
        )}

        {(activeScreen === 'product-detail' || activeScreen === 'cart' || activeScreen === 'checkout' || activeScreen === 'order-tracking' || activeScreen === 'store') && (
          <>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onNavigate(activeScreen === 'checkout' ? 'cart' : activeScreen === 'order-tracking' ? 'feed' : 'feed')}
                className="p-1.5 -mr-1 rounded-full hover:bg-slate-100 transition-colors text-slate-700"
                title="بازگشت"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <h1 className="text-base font-bold text-slate-900">
                {title || (
                  activeScreen === 'product-detail' ? 'جزئیات کالا' :
                  activeScreen === 'cart' ? 'سبد خرید' :
                  activeScreen === 'checkout' ? 'تکمیل خرید' :
                  activeScreen === 'order-tracking' ? 'سفارش ۹۲۷۱' :
                  'پروفایل غرفه'
                )}
              </h1>
            </div>

            <div className="flex items-center gap-2 text-slate-600">
              {activeScreen === 'product-detail' && (
                <>
                  <button className="p-1.5 hover:text-blue-600 transition-colors">
                    <Bookmark className="w-5 h-5" />
                  </button>
                  <button className="p-1.5 hover:text-blue-600 transition-colors">
                    <Share2 className="w-5 h-5" />
                  </button>
                </>
              )}
              {activeScreen === 'store' && (
                <>
                  <button className="p-1.5 hover:text-blue-600 transition-colors">
                    <Bell className="w-5 h-5" />
                  </button>
                  <button className="p-1.5 hover:text-blue-600 transition-colors">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {activeScreen === 'profile' && (
          <>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">سارا احمدی</h1>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <button className="p-1.5 hover:text-blue-600">
                <Share2 className="w-5 h-5" />
              </button>
              <button className="p-1.5 hover:text-blue-600">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </>
        )}

        {activeScreen === 'seller-studio' && (
          <>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onNavigate('feed')}
                className="p-1.5 -mr-1 rounded-full hover:bg-slate-100 transition-colors text-slate-700"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <h1 className="text-base font-bold text-slate-900">مدیریت فروشگاه</h1>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <button className="p-1.5 hover:text-blue-600 relative">
                <Bell className="w-5 h-5" />
                <span className="w-2 h-2 rounded-full bg-red-500 absolute top-1 right-1"></span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
