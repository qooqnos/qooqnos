import React, { useState } from 'react';
import { 
  CheckCircle2, 
  MessageSquare, 
  UserPlus, 
  UserCheck, 
  Star, 
  Grid, 
  Layers, 
  Search,
  Filter
} from 'lucide-react';
import { PRODUCTS_DATA, formatToman, toPersianDigits } from '../../data/mockData';
import { ScreenId } from '../../types/qooqnos';

interface StoreScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onSelectProduct: (productId: string) => void;
}

export const StoreScreen: React.FC<StoreScreenProps> = ({
  onNavigate,
  onSelectProduct,
}) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | 'mugs' | 'bowls' | 'vases'>('all');

  const categories = [
    { id: 'all', name: 'همه (۸۶)' },
    { id: 'mugs', name: 'ماگ و فنجان' },
    { id: 'bowls', name: 'کاسه و بشقاب' },
    { id: 'vases', name: 'گلدان و دکوراتیو' },
  ];

  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto">
      {/* Store Header Banner */}
      <div className="bg-white p-4 border-b border-slate-200/90 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-0.5 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500">
              <div className="p-0.5 bg-white rounded-full">
                <img
                  src="https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=300&q=80"
                  alt="خانه ماژور"
                  className="w-16 h-16 rounded-full object-cover"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-black text-slate-900">خانه ماژور</h2>
                <CheckCircle2 className="w-4 h-4 text-blue-600 fill-blue-600 text-white" />
              </div>
              <span className="text-[11px] text-slate-400">صنایع دست‌ساز و سفالگری مدرن</span>
              <div className="flex items-center gap-1 text-[11px] text-amber-500 mt-1 font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>۴.۹ رضایت خریداران</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Stats from Figma */}
        <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-100 border-y border-slate-100 py-2.5 text-center">
          <div>
            <div className="text-sm font-black text-slate-900">۸۶</div>
            <div className="text-[10px] text-slate-400">محصول</div>
          </div>
          <div>
            <div className="text-sm font-black text-slate-900">۱۲.۳ هزار</div>
            <div className="text-[10px] text-slate-400">دنبال‌کننده</div>
          </div>
          <div>
            <div className="text-sm font-black text-slate-900">۱۸۶</div>
            <div className="text-[10px] text-slate-400">نظر ثبت‌شده</div>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          کارگاه تخصصی تولید ظروف سرامیکی دست‌ساز با متریال بهداشتی و لعاب بدون سرب. تمامی قطعات کار دست و یکتا هستند.
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            onClick={() => setIsFollowing(!isFollowing)}
            className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
              isFollowing
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/30'
            }`}
          >
            {isFollowing ? (
              <>
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>دنبال می‌کنید</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>دنبال کردن</span>
              </>
            )}
          </button>

          <button className="py-2 px-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors">
            <MessageSquare className="w-4 h-4 text-slate-500" />
            <span>گفتگو با غرفه</span>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="p-3 bg-white border-b border-slate-200/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id as any)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              activeCategory === cat.id
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* 2-Column Product Grid - Exactly matching Figma Screen 7 */}
      <div className="p-3 grid grid-cols-2 gap-3">
        {PRODUCTS_DATA.map((prod) => (
          <div
            key={prod.id}
            onClick={() => {
              onSelectProduct(prod.id);
              onNavigate('product-detail');
            }}
            className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs cursor-pointer group hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
                <img
                  src={prod.images[0]}
                  alt={prod.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {prod.discountPercent && (
                  <span className="absolute top-2 right-2 bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                    {toPersianDigits(prod.discountPercent)}٪
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{prod.title}</h4>
                <div className="flex items-center gap-1 text-[10px] text-amber-500 mt-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>{toPersianDigits(prod.rating)}</span>
                </div>
              </div>
            </div>

            <div className="p-2.5 pt-0 border-t border-slate-100/60 mt-1 flex items-center justify-between">
              <span className="text-xs font-black text-slate-900">
                {formatToman(prod.price)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
