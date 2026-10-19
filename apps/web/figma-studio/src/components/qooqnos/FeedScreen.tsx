import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Bookmark, 
  MoreHorizontal, 
  ShoppingBag, 
  Tag, 
  CheckCircle2,
  ChevronLeft,
  Loader2
} from 'lucide-react';
import { api } from '../../services/api';
import { Product, Story, ScreenId } from '../../types/qooqnos';
import { formatToman, toPersianDigits } from '../../data/mockData';

interface FeedScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onSelectProduct: (productId: string) => void;
}

export const FeedScreen: React.FC<FeedScreenProps> = ({
  onNavigate,
  onSelectProduct,
}) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadFeed() {
      try {
        const [fetchedStories, fetchedProducts] = await Promise.all([
          api.getStories(),
          api.getProducts(),
        ]);
        if (isMounted) {
          setStories(fetchedStories);
          setProducts(fetchedProducts);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading feed data:', err);
        if (isMounted) setLoading(false);
      }
    }
    loadFeed();
    return () => { isMounted = false; };
  }, []);

  const handleToggleLike = async (productId: string) => {
    try {
      const res = await api.toggleLike(productId);
      setProducts(prev =>
        prev.map(p =>
          p.id === productId ? { ...p, isLiked: res.isLiked, likesCount: res.likesCount } : p
        )
      );
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const handleToggleSave = async (productId: string) => {
    try {
      const res = await api.toggleSave(productId);
      setProducts(prev =>
        prev.map(p => (p.id === productId ? { ...p, isSaved: res.isSaved } : p))
      );
    } catch (err) {
      console.error('Error toggling save:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white p-8">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs">در حال بارگذاری ویترین ققنوس...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white overflow-y-auto">
      {/* 1. Stories Carousel */}
      <div className="py-3 px-3 border-b border-slate-100 flex items-center gap-3 overflow-x-auto no-scrollbar scroll-smooth">
        {stories.map((story) => (
          <button
            key={story.id}
            onClick={() => onNavigate('store')}
            className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none"
          >
            <div className={`p-0.5 rounded-full ${story.hasUnseen ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600' : 'bg-slate-200'}`}>
              <div className="p-0.5 bg-white rounded-full">
                <img
                  src={story.avatar}
                  alt={story.sellerName}
                  className="w-14 h-14 rounded-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
            </div>
            <span className="text-[11px] font-medium text-slate-700 max-w-[68px] truncate text-center">
              {story.sellerName}
            </span>
          </button>
        ))}
      </div>

      {/* 2. Feed Posts */}
      <div className="divide-y divide-slate-100">
        {products.slice(0, 2).map((prod) => (
          <article key={prod.id} className="pb-4">
            {/* Post Header */}
            <div className="p-3 flex items-center justify-between">
              <button
                onClick={() => onNavigate('store')}
                className="flex items-center gap-2.5 text-right focus:outline-none"
              >
                <img
                  src={prod.sellerAvatar}
                  alt={prod.sellerName}
                  className="w-9 h-9 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-900">{prod.sellerName}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 fill-blue-600 text-white" />
                  </div>
                  <span className="text-[10px] text-slate-400">کارگاه سرامیک دست‌ساز • تهران</span>
                </div>
              </button>
              <button className="text-slate-400 hover:text-slate-600 p-1">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            {/* Post Image with interactive product badge */}
            <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
              <img
                src={prod.images[0]}
                alt={prod.title}
                className="w-full h-full object-cover"
              />
              {/* Tag Overlay - matches Figma button on photo */}
              <button
                onClick={() => {
                  onSelectProduct(prod.id);
                  onNavigate('product-detail');
                }}
                className="absolute bottom-3 right-3 bg-slate-900/85 hover:bg-slate-900 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-black/20 transition-transform active:scale-95"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
                <span>مشاهده محصول {formatToman(prod.price)}</span>
              </button>
            </div>

            {/* Post Actions Bar */}
            <div className="px-3 pt-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => handleToggleLike(prod.id)}
                  className="transition-transform active:scale-125 focus:outline-none"
                >
                  <Heart className={`w-6 h-6 ${prod.isLiked ? 'text-red-500 fill-red-500' : 'text-slate-700'}`} />
                </button>
                <button 
                  onClick={() => {
                    onSelectProduct(prod.id);
                    onNavigate('product-detail');
                  }}
                  className="text-slate-700 hover:text-slate-900"
                >
                  <MessageCircle className="w-6 h-6" />
                </button>
                <button className="text-slate-700 hover:text-slate-900">
                  <Send className="w-5 h-5 rotate-180" />
                </button>
              </div>
              <button 
                onClick={() => handleToggleSave(prod.id)}
                className="text-slate-700 focus:outline-none"
              >
                <Bookmark className={`w-6 h-6 ${prod.isSaved ? 'text-slate-900 fill-slate-900' : ''}`} />
              </button>
            </div>

            {/* Post Meta */}
            <div className="px-3 pt-2 space-y-1">
              <div className="text-xs font-bold text-slate-900">
                {toPersianDigits(prod.likesCount)} پسند
              </div>
              <p className="text-xs text-slate-800 leading-relaxed">
                <span className="font-bold ml-1.5">{prod.sellerName}</span>
                {prod.description}
              </p>
              <button
                onClick={() => {
                  onSelectProduct(prod.id);
                  onNavigate('product-detail');
                }}
                className="text-[11px] text-slate-400 hover:text-slate-600 block pt-0.5"
              >
                مشاهده تمام {toPersianDigits(prod.reviewCount)} نظر
              </button>
              <div className="text-[10px] text-slate-400 pt-0.5">
                ۳ ساعت پیش
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
