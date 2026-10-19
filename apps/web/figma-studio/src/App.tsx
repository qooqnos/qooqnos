import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Monitor, 
  Layers, 
  CheckCircle2, 
  UserCheck, 
  Store,
  ArrowRightLeft,
  Download
} from 'lucide-react';
import { ScreenId } from './types/qooqnos';
import { api, UserPersona } from './services/api';
import { TopBar } from './components/qooqnos/TopBar';
import { BottomNav } from './components/qooqnos/BottomNav';
import { FeedScreen } from './components/qooqnos/FeedScreen';
import { ProductDetailScreen } from './components/qooqnos/ProductDetailScreen';
import { CartScreen } from './components/qooqnos/CartScreen';
import { CheckoutScreen } from './components/qooqnos/CheckoutScreen';
import { OrderTrackingScreen } from './components/qooqnos/OrderTrackingScreen';
import { ProfileScreen } from './components/qooqnos/ProfileScreen';
import { StoreScreen } from './components/qooqnos/StoreScreen';
import { SellerStudioScreen } from './components/qooqnos/SellerStudioScreen';
import { FigmaCompareModal } from './components/qooqnos/FigmaCompareModal';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('feed');
  const [selectedProductId, setSelectedProductId] = useState<string>('p1');
  const [activeOrderId, setActiveOrderId] = useState<string>('ord-9271');
  const [cartCount, setCartCount] = useState<number>(2);
  const [currentPersona, setCurrentPersona] = useState<UserPersona | null>(null);
  const [currentRole, setCurrentRole] = useState<'buyer' | 'seller'>('buyer');
  const [viewMode, setViewMode] = useState<'mobile-frame' | 'responsive'>('mobile-frame');
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // Sync initial cart and user state from backend
  const syncState = async () => {
    try {
      const [userRes, cartRes] = await Promise.all([
        api.getCurrentUser(),
        api.getCart(),
      ]);
      setCurrentPersona(userRes.persona);
      setCurrentRole(userRes.currentRole);
      setCartCount(cartRes.itemCount);
    } catch (err) {
      console.warn('Initial sync fallback:', err);
    }
  };

  useEffect(() => {
    syncState();
  }, []);

  const handleRoleSwitch = async (targetRole: 'buyer' | 'seller') => {
    try {
      const res = await api.switchRole(targetRole);
      setCurrentPersona(res.persona);
      setCurrentRole(res.currentRole);
      if (targetRole === 'seller') {
        setActiveScreen('seller-studio');
      } else {
        setActiveScreen('feed');
      }
    } catch (err) {
      console.error('Role switch error:', err);
    }
  };

  const screenTabs: { id: ScreenId; label: string; number: string }[] = [
    { id: 'feed', label: 'ویترین', number: '۱' },
    { id: 'product-detail', label: 'جزئیات کالا', number: '۲' },
    { id: 'cart', label: 'سبد خرید', number: '۳' },
    { id: 'checkout', label: 'تکمیل خرید', number: '۴' },
    { id: 'order-tracking', label: 'پیگیری سفارش', number: '۵' },
    { id: 'profile', label: 'پروفایل کاربر', number: '۶' },
    { id: 'store', label: 'صفحه غرفه', number: '۷' },
    { id: 'seller-studio', label: 'مدیریت فروشگاه', number: '۸' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Vazirmatn',sans-serif]" dir="rtl">
      {/* Top Project Controller Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Brand & Project Info */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-rose-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black text-lg">
              ق
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-white">پروژه ققنوس (Qooqnos)</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  متصل به بک‌اند Express
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                طرح فیگما: ۸ صفحه کامل با داده‌های ماندگار API و احراز هویت
              </p>
            </div>
          </div>

          {/* Quick Persona Switcher + View Controls */}
          <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-between md:justify-end">
            {/* Quick Role Switcher Button */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <span className="text-[11px] text-slate-400 px-1.5 flex items-center gap-1">
                <ArrowRightLeft className="w-3 h-3 text-indigo-400" />
                <span>نقش:</span>
              </span>
              <button
                onClick={() => handleRoleSwitch('buyer')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                  currentRole === 'buyer'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="مشاهده در نقش خریدار (سارا احمدی)"
              >
                <UserCheck className="w-3 h-3" />
                <span>سارا (خریدار)</span>
              </button>
              <button
                onClick={() => handleRoleSwitch('seller')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                  currentRole === 'seller'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="مشاهده در نقش فروشنده (خانه ماژور)"
              >
                <Store className="w-3 h-3" />
                <span>غرفه ماژور</span>
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setViewMode('mobile-frame')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors ${
                  viewMode === 'mobile-frame' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
                title="قاب موبایل"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">قاب موبایل</span>
              </button>
              <button
                onClick={() => setViewMode('responsive')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors ${
                  viewMode === 'responsive' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
                title="نمای تمام صفحه"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ریسپانسیو</span>
              </button>
            </div>

            {/* Download Full Project ZIP */}
            <a
              href="/qooqnos-project.zip"
              download="qooqnos-project.zip"
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-95"
              title="دانلود فایل زیپ کامل پروژه"
            >
              <Download className="w-3.5 h-3.5" />
              <span>دانلود ZIP پروژه</span>
            </a>

            {/* Compare with Figma Button */}
            <button
              onClick={() => setIsCompareOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors shadow-sm"
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>طرح فیگما</span>
            </button>
          </div>
        </div>

        {/* Screen Switcher Chips Bar */}
        <div className="max-w-7xl mx-auto mt-2.5 pt-2 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <span className="text-[11px] text-slate-400 shrink-0 ml-1">صفحات فیگما:</span>
          {screenTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveScreen(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all shrink-0 ${
                activeScreen === tab.id
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30 scale-[1.02]'
                  : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 border border-slate-800/80'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                activeScreen === tab.id ? 'bg-white text-blue-700 font-black' : 'bg-slate-800 text-slate-400'
              }`}>
                {tab.number}
              </span>
              <span>{tab.label}</span>
              {tab.id === 'cart' && cartCount > 0 && (
                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 rounded-full">
                  {cartCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 flex items-center justify-center p-2 sm:p-6 lg:p-8">
        {viewMode === 'mobile-frame' ? (
          /* Mobile Device Frame Simulation (iPhone 15 Pro look) */
          <div className="relative mx-auto my-auto w-full max-w-[420px] h-[860px] max-h-[92vh] bg-slate-900 rounded-[52px] p-3 shadow-[0_25px_70px_rgba(0,0,0,0.85)] border-[6px] border-slate-800 ring-1 ring-slate-700/80 flex flex-col overflow-hidden">
            {/* Dynamic Island / Notch */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-40 flex items-center justify-end px-2.5 gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800"></span>
              <span className="w-2 h-2 rounded-full bg-blue-900/60"></span>
            </div>

            {/* Inner Phone Screen Container */}
            <div className="relative w-full h-full bg-white rounded-[42px] overflow-hidden flex flex-col">
              {/* Screen Top Bar */}
              <TopBar
                activeScreen={activeScreen}
                onNavigate={setActiveScreen}
                cartCount={cartCount}
              />

              {/* Active Screen Content */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {activeScreen === 'feed' && (
                  <FeedScreen
                    onNavigate={setActiveScreen}
                    onSelectProduct={setSelectedProductId}
                  />
                )}
                {activeScreen === 'product-detail' && (
                  <ProductDetailScreen
                    productId={selectedProductId}
                    onNavigate={setActiveScreen}
                    onCartUpdated={syncState}
                  />
                )}
                {activeScreen === 'cart' && (
                  <CartScreen
                    onNavigate={setActiveScreen}
                    onCartChange={syncState}
                  />
                )}
                {activeScreen === 'checkout' && (
                  <CheckoutScreen
                    onNavigate={setActiveScreen}
                    onOrderCreated={(orderId) => {
                      setActiveOrderId(orderId);
                      syncState();
                    }}
                  />
                )}
                {activeScreen === 'order-tracking' && (
                  <OrderTrackingScreen 
                    orderId={activeOrderId}
                    onNavigate={setActiveScreen} 
                  />
                )}
                {activeScreen === 'profile' && (
                  <ProfileScreen 
                    onNavigate={setActiveScreen}
                    onSwitchRole={handleRoleSwitch}
                  />
                )}
                {activeScreen === 'store' && (
                  <StoreScreen
                    onNavigate={setActiveScreen}
                    onSelectProduct={setSelectedProductId}
                  />
                )}
                {activeScreen === 'seller-studio' && (
                  <SellerStudioScreen onNavigate={setActiveScreen} />
                )}
              </div>

              {/* Screen Bottom Navigation */}
              <BottomNav
                activeScreen={activeScreen}
                onNavigate={setActiveScreen}
                cartCount={cartCount}
              />

              {/* iOS Home Indicator Bar */}
              <div className="w-full bg-white pb-1 pt-0.5 flex justify-center">
                <div className="w-32 h-1 bg-slate-300 rounded-full"></div>
              </div>
            </div>
          </div>
        ) : (
          /* Full Responsive App View */
          <div className="w-full max-w-4xl min-h-[750px] bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col my-4">
            <TopBar
              activeScreen={activeScreen}
              onNavigate={setActiveScreen}
              cartCount={cartCount}
            />

            <div className="flex-1 overflow-y-auto flex flex-col">
              {activeScreen === 'feed' && (
                <FeedScreen
                  onNavigate={setActiveScreen}
                  onSelectProduct={setSelectedProductId}
                />
              )}
              {activeScreen === 'product-detail' && (
                <ProductDetailScreen
                  productId={selectedProductId}
                  onNavigate={setActiveScreen}
                  onCartUpdated={syncState}
                />
              )}
              {activeScreen === 'cart' && (
                <CartScreen
                  onNavigate={setActiveScreen}
                  onCartChange={syncState}
                />
              )}
              {activeScreen === 'checkout' && (
                <CheckoutScreen
                  onNavigate={setActiveScreen}
                  onOrderCreated={(orderId) => {
                    setActiveOrderId(orderId);
                    syncState();
                  }}
                />
              )}
              {activeScreen === 'order-tracking' && (
                <OrderTrackingScreen 
                  orderId={activeOrderId}
                  onNavigate={setActiveScreen} 
                />
              )}
              {activeScreen === 'profile' && (
                <ProfileScreen 
                  onNavigate={setActiveScreen}
                  onSwitchRole={handleRoleSwitch}
                />
              )}
              {activeScreen === 'store' && (
                <StoreScreen
                  onNavigate={setActiveScreen}
                  onSelectProduct={setSelectedProductId}
                />
              )}
              {activeScreen === 'seller-studio' && (
                <SellerStudioScreen onNavigate={setActiveScreen} />
              )}
            </div>

            <BottomNav
              activeScreen={activeScreen}
              onNavigate={setActiveScreen}
              cartCount={cartCount}
            />
          </div>
        )}
      </main>

      {/* Comparison Modal */}
      <FigmaCompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        onSelectScreen={setActiveScreen}
      />
    </div>
  );
}
