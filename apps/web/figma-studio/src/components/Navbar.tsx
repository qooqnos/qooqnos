import React from 'react';
import { Layers, Code2, Globe, Sparkles, CheckCircle2 } from 'lucide-react';
import { Language } from '../types';

interface NavbarProps {
  lang: Language;
  setLang: (lang: Language) => void;
  onOpenSpecModal: () => void;
  onScrollToShowcase: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  lang,
  setLang,
  onOpenSpecModal,
  onScrollToShowcase
}) => {
  const isRtl = lang === 'fa';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-pink-500 shadow-lg shadow-indigo-500/25 text-white">
            <Layers className="w-5 h-5 absolute -translate-x-1 -translate-y-1 opacity-70" />
            <Code2 className="w-5 h-5 relative translate-x-1 translate-y-1" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">
                Figma<span className="text-indigo-400">2</span>Web
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {isRtl ? 'آماده پیاده‌سازی' : 'Ready to Build'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              {isRtl ? 'استودیوی تبدیل مستقیم طرح فیگما به کد وب' : 'Pixel-perfect Figma to React & Tailwind'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === 'fa' ? 'en' : 'fa')}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors"
            title={isRtl ? 'تغییر زبان به انگلیسی' : 'Switch to Persian'}
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span>{lang === 'fa' ? 'English' : 'فارسی'}</span>
          </button>

          {/* Quick link to Showcase */}
          <button
            onClick={onScrollToShowcase}
            className="hidden md:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{isRtl ? 'مشاهده نمونه‌های آماده' : 'Live Demos'}</span>
          </button>

          {/* CTA to provide specs */}
          <button
            onClick={onOpenSpecModal}
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-600/20 transition-all active:scale-95"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isRtl ? 'ارسال طرح فیگما' : 'Submit Figma Spec'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
