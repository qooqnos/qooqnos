import React from 'react';
import { ExternalLink, CheckCircle2, Eye, X, Layers, Smartphone } from 'lucide-react';
import { ScreenId } from '../../types/qooqnos';

interface FigmaCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScreen: (screen: ScreenId) => void;
}

export const FigmaCompareModal: React.FC<FigmaCompareModalProps> = ({
  isOpen,
  onClose,
  onSelectScreen,
}) => {
  if (!isOpen) return null;

  const screens = [
    { id: 'feed', name: '۱. ویترین (Feed / Explore)', desc: 'استوری‌ها، پست‌های ماگ زیتون و کارگاه نقش، برچسب قیمت روی عکس' },
    { id: 'product-detail', name: '۲. جزئیات کالا (Product Details)', desc: 'گالری اسلایدر، پالت رنگ، انتخاب حجم ۳۰۰ میلی‌لیتر، دکمه خرید چسبان' },
    { id: 'cart', name: '۳. سبد خرید (Cart)', desc: 'تفکیک اقلام به تفکیک غرفه‌ها، استپر تعداد، محاسبه تخفیف و ارسال' },
    { id: 'checkout', name: '۴. تکمیل خرید و پرداخت (Checkout)', desc: 'آدرس ستارخان، پست پیشتاز، درگاه بانکی شتاب و کیف پول' },
    { id: 'order-tracking', name: '۵. پیگیری سفارش ۹۲۷۱ (Order Tracking)', desc: 'تایم‌لاین وضعیت ارسال بسته در مسیر، کد رهگیری، فاکتور' },
    { id: 'profile', name: '۶. حساب کاربری سارا احمدی (Profile)', desc: 'آمار ۲۸ ذخیره، ۲۴ نشان، ۱۲ سفارش، ماتریس پیگیری وضعیت' },
    { id: 'store', name: '۷. پروفایل غرفه خانه ماژور (Store Page)', desc: 'بیوگرافی، دکمه دنبال کردن و چت، گرید ۲ ستونه محصولات' },
    { id: 'seller-studio', name: '۸. داشبورد مدیریت فروشگاه (Seller Studio)', desc: 'نمودار فروش ۱۲.۸ میلیون تومانی، مدیریت کالاها و سفارش‌ها' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <span>تطبیق پیاده‌سازی با طرح فیگما ققنوس</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                  ۱۰۰٪ پیاده‌سازی شده
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                فایل: qooqnos • لینک اصلی: figma.com/design/Lrp81eZdZgxB0Jp2LEGuQz
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Original Snapshot preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300">طرح ۸ فریم اصلی استخراج شده از فیگمای شما:</span>
              <a
                href="https://www.figma.com/design/Lrp81eZdZgxB0Jp2LEGuQz/qooqnos?node-id=0-1&p=f"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
              >
                <span>مشاهده در فیگما</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 p-2 shadow-inner">
              <img
                src="/public/figma_thumbnail.png"
                alt="Figma Original Design"
                className="w-full h-auto max-h-72 object-contain rounded-xl"
              />
            </div>
          </div>

          {/* Implemented screens directory */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 mb-3">
              روی هر کدام از فریم‌ها کلیک کنید تا مستقیماً به آن صفحه بروید:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {screens.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => {
                    onSelectScreen(sc.id as ScreenId);
                    onClose();
                  }}
                  className="p-3.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-blue-500/50 text-right transition-all group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                      {sc.name}
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {sc.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
          >
            مشاهده برنامه زنده
          </button>
        </div>
      </div>
    </div>
  );
};
