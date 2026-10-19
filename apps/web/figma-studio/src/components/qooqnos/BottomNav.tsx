import React from 'react';
import { Home, Search, ShoppingBag, Bookmark, User } from 'lucide-react';
import { ScreenId } from '../../types/qooqnos';

interface BottomNavProps {
  activeScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  cartCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeScreen,
  onNavigate,
  cartCount,
}) => {
  return (
    <div className="w-full bg-white border-t border-slate-200/90 py-2 px-6 flex items-center justify-between sticky bottom-0 z-30 select-none shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
      {/* 1. Feed / Home */}
      <button
        onClick={() => onNavigate('feed')}
        className={`flex flex-col items-center gap-1 transition-colors ${
          activeScreen === 'feed' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <Home className={`w-5 h-5 ${activeScreen === 'feed' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
        <span className="text-[10px]">ویترین</span>
      </button>

      {/* 2. Search / Explore */}
      <button
        onClick={() => onNavigate('store')}
        className={`flex flex-col items-center gap-1 transition-colors ${
          activeScreen === 'store' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <Search className={`w-5 h-5 ${activeScreen === 'store' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
        <span className="text-[10px]">غرفه‌ها</span>
      </button>

      {/* 3. Cart */}
      <button
        onClick={() => onNavigate('cart')}
        className={`relative flex flex-col items-center gap-1 transition-colors ${
          activeScreen === 'cart' || activeScreen === 'checkout'
            ? 'text-blue-600 font-bold'
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <ShoppingBag className={`w-5 h-5 ${activeScreen === 'cart' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
        {cartCount > 0 && (
          <span className="absolute -top-1 right-2 w-4 h-4 bg-blue-600 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
            {cartCount}
          </span>
        )}
        <span className="text-[10px]">سبد خرید</span>
      </button>

      {/* 4. Orders / Tracking */}
      <button
        onClick={() => onNavigate('order-tracking')}
        className={`flex flex-col items-center gap-1 transition-colors ${
          activeScreen === 'order-tracking' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <Bookmark className={`w-5 h-5 ${activeScreen === 'order-tracking' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
        <span className="text-[10px]">سفارش‌ها</span>
      </button>

      {/* 5. Profile */}
      <button
        onClick={() => onNavigate('profile')}
        className={`flex flex-col items-center gap-1 transition-colors ${
          activeScreen === 'profile' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <div className={`w-6 h-6 rounded-full overflow-hidden border-2 ${activeScreen === 'profile' ? 'border-blue-600' : 'border-transparent'}`}>
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
            alt="Profile"
            className="w-full h-full object-cover"
          />
        </div>
        <span className="text-[10px]">حساب من</span>
      </button>
    </div>
  );
};
