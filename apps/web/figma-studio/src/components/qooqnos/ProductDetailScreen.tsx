import React, { useState, useEffect } from 'react';
import { 
  Star, 
  CheckCircle2, 
  ShieldCheck, 
  Truck, 
  ShoppingBag, 
  Check, 
  Loader2 
} from 'lucide-react';
import { api } from '../../services/api';
import { Product, ScreenId } from '../../types/qooqnos';
import { formatToman, toPersianDigits } from '../../data/mockData';

interface ProductDetailScreenProps {
  productId: string;
  onNavigate: (screen: ScreenId) => void;
  onCartUpdated?: () => void;
}

export const ProductDetailScreen: React.FC<ProductDetailScreenProps> = ({
  productId,
  onNavigate,
  onCartUpdated,
}) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState('سبز زیتونی');
  const [selectedVolume, setSelectedVolume] = useState('۳۰۰ میلی‌لیتر');
  const [adding, setAdding] = useState(false);
  const [addedToast, setAddedToast] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadProduct() {
      setLoading(true);
      try {
        const prod = await api.getProductById(productId);
        if (isMounted) {
          setProduct(prod);
          if (prod.colors && prod.colors.length > 0) {
            setSelectedColor(prod.colors[0].name);
          }
          if (prod.volumes && prod.volumes.length > 0) {
            setSelectedVolume(prod.volumes[0]);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading product:', err);
        if (isMounted) setLoading(false);
      }
    }
    loadProduct();
    return () => { isMounted = false; };
  }, [productId]);

  const handleAddToCart = async () => {
    if (!product) return;
    setAdding(true);
    try {
      await api.addToCart(product.id, selectedColor, selectedVolume);
      setAddedToast(true);
      if (onCartUpdated) onCartUpdated();
      setTimeout(() => setAddedToast(false), 2200);
    } catch (err) {
      console.error('Failed to add to cart:', err);
    } finally {
      setAdding(false);
    }
  };

  if (loading || !product) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white p-8">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs">در حال بارگذاری جزئیات کالا...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white overflow-y-auto flex flex-col justify-between relative">
      <div>
        {/* Gallery Carousel */}
        <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
          <img
            src={product.images[selectedImageIndex] || product.images[0]}
            alt={product.title}
            className="w-full h-full object-cover transition-all duration-300"
          />

          {/* Pagination badge */}
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[11px] font-mono px-2.5 py-1 rounded-full">
            {toPersianDigits(selectedImageIndex + 1)} / {toPersianDigits(product.images.length)}
          </div>

          {/* Quick thumbnails preview */}
          {product.images.length > 1 && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
              {product.images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    selectedImageIndex === idx ? 'bg-white w-6' : 'bg-white/60'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Content Info */}
        <div className="p-4 space-y-4">
          {/* Status & Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                موجود در انبار ({toPersianDigits(product.stockCount || 18)} عدد)
              </span>
              <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>{toPersianDigits(product.rating)}</span>
                <span className="text-slate-400 font-normal">({toPersianDigits(product.reviewCount)} نظر)</span>
              </div>
            </div>

            <h1 className="text-xl font-black text-slate-900 leading-snug">
              {product.title}
            </h1>

            {/* Price */}
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {formatToman(product.price)}
              </span>
              {product.originalPrice && (
                <span className="text-xs text-slate-400 line-through">
                  {formatToman(product.originalPrice)}
                </span>
              )}
              {product.discountPercent && (
                <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                  {toPersianDigits(product.discountPercent)}٪ تخفیف
                </span>
              )}
            </div>
          </div>

          {/* Seller Card */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <button
              onClick={() => onNavigate('store')}
              className="flex items-center gap-3 text-right"
            >
              <img
                src={product.sellerAvatar}
                alt={product.sellerName}
                className="w-11 h-11 rounded-full object-cover border border-slate-300"
              />
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-slate-900">{product.sellerName}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 fill-blue-600 text-white" />
                </div>
                <span className="text-[10px] text-slate-500">کارگاه سرامیک دست‌ساز • ۱۲.۳ هزار دنبال‌کننده</span>
              </div>
            </button>
            <button
              onClick={() => onNavigate('store')}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white hover:border-slate-400 transition-colors"
            >
              مشاهده غرفه
            </button>
          </div>

          {/* Color Variations */}
          {product.colors && product.colors.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                <span>انتخاب رنگ: <span className="font-normal text-slate-500">{selectedColor}</span></span>
              </div>
              <div className="flex items-center gap-3">
                {product.colors.map((color) => (
                  <button
                    key={color.name}
                    disabled={!color.available}
                    onClick={() => setSelectedColor(color.name)}
                    className={`relative w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                      selectedColor === color.name ? 'border-blue-600 ring-2 ring-blue-600/30 scale-105' : 'border-slate-300'
                    } ${!color.available ? 'opacity-40 cursor-not-allowed' : ''}`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  >
                    {selectedColor === color.name && (
                      <Check className="w-4 h-4 text-white drop-shadow" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Volume / Size Variations */}
          {product.volumes && product.volumes.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-800 mb-2">
                حجم ماگ:
              </div>
              <div className="flex items-center gap-2">
                {product.volumes.map((vol) => (
                  <button
                    key={vol}
                    onClick={() => setSelectedVolume(vol)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      selectedVolume === vol
                        ? 'bg-blue-50 border-blue-600 text-blue-700'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {vol}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 mb-1.5">توضیحات و مشخصات</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Guarantee Badges */}
          <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-slate-600">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>ارسال امن و بسته‌بندی ضدضربه</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>ضمانت اصالت و سلامت اثر</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex items-center justify-between gap-4 z-20 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div>
          <span className="text-[10px] text-slate-400 block">قیمت نهایی:</span>
          <span className="text-lg font-black text-slate-900">{formatToman(product.price)}</span>
        </div>

        <button
          onClick={handleAddToCart}
          disabled={adding}
          className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm shadow-md shadow-blue-600/30 transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          {adding ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <ShoppingBag className="w-4 h-4" />
          )}
          <span>افزودن به سبد خرید</span>
        </button>
      </div>

      {/* Toast notification */}
      {addedToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>با موفقیت به سبد خرید سرور افزوده شد!</span>
        </div>
      )}
    </div>
  );
};
