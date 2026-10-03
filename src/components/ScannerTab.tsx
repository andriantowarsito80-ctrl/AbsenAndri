/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Student, AttendanceRecord } from "../types";
import { Html5Qrcode, Html5QrcodeCameraScanConfig } from "html5-qrcode";
import { Camera, SwitchCamera, VideoOff, Play, CheckCircle, ShieldAlert, MonitorCheck, Keyboard, Volume2 } from "lucide-react";

interface ScannerTabProps {
  students: Student[];
  records: AttendanceRecord[];
  onTriggerAttendance: (nis: string) => { success: boolean; msg: string; label?: string } | null;
  isOnline?: boolean;
}

export default function ScannerTab({
  students,
  records,
  onTriggerAttendance,
  isOnline = true,
}: ScannerTabProps) {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Keyboard simulator states
  const [manualScanNis, setManualScanNis] = useState("");

  const qrReaderRef = useRef<Html5Qrcode | null>(null);
  const QR_READER_ID = "camera-qr-scanner-element";

  // HTML5 Web Audio API beep synthesizer for audio cueing
  const playBeepSound = (type: "success" | "error") => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === "success") {
        oscillator.type = "sine";
        // If offline, use a louder beep sound
        const freq = isOnline ? 880 : 1000;
        const volume = isOnline ? 0.1 : 0.6; // Much louder beep when offline
        const duration = isOnline ? 0.15 : 0.35; // Longer beep when offline
        
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + duration);
      } else {
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(220, audioCtx.currentTime); // Low buzz
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3); // buzz for 300ms
      }
    } catch (err) {
      console.warn("Audio Context API not supported or user gesture required first:", err);
    }
  };

  // 1. Fetch available cameras on mount
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        setCameras(devices);
        if (devices.length > 0) {
          // Default to back camera ('environment') if available, otherwise first camera
          const backCam = devices.find(d => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("rear") || d.label.toLowerCase().includes("environment"));
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        }
      })
      .catch((err) => {
        console.error("Gagal mendeteksi kamera perangkat:", err);
      });

    // Cleanup scanning component on unmount
    return () => {
      stopScanning();
    };
  }, []);

  const handleScanSuccess = (decodedText: string) => {
    const rawNis = decodedText.trim();
    if (!rawNis) return;

    // Trigger state handler
    const response = onTriggerAttendance(rawNis);
    
    if (response) {
      if (response.success) {
        setScanResult({
          type: "success",
          text: `Berhasil Absen! ${response.label || ""} (NIS: ${rawNis}) - ${response.msg}`,
        });
        playBeepSound("success");
      } else {
        setScanResult({
          type: "error",
          text: `Gagal Absen! NIS: ${rawNis} - ${response.msg}`,
        });
        playBeepSound("error");
      }
    } else {
      setScanResult({
        type: "error",
        text: `Data untuk NIS: ${rawNis} tidak ditemukan di database siswa.`,
      });
      playBeepSound("error");
    }

    // Auto clear results block after 6 seconds
    const timer = setTimeout(() => setScanResult(null), 6000);
    return () => clearTimeout(timer);
  };

  // Start Camera scanning
  const startScanning = async () => {
    if (!selectedCameraId) return;
    
    try {
      setScanResult(null);
      const scanner = new Html5Qrcode(QR_READER_ID);
      qrReaderRef.current = scanner;

      const config: Html5QrcodeCameraScanConfig = {
        fps: 10,
        qrbox: { width: 260, height: 260 },
      };

      await scanner.start(
        selectedCameraId,
        config,
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Silence continuous parsing frame logs in console
        }
      );
      
      setIsScanning(true);
    } catch (err) {
      console.error("Gagal memulai kamera scanner html5-qrcode:", err);
      setIsScanning(false);
      alert("Akses kamera ditolak atau kamera sedang digunakan oleh aplikasi lain.");
    }
  };

  // Stop Camera stream
  const stopScanning = async () => {
    if (qrReaderRef.current && qrReaderRef.current.isScanning) {
      try {
        await qrReaderRef.current.stop();
        qrReaderRef.current = null;
      } catch (err) {
        console.error("Error stopping qr reader camera stream:", err);
      }
    }
    setIsScanning(false);
  };

  // Manual Trigger scanning for simulations (or if camera doesn't work inside iframe)
  const handleManualTrigger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualScanNis.trim()) return;
    handleScanSuccess(manualScanNis.trim());
    setManualScanNis("");
  };

  return (
    <div className="space-y-6" id="scanner-tab">
      
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">📸 Pemindai QR Code Absensi (Kamera & USB)</h2>
        <p className="text-xs text-slate-500">Pindai kode QR siswa menggunakan kamera perangkat depan/belakang serta mendukung penggunaan pemindai USB global otomatis.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* WEBCAM CAMERA SCANNER GRID */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center select-none">
          <h3 className="text-sm font-bold text-slate-700 w-full mb-4 flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="flex items-center gap-1.5"><Camera className="w-5 h-5 text-blue-600" /> Scanner Kamera Aktif</span>
            <span className="text-[10px] bg-blue-50 border border-blue-200 text-blue-650 font-extrabold px-2 py-0.5 rounded-full uppercase">Kamera Fisik</span>
          </h3>

          {/* Camera choosing inputs and triggers */}
          <div className="w-full flex flex-col sm:flex-row gap-3 items-center justify-between mb-5">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500 shrink-0">Sumber Kamera:</span>
              <select
                id="camera-device-select"
                value={selectedCameraId}
                onChange={(e) => {
                  setSelectedCameraId(e.target.value);
                  if (isScanning) {
                    stopScanning().then(() => startScanning());
                  }
                }}
                disabled={cameras.length === 0}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 text-slate-700 w-full sm:w-60 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
              >
                {cameras.length === 0 ? (
                  <option value="">Tidak ada kamera terdeteksi</option>
                ) : (
                  cameras.map((cam) => (
                    <option key={cam.id} value={cam.id}>
                      {cam.label || `Kamera ${cameras.indexOf(cam) + 1}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Toggle Streaming Start/Stop */}
            <div className="flex gap-2 w-full sm:w-auto shrink-0">
              {isScanning ? (
                <button
                  id="btn-stop-camera"
                  onClick={stopScanning}
                  className="w-full sm:w-auto flex items-center justify-center gap-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  <VideoOff className="w-4 h-4" /> Matikan Kamera
                </button>
              ) : (
                <button
                  id="btn-start-camera"
                  onClick={startScanning}
                  disabled={cameras.length === 0}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:bg-slate-300"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Mulai Kamera
                </button>
              )}
            </div>
          </div>

          {/* Render Area Screen */}
          <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-slate-900 border-4 border-slate-950 shadow-md mb-4 flex items-center justify-center">
            
            {/* The real element for html5-qrcode */}
            <div id={QR_READER_ID} className="absolute inset-0 w-full h-full object-cover z-0"></div>

            {/* Simulated overlays & guides */}
            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-slate-400 bg-slate-950/90 z-10 space-y-3">
                <div className="p-4 rounded-full bg-slate-900 text-slate-500 border border-slate-800">
                  <VideoOff className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">KAMERA BELUM AKTIF</span>
                  <p className="text-[10px] text-slate-500 max-w-[240px] mt-1 leading-normal">
                    Silakan pilih sumber kamera di atas dan klik tombol <strong>"Mulai Kamera"</strong> untuk mengaktifkan video feed scanner.
                  </p>
                </div>
              </div>
            )}

            {isScanning && (
              <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                {/* Visual Radar scan beam effect */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_cyan] animate-bounce" style={{ animationDuration: '4s' }}></div>

                {/* Target Frame indicators */}
                <div className="w-60 h-60 border-2 border-dashed border-blue-400/40 rounded-xl relative">
                  {/* Neon laser corners */}
                  <div className="absolute -top-1.5 -left-1.5 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl"></div>
                  <div className="absolute -top-1.5 -right-1.5 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr"></div>
                  <div className="absolute -bottom-1.5 -left-1.5 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl"></div>
                  <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br"></div>
                </div>

                <div className="absolute bottom-5 bg-black/75 px-3 py-1 rounded-full text-[9px] font-bold text-blue-300 tracking-wider">
                  HADAPKAN QR CODE KARTU PADA LAYAR
                </div>
              </div>
            )}
          </div>

          <p className="text-[10.5px] text-slate-400 text-center uppercase tracking-wider font-semibold">Webcam Render Frame</p>
        </div>

        {/* SECOND GRID: TESTING & USB INFO */}
        <div className="space-y-6">
          
          {/* Real scan results display */}
          {scanResult && (
            <div className={`p-5 rounded-2xl border flex items-start gap-3 shadow-sm animate-none ${
              scanResult.type === "success" 
                ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}>
              <div className="shrink-0 mt-0.5">
                {scanResult.type === "success" ? (
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-rose-500" />
                )}
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase block tracking-wider text-slate-500">
                  Hasil Log Pindai Terakhir:
                </span>
                <p className="text-xs font-semibold leading-normal">{scanResult.text}</p>
                
                {/* Visual success beep notification */}
                <span className="text-[9.5px] text-slate-400 flex items-center gap-1 font-medium pt-0.5">
                  <Volume2 className="w-3 h-3 text-slate-450" /> Suara Beep Terpicu Aktif
                </span>
              </div>
            </div>
          )}

          {/* USB Scanner global recognition Information Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <h3 className="text-md font-bold text-slate-850 flex items-center gap-2 border-b border-slate-100 pb-2">
              <MonitorCheck className="w-5 h-5 text-blue-600" /> Pemindai USB Scanner Global
            </h3>
            
            <p className="text-[11.5px] text-slate-600 leading-relaxed">
              Sistem absensi dilengkapi teknologi <strong>Global USB Barcode Listener</strong>. Pemindai USB (seperti scanner pistol / QR scanner external) bekerja layaknya keyboard.
            </p>

            <div className="p-3.5 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 space-y-2 text-[11px]">
              <span className="font-extrabold text-emerald-800 uppercase tracking-widest block text-[9.5px]">🚀 STATUS AUTO DETECT: AKTIF</span>
              <p className="text-slate-600 leading-normal">
                Anda dapat menyambungkan alat pemindai (scanner USB) via kabel/Bluetooth, lalu arahkan laser alat ke kode QR siswa **kapan saja, di halaman mana saja pada aplikasi**, sistem akan mencatat kehadiran secara langsung secara instan!
              </p>
            </div>

            <div className="text-[10px] text-blue-500 flex items-center gap-1.5 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 font-semibold leading-normal">
              <Keyboard className="w-4 h-4 shrink-0 text-blue-600" />
              <span>Sistem mendeteksi sequence input cepat scanner secara otomatis.</span>
            </div>
          </div>

          {/* Manual Input Simulator (extremely useful if camera scanner fails inside the AI Studio sandboxed iframe) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Keyboard className="w-5 h-5 text-blue-600" /> Simulator Ketik Manual / Scanner
            </h3>
            
            <p className="text-[11px] text-slate-500">
              Gunakan simulator di bawah ini jika scanner fisik tidak tersedia, atau kamera perangkat terkendala izin akses dalam frame.
            </p>

            <form onSubmit={handleManualTrigger} className="space-y-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Input Nomor NIS Siswa:</label>
                <div className="flex gap-2">
                  <input
                    id="manual-nis-scanner-input"
                    type="text"
                    required
                    placeholder="Contoh: 10103 atau 10101"
                    value={manualScanNis}
                    onChange={(e) => setManualScanNis(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <button
                    id="btn-trigger-manual-scan"
                    type="submit"
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-sm transition-colors cursor-pointer shrink-0"
                  >
                    Simulasi Pindai
                  </button>
                </div>
              </div>
            </form>

            {/* Quick action list for testing */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Daftar NIS untuk Pengujian:</span>
              <div className="flex flex-wrap gap-1.5">
                {students.slice(0, 5).map((s) => (
                  <button
                    id={`btn-test-scan-nis-${s.nis}`}
                    key={s.nis}
                    onClick={() => {
                      setManualScanNis(s.nis);
                    }}
                    className="px-2 py-1 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 rounded text-[10.5px] font-mono text-slate-600 font-bold transition-all cursor-pointer"
                  >
                    {s.nis} ({s.nama.split(" ")[0]})
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
