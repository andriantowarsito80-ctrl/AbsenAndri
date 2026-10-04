import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Smartphone, Download, Check, X, Share2, PlusSquare } from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'compact' | 'full' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  className = '', 
  variant = 'compact' 
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  // If already running inside standalone app, do not show install prompt
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      await install();
      setInstalling(false);
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      {variant === 'banner' ? (
        <div className={`bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-3 md:p-3.5 rounded-2xl shadow-lg border border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 ${className}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-inner">
              <Smartphone className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h4 className="text-xs md:text-sm font-black tracking-tight flex items-center gap-1.5">
                Instal SIMANJA di HP Android Anda
                <span className="text-[9px] bg-emerald-400 text-emerald-950 font-bold px-2 py-0.5 rounded-full uppercase">PWA Luring</span>
              </h4>
              <p className="text-[10px] md:text-[11px] text-blue-100 font-medium">
                Dapat dipasang langsung ke layar utama tanpa Play Store, hemat memori, dan dapat dibuka luring.
              </p>
            </div>
          </div>
          <button
            id="btn-pwa-install-banner"
            onClick={handleInstallClick}
            disabled={installing}
            className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-blue-50 text-blue-900 rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4 text-blue-700" />
            {installing ? 'Memproses...' : 'Pasang Aplikasi Sekarang'}
          </button>
        </div>
      ) : variant === 'full' ? (
        <button
          id="btn-pwa-install-full"
          onClick={handleInstallClick}
          disabled={installing}
          className={`w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer ${className}`}
        >
          <Smartphone className="w-4 h-4" />
          <span>{installing ? 'Memproses...' : 'Pasang ke HP Android (PWA)'}</span>
        </button>
      ) : (
        <button
          id="btn-pwa-install-compact"
          onClick={handleInstallClick}
          disabled={installing}
          title="Pasang aplikasi SIMANJA ke layar utama Android / iOS"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-[11px] font-extrabold shadow-2xs transition-all cursor-pointer ${className}`}
        >
          <Download className="w-3.5 h-3.5 text-blue-700" />
          <span>Pasang di HP</span>
        </button>
      )}

      {/* Panduan Instalasi Manual Dialog */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-slate-800">Cara Pasang di HP Android / iOS</h3>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">Untuk Pengguna iPhone / iPad (Safari):</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                    <span>Ketuk tombol <strong>Bagikan (Share)</strong> <Share2 className="w-3.5 h-3.5 inline mx-1 text-blue-600" /> pada bilah menu Safari di bawah.</span>
                  </div>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                    <span>Gulir ke bawah dan pilih opsi <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-slate-700" />.</span>
                  </div>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                    <span>Ketuk <strong>Tambah</strong> di pojok kanan atas. Ikon aplikasi SIMANJA akan langsung muncul di beranda HP Anda!</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">Untuk Pengguna HP Android (Google Chrome / Edge):</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                    <span>Buka browser Google Chrome di HP Android Anda.</span>
                  </div>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                    <span>Ketuk ikon menu titik tiga (<strong>⋮</strong>) di pojok kanan atas browser.</span>
                  </div>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                    <span>Pilih menu <strong>"Instal aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama" (Add to Home screen)</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">4</span>
                    <span>Ketuk <strong>Instal</strong>. Aplikasi SIMANJA akan langsung terpasang seperti aplikasi Android biasa dengan ikon logo sekolah!</span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowGuide(false)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
