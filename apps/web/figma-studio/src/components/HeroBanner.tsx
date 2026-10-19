import React from 'react';
import { 
  CheckCircle, 
  Sparkles, 
  Smartphone, 
  Monitor, 
  Zap, 
  Palette, 
  FileCode2, 
  ArrowLeft,
  ArrowRight,
  Upload,
  Copy
} from 'lucide-react';
import { Language } from '../types';

interface HeroBannerProps {
  lang: Language;
  onOpenSpecModal: () => void;
  onScrollToUploader: () => void;
  onScrollToShowcase: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  lang,
  onOpenSpecModal,
  onScrollToUploader,
  onScrollToShowcase,
}) => {
  const isRtl = lang === 'fa';
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <section className="relative overflow-hidden pt-8 pb-14 border-b border-slate-800/60 bg-gradient-to-b from-slate-900/80 via-slate-950 to-slate-950">
      {/* Background glow effects */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Affirmation Tag */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs sm:text-sm font-medium shadow-sm backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>
              {isRtl
                ? 'پاسخ به درخواست شما: بله، ۱۰۰٪ با بالاترین دقت امکان‌پذیر است!'
                : 'Direct Answer: Yes, 100% pixel-perfect implementation is ready!'}
            </span>
          </div>
        </div>

        {/* Main Headline */}
        <div className="text-center max-w-3xl mx-auto mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight mb-4">
            {isRtl ? (
              <>
                طرح فیگمای خود را بدهید،{' '}
                <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
                  سایت زنده و واکنش‌گرا
                </span>{' '}
                تحویل بگیرید
              </>
            ) : (
              <>
                Bring Your Figma Design, Get a{' '}
                <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
                  Live Responsive Web App
                </span>
              </>
            )}
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            {isRtl
              ? 'کافیست اسکرین‌شات از فریم‌های فیگما، لینک طرح، یا مشخصات رنگ‌ها و کامپوننت‌های مورد نظرتان را در چت ارسال کنید تا با فریم‌ورک React و Tailwind CSS دقیقاً بازسازی و اجرایی شود.'
              : 'Simply share screenshots of your Figma frames, a project link, or design specifications here in chat, and I will translate it into clean, interactive React & Tailwind code.'}
          </p>
        </div>

        {/* Primary CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-12">
          <button
            onClick={onOpenSpecModal}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
          >
            <Copy className="w-4 h-4" />
            <span>{isRtl ? 'مشاهده قالب آماده برای ارسال مشخصات' : 'View Figma Spec Prompt Template'}</span>
            <Arrow className="w-4 h-4" />
          </button>

          <button
            onClick={onScrollToUploader}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-200 hover:text-white font-medium text-sm transition-all hover:bg-slate-800/80"
          >
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>{isRtl ? 'پیش‌نمایش و آپلود اسکرین‌شات فیگما' : 'Inspect / Upload Figma Screenshot'}</span>
          </button>

          <button
            onClick={onScrollToShowcase}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-transparent border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors"
          >
            <span>{isRtl ? 'نمونه‌های کد شده از فیگما' : 'Explore Implemented Templates'}</span>
          </button>
        </div>

        {/* 4 Core Pillars of Implementation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-indigo-500/40 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Monitor className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm mb-1">
              {isRtl ? 'دقت پیکسل‌به‌پیکسل (Pixel-Perfect)' : 'Pixel-Perfect Fidelity'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isRtl
                ? 'رعایت دقیق فواصل Auto Layout، شعاع گوشه‌ها (Radius)، رنگ‌ها، سایه‌ها و آیکون‌ها.'
                : 'Exact Auto Layout margins, gaps, border-radii, drop shadows, and SVG icons.'}
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-violet-500/40 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm mb-1">
              {isRtl ? 'کاملاً ریسپانسیو و روان' : 'Fully Responsive Design'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isRtl
                ? 'نمایش بی‌نقص در موبایل، تبلت، لپ‌تاپ و مانیتورهای عریض با کنترل‌های روان.'
                : 'Smooth scaling across Mobile (375px), Tablet (768px), and Desktop (1440px).'}
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-pink-500/40 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm mb-1">
              {isRtl ? 'تعاملی و پویا (Interactivity)' : 'Interactive & Animated'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isRtl
                ? 'پشتیبانی از حالت‌های Hover، کلیک، انیمیشن‌های نرم، مودال و مدیریت State.'
                : 'Micro-interactions, state management, modal dialogs, and smooth transitions.'}
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-emerald-500/40 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <FileCode2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm mb-1">
              {isRtl ? 'کد ماژولار و استاندارد' : 'Clean Component Architecture'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isRtl
                ? 'کد React ماژولار با تایپ‌های TypeScript و استایل‌های بهینه شده در Tailwind CSS.'
                : 'TypeScript types, modular React components, and maintainable Tailwind utility code.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
