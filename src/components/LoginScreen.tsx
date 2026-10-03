import React, { useState, useEffect, useRef } from "react";
import { 
  Lock, User, Eye, EyeOff, AlertCircle, CheckCircle, 
  ArrowRight, ShieldCheck, Landmark,
  RefreshCw, QrCode
} from "lucide-react";
import { safeStorage } from "../utils/storage";

interface LoginScreenProps {
  onLoginSuccess: () => void;
  schoolName: string;
  schoolLogo?: string | null;
}

export default function LoginScreen({ onLoginSuccess, schoolName, schoolLogo }: LoginScreenProps) {
  const [loginMethod, setLoginMethod] = useState<"credentials" | "qrcode">("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(2);

  // Alphanumeric CAPTCHA States
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // USB QR/Barcode Scanner States
  const [usbScanInput, setUsbScanInput] = useState("");
  const [isUsbInputFocused, setIsUsbInputFocused] = useState(true);
  const usbInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-slide every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 3);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const generateCaptcha = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; 
    let result = "";
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleRefreshCaptcha = () => {
    const code = generateCaptcha();
    setCaptchaCode(code);
    drawCaptcha(code);
  };

  const drawCaptcha = (code: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#f8fafc"; // slate-50
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines for distraction
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 0.5;
    const step = 8;
    for (let x = 0; x < canvas.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Bezier curve
    ctx.strokeStyle = "rgba(99, 102, 241, 0.4)"; // indigo-500 tint
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2 + (Math.random() - 0.5) * 15);
    ctx.bezierCurveTo(
      canvas.width * 0.25, canvas.height / 2 + (Math.random() - 0.5) * 25,
      canvas.width * 0.75, canvas.height / 2 + (Math.random() - 0.5) * 25,
      canvas.width, canvas.height / 2 + (Math.random() - 0.5) * 15
    );
    ctx.stroke();

    // Noise dots
    for (let i = 0; i < 25; i++) {
      ctx.fillStyle = `rgba(${Math.floor(Math.random() * 100 + 100)}, ${Math.floor(Math.random() * 120 + 80)}, ${Math.floor(Math.random() * 200)}, 0.18)`;
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 3 + 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw characters
    ctx.font = "bold 20px monospace";
    ctx.textBaseline = "middle";
    for (let i = 0; i < code.length; i++) {
      ctx.fillStyle = `rgb(${Math.floor(Math.random() * 80)}, ${Math.floor(Math.random() * 80)}, ${Math.floor(Math.random() * 140 + 60)})`;
      ctx.save();
      const x = 12 + i * 21;
      const y = canvas.height / 2 + (Math.random() - 0.5) * 8;
      const angle = (Math.random() - 0.5) * 0.4;
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillText(code[i], 0, 0);
      ctx.restore();
    }
  };

  useEffect(() => {
    if (loginMethod === "credentials") {
      const code = generateCaptcha();
      setCaptchaCode(code);
      const timer = setTimeout(() => {
        drawCaptcha(code);
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [loginMethod]);

  // Sound synthesizer for feedback
  const playLoginSound = (soundType: "success" | "error") => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      if (soundType === "success") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      }
    } catch (e) {}
  };

  // USB Focus helper
  useEffect(() => {
    if (loginMethod === "qrcode") {
      const timer = setTimeout(() => {
        usbInputRef.current?.focus();
        setIsUsbInputFocused(true);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [loginMethod]);

  // Global rapid typing listener (captures external physical scanner device inputs layout-wide when tab is active)
  const globalBufferRef = useRef("");
  const globalLastTimeRef = useRef(0);

  useEffect(() => {
    if (loginMethod !== "qrcode") return;

    const handleGlobalScan = (e: KeyboardEvent) => {
      // Avoid capturing when writing inside other specialized forms if any
      if (
        document.activeElement?.tagName === "INPUT" &&
        document.activeElement !== usbInputRef.current
      ) {
        return;
      }

      const now = Date.now();
      const diff = now - globalLastTimeRef.current;
      globalLastTimeRef.current = now;

      if (e.key === "Enter") {
        const scannedText = globalBufferRef.current.trim();
        globalBufferRef.current = "";
        
        if (scannedText) {
          const storedSecret = safeStorage.getItem("absensi_admin_qr_key") || "AD_QR_ADMIN_SECRET";
          const expectedToken = `ADMIN_KEY:${storedSecret}`;
          
          if (scannedText === expectedToken || scannedText === storedSecret) {
            playLoginSound("success");
            safeStorage.setItem("attendance_admin_logged", "true");
            onLoginSuccess();
          } else {
            playLoginSound("error");
            setError("QR Code Akses Admin tidak valid!");
            setUsbScanInput("");
            setTimeout(() => setError(null), 5000);
          }
        }
      } else if (e.key.length === 1) {
        // High speed sequences smaller than 65ms are characters from hardware guns
        if (diff < 65 || globalBufferRef.current === "") {
          globalBufferRef.current += e.key;
        } else {
          globalBufferRef.current = e.key;
        }
        setUsbScanInput(globalBufferRef.current);
      }
    };

    window.addEventListener("keydown", handleGlobalScan);
    return () => {
      window.removeEventListener("keydown", handleGlobalScan);
    };
  }, [loginMethod, onLoginSuccess]);

  const handleUsbScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawVal = usbScanInput.trim();
    if (!rawVal) return;

    const storedSecret = safeStorage.getItem("absensi_admin_qr_key") || "AD_QR_ADMIN_SECRET";
    const expectedToken = `ADMIN_KEY:${storedSecret}`;

    if (rawVal === expectedToken || rawVal === storedSecret) {
      playLoginSound("success");
      safeStorage.setItem("attendance_admin_logged", "true");
      onLoginSuccess();
    } else {
      playLoginSound("error");
      setError("QR Code Akses Admin tidak valid atau tidak cocok!");
      setUsbScanInput("");
      setTimeout(() => {
        usbInputRef.current?.focus();
      }, 50);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError("Username dan password tidak boleh kosong");
      return;
    }

    if (captchaInput.trim().toUpperCase() !== captchaCode.toUpperCase()) {
      setError("Kode CAPTCHA salah! Silakan coba lagi.");
      const newCode = generateCaptcha();
      setCaptchaCode(newCode);
      drawCaptcha(newCode);
      setCaptchaInput("");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      const storedPassword = safeStorage.getItem("absensi_admin_password") || "admin123";
      if (username === "admin" && password === storedPassword) {
        safeStorage.setItem("attendance_admin_logged", "true");
        onLoginSuccess();
      } else {
        setError("Kredensial salah! Periksa kembali Username dan Password Anda.");
        setLoading(false);
        // Regenerate captcha on incorrect credentials to preserve security
        const newCode = generateCaptcha();
        setCaptchaCode(newCode);
        drawCaptcha(newCode);
        setCaptchaInput("");
      }
    }, 850);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 flex items-center justify-center p-3 md:p-6 lg:p-8 select-none font-sans">
      
      {/* Container Card with Split-Screen Split Grid */}
      <div className="bg-white w-full max-w-[1100px] rounded-3xl md:rounded-[28px] shadow-2xl border border-slate-150 flex flex-col md:flex-row overflow-hidden relative md:min-h-[580px]">
        
        {/* =========================================================================
            LEFT PANEL: Sleek Minimalist Authentication Form (White Side)
            ========================================================================= */}
        <div className="w-full md:w-[48%] p-6 md:p-8 lg:p-9 flex flex-col justify-between bg-white">
          
          {/* Top Row: System Identity Identity Logo */}
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              {schoolLogo ? (
                <img 
                  src={schoolLogo} 
                  alt="Logo Sekolah" 
                  className="w-9 h-9 rounded-xl object-contain bg-slate-50 p-1 border border-slate-200 shadow-xs shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-extrabold shadow-md shadow-blue-500/10 shrink-0">
                  <Landmark className="w-5 h-5 text-white" />
                </div>
              )}
              <div>
                <span className="text-xs font-black text-slate-800 tracking-wider uppercase font-mono block">QR_PRESENSI</span>
                <span className="text-[9px] font-black text-slate-500 block -mt-1 tracking-tight">SMAN 1 MAJALAYA KARAWANG</span>
              </div>
            </div>

            {/* Offline-First Ready Badge */}
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shrink-0 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[8px] font-black text-emerald-800 font-mono tracking-wider uppercase">Luring Ready</span>
            </div>
          </div>

          {/* Core Central Form */}
          <div className="my-auto py-2 max-w-sm mx-auto w-full">
            <div className="space-y-1 mb-4">
              <h1 className="text-[16px] md:text-[17px] font-black text-slate-800 tracking-tight font-sans leading-snug">
                Selamat Datang di SIMANJA, Aplikasi Absensi Qr-Code Siswa SMAN 1 Majalaya Kabupaten Karawang
              </h1>
              <p className="text-[11px] font-semibold text-slate-500 leading-relaxed">
                Gunakan akun admin sekolah atau scan QR khusus admin untuk mengelola pangkalan data absensi.
              </p>
            </div>

            {/* Login Navigation Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
              <button
                type="button"
                onClick={() => {
                  setLoginMethod("credentials");
                  setError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  loginMethod === "credentials" 
                    ? "bg-white text-slate-800 shadow-sm" 
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <User className="w-3.5 h-3.5" /> Login Manual
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMethod("qrcode");
                  setError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  loginMethod === "qrcode" 
                    ? "bg-white text-slate-800 shadow-sm" 
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <QrCode className="w-3.5 h-3.5" /> Scan QR Admin
              </button>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100/80 text-rose-700 px-3.5 py-2 rounded-xl mb-3 text-xs font-bold leading-normal flex gap-2 animate-pulse">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {loginMethod === "credentials" ? (
              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                {/* Username Input */}
                <div className="space-y-1">
                  <label htmlFor="username-input" className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      id="username-input"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setError(null);
                      }}
                      placeholder="Masukkan username Anda..."
                      className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white rounded-xl text-xs font-bold focus:outline-none focus:ring-0 text-slate-700 placeholder:text-slate-400 transition-all font-sans"
                    />
                    {username === "admin" && (
                      <span className="absolute right-3.5 top-2.5 text-emerald-500 text-xs font-bold animate-fadeIn">
                        <CheckCircle className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label htmlFor="password-input" className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">
                      Sandikata (Password)
                    </label>
                    <a href="#" onClick={(e) => { e.preventDefault(); alert("Silahkan hubungi tim IT Sekolah untuk mendapatkan bantuan akses atau reset password."); }} className="text-[10px] font-bold text-indigo-600 hover:underline">
                      Butuh Bantuan?
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      id="password-input"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError(null);
                      }}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white rounded-xl text-xs font-bold focus:outline-none focus:ring-0 text-slate-700 placeholder:text-slate-400 transition-all font-sans"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Dynamic Alphanumeric CAPTCHA Section */}
                <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex justify-between items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                    {/* Captcha Canvas */}
                    <canvas 
                      ref={canvasRef} 
                      width="125" 
                      height="36" 
                      className="rounded-lg bg-slate-50 shrink-0 select-none overflow-hidden" 
                    />
                    
                    {/* Refresh CAPTCHA button */}
                    <button
                      id="btn-refresh-captcha"
                      type="button"
                      onClick={handleRefreshCaptcha}
                      className="p-1.5 text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                      title="Perbarui kode CAPTCHA"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="captcha-input" className="text-[9.5px] font-extrabold text-slate-500 uppercase tracking-widest block">
                      Ketik Kode Di atas (Sensitif Huruf)
                    </label>
                    <input
                      id="captcha-input"
                      type="text"
                      required
                      maxLength={5}
                      value={captchaInput}
                      onChange={(e) => {
                        setCaptchaInput(e.target.value);
                        setError(null);
                      }}
                      placeholder="Masukkan 5 karakter kode..."
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-slate-800 rounded-xl text-xs font-bold focus:outline-none text-slate-700 font-mono tracking-widest text-center"
                    />
                  </div>
                </div>

                {/* Remember me ticked */}
                <div className="flex items-center gap-2 select-none pt-0.5">
                  <input
                    id="remember-me"
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="remember-me" className="text-[11px] font-semibold text-slate-500 cursor-pointer">
                    Ingat saya di peramban ini selanjutnya.
                  </label>
                </div>

                {/* Action Submit Button */}
                <button
                  id="btn-login-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-xl text-xs font-extrabold shadow-md shadow-slate-900/10 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Mengevaluasi Akun...
                    </>
                  ) : (
                    <>
                      Masuk ke Sistem Absensi <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* USB QR Code / Barcode Scanner Tab View */
              <form onSubmit={handleUsbScanSubmit} className="space-y-4">
                <div 
                  onClick={() => {
                    usbInputRef.current?.focus();
                    setIsUsbInputFocused(true);
                  }}
                  className={`border rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all relative min-h-[250px] group select-none ${
                    isUsbInputFocused 
                      ? "bg-slate-900 border-slate-950 text-white shadow-lg shadow-indigo-950/20" 
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/70"
                  }`}
                >
                  {/* Glowing Radar scan beam effect (only when focused) */}
                  {isUsbInputFocused && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_#34d399] animate-bounce" style={{ animationDuration: '3s' }}></div>
                  )}

                  {/* Icon with pulsing indicator */}
                  <div className="mb-4 relative">
                    <div className={`p-4 rounded-full transition-colors ${
                      isUsbInputFocused 
                        ? "bg-slate-800 text-emerald-400 border border-slate-700/60" 
                        : "bg-slate-200 text-slate-500"
                    }`}>
                      <QrCode className={`w-8 h-8 ${isUsbInputFocused ? "animate-pulse" : ""}`} />
                    </div>
                    {isUsbInputFocused && (
                      <span className="absolute top-1 right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                    )}
                  </div>

                  {/* Monospace Indicator Details */}
                  {isUsbInputFocused ? (
                    <div className="space-y-1">
                      <span className="text-[9px] bg-emerald-950 text-emerald-450 border border-emerald-800/80 px-2.5 py-0.5 rounded-full font-black uppercase tracking-widest font-mono">
                        STANDBY SCANNING
                      </span>
                      <h4 className="text-xs font-black text-white pt-1">MENUNGGU HASIL SCANNER USB</h4>
                      <p className="text-[10px] text-slate-450 max-w-[280px] leading-relaxed mx-auto font-medium">
                        Silakan posisikan laser mesin USB Scanner ke arah QR Code Admin Anda. Hasil pindaian akan langsung diotentikasi.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full font-black uppercase tracking-widest font-mono">
                        FOKUS KONEKSI LEPAS
                      </span>
                      <h4 className="text-xs font-black text-slate-800 pt-1">KLIK DUA KALI DI SINI UNTUK MEMFOKUSKAN</h4>
                      <p className="text-[10px] text-slate-500 max-w-[280px] leading-relaxed mx-auto">
                        Aplikasi tidak dapat menerima input ketikan scanner. Ketuk kotak ini sekarang agar mesin siap menyalin data.
                      </p>
                    </div>
                  )}

                  {/* Hidden/Stylized Input field (keeps focus and acts as scanner receiver) */}
                  <div className="mt-4 w-full max-w-[220px] relative z-10">
                    <input
                      ref={usbInputRef}
                      type="text"
                      value={usbScanInput}
                      onFocus={() => setIsUsbInputFocused(true)}
                      onBlur={() => setIsUsbInputFocused(false)}
                      onChange={(e) => {
                        setUsbScanInput(e.target.value);
                        setError(null);
                      }}
                      placeholder="Input token laser..."
                      className={`w-full px-3 py-1.5 rounded-lg text-center font-mono text-xs font-extrabold focus:outline-none focus:ring-0 ${
                        isUsbInputFocused 
                          ? "bg-slate-800 border-slate-700 text-emerald-400 placeholder:text-slate-600 focus:border-emerald-550 focus:bg-slate-800/90" 
                          : "bg-slate-100 border-slate-200 text-slate-400 placeholder:text-slate-300"
                      } border transition-all`}
                    />
                  </div>
                </div>

                {/* Info & Simulator Tool */}
                <div className="space-y-2.5">
                  <div className="border border-slate-150 rounded-xl p-3 bg-indigo-50/50 flex gap-2.5 items-start">
                    <ShieldCheck className="w-4.5 h-4.5 text-indigo-600 shrink-0 mt-0.5" />
                    <p className="text-[9.5px] font-semibold text-slate-600 leading-normal">
                      Metode USB Scanner bekerja dengan membaca QR Code sebagai data teks utuh. Amankan lembar cetak QR code Anda agar hanya administrator terverifikasi yang dapat masuk.
                    </p>
                  </div>

                  {/* Built-in high-quality simulation test rig */}
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 text-center space-y-1.5">
                    <span className="text-[8.5px] text-slate-450 uppercase tracking-widest font-bold block">Simulator Pengujian Pindai USB:</span>
                    <button
                      id="btn-simulate-admin-scan"
                      type="button"
                      onClick={() => {
                        const storedSecret = safeStorage.getItem("absensi_admin_qr_key") || "AD_QR_ADMIN_SECRET";
                        setUsbScanInput(`ADMIN_KEY:${storedSecret}`);
                        setTimeout(() => {
                          playLoginSound("success");
                          safeStorage.setItem("attendance_admin_logged", "true");
                          onLoginSuccess();
                        }, 350);
                      }}
                      className="w-full py-1.5 bg-indigo-600 hover:bg-slate-900 text-white font-bold rounded-lg text-[10px] transition-all cursor-pointer shadow-2xs"
                    >
                      ⚡ Ketuk Untuk Mensimulasikan Hasil Pindai USB Admin
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

        </div>

        {/* =========================================================================
            RIGHT PANEL: Interactive slide-show presenting modern geometrical patterns
            and floating app preview layers (Dynamic colorful side)
            ========================================================================= */}
        <div className="hidden md:block w-[52%] relative overflow-hidden self-stretch">
          
          {/* SLIDE 0: Dark slate background with bold Coral Semicircles, dark pillars & triangular grids */}
          <div 
            className={`absolute inset-0 transition-all duration-1000 ease-in-out flex flex-col justify-between p-8 lg:p-10 pb-16 text-white overflow-hidden ${
              currentSlide === 0 ? "opacity-100 translate-x-0 scale-100 z-20" : "opacity-0 translate-x-20 scale-95 z-10 pointer-events-none"
            }`}
            style={{ backgroundColor: "#1d2433" }}
          >
            {/* Vector art shapes decoration for Slide 0 */}
            <div className="absolute top-10 right-10 w-48 h-48 bg-rose-500 rounded-full mix-blend-screen filter opacity-75 animate-pulse" />
            <div className="absolute top-1/3 left-10 w-24 h-48 bg-amber-600 rounded-r-full rotate-45 opacity-60" />
            <div className="absolute -bottom-10 right-1/4 w-52 h-52 bg-slate-800 rounded-full" />
            <div className="absolute bottom-1/4 right-10 w-20 h-20 bg-rose-600 rounded-l-full" />
            
            {/* Minimal line details matching the abstract geometric design */}
            <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <line x1="10%" y1="10%" x2="90%" y2="90%" stroke="white" strokeWidth="2" strokeDasharray="5,5" />
              <circle cx="80%" cy="30%" r="40" fill="none" stroke="white" strokeWidth="2" />
              <polygon points="50,150 100,250 0,250" fill="none" stroke="white" strokeWidth="2" />
            </svg>

            {/* Title / Description info on Slide 0 */}
            <div className="relative z-30 flex items-center justify-between">
              <span className="text-[10px] bg-white/20 px-2.5 py-1 rounded-full font-bold tracking-wider font-mono">Modul Utama</span>
              <span className="text-[10px] text-slate-300 font-bold">Slide 1 dari 3</span>
            </div>

            {/* Central Laptop/Device Mockup with absolute HTML Elements */}
            <div className="relative z-30 mx-auto my-auto w-full max-w-[340px] transform hover:scale-105 transition-transform duration-500">
              {/* Device outer frame */}
              <div className="bg-slate-900 rounded-2xl p-2 shadow-2xl border border-slate-700/80 shadow-black/40">
                <div className="bg-slate-950 rounded-lg aspect-[16/10] overflow-hidden p-2.5 flex flex-col justify-between">
                  {/* Mock toolbar */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </div>
                    <span className="text-[8px] text-slate-500 font-mono">absensi-live-report.xml</span>
                  </div>
                  {/* Mock charts */}
                  <div className="space-y-1.5 py-1.5">
                    <div className="flex justify-between items-center text-[8px] text-slate-400 font-bold">
                      <span>Live Persentase Hari Ini:</span>
                      <span className="text-emerald-450 font-mono">92.4%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: "92.4%" }}></div>
                    </div>
                    {/* Mock log entries */}
                    <div className="space-y-1">
                      <div className="bg-slate-800/45 p-1 rounded border border-white/5 flex justify-between items-center text-[7.5px]">
                        <span className="text-slate-300 font-bold">Siswa : Adrian (X-RPL)</span>
                        <span className="text-emerald-400 bg-emerald-500/10 px-1 rounded font-extrabold uppercase scale-90">Hadir (H)</span>
                      </div>
                      <div className="bg-slate-800/45 p-1 rounded border border-white/5 flex justify-between items-center text-[7.5px]">
                        <span className="text-slate-300 font-bold">Siswa : Fatimah (XI-IPA)</span>
                        <span className="text-amber-400 bg-amber-500/10 px-1 rounded font-extrabold uppercase scale-90">Izin (I)</span>
                      </div>
                    </div>
                  </div>
                  {/* System update details */}
                  <div className="text-[7px] text-slate-600 text-center uppercase tracking-widest font-mono">
                    Dashboard Kehadiran Aktif
                  </div>
                </div>
              </div>
            </div>

            {/* Large text & sub-text summary descriptive paragraph */}
            <div className="relative z-30 space-y-1 text-left">
              <h3 className="text-base lg:text-lg font-extrabold tracking-tight">
                Kelola Manajemen Kehadiran
              </h3>
              <p className="text-[11px] lg:text-xs text-slate-300/90 leading-relaxed font-semibold">
                Pantau statistik presensi real-time, sanksi akumulatif kedisiplinan, hingga grafik bulanan siswa dengan mudah dan akurat dalam satu panel terintegrasi.
              </p>
            </div>
          </div>

          {/* SLIDE 1: Teal background with orange dots, colorful layout cubes, diagonal frames */}
          <div 
            className={`absolute inset-0 transition-all duration-1000 ease-in-out flex flex-col justify-between p-8 lg:p-10 pb-16 text-white overflow-hidden ${
              currentSlide === 1 ? "opacity-100 translate-x-0 scale-100 z-20" : "opacity-0 translate-x-20 scale-95 z-10 pointer-events-none"
            }`}
            style={{ backgroundColor: "#0f766e" }}
          >
            {/* Vector art shapes decoration for Slide 1 */}
            <div className="absolute top-1/4 right-1/4 w-36 h-36 bg-amber-500 rounded-full opacity-70 animate-bounce" />
            <div className="absolute -top-12 left-10 w-44 h-44 bg-cyan-500/50 rounded-full" />
            <div className="absolute bottom-10 right-10 w-28 h-56 bg-orange-500/60 rounded-l-full rotate-12" />
            
            <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20%" cy="40%" r="60" fill="none" stroke="white" strokeWidth="2" />
              <circle cx="20%" cy="40%" r="5" fill="white" />
              <line x1="0" y1="50" x2="300" y2="50" stroke="white" strokeWidth="2" />
              <rect x="70%" y="40%" width="80" height="80" fill="none" stroke="white" strokeWidth="1.5" transform="rotate(45)" />
            </svg>

            <div className="relative z-30 flex items-center justify-between">
              <span className="text-[10px] bg-white/20 px-2.5 py-1 rounded-full font-bold tracking-wider font-mono">Sinkronisasi</span>
              <span className="text-[10px] text-slate-200 font-bold">Slide 2 dari 3</span>
            </div>

            {/* Central Laptop/Device Mockup */}
            <div className="relative z-30 mx-auto my-auto w-full max-w-[340px] transform hover:scale-105 transition-transform duration-500">
              <div className="bg-slate-900 rounded-2xl p-2 shadow-2xl border border-slate-700/80 shadow-black/40">
                <div className="bg-slate-950 rounded-lg aspect-[16/10] overflow-hidden p-2.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </div>
                    <span className="text-[8px] text-slate-500 font-mono">firestore-cloud-db.xml</span>
                  </div>
                  {/* Cloud Firestore styling */}
                  <div className="flex-1 py-1.5 flex flex-col justify-center space-y-1.5">
                    <div className="bg-blue-950/60 rounded border border-blue-500/30 p-1.5 flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-blue-550 flex items-center justify-center text-[10px] font-black text-white">☁</div>
                      <div>
                        <span className="text-[8px] text-blue-300 font-black block">Cloud Firestore Active</span>
                        <span className="text-[6.5px] text-slate-400 block -mt-0.5">Auto-synchronize multi-device admin access</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[6px] font-mono text-center">
                      <div className="bg-slate-800 p-1 rounded text-slate-300 border border-white/5">NIS &amp; Nama</div>
                      <div className="bg-slate-800 p-1 rounded text-slate-300 border border-white/5">Kelas Siswa</div>
                      <div className="bg-slate-800 p-1 rounded text-slate-300 border border-white/5">Waktu Scan</div>
                    </div>
                  </div>
                  <div className="text-[7px] text-slate-600 text-center uppercase tracking-widest font-mono">
                    Cloud Database Terpusat
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-30 space-y-1 text-left">
              <h3 className="text-base lg:text-lg font-extrabold tracking-tight">
                Sinkronisasi Cloud Firestore
              </h3>
              <p className="text-[11px] lg:text-xs text-slate-200/90 leading-relaxed font-semibold">
                Setiap data kehadiran dan perubahan data siswa tersimpan secara real-time dan terpusat di Cloud Database Firestore, aman dari kehilangan data lokal.
              </p>
            </div>
          </div>

          {/* SLIDE 2: Blue-Indigo background with geometric arches, pastel spheres and pink patterns */}
          <div 
            className={`absolute inset-0 transition-all duration-1000 ease-in-out flex flex-col justify-between p-8 lg:p-10 pb-16 text-white overflow-hidden ${
              currentSlide === 2 ? "opacity-100 translate-x-0 scale-100 z-20" : "opacity-0 translate-x-20 scale-95 z-10 pointer-events-none"
            }`}
            style={{ backgroundColor: "#2563eb" }}
          >
            {/* Vector art shapes decoration for Slide 2 */}
            <div className="absolute top-10 left-10 w-32 h-32 bg-amber-400 rounded-full opacity-60" />
            <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-pink-500 rounded-full animate-pulse opacity-80" />
            <div className="absolute -bottom-10 -right-10 w-60 h-60 bg-emerald-600 rounded-full" />
            <div className="absolute top-1/2 left-1/4 w-12 h-24 bg-slate-900 rounded-b-full rotate-90" />

            <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <rect x="5%" y="70%" width="60" height="60" fill="none" stroke="white" strokeWidth="2" />
              <line x1="0" y1="0" x2="300" y2="300" stroke="white" strokeWidth="2" />
              <path d="M 10 80 Q 52.5 10, 95 80" fill="none" stroke="white" strokeWidth="2.5" />
            </svg>

            <div className="relative z-30 flex items-center justify-between">
              <span className="text-[10px] bg-white/20 px-2.5 py-1 rounded-full font-bold tracking-wider font-mono">Pemindai QR</span>
              <span className="text-[10px] text-slate-200 font-bold">Slide 3 dari 3</span>
            </div>

            {/* Central Laptop/Device Mockup */}
            <div className="relative z-30 mx-auto my-auto w-full max-w-[340px] transform hover:scale-105 transition-transform duration-500">
              <div className="bg-slate-900 rounded-2xl p-2 shadow-2xl border border-slate-700/80 shadow-black/40">
                <div className="bg-slate-950 rounded-lg aspect-[16/10] overflow-hidden p-2.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </div>
                    <span className="text-[8px] text-slate-500 font-mono">webcam-scan-portal.xml</span>
                  </div>
                  {/* Mock camera scanning visual */}
                  <div className="flex-1 py-1 flex items-center justify-center relative">
                    <div className="w-32 h-18 bg-slate-900 border border-blue-500/40 rounded-md relative overflow-hidden flex flex-col justify-center items-center">
                      {/* Active green scan lines */}
                      <div className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] top-1/2 animate-bounce"></div>
                      <span className="text-[15px] text-slate-400">📷</span>
                      <span className="text-[6.5px] font-bold text-emerald-400 uppercase tracking-widest mt-0.5 font-mono">Kamera Siap Mendeteksi</span>
                    </div>
                  </div>
                  <div className="text-[7px] text-slate-600 text-center uppercase tracking-widest font-mono">
                    Lensa Kamera Absensi
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-30 space-y-1 text-left">
              <h3 className="text-base lg:text-lg font-extrabold tracking-tight">
                Scan Kartu QR Mandiri Siswa
              </h3>
              <p className="text-[11px] lg:text-xs text-slate-200/90 leading-relaxed font-semibold">
                Dukungan scan barcode dua arah via kamera laptop (Webcam) atau hubungkan mesin pemindai USB eksternal secara plug-and-play dengan suara audio yang alami.
              </p>
            </div>
          </div>

          {/* Bottom Slide Indicators & Slide Controller (Interactive Dots) */}
          <div className="absolute bottom-6 left-8 right-8 lg:left-10 lg:right-10 z-40 flex items-center justify-between">
            {/* Horizontal Pagination Dot list */}
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((idx) => (
                <button
                  id={`btn-slide-dot-${idx}`}
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    currentSlide === idx ? "w-7 bg-white" : "w-2 bg-white/40 hover:bg-white/70"
                  }`}
                  title={`Tampilkan slide ${idx + 1}`}
                />
              ))}
            </div>
            
            {/* Active module summary status tag */}
            <span className="text-[9px] font-black text-white/70 tracking-widest uppercase font-mono bg-white/10 px-2 py-0.5 rounded">
              SISTEM AMAN (SSL)
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}
