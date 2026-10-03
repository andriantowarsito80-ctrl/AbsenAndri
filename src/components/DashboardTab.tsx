/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { SchoolProfile, Student, AttendanceRecord } from "../types";
import { formatIndonesianDate, getDayName } from "../utils/dateUtils";
import {
  School,
  Clock,
  Calendar,
  Users,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Filter,
  Search,
  RotateCcw,
} from "lucide-react";

interface DashboardTabProps {
  profile: SchoolProfile;
  students: Student[];
  records: AttendanceRecord[];
  onUpdateProfile: (updated: Partial<SchoolProfile>) => void;
  onNavigateToTab: (index: number) => void;
}

export default function DashboardTab({
  profile,
  students,
  records,
  onUpdateProfile,
  onNavigateToTab,
}: DashboardTabProps) {
  const [time, setTime] = useState<Date>(new Date());
  
  // Helper to resolve today's string YYYY-MM-DD
  const getTodayStr = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = getTodayStr();

  // Highlighting selected date for Histogram
  const recordDates = Array.from(
    new Set(records.map((r) => r.waktuAbsensi.split(" ")[0]))
  );

  // Available dates include today and all recorded dates, sorted descending
  const availableDates = Array.from(
    new Set([todayStr, ...recordDates])
  ).sort((a, b) => b.localeCompare(a));

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>("");
  const [studentStatusFilter, setStudentStatusFilter] = useState<string>("all");

  // Update the digital clock every second & check day transition
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now);
      const currentToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      setSelectedDate((prevDate) => {
        // If date changed overnight, switch selectedDate to new today
        if (prevDate < currentToday && !records.some((r) => r.waktuAbsensi.startsWith(prevDate) && prevDate === currentToday)) {
          return currentToday;
        }
        return prevDate;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [records]);

  // Format time as HH:MM:SS
  const formatTime = (date: Date) => {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  };

  // Get active classes from current student database
  const classes = Array.from(new Set(students.map((s) => s.kelas))).filter(Boolean).sort();

  // Compute stats per class for the selectedDate
  const statsPerClass = classes.map((cls) => {
    const classStudents = students.filter((s) => s.kelas === cls);
    const totalSiswa = classStudents.length;

    // Filter attendance records on the selectedDate for this class
    const classRecords = records.filter(
      (r) => r.waktuAbsensi.startsWith(selectedDate) && r.kelas === cls
    );

    const hasClassRecords = classRecords.length > 0;
    const onTimeCount = classRecords.filter((r) => r.keterangan === "H").length;
    const lateCount = classRecords.filter((r) => r.keterangan === "DT").length;
    const absentCount = hasClassRecords ? Math.max(0, totalSiswa - (onTimeCount + lateCount)) : 0;

    return {
      kelas: cls,
      totalSiswa,
      onTime: onTimeCount,
      late: lateCount,
      absent: absentCount,
      presentPercent: (totalSiswa > 0 && hasClassRecords) ? Math.round(((onTimeCount + lateCount) / totalSiswa) * 100) : 0,
    };
  });

  // Calculate filtered students and attendance stats based on selectedClass
  const filteredStudents = selectedClass === "all"
    ? students
    : students.filter((s) => s.kelas === selectedClass);

  const totalSiswaActive = filteredStudents.length;

  const recordsOnSelectedDate = records.filter(
    (r) => r.waktuAbsensi.startsWith(selectedDate) &&
      (selectedClass === "all" || r.kelas === selectedClass)
  );

  const hasRecordsOnSelectedDate = recordsOnSelectedDate.length > 0;

  const totalOnTime = recordsOnSelectedDate.filter((r) => r.keterangan === "H").length;
  const totalLate = recordsOnSelectedDate.filter((r) => r.keterangan === "DT").length;
  // When no attendance has taken place on the selected date (e.g. pindah hari / belum ada absensi),
  // totalAbsent is set to 0 so all 3 cards (Tepat Waktu, Terlambat, Tidak Hadir) show 0.
  const totalAbsent = hasRecordsOnSelectedDate ? Math.max(0, totalSiswaActive - (totalOnTime + totalLate)) : 0;

  // Histogram cards to display
  const displayedStatsPerClass = selectedClass === "all"
    ? statsPerClass
    : statsPerClass.filter((cls) => cls.kelas === selectedClass);

  // List of students for the selected class breakdown
  const classStudentsForList = selectedClass !== "all"
    ? students.filter((s) => s.kelas === selectedClass)
    : [];

  const displayedClassStudents = classStudentsForList.filter((st) => {
    const q = studentSearchQuery.toLowerCase().trim();
    const matchesSearch = !q || st.nama.toLowerCase().includes(q) || st.nis.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (studentStatusFilter === "all") return true;

    const rec = records.find(
      (r) => r.nis === st.nis && r.waktuAbsensi.startsWith(selectedDate)
    );

    if (studentStatusFilter === "H") return rec?.keterangan === "H";
    if (studentStatusFilter === "DT") return rec?.keterangan === "DT";
    if (studentStatusFilter === "TA") return !rec || rec.keterangan === "A";
    if (studentStatusFilter === "S") return rec?.keterangan === "S";
    if (studentStatusFilter === "I") return rec?.keterangan === "I";
    return true;
  });

  return (
    <div className="space-y-6" id="dashboard-tab">
      {/* Top Welcome Panel */}
      <div className="flex flex-col lg:flex-row gap-6 p-1 border-b border-gray-100 pb-5">
        <div className="flex-1 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">
            <School className="w-3.5 h-3.5" />
            Portal Absensi Sekolah Terpadu
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">
            {profile.namaSekolah}
          </h1>
          <p className="text-slate-600 text-sm">
            NPSN: <span className="font-mono bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-medium">{profile.npsn}</span> | Status: <span className="font-semibold">{profile.status}</span> | Kepala Sekolah: <span className="font-semibold">{profile.namaKepalaSekolah}</span>
          </p>
        </div>

        {/* Filter Kelas, Semester & Tahun Pelajaran Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3 h-3 text-blue-600" /> Filter Kelas
            </label>
            <select
              id="top-class-filter-select"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-1.5 bg-blue-50/70 border border-blue-200 text-blue-700 font-bold rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
            >
              <option value="all">Semua Kelas ({classes.length})</option>
              {classes.map((cls) => (
                <option key={cls} value={cls}>Kelas {cls}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">Semester</label>
            <select
              id="semester-select"
              value={profile.semester}
              onChange={(e) => onUpdateProfile({ semester: e.target.value as "Ganjil" | "Genap" })}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">Tahun Pelajaran</label>
            <select
              id="tahun-ajaran-select"
              value={profile.tahunPelajaran}
              onChange={(e) => onUpdateProfile({ tahunPelajaran: e.target.value })}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none animate-none"
            >
              <option value="2025/2026">2025/2026</option>
              <option value="2026/2027">2026/2027</option>
              <option value="2027/2028">2027/2028</option>
            </select>
          </div>
        </div>
      </div>

      {/* Hero Widget Area (Big Clock & Jam Masuk Adjustment) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Large Digital Clock and Jam Masuk merged column */}
        <div id="clock-card" className="col-span-1 lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center relative overflow-hidden text-slate-800">
          <div className="absolute top-4 left-4 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold">
            WIB (Waktu Indonesia Barat)
          </div>
          <div className="absolute top-4 right-4 text-xs font-semibold text-slate-450 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-blue-550" />
            {formatIndonesianDate(time)}
          </div>

          <div className="text-[64px] md:text-[76px] font-mono font-bold tracking-tighter text-slate-800 leading-none select-none my-6">
            {formatTime(time)}
          </div>

          <div className="w-full mt-4 flex flex-col sm:flex-row items-center justify-center gap-4 py-3 px-6 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-xs font-bold text-slate-500 uppercase">Batasan Jam Masuk:</span>
            <div className="flex items-center gap-2">
              <input 
                type="time" 
                value={profile.jamMasuk} 
                onChange={(e) => onUpdateProfile({ jamMasuk: e.target.value })}
                className="bg-white border border-slate-300 rounded-md px-2 py-1 text-lg font-bold text-blue-600 shadow-inner outline-none focus:ring-1 focus:focus:ring-blue-500"
              />
              <span className="text-xs text-slate-400 font-medium">Setiap keterlambatan tercatat otomatis</span>
            </div>
          </div>
        </div>

        {/* Vertical stats stacking column */}
        <div className="col-span-1 lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 flex-1">
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xl shrink-0">
              ✅
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">Tepat Waktu</p>
                {selectedClass !== "all" && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                    Kelas {selectedClass}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-800">{totalOnTime} Siswa</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 flex-1">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xl shrink-0">
              ⏰
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">Terlambat</p>
                {selectedClass !== "all" && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                    Kelas {selectedClass}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-800">{totalLate} Siswa</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 flex-1">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xl shrink-0">
              ❌
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-tight font-sans">Tidak Hadir (TA)</p>
                {selectedClass !== "all" && (
                  <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">
                    Kelas {selectedClass}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-800">{totalAbsent} Siswa</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Interactive Reports Area */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-100 space-y-6">
        {/* Header and Filter Selectors for Histogram & Stats */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              📊 Histogram Grafik Kehadiran Siswa {selectedClass === "all" ? "Per Kelas" : `Kelas ${selectedClass}`}
            </h3>
            <p className="text-xs text-slate-500">
              {selectedClass === "all" 
                ? "Menampilkan rincian visual status kehadiran seluruh kelas berdasarkan tanggal pelaporan."
                : `Menampilkan rincian visual status kehadiran khusus siswa Kelas ${selectedClass}.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter Dropdown Kelas */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs shadow-2xs">
              <Filter className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="font-semibold text-slate-500">Pilih Kelas:</span>
              <select
                id="filter-kelas-dropdown"
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setStudentSearchQuery("");
                  setStudentStatusFilter("all");
                }}
                className="bg-transparent font-bold text-blue-700 focus:outline-none cursor-pointer"
              >
                <option value="all">Semua Kelas ({classes.length} Kelas)</option>
                {classes.map((cls) => {
                  const count = students.filter((s) => s.kelas === cls).length;
                  return (
                    <option key={cls} value={cls}>
                      Kelas {cls} ({count} Siswa)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Filter Dropdown Tanggal */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="font-semibold text-slate-500">Pilih Tanggal:</span>
              <select
                id="date-histogram-select"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                {availableDates.map((d) => (
                  <option key={d} value={d}>
                    {d === todayStr ? `🗓️ ${d} (Hari Ini - ${getDayName(d)})` : `📅 ${d} (${getDayName(d)})`}
                  </option>
                ))}
              </select>
            </div>

            {selectedClass !== "all" && (
              <button
                type="button"
                onClick={() => {
                  setSelectedClass("all");
                  setStudentSearchQuery("");
                  setStudentStatusFilter("all");
                }}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Tampilkan Semua Kelas"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* Global / Filtered Summary Stats Widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500 text-white shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-blue-500 block">
                {selectedClass === "all" ? "TOTAL SISWA TERDAFTAR" : `TOTAL SISWA KELAS ${selectedClass}`}
              </span>
              <span className="text-lg font-extrabold font-mono text-blue-950">{totalSiswaActive}</span>
              <span className="text-[10px] text-slate-500 block">
                {selectedClass === "all" ? "Siswa Aktif Seluruh Kelas" : `Siswa Aktif Kelas ${selectedClass}`}
              </span>
            </div>
          </div>
          
          <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500 text-white shadow-sm">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-emerald-600 block">TEPAT WAKTU (H)</span>
              <span className="text-lg font-extrabold font-mono text-emerald-950">{totalOnTime}</span>
              <span className="text-[10px] text-slate-500 block">
                {totalSiswaActive > 0 ? Math.round((totalOnTime / totalSiswaActive) * 100) : 0}% Hadir Lebih Awal
              </span>
            </div>
          </div>

          <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500 text-white shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-amber-600 block">TERLAMBAT (DT)</span>
              <span className="text-lg font-extrabold font-mono text-amber-950">{totalLate}</span>
              <span className="text-[10px] text-slate-500 block">
                {totalSiswaActive > 0 ? Math.round((totalLate / totalSiswaActive) * 100) : 0}% Diatas Jam Masuk
              </span>
            </div>
          </div>

          <div className="bg-rose-50/50 rounded-xl p-4 border border-rose-100 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-rose-500 text-white shadow-sm">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-rose-600 block">TIDAK BERABSEN (TA)</span>
              <span className="text-lg font-extrabold font-mono text-rose-950">{totalAbsent}</span>
              <span className="text-[10px] text-slate-500 block">
                {totalSiswaActive > 0 ? Math.round((totalAbsent / totalSiswaActive) * 100) : 0}% Tanpa Rekam
              </span>
            </div>
          </div>
        </div>

        {/* Custom Histogram Chart */}
        <div className="space-y-4 pt-4">
          {displayedStatsPerClass.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
              {selectedClass === "all"
                ? "Belum ada data siswa. Silakan tambahkan database siswa terlebih dahulu."
                : `Tidak ditemukan data untuk Kelas ${selectedClass}.`}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Legends & Filter Status Info */}
              <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-semibold">
                <div className="text-slate-600 font-bold">
                  {selectedClass === "all" ? (
                    <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs">
                      Menampilkan semua ({displayedStatsPerClass.length}) kelas
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full text-xs font-bold">
                        Filter Aktif: Kelas {selectedClass}
                      </span>
                      <button
                        onClick={() => setSelectedClass("all")}
                        className="text-xs text-blue-600 hover:underline cursor-pointer"
                      >
                        (Lihat semua kelas)
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 bg-emerald-500 rounded"></span>
                    <span className="text-slate-600">Hadir Tepat Waktu (H)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 bg-amber-500 rounded"></span>
                    <span className="text-slate-600">Mangkir Terlambat (DT)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 bg-rose-400 rounded"></span>
                    <span className="text-slate-600">Alpa / Belum Absen (TA)</span>
                  </div>
                </div>
              </div>

              {/* The Histogram bar items */}
              <div className={`grid grid-cols-1 ${selectedClass === "all" ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-1 max-w-xl"} gap-6`}>
                {displayedStatsPerClass.map((clsItem) => {
                  const maxVal = clsItem.totalSiswa || 1;
                  // Compute proportional pixel widths/heights
                  const onTimePercent = (clsItem.onTime / maxVal) * 100;
                  const latePercent = (clsItem.late / maxVal) * 100;
                  const absentPercent = (clsItem.absent / maxVal) * 100;

                  return (
                    <div 
                      key={clsItem.kelas} 
                      className={`border rounded-xl p-4 transition-all space-y-3 ${
                        selectedClass === clsItem.kelas
                          ? "border-blue-300 bg-blue-50/30 ring-2 ring-blue-500/20 shadow-sm"
                          : "border-slate-100 bg-slate-50/60 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm">Kelas {clsItem.kelas}</span>
                          {selectedClass === "all" && (
                            <button
                              type="button"
                              onClick={() => setSelectedClass(clsItem.kelas)}
                              className="text-[10px] text-blue-600 hover:text-blue-800 font-bold bg-blue-50 px-2 py-0.5 rounded cursor-pointer transition-colors"
                              title={`Filter hanya Kelas ${clsItem.kelas}`}
                            >
                              Pilih Kelas Ini →
                            </button>
                          )}
                        </div>
                        <span className="text-xs bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                          Total: {clsItem.totalSiswa} Siswa
                        </span>
                      </div>

                      {/* Cumulative bar layout */}
                      <div className="h-6 w-full rounded-lg bg-slate-200 overflow-hidden flex shadow-inner">
                        {clsItem.onTime > 0 && (
                          <div 
                            style={{ width: `${onTimePercent}%` }} 
                            title={`Tepat waktu: ${clsItem.onTime} siswa`}
                            className="bg-emerald-500 h-full flex items-center justify-center text-[10px] text-white font-bold transition-all"
                          >
                            {clsItem.onTime}
                          </div>
                        )}
                        {clsItem.late > 0 && (
                          <div 
                            style={{ width: `${latePercent}%` }} 
                            title={`Terlambat: ${clsItem.late} siswa`}
                            className="bg-amber-500 h-full flex items-center justify-center text-[10px] text-white font-bold transition-all"
                          >
                            {clsItem.late}
                          </div>
                        )}
                        {clsItem.absent > 0 && (
                          <div 
                            style={{ width: `${absentPercent}%` }} 
                            title={`Alpa: ${clsItem.absent} siswa`}
                            className="bg-rose-400 h-full flex items-center justify-center text-[10px] text-white font-bold transition-all"
                          >
                            {clsItem.absent}
                          </div>
                        )}
                      </div>

                      {/* Statistics indicators */}
                      <div className="grid grid-cols-3 text-center text-xs divide-x divide-slate-200 pt-1">
                        <div>
                          <span className="text-[10px] font-bold text-emerald-600 block">Tepat</span>
                          <span className="font-bold text-slate-700">{clsItem.onTime}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-amber-600 block">Telat</span>
                          <span className="font-bold text-slate-700">{clsItem.late}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-rose-500 block">Alpa</span>
                          <span className="font-bold text-slate-700">{clsItem.absent}</span>
                        </div>
                      </div>

                      {/* Attendence Percentage Indicator */}
                      <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-100 text-slate-500">
                        <span>Persentase Kehadiran</span>
                        <span className="font-bold text-slate-800">{clsItem.presentPercent}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detailed Breakdown Student Table when a class is selected */}
              {selectedClass !== "all" && (
                <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-200/80 space-y-4 mt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">
                          Daftar Presensi Siswa Kelas {selectedClass}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Tanggal {selectedDate} ({formatIndonesianDate(selectedDate)})
                        </p>
                      </div>
                      <span className="ml-2 text-[11px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                        {filteredStudents.length} Siswa
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Search student name / NIS */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Cari nama / NIS..."
                          value={studentSearchQuery}
                          onChange={(e) => setStudentSearchQuery(e.target.value)}
                          className="pl-7 pr-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-48 shadow-2xs"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                      </div>

                      {/* Filter Status */}
                      <select
                        value={studentStatusFilter}
                        onChange={(e) => setStudentStatusFilter(e.target.value)}
                        className="text-xs py-1.5 px-2 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none shadow-2xs"
                      >
                        <option value="all">Semua Status</option>
                        <option value="H">Tepat Waktu (H)</option>
                        <option value="DT">Terlambat (DT)</option>
                        <option value="S">Sakit (S)</option>
                        <option value="I">Izin (I)</option>
                        <option value="TA">Belum Absen (TA)</option>
                      </select>
                    </div>
                  </div>

                  {/* Student Table */}
                  <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">No</th>
                          <th className="py-2.5 px-3">NIS</th>
                          <th className="py-2.5 px-3">Nama Siswa</th>
                          <th className="py-2.5 px-3">Waktu Presensi</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {displayedClassStudents.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                              Tidak ada data siswa yang cocok dengan filter atau pencarian.
                            </td>
                          </tr>
                        ) : (
                          displayedClassStudents.map((st, idx) => {
                            const rec = records.find(
                              (r) => r.nis === st.nis && r.waktuAbsensi.startsWith(selectedDate)
                            );
                            const isPresent = rec?.keterangan === "H";
                            const isLate = rec?.keterangan === "DT";
                            const isSick = rec?.keterangan === "S";
                            const isPermit = rec?.keterangan === "I";
                            const isAlpha = rec?.keterangan === "A";

                            return (
                              <tr key={st.nis} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                                <td className="py-2.5 px-3 font-mono text-slate-600">{st.nis}</td>
                                <td className="py-2.5 px-3 font-semibold text-slate-800">{st.nama}</td>
                                <td className="py-2.5 px-3 font-mono text-slate-500">
                                  {rec ? rec.waktuAbsensi.split(" ")[1] || rec.waktuAbsensi : "-"}
                                </td>
                                <td className="py-2.5 px-3">
                                  {isPresent && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                      <CheckCircle className="w-3 h-3" /> Tepat Waktu
                                    </span>
                                  )}
                                  {isLate && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                                      <AlertTriangle className="w-3 h-3" /> Terlambat (+{rec.menitTerlambat}m)
                                    </span>
                                  )}
                                  {isSick && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                                      Sakit (S)
                                    </span>
                                  )}
                                  {isPermit && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                                      Izin (I)
                                    </span>
                                  )}
                                  {isAlpha && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                                      Alpa (A)
                                    </span>
                                  )}
                                  {!rec && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                                      <XCircle className="w-3 h-3 text-slate-400" /> Belum Absen (TA)
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
