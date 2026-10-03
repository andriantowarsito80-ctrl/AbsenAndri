/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { SchoolProfile, HolidayRange } from "../types";
import { Plus, Trash2, Save, Upload, FileText, Image, ShieldAlert, User, Key, Lock, RefreshCw, Eye, EyeOff, Check, Download, QrCode } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { safeStorage } from "../utils/storage";

interface PengaturanTabProps {
  profile: SchoolProfile;
  bgType: "default" | "color" | "custom";
  bgColor: string;
  bgImage: string | null;
  onUpdateProfile: (updated: Partial<SchoolProfile>) => void;
  onUpdateAppBg: (type: "default" | "color" | "custom", color: string, imageBase64: string | null) => void;
  adminName: string;
  onUpdateAdminName: (name: string) => void;
  adminPhoto: string;
  onUpdateAdminPhoto: (photo: string) => void;
  onClearAllRecords?: () => void;
}

export default function PengaturanTab({
  profile,
  bgType,
  bgColor,
  bgImage,
  onUpdateProfile,
  onUpdateAppBg,
  adminName,
  onUpdateAdminName,
  adminPhoto,
  onUpdateAdminPhoto,
  onClearAllRecords,
}: PengaturanTabProps) {
  // Input fields for School profile
  const [namaSekolah, setNamaSekolah] = useState(profile.namaSekolah);
  const [npsn, setNpsn] = useState(profile.npsn);
  const [status, setStatus] = useState(profile.status);
  const [namaKepalaSekolah, setNamaKepalaSekolah] = useState(profile.namaKepalaSekolah);
  const [semester, setSemester] = useState(profile.semester);
  const [tahunPelajaran, setTahunPelajaran] = useState(profile.tahunPelajaran);
  const [jamMasuk, setJamMasuk] = useState(profile.jamMasuk);
  
  // Clear all logs state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Admin details state
  const [adminNameInput, setAdminNameInput] = useState(adminName);
  const [adminPhotoInput, setAdminPhotoInput] = useState(adminPhoto);
  const [adminSaved, setAdminSaved] = useState(false);
  
  // Local state for adding holiday ranges
  const [holidayStart, setHolidayStart] = useState("");
  const [holidayEnd, setHolidayEnd] = useState("");
  const [holidayDesc, setHolidayDesc] = useState("");
  const [holidayError, setHolidayError] = useState("");

  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Password management states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // QR Auth management states
  const [adminQrKey, setAdminQrKey] = useState(() => {
    const key = safeStorage.getItem("absensi_admin_qr_key");
    if (key) return key;
    const generated = "AD_QR_" + Math.random().toString(36).substring(2, 10).toUpperCase();
    safeStorage.setItem("absensi_admin_qr_key", generated);
    return generated;
  });
  const [qrTokenSuccess, setQrTokenSuccess] = useState("");

  const handleSaveNewPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    const storedPass = safeStorage.getItem("absensi_admin_password") || "admin123";

    if (currentPassword !== storedPass) {
      setPasswordError("Password lama (saat ini) salah!");
      return;
    }

    if (newPassword.length < 5) {
      setPasswordError("Password baru harus minimal 5 karakter!");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Konfirmasi password baru tidak cocok!");
      return;
    }

    safeStorage.setItem("absensi_admin_password", newPassword);
    setPasswordSuccess("Password administrator sukses diperbarui!");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleRegenerateQrToken = () => {
    const generated = "AD_QR_" + Math.random().toString(36).substring(2, 10).toUpperCase();
    safeStorage.setItem("absensi_admin_qr_key", generated);
    setAdminQrKey(generated);
    setQrTokenSuccess("Token QR Code login admin yang baru berhasil disinkronkan!");
    setTimeout(() => setQrTokenSuccess(""), 4000);
  };

  const handleDownloadAdminQr = () => {
    const canvas = document.getElementById("admin-qr-canvas-element") as HTMLCanvasElement;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `QR_Akses_Admin_${adminQrKey}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Gagal mengunduh QR Code Admin:", err);
    }
  };

  // Handle saving primary school Profile data
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      namaSekolah,
      npsn,
      status,
      namaKepalaSekolah,
      semester: semester as "Ganjil" | "Genap",
      tahunPelajaran,
      jamMasuk,
    });
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 3000);
  };

  // Add a holiday Range
  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    setHolidayError("");

    if (!holidayStart || !holidayEnd || !holidayDesc.trim()) {
      setHolidayError("Semua form rentang tanggal & keterangan libur wajib diisi.");
      return;
    }

    if (new Date(holidayStart) > new Date(holidayEnd)) {
      setHolidayError("Tanggal mulai tidak boleh melebihi tanggal akhir libur.");
      return;
    }

    const newHoliday: HolidayRange = {
      id: "holiday-" + Date.now(),
      startDate: holidayStart,
      endDate: holidayEnd,
      description: holidayDesc.trim(),
    };

    onUpdateProfile({
      holidayRanges: [...profile.holidayRanges, newHoliday],
    });

    // Clear inputs
    setHolidayStart("");
    setHolidayEnd("");
    setHolidayDesc("");
  };

  // Delete holiday Range
  const handleDeleteHoliday = (id: string) => {
    onUpdateProfile({
      holidayRanges: profile.holidayRanges.filter((r) => r.id !== id),
    });
  };

  // School Logo Image Upload handler: Converts to Base64 String
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      onUpdateProfile({ logo: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  // Custom Background Image Upload handler: Base64
  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      onUpdateAppBg("custom", "", reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Admin Photo Upload handler: Converts to Base64 String
  const handleAdminPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAdminPhotoInput(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAdminProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateAdminName(adminNameInput);
    onUpdateAdminPhoto(adminPhotoInput);
    setAdminSaved(true);
    setTimeout(() => setAdminSaved(false), 3000);
  };

  return (
    <div className="space-y-6" id="pengaturan-tab">
      
      {/* Tab Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">⚙️ Pengaturan & Kustomisasi Absensi</h2>
        <p className="text-xs text-slate-500">Konfigurasi profil sekolah, atur jam masuk, kelola rentang tanggal libur khusus, upload desain logo, dan atur latar belakang.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* FIRST COLUMN: PROFILE SEKOLAH & LOGO */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card Form Profil Sekolah */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <FileText className="w-5 h-5 text-blue-600" /> Profil & Identitas Sekolah
            </h3>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Nama Sekolah */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Nama Sekolah</label>
                  <input
                    id="set-nama-sekolah"
                    type="text"
                    value={namaSekolah}
                    onChange={(e) => setNamaSekolah(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* NPSN */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">NPSN</label>
                  <input
                    id="set-npsn"
                    type="text"
                    value={npsn}
                    onChange={(e) => setNpsn(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-semibold focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Status Sekolah */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Status Sekolah</label>
                  <select
                    id="set-status-sekolah"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Negeri">Negeri</option>
                    <option value="Swasta">Swasta</option>
                  </select>
                </div>

                {/* Kepala Sekolah */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Nama Kepala Sekolah</label>
                  <input
                    id="set-kepala-sekolah"
                    type="text"
                    value={namaKepalaSekolah}
                    onChange={(e) => setNamaKepalaSekolah(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>

                {/* Semester */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Semester Aktif</label>
                  <select
                    id="set-semester"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                </div>

                {/* Tahun Pelajaran */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Tahun Pelajaran</label>
                  <input
                    id="set-tahun-pelajaran"
                    type="text"
                    value={tahunPelajaran}
                    onChange={(e) => setTahunPelajaran(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold font-mono"
                  />
                </div>

                {/* Jam Masuk Batas Toleransi */}
                <div className="space-y-1 col-span-1 sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase text-blue-600 block">Jam Masuk Sekolah (Batas Terlambat)</label>
                  <div className="flex items-center gap-3">
                    <input
                      id="set-jam-masuk"
                      type="time"
                      value={jamMasuk}
                      onChange={(e) => setJamMasuk(e.target.value)}
                      className="px-4 py-2 border border-blue-200 text-blue-900 rounded-xl text-sm font-bold font-mono focus:ring-1 focus:ring-blue-500 bg-blue-50/35"
                    />
                    <span className="text-xs text-slate-500 block">
                      Semua perhitungan keterlambatan (DT) di halaman Rekap dan Kedisiplinan akan langsung menyesuaikan dengan nilai ini.
                    </span>
                  </div>
                </div>

              </div>

              {copiedSuccess && (
                <div className="bg-emerald-50 text-emerald-800 p-3 rounded-lg text-xs font-medium border border-emerald-150">
                  ✔ Profil identitas sekolah berhasil disimpan dan diperbarui di seluruh tab!
                </div>
              )}

              {/* Action save profile button */}
              <div className="pt-2 flex justify-end">
                <button
                  id="btn-save-profile"
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Simpan Profil Sekolah
                </button>
              </div>
            </form>
          </div>

          {/* Card Form Profil Admin */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <User className="w-5 h-5 text-indigo-600" /> Profil Administrator & Pengelola
            </h3>
            
            <p className="text-xs text-slate-500 mb-4">
              Konfigurasi nama lengkap serta foto profil administrator yang akan ditampilkan pada papan status / top bar navigasi absensi.
            </p>

            <form onSubmit={handleSaveAdminProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Nama Admin */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Nama Administrator</label>
                  <input
                    id="set-admin-name"
                    type="text"
                    required
                    value={adminNameInput}
                    onChange={(e) => setAdminNameInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-blue-500"
                    placeholder="Contoh: Andrianto Tito, S.Pd."
                  />
                </div>

                {/* Upload Foto Admin */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase block">Foto Profil Admin</label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <img
                      src={adminPhotoInput}
                      alt="Preview Foto Admin"
                      className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0"
                    />
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => document.getElementById("admin-photo-uploader")?.click()}
                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-slate-100 border border-indigo-200 text-indigo-600 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Pilih foto baru
                      </button>
                      <input
                        id="admin-photo-uploader"
                        type="file"
                        onChange={handleAdminPhotoUpload}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {adminSaved && (
                <div className="bg-emerald-50 text-emerald-800 p-2.5 rounded-lg text-xs font-medium border border-emerald-150">
                  ✔ Profil administrator berhasil disimpan dan diperbarui pada bilah atas!
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  id="btn-save-admin-profile"
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Simpan Profil Admin
                </button>
              </div>

            </form>
          </div>

          {/* Card Form Ganti Password */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Key className="w-5 h-5 text-amber-500" /> Keamanan & Ubah Password Admin
            </h3>
            
            <p className="text-xs text-slate-500 mb-4">
              Silakan ubah password default login sistem administrator demi keamanan pangkalan data absensi. Password baru minimal harus terdiri dari 5 karakter.
            </p>

            <form onSubmit={handleSaveNewPassword} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Current Password */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Password Saat Ini</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      id="current-pwd-input"
                      type={showCurrentPass ? "text" : "password"}
                      required
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        setPasswordError("");
                        setPasswordSuccess("");
                      }}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl text-xs font-semibold focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Password Baru</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      id="new-pwd-input"
                      type={showNewPass ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordError("");
                        setPasswordSuccess("");
                      }}
                      placeholder="Minimal 5 karakter..."
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl text-xs font-semibold focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Konfirmasi Password Baru</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      id="confirm-pwd-input"
                      type={showNewPass ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordError("");
                        setPasswordSuccess("");
                      }}
                      placeholder="Ketik ulang password baru..."
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl text-xs font-semibold focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {passwordError && (
                <div className="bg-rose-50 text-rose-700 p-2.5 rounded-lg text-xs font-bold border border-rose-105 flex items-center gap-1.5 animate-pulse">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" /> {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="bg-emerald-50 text-emerald-800 p-2.5 rounded-lg text-xs font-bold border border-emerald-150 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" /> {passwordSuccess}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  id="btn-change-password-submit"
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Simpan Password Baru
                </button>
              </div>
            </form>
          </div>

          {/* Card QR Code Login Admin */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <QrCode className="w-5 h-5 text-emerald-600" /> 🔐 Lembar QR Code Akses Login Admin
            </h3>
            
            <p className="text-xs text-slate-500 mb-4">
              Unduh dan simpan QR Code akses otentikasi di bawah ini untuk digunakan pada tab <span className="font-extrabold text-indigo-600">Scan QR Admin</span> di layar login. Amankan lembaran gambar cetakan ini agar hanya Anda sebagai admin yang memegang QR Code ini.
            </p>

            <div className="flex flex-col md:flex-row gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-150 items-center">
              {/* QR Code Canvas container */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs flex items-center justify-center">
                <QRCodeCanvas 
                  id="admin-qr-canvas-element"
                  value={`ADMIN_KEY:${adminQrKey}`}
                  size={150}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* QR Details */}
              <div className="flex-1 space-y-3.5 text-center md:text-left w-full">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Token Otorisasi Aktif:</span>
                  <div className="bg-slate-200/60 px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold text-slate-700 mt-1 flex items-center justify-between gap-2 overflow-x-auto max-w-full">
                    <span>ADMIN_KEY:{adminQrKey}</span>
                  </div>
                </div>

                {qrTokenSuccess && (
                  <div className="bg-emerald-50 text-[10px] text-emerald-800 p-2 rounded-lg font-bold border border-emerald-150-fadeIn">
                    {qrTokenSuccess}
                  </div>
                )}

                <div className="flex flex-wrap gap-2.5 justify-center md:justify-start">
                  <button
                    id="btn-download-admin-qr"
                    type="button"
                    onClick={handleDownloadAdminQr}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Unduh QR Akses
                  </button>

                  <button
                    id="btn-regenerate-admin-qr"
                    type="button"
                    onClick={handleRegenerateQrToken}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-250 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-300"
                    title="Buat ulang token QR baru jika lembar QR lama hilang atau dicuri"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Buat Token Baru
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card Form Hari Libur */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Plus className="w-5 h-5 text-blue-600" /> 📅 Pengaturan Hari Libur Khusus (Rentang Tanggal)
            </h3>
            
            <p className="text-xs text-slate-500 mb-4">
              Atur hari libur nasional atau libur semester. Tanggal yang dimasukkan ke dalam rentang libur ini akan diwarnai merah pada Spreadsheet rekap dan alpa (TA) tidak akan dihitung.
            </p>

            <form onSubmit={handleAddHoliday} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end bg-slate-50 p-4 rounded-xl border border-slate-205 mb-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Dari Tanggal:</label>
                <input
                  id="holiday-range-start"
                  type="date"
                  value={holidayStart}
                  onChange={(e) => setHolidayStart(e.target.value)}
                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Sampai Tanggal:</label>
                <input
                  id="holiday-range-end"
                  type="date"
                  value={holidayEnd}
                  onChange={(e) => setHolidayEnd(e.target.value)}
                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Keterangan:</label>
                <input
                  id="holiday-range-desc"
                  type="text"
                  placeholder="Contoh: Libur Idul Fitri"
                  value={holidayDesc}
                  onChange={(e) => setHolidayDesc(e.target.value)}
                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                />
              </div>

              {holidayError && (
                <div className="col-span-1 sm:col-span-3 text-xs text-rose-600 bg-rose-50 p-2 rounded">
                  {holidayError}
                </div>
              )}

              <div className="col-span-1 sm:col-span-3 flex justify-end">
                <button
                  id="btn-add-holiday-range"
                  type="submit"
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Tambah Hari Libur
                </button>
              </div>
            </form>

            {/* List of active Holidays */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-600">Daftar Libur Khusus Terdaftar:</h4>
              {profile.holidayRanges.length === 0 ? (
                <div className="text-xs text-slate-400 py-4 bg-slate-50 text-center rounded-lg border border-dashed border-slate-200">
                  Tidak ada hari libur luar akhir pekan yang didaftarkan.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto border border-slate-150 rounded-xl bg-white">
                  {profile.holidayRanges.map((range) => (
                    <div key={range.id} className="p-3 flex items-center justify-between hover:bg-slate-50/60 transition-colors text-xs">
                      <div>
                        <span className="font-bold text-slate-800 block">{range.description}</span>
                        <span className="font-mono text-[10.5px] text-slate-500">
                          {range.startDate} s/d {range.endDate}
                        </span>
                      </div>
                      <button
                        id={`btn-del-holiday-${range.id}`}
                        type="button"
                        onClick={() => handleDeleteHoliday(range.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg cursor-pointer"
                        title="Hapus Rentang Libur"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECOND COLUMN: BRANDING (LOGO & BG) + INTEGRATION */}
        <div className="space-y-6">
          
          {/* Brand Visual settings */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Image className="w-5 h-5 text-blue-600" /> Logo & Wallpaper Aplikasi
            </h3>

            {/* Upload Logo Block */}
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">1. LOGO SEKOLAH (PNG/JPG)</span>
                <div className="flex items-center gap-4 border border-dashed border-slate-200 p-3 rounded-xl bg-slate-50/50">
                  
                  {/* Logo preview */}
                  <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                    {profile.logo ? (
                      <img src={profile.logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="text-[10px] text-slate-400 font-bold uppercase text-center leading-none">NO<br/>LOGO</div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <button
                      id="btn-upload-logo-trigger"
                      onClick={() => document.getElementById("logo-uploader-input")?.click()}
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Pilih Logo Baru
                    </button>
                    <input
                      id="logo-uploader-input"
                      type="file"
                      onChange={handleLogoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <p className="text-[10px] text-slate-400 leading-normal">Unggah logo transparan untuk header navigasi.</p>
                  </div>
                </div>
              </div>

              {/* App Background Color Setting */}
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">2. BACKGROUND LATAR APLIKASI</span>
                
                {/* Visual control select presets */}
                <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">
                  <button
                    id="btn-preset-default"
                    onClick={() => onUpdateAppBg("default", "", null)}
                    className={`py-2 px-3 border rounded-xl flex items-center justify-center gap-1.5 cursor-pointer ${
                      bgType === "default" ? "bg-blue-600 border-blue-600 text-white" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Clean White
                  </button>

                  <button
                    id="btn-preset-grad-slate"
                    onClick={() => onUpdateAppBg("color", "bg-gradient-to-tr from-slate-50 via-blue-50/20 to-slate-100/50", null)}
                    className={`py-2 px-3 border rounded-xl flex items-center justify-center gap-1.5 cursor-pointer ${
                      bgType === "color" && bgColor.includes("blue") ? "bg-blue-600 border-blue-600 text-white" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Gradasi Soft
                  </button>
                </div>

                {/* Upload wallpaper backgrounds */}
                <div className="border border-dashed border-slate-200 p-3 rounded-xl bg-slate-50/50 mt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500">Wallpaper Custom:</span>
                    {bgType === "custom" && (
                      <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 rounded font-extrabold uppercase">Aktif</span>
                    )}
                  </div>
                  
                  <button
                    id="btn-upload-bg-trigger"
                    onClick={() => document.getElementById("bg-uploader-input")?.click()}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors border border-slate-200 cursor-pointer"
                  >
                    <Image className="w-3.5 h-3.5" /> Upload File Wallpaper Image
                  </button>

                  <input
                    id="bg-uploader-input"
                    type="file"
                    onChange={handleBgImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <p className="text-[9.5px] text-slate-400 text-center leading-normal">Saran: Gunakan gambar beresolusi HD dengan kontras tipis / redup.</p>
                </div>
              </div>
            </div>
          </div>



          {/* Danger Zone */}
          {onClearAllRecords && (
            <div className="bg-rose-50/30 rounded-2xl shadow-sm border border-rose-100 p-6 space-y-4">
              <h3 className="text-md font-bold text-rose-800 flex items-center gap-2 border-b border-rose-100 pb-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" /> Zona Bahaya (Danger Zone)
              </h3>
              
              <p className="text-[11.5px] text-slate-500 leading-normal">
                Gunakan fitur di bawah ini dengan sangat hati-hati. Penghapusan seluruh data log absensi bersifat permanen di database lokal maupun cloud Firestore.
              </p>

              <div className="pt-2 border-t border-rose-100/60 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-slate-800">Kosongkan Semua Log Absensi</h4>
                  <p className="text-[10px] text-slate-400">Menghapus seluruh catatan rekap pemindaian QR harian untuk semua siswa secara keseluruhan.</p>
                </div>
                <button
                  id="btn-danger-clear-all-records"
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-4 h-4" /> Hapus Semua Data Absen
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* CONFIRM ALL RECORDS RESET POPUP */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all p-6 text-left">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-2 bg-rose-50 rounded-full">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-md font-bold text-slate-800">Hapus Semua Absensi?</h3>
            </div>
            
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Apakah Anda benar-benar yakin ingin menghapus <strong className="text-rose-600">SELURUH DATA ABSENSI</strong> siswa secara keseluruhan? Seluruh data riwayat rekap log masuk harian, status kehadiran, dan statistik kedisiplinan akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex justify-end gap-3">
              <button
                id="btn-cancel-clear-records-settings"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-150 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-confirm-clear-records-settings"
                onClick={() => {
                  onClearAllRecords?.();
                  setShowClearConfirm(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
